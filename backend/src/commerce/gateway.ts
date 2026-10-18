import { Injectable } from "@nestjs/common";
import { Database } from "../database/database";
import { Security } from "../security/security";
import { requireCondition } from "../common/errors";
import { z } from "zod";

// Documented authorities are 36 characters ("A" + 35 alphanumerics); the range stays tolerant
// of length but never admits anything that could alter the StartPay URL path.
export const ZARINPAL_AUTHORITY = /^A[A-Za-z0-9]{32,40}$/;
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
};
export interface PaymentGateway {
  create(
    request: PaymentRequest,
  ): Promise<{ authority: string; redirect_url: string }>;
  verify(request: PaymentRequest): Promise<PaymentResult>;
  query(request: PaymentRequest): Promise<PaymentResult>;
}
export class FakeZarinPal implements PaymentGateway {
  constructor(private db: Database) {}
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
  constructor(
    private merchant: string,
    private callback: string,
    private transport: typeof fetch,
  ) {
    z.uuid().parse(merchant);
    const u = new URL(callback);
    requireCondition(
      u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash,
      "GATEWAY_CONFIG_INVALID",
    );
  }
  private async call(
    path: "request" | "verify" | "inquiry",
    body: Record<string, unknown>,
  ) {
    const response = await this.transport(
      "https://payment.zarinpal.com/pg/v4/payment/" + path + ".json",
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
        ZARINPAL_AUTHORITY.test(result.data.authority ?? ""),
      "GATEWAY_UNKNOWN",
      503,
    );
    return {
      authority: result.data!.authority!,
      redirect_url:
        "https://payment.zarinpal.com/pg/StartPay/" + result.data!.authority,
    };
  }
  async verify(r: PaymentRequest): Promise<PaymentResult> {
    if (
      !r.authority ||
      !ZARINPAL_AUTHORITY.test(r.authority) ||
      r.currency !== "IRR"
    )
      return { state: "UNKNOWN" };
    try {
      const result = await this.call("verify", {
        authority: r.authority,
        amount: r.amount_irr,
      });
      if (
        ![100, 101].includes(result.data?.code ?? 0) ||
        !/^[1-9][0-9]{0,30}$/.test(String(result.data?.ref_id ?? ""))
      )
        return { state: "UNKNOWN" };
      // The documented verify endpoint binds the supplied amount; it does not echo amount/currency.
      return {
        state: "VERIFIED",
        authority: r.authority,
        reference: String(result.data!.ref_id),
        amount_irr: r.amount_irr,
        currency: "IRR",
        provider_config: r.provider_config,
      };
    } catch {
      return { state: "UNKNOWN" };
    }
  }
  async query(r: PaymentRequest): Promise<PaymentResult> {
    if (!r.authority) return { state: "UNKNOWN" };
    try {
      await this.call("inquiry", { authority: r.authority });
    } catch {
      return { state: "UNKNOWN" };
    }
    // Inquiry status vocabulary/terminal failure semantics require merchant acceptance.
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
    this.provider = this.fake;
  }
  available() {
    requireCondition(
      this.security.config.COMMERCE_MODE === "fake",
      "COMMERCE_UNAVAILABLE",
      503,
    );
  }
}
