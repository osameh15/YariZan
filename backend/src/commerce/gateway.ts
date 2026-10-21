import { Injectable } from "@nestjs/common";
import { Database } from "../database/database";
import { Security } from "../security/security";
import { requireCondition } from "../common/errors";
import { z } from "zod";

// Documented authorities are 36 characters ("A" + 35 alphanumerics); the range stays tolerant
// of length but never admits anything that could alter the StartPay URL path.
export const ZARINPAL_AUTHORITY = /^A[A-Za-z0-9]{32,40}$/;
// The official sandbox issues authorities that start with "S" instead of "A".
export const ZARINPAL_SANDBOX_AUTHORITY = /^S[A-Za-z0-9]{32,40}$/;
// The browser return route accepts exactly the authorities a provider environment can issue (fake test
// authority, production "A...", sandbox "S..."), strictly alphanumeric so nothing can alter a URL. The
// web return handler (apps/web/shared/payment-return.ts) must stay identical; a unit test compares them.
export const PAYMENT_RETURN_AUTHORITY =
  /^(?:FAKE-[0-9a-f-]{36}|[AS][A-Za-z0-9]{32,40})$/;
export type ZarinPalEnvironment = "production" | "sandbox";
const ZARINPAL_HOSTS: Record<ZarinPalEnvironment, string> = {
  production: "https://payment.zarinpal.com",
  sandbox: "https://sandbox.zarinpal.com",
};
export interface PaymentRequest {
  attempt_id: string;
  order_id: string;
  amount_irr: number;
  currency: "IRR";
  provider_config: string;
  authority: string | null;
}
export type PaymentResult = {
  state: "VERIFIED" | "FAILED" | "CANCELLED" | "UNKNOWN";
  authority?: string;
  reference?: string;
  amount_irr?: number;
  currency?: string;
  provider_config?: string;
  /** Provider code 101: the authority was already verified by an earlier call. */
  previously_verified?: boolean;
  /** The provider returned a parsed, documented answer (not a timeout or transport failure). */
  answered?: boolean;
};
export interface PaymentGateway {
  /** Identifies the provider contract stored on every payment attempt. */
  readonly providerConfig: string;
  create(
    request: PaymentRequest,
  ): Promise<{ authority: string; redirect_url: string }>;
  verify(request: PaymentRequest): Promise<PaymentResult>;
  query(request: PaymentRequest): Promise<PaymentResult>;
  /**
   * Whether a freshly created authority and redirect are exactly what this provider issues. The
   * caller refuses (and records an ambiguous creation) otherwise, so a malformed or foreign redirect
   * can never reach a customer. A provider without this check is refused.
   */
  acceptCreated(
    created: { authority: string; redirect_url: string },
    orderId: string,
  ): boolean;
}
export class FakeZarinPal implements PaymentGateway {
  readonly providerConfig = "fake-v1";
  constructor(private db: Database) {}
  acceptCreated(
    created: { authority: string; redirect_url: string },
    orderId: string,
  ) {
    return (
      /^FAKE-[0-9a-f-]{36}$/.test(created.authority) &&
      created.redirect_url === "/payment/simulate?order=" + orderId
    );
  }
  async create(r: PaymentRequest) {
    const authority = "FAKE-" + r.attempt_id;
    await this.db.query(
      "INSERT INTO fake_gateway_payments(attempt_id,authority,provider_ref,amount_irr,currency,merchant_config) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [
        r.attempt_id,
        authority,
        "SYNTHETIC-" + r.attempt_id,
        r.amount_irr,
        r.currency,
        r.provider_config,
      ],
    );
    return { authority, redirect_url: "/payment/simulate?order=" + r.order_id };
  }
  async query(r: PaymentRequest): Promise<PaymentResult> {
    const p = (
      await this.db.query(
        "SELECT * FROM fake_gateway_payments WHERE attempt_id=$1",
        [r.attempt_id],
      )
    ).rows[0];
    if (!p) return { state: "UNKNOWN" };
    return {
      state:
        p.outcome === "SUCCESS"
          ? "VERIFIED"
          : ["FAILED", "CANCELLED"].includes(p.outcome)
            ? p.outcome
            : "UNKNOWN",
      authority: p.authority,
      reference: p.provider_ref,
      amount_irr: Number(p.amount_irr),
      currency: p.currency,
      provider_config: p.merchant_config,
    };
  }
  verify(r: PaymentRequest) {
    return this.query(r);
  }
}

// Runtime selection never constructs this adapter. Only injected offline transports are
// authorized until merchant/currency/return-host acceptance and a separate gate review.
export class ZarinPalAdapter implements PaymentGateway {
  get providerConfig() {
    return this.environment === "sandbox"
      ? "zarinpal-sandbox-v1"
      : "zarinpal-v4";
  }
  constructor(
    private merchant: string,
    private callback: string,
    private transport: typeof fetch,
    private environment: ZarinPalEnvironment = "production",
  ) {
    z.uuid().parse(merchant);
    const u = new URL(callback);
    // The local sandbox may return to a loopback http URL; nothing else may be plain http.
    requireCondition(
      (u.protocol === "https:" ||
        (environment === "sandbox" &&
          u.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(u.hostname))) &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash,
      "GATEWAY_CONFIG_INVALID",
    );
  }
  private get host() {
    return ZARINPAL_HOSTS[this.environment];
  }
  acceptCreated(created: { authority: string; redirect_url: string }) {
    return (
      this.authorityPattern.test(created.authority) &&
      created.redirect_url === this.host + "/pg/StartPay/" + created.authority
    );
  }
  private get authorityPattern() {
    return this.environment === "sandbox"
      ? ZARINPAL_SANDBOX_AUTHORITY
      : ZARINPAL_AUTHORITY;
  }
  private async call(
    path: "request" | "verify" | "inquiry",
    body: Record<string, unknown>,
  ) {
    const response = await this.transport(
      this.host + "/pg/v4/payment/" + path + ".json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ merchant_id: this.merchant, ...body }),
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    requireCondition(response.ok && response.body, "GATEWAY_UNKNOWN", 503);
    const reader = response.body.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        requireCondition(bytes <= 16384, "GATEWAY_UNKNOWN", 503);
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      data?: {
        code?: number;
        authority?: string;
        ref_id?: string | number;
        status?: string;
      };
    };
  }
  async create(r: PaymentRequest) {
    requireCondition(
      r.currency === "IRR" &&
        Number.isSafeInteger(r.amount_irr) &&
        r.amount_irr >= 10000,
      "GATEWAY_CONFIG_INVALID",
    );
    const result = await this.call("request", {
      amount: r.amount_irr,
      currency: "IRR",
      description: "YariZan order " + r.order_id,
      callback_url: this.callback,
    });
    requireCondition(
      result.data?.code === 100 &&
        this.authorityPattern.test(result.data.authority ?? ""),
      "GATEWAY_UNKNOWN",
      503,
    );
    return {
      authority: result.data!.authority!,
      redirect_url: this.host + "/pg/StartPay/" + result.data!.authority,
    };
  }
  async verify(r: PaymentRequest): Promise<PaymentResult> {
    if (
      !r.authority ||
      !this.authorityPattern.test(r.authority) ||
      r.currency !== "IRR"
    )
      return { state: "UNKNOWN" };
    try {
      const result = await this.call("verify", {
        authority: r.authority,
        amount: r.amount_irr,
      });
      const code = result.data?.code;
      // Official contract: 100 = verified now, 101 = already verified earlier.
      const reference = /^[1-9][0-9]{0,30}$/.test(
        String(result.data?.ref_id ?? ""),
      );
      if ((code === 100 || code === 101) && reference)
        // The documented verify endpoint binds the supplied amount; it does not echo amount/currency.
        return {
          state: "VERIFIED",
          authority: r.authority,
          reference: String(result.data!.ref_id),
          amount_irr: r.amount_irr,
          currency: "IRR",
          provider_config: r.provider_config,
          previously_verified: code === 101,
          answered: true,
        };
      return { state: "UNKNOWN", answered: typeof code === "number" };
    } catch {
      return { state: "UNKNOWN" };
    }
  }
  // Authoritative status check = server-side verify. The inquiry endpoint's status vocabulary
  // is not mapped (recorded as an open item in the readiness matrix), so it is never consulted.
  query(r: PaymentRequest): Promise<PaymentResult> {
    return this.verify(r);
  }
}
@Injectable()
export class Gateway {
  readonly fake: FakeZarinPal;
  provider: PaymentGateway;
  constructor(
    db: Database,
    private security: Security,
  ) {
    this.fake = new FakeZarinPal(db);
    const c = security.config;
    // Only the explicit local sandbox mode ever builds the real adapter, and only for the
    // sandbox host. `zarinpal` (live) is refused at startup and never reaches this class.
    this.provider =
      c.COMMERCE_MODE === "zarinpal_sandbox"
        ? new ZarinPalAdapter(
            c.ZARINPAL_MERCHANT_ID!,
            c.ZARINPAL_CALLBACK_URL!,
            fetch,
            "sandbox",
          )
        : this.fake;
  }
  available() {
    requireCondition(
      ["fake", "zarinpal_sandbox"].includes(this.security.config.COMMERCE_MODE),
      "COMMERCE_UNAVAILABLE",
      503,
    );
  }
  /** The browser simulator exists only for the in-database fake provider. */
  get simulated() {
    return (
      this.security.config.COMMERCE_MODE === "fake" &&
      !(this.provider instanceof ZarinPalAdapter)
    );
  }
}
