import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import * as controllers from "../dist/src/api/controllers.js";
import * as schemas from "../dist/src/common/schemas.js";
import { artifactClaims, profiles } from "../dist/src/signing/signing.js";
import { PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants.js";
import { RequestMethod } from "@nestjs/common";

const routes = [];
for (const Type of Object.values(controllers)) {
  if (typeof Type !== "function" || !Type.prototype) continue;
  const prefix = Reflect.getMetadata(PATH_METADATA, Type);
  for (const name of Object.getOwnPropertyNames(Type.prototype)) {
    const member = Type.prototype[name];
    if (typeof member !== "function") continue;
    const method = Reflect.getMetadata(METHOD_METADATA, member),
      route = Reflect.getMetadata(PATH_METADATA, member);
    if (method === undefined || route === undefined) continue;
    routes.push({
      method: RequestMethod[method].toLowerCase(),
      path: ("/" + prefix + "/" + route)
        .replace(/\/+/g, "/")
        .replace(/:([a-z_]+)/g, "{$1}"),
    });
  }
}
assert.ok(!routes.some((r) => /heartbeat|authorize-game/.test(r.path)));
const json = (s) => {
  const result = z.toJSONSchema(s, { io: "input" });
  delete result.$schema;
  return result;
};
const claim = schemas.claimSchema;
const login = z.strictObject({
  username: z.string().max(64),
  password: z.string().max(128),
});
const commerce = await import("../dist/src/commerce/contracts.js");
const promotions = await import("../dist/src/commerce/promotions.js");
// Proof of work for public OTP requests (G5); required at runtime, optional in the schema so a
// missing proof gets its own error code.
const powProof = z
  .strictObject({
    challenge: z.string().min(1).max(400),
    counter: z.string().regex(/^[0-9]{1,15}$/),
  })
  .optional();
const requests = {
  "/api/v2/discounts/quote": commerce.quoteInput,
  "/api/v2/orders": commerce.orderInput,
  "/api/v2/orders/{id}/payments": commerce.paymentInput,
  "/api/v2/orders/{id}/simulate": commerce.simulationInput,
  "/api/v2/orders/{id}/refund-request": z.strictObject({
    reason: z.string().min(10).max(1000),
  }),
  "/api/v2/admin/commerce/campaigns": commerce.campaignInput,
  "/api/v2/admin/commerce/campaigns/{id}": commerce.campaignInput,
  "/api/v2/admin/commerce/coupons": commerce.codeInput,
  "/api/v2/admin/commerce/coupons/{id}": commerce.codeInput,
  "/api/v2/admin/commerce/refunds/{id}/review": schemas.mutationSchema.extend({
    state: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
  }),
  "/api/v2/devices/challenges": schemas.challengeSchema,
  "/api/v2/device-pairings": schemas.proofSchema,
  "/api/v2/device-pairings/{id}/confirm": z.strictObject({
    pairing_secret: schemas.secret,
    password: schemas.password.optional(),
    otp: schemas.otpProofSchema.optional(),
  }),
  "/api/v2/device-pairings/{id}/pickup": schemas.proofSchema,
  "/api/v2/device-pairings/{id}/preview": z.strictObject({
    pairing_secret: schemas.secret,
  }),
  "/api/v2/device-pairings/{id}/cancel": z.strictObject({
    pairing_secret: schemas.secret,
  }),
  "/api/v2/devices/authenticate": schemas.proofSchema,

  "/api/v2/auth/claim": claim,
  "/api/v2/auth/login": login,
  "/api/v2/auth/password-reset/complete": z.strictObject({
    reset_grant: schemas.secret,
    password: schemas.password,
  }),
  "/api/v2/admin/auth/login": login,
  "/api/v2/admin/auth/sms/verify": schemas.otpProofSchema,
  "/api/v2/auth/challenge": z.strictObject({
    purpose: z.enum(["LOGIN", "RESET", "CLAIM"]),
    mobile: schemas.mobile,
  }),
  "/api/v2/auth/claim/otp/request": z.strictObject({
    pairing_id: schemas.uuid,
    pairing_secret: schemas.secret,
    mobile: schemas.mobile,
    pow: powProof,
  }),
  "/api/v2/auth/otp/request": z.strictObject({
    username: z.string().min(1).max(64),
    mobile: schemas.mobile,
    purpose: z.enum(["LOGIN", "RESET"]),
    pow: powProof,
  }),
  "/api/v2/auth/otp/verify": schemas.otpProofSchema,
  "/api/v2/auth/password-reset/otp": schemas.otpProofSchema.extend({
    password: schemas.password,
  }),
  "/api/v2/account/security/otp": z.strictObject({
    purpose: z.enum(["PASSWORD", "MOBILE_OLD", "MOBILE_NEW"]),
    mobile: schemas.mobile.optional(),
    current: schemas.otpProofSchema.optional(),
    current_password: schemas.password.optional(),
  }),
  "/api/v2/account/security/password": schemas.otpProofSchema.extend({
    password: schemas.password,
  }),
  "/api/v2/account/security/mobile": schemas.otpProofSchema.extend({
    current: schemas.otpProofSchema.optional(),
  }),
  "/api/v2/admin/notes/{type}/{id}": z.strictObject({
    note: z.string().max(2000),
    expected_revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  }),
  "/api/v2/desktop/trials/{sku}/start": schemas.startSchema,
  "/api/v2/desktop/licenses/pickup": z.strictObject({ sku: schemas.sku }),
  "/api/v2/desktop/licenses/sync": z.strictObject({
    license_id: schemas.uuid,
    sku: schemas.sku,
  }),
  "/api/v2/desktop/activation-codes/redeem": schemas.redeemSchema,
  "/api/v2/admin/licenses/issue": schemas.mutationSchema.extend({
    device_id: schemas.uuid,
    sku: schemas.sku,
  }),
  "/api/v2/admin/activation-codes": schemas.mutationSchema.extend({
    device_id: schemas.uuid,
    sku: schemas.sku,
    expires_at: z.iso.datetime(),
  }),
  "/api/v2/admin/products/{sku}": schemas.mutationSchema.extend({
    price_irr: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    publication_status: z.enum(["published", "coming_soon", "hidden"]),
    sale_enabled: z.boolean(),
    trial_enabled: z.boolean(),
    activation_enabled: z.boolean(),
  }),
  "/api/v2/admin/products/{sku}/promotions": promotions.promotionCreate,
  "/api/v2/admin/promotions/{id}": promotions.promotionUpdate,
  "/api/v2/admin/promotions/{id}/deactivate": promotions.promotionDecision,
  "/api/v2/admin/promotions/{id}/restore": promotions.promotionDecision,
};
const envelope = (type) =>
  z.strictObject({
    algorithm: z.literal("ES256-P1363"),
    payload: artifactClaims[type].extend({
      format: z.literal(profiles[type].format),
      kid: z.string().min(1).max(128),
      issued_at: z.iso.datetime(),
    }),
    signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  });
const product = z.strictObject({
  sku: schemas.sku,
  grade: z.number().int().min(1).max(6),
  title_fa: z.string(),
  publication_status: z.enum(["published", "coming_soon", "hidden"]),
  sale_enabled: z.boolean(),
  trial_enabled: z.boolean(),
  activation_enabled: z.boolean(),
  revision: z.number().int(),
  price_irr: z.number().int().nonnegative(),
});
const receipt = z.strictObject({
  status: z.literal("APPROVED"),
  authenticated: z.literal(true),
  csrf_token: schemas.secret.optional(),
  username: z.string(),
  expires_at: z.iso.datetime(),
});
const metadata = z.record(z.string(), z.unknown());
const page = z.strictObject({
  items: z.array(metadata),
  next_offset: z.number().int().nullable(),
});
const otpReceipt = z.strictObject({
  challenge_id: schemas.uuid,
  expires_in: z.literal(180),
  retry_after: z.literal(60),
});
const promotionView = z.strictObject({
  id: schemas.uuid,
  sku: schemas.sku,
  original_price_irr: commerce.money,
  promo_price_irr: commerce.money,
  discount_percent: z.number().int().min(1).max(99),
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime(),
  state: z.enum(["ENABLED", "DISABLED"]),
  status: z.enum(["SCHEDULED", "ACTIVE", "EXPIRED", "DISABLED"]),
  revision: z.number().int().positive(),
  reason: z.string(),
  updated_by: schemas.uuid,
  updated_at: z.iso.datetime(),
});
const responses = {
  "/api/v2/admin/products/{sku}/promotions": z.union([
    promotionView,
    z.strictObject({
      promotions: z.array(promotionView),
      history: z.array(z.record(z.string(), z.unknown())),
    }),
  ]),
  "/api/v2/admin/promotions/{id}": promotionView,
  "/api/v2/admin/promotions/{id}/deactivate": promotionView,
  "/api/v2/admin/promotions/{id}/restore": promotionView,
  "/api/v2/commerce/capabilities": z.object({
    mode: z.enum(["disabled", "fake", "zarinpal_sandbox", "zarinpal"]),
    checkout_enabled: z.boolean(),
    real_payments_enabled: z.boolean(),
    sandbox: z.boolean(),
    test_price_irr: commerce.money.nullable(),
    currency: z.literal("IRR"),
    enabled_capabilities: z.array(
      z.enum([
        "PRODUCTION_CORE",
        "CUSTOMER_AUTH",
        "ADMIN_AUTH",
        "DESKTOP_PROVISIONING",
        "TRIALS_AND_LICENSES",
        "LIVE_COMMERCE",
      ]),
    ),
  }),
  "/api/v2/discounts/quote": commerce.quoteView,
  "/api/v2/orders": commerce.orderView,
  "/api/v2/orders/{id}": commerce.orderView,
  "/api/v2/account/orders": commerce.commercePage,
  "/api/v2/orders/{id}/payments": z.object({
    attempt_id: schemas.uuid,
    state: z.string(),
    redirect_url: z.string().nullable(),
    mode: z.literal("simulated"),
  }),
  "/api/v2/orders/{id}/simulate": z.object({
    order_id: schemas.uuid,
    status: z.literal("VERIFICATION_PENDING"),
  }),
  "/api/v2/payments/zarinpal/return": z.object({
    order_id: schemas.uuid,
    status: z.literal("VERIFICATION_PENDING"),
  }),
  "/api/v2/admin/commerce/{section}": z.record(z.string(), z.unknown()),
  "/api/v2/admin/payment-readiness": z.strictObject({
    real_payments_possible: z.boolean(),
    generated_at: z.iso.datetime(),
    production_payment_gate: z.strictObject({
      id: z.literal("ZARINPAL_LIVE_GATE"),
      open: z.boolean(),
    }),
    gates: z.array(
      z.strictObject({ id: z.string(), reason: z.string(), open: z.boolean() }),
    ),
    runtime: z.strictObject({
      node_env: z.enum(["development", "test", "production"]),
      commerce_mode: z.enum([
        "disabled",
        "fake",
        "zarinpal_sandbox",
        "zarinpal",
      ]),
      sandbox: z.boolean(),
    }),
    merchant_configuration: z.strictObject({
      merchant_id_present: z.boolean(),
      callback_url_present: z.boolean(),
      live_merchant_usable: z.literal(false),
    }),
    sandbox_evidence: z.strictObject({
      verified_payments: z.number().int(),
      unresolved_payments: z.number().int(),
      last_verified_at: z.iso.datetime().nullable(),
    }),
    health: z.strictObject({
      unknown_payments: z.number().int(),
      open_exceptions: z.number().int(),
      jobs_in_review: z.number().int(),
      overdue_jobs: z.number().int(),
      paid_unfulfilled: z.number().int(),
      oldest_unresolved_seconds: z.number().int().nullable(),
    }),
    catalog: z.array(
      z.strictObject({
        sku: z.string(),
        publication_status: z.string(),
        sale_enabled: z.boolean(),
        price_irr: z.string().nullable(),
      }),
    ),
    evidence: z.array(
      z.strictObject({
        id: z.string(),
        status: z.enum([
          "verified",
          "owner_confirmed",
          "partial",
          "blocked",
          "not_started",
        ]),
        evidence: z.string(),
        reference: z.string(),
      }),
    ),
  }),
  "/api/v2/admin/commerce/orders/{id}": commerce.orderView.extend({
    transitions: z.array(z.record(z.string(), z.unknown())),
    reconciliation: z.array(z.record(z.string(), z.unknown())),
    inquiries: z.array(z.record(z.string(), z.unknown())),
  }),

  "/api/v2/admin/auth/login": otpReceipt,
  "/api/v2/auth/challenge": z.strictObject({
    challenge: z.string(),
    bits: z.number().int(),
    expires_in: z.number().int(),
  }),
  "/api/v2/auth/claim/otp/request": otpReceipt,
  "/api/v2/auth/otp/request": otpReceipt,
  "/api/v2/account/security/otp": otpReceipt,
  "/api/v2/admin/auth/sms/verify": z.strictObject({
    csrf_token: schemas.secret,
  }),
  "/api/v2/auth/otp/verify": z.strictObject({ csrf_token: schemas.secret }),
  "/api/v2/auth/password-reset/otp": z.strictObject({
    password_changed: z.literal(true),
  }),
  "/api/v2/account/security": z.strictObject({
    has_password: z.boolean(),
    mobile_masked: z.string().nullable(),
    mobile_verified: z.boolean(),
  }),
  "/api/v2/account/security/password": z.strictObject({
    changed: z.literal(true),
    reauthentication_required: z.literal(true),
  }),
  "/api/v2/account/security/mobile": z.strictObject({
    changed: z.literal(true),
    reauthentication_required: z.literal(true),
  }),
  "/api/v2/admin/notes/{type}/{id}": z.strictObject({
    note: z.string(),
    revision: z.number().int().positive(),
  }),
  "/api/v2/admin/activation-codes": z.union([
    z.strictObject({
      code_id: schemas.uuid,
      activation_code: z
        .string()
        .regex(/^YZ2-(?:[0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/),
    }),
    z.strictObject({
      code_id: schemas.uuid,
      secret_already_delivered: z.literal(true),
    }),
  ]),
  "/api/v2/admin/customers/{id}/password-reset": z.union([
    z.strictObject({ reset_grant: schemas.secret }),
    z.strictObject({ secret_already_delivered: z.literal(true) }),
  ]),

  "/api/v2/account/devices": z.array(
    z.strictObject({
      id: schemas.uuid,
      status: z.string(),
      created_at: z.iso.datetime(),
    }),
  ),
  "/api/v2/account/licenses": z.array(
    z.strictObject({
      id: schemas.uuid,
      sku: schemas.sku,
      state: z.string(),
      decision_version: z.string(),
    }),
  ),
  "/api/v2/account/entitlements": z.array(
    z.strictObject({
      id: schemas.uuid,
      sku: schemas.sku,
      state: z.string(),
      created_at: z.iso.datetime(),
    }),
  ),
  "/api/v2/admin/audit": z.array(metadata),
  ...Object.fromEntries(
    [
      "products",
      "customers",
      "devices",
      "licenses",
      "trials",
      "activation-codes",
    ].map((name) => ["/api/v2/admin/" + name, page]),
  ),

  "/api/v2/products": z.array(product),
  "/api/v2/products/{sku}": product,
  "/api/v2/auth/claim": receipt,
  "/api/v2/device-pairings/{id}/confirm": receipt,
  "/api/v2/device-pairings/{id}/preview": z.strictObject({
    username: z.string(),
    requires_owner: z.boolean(),
    status: z.literal("PENDING"),
    expires_at: z.iso.datetime(),
  }),
  "/api/v2/device-pairings/{id}/cancel": z.strictObject({
    status: z.literal("CANCELLED"),
  }),
  "/api/v2/device-pairings/{id}/pickup": z.union([
    z.strictObject({ status: z.literal("PENDING") }),
    z.strictObject({
      status: z.literal("ENROLLED"),
      device_id: schemas.uuid,
      customer_id: schemas.uuid,
      username: z.string(),
      enrollment: envelope("enrollment"),
      credential: schemas.secret,
    }),
  ]),
  "/api/v2/account": z.strictObject({
    id: schemas.uuid,
    username: z.string(),
    device_id: schemas.uuid,
    generation: z.number().int(),
  }),
  "/api/v2/admin/auth/session": z.strictObject({
    id: schemas.uuid,
    permissions: z.array(z.string()),
  }),

  "/api/v2/desktop/trials/{sku}/status": z.strictObject({
    remaining: z.number().int().min(0).max(2),
  }),
  "/api/v2/desktop/trials/{sku}/start": z.strictObject({
    grant: envelope("trial"),
    remaining: z.number().int().min(0).max(1),
    server_time: z.iso.datetime(),
  }),
  "/api/v2/desktop/licenses/pickup": envelope("license"),
  "/api/v2/desktop/licenses/sync": envelope("decision"),
  "/api/v2/desktop/activation-codes/redeem": envelope("license"),
};
const paths = {};
for (const r of routes.sort(
  (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
)) {
  const desktop = r.path.includes("/desktop/"),
    admin =
      r.path.includes("/admin/") &&
      !/\/auth\/(?:login|sms\/verify)$/.test(r.path),
    customer =
      r.path.startsWith("/api/v2/orders") ||
      r.path === "/api/v2/discounts/quote" ||
      r.path.startsWith("/api/v2/account") ||
      ["/api/v2/auth/logout", "/api/v2/auth/session/rotate"].includes(r.path);
  const security = desktop
    ? [{ DeviceBearer: [] }]
    : admin
      ? [{ AdminCookie: [] }]
      : customer
        ? [{ CustomerCookie: [] }]
        : [];
  const mutation =
    ["post", "patch"].includes(r.method) &&
    admin &&
    !r.path.endsWith("/logout");
  const body =
    requests[r.path] ?? (mutation ? schemas.mutationSchema : undefined);
  const successful =
    r.path === "/api/v2/orders" && r.method === "get"
      ? json(commerce.commercePage)
      : responses[r.path]
        ? json(responses[r.path])
        : {
            description: "See the Phase 2 API guide for this operation",
            type: "object",
          };
  const parameters = [...r.path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: json(
      name === "section"
        ? z.enum([
            "orders",
            "payments",
            "campaigns",
            "coupons",
            "jobs",
            "exceptions",
            "reservations",
            "redemptions",
            "finance",
            "refunds",
          ])
        : name === "type"
          ? z.enum([
              "customers",
              "devices",
              "licenses",
              "activation-codes",
              "trials",
              "products",
              "orders",
              "payments",
              "campaigns",
              "coupons",
            ])
          : name === "id" && r.path.includes("/notes/")
            ? z.string().min(1).max(128)
            : name === "sku"
              ? schemas.sku
              : schemas.uuid,
    ),
  }));
  if (admin || (customer && r.method !== "get"))
    parameters.push({
      name: "X-CSRF-Token",
      in: "header",
      required: true,
      schema: { type: "string" },
    });
  const error = {
    description: "Structured error; no secrets or request bodies echoed",
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  };
  paths[r.path] ??= {};
  paths[r.path][r.method] = {
    operationId: r.method + "_" + r.path.replace(/[^a-zA-Z0-9]/g, "_"),
    summary: r.method.toUpperCase() + " " + r.path,
    ...(["/api/v2/auth/claim", "/api/v2/devices/register"].includes(r.path)
      ? {
          description:
            "Browser authorization returns a public receipt only. No device credential, signed enrollment or desktop claim grant is returned. Fresh pairing-bound device-key proof is mandatory at the separate desktop pickup endpoint. Legacy register/desktop-confirm endpoints are retired (410). Commercial startup remains closed.",
        }
      : r.path === "/api/v2/desktop/trials/{sku}/start"
        ? {
            description:
              "Exactly two starts per machine, grade, account generation and authorized allocation epoch. Identical current-epoch retries return the stored result. A nonce retired by Admin trial reset returns HTTP 409 TRIAL_ALLOCATION_CHANGED without consuming the new quota. Already-started processes continue offline indefinitely.",
          }
        : {}),
    security,
    parameters,
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: json(body) } },
          },
        }
      : {}),
    responses: {
      [r.method === "post" ? 201 : 200]: {
        description: "Successful operation",
        content: { "application/json": { schema: successful } },
      },
      400: error,
      401: error,
      403: error,
      404: error,
      409: error,
      410: error,
      429: error,
      503: error,
    },
  };
  if (
    [
      "/api/v2/devices/register",
      "/api/v2/device-pairings/{id}/desktop-confirm",
    ].includes(r.path)
  ) {
    paths[r.path][r.method].deprecated = true;
    paths[r.path][r.method].description =
      "Retired Phase 2 development protocol. Always returns 410 PROTOCOL_RETIRED; cannot issue credentials or enroll a profile.";
    paths[r.path][r.method].responses = { 410: error };
    delete paths[r.path][r.method].requestBody;
  }
}
const spec = {
  openapi: "3.1.0",
  info: {
    title: "YariZan implemented V2 backend API",
    version: "2.0.0",
    description:
      "Synthetic commerce and licensing development API. Production, live payments and deployment gates closed.",
    license: {
      name: "Proprietary",
      url: "https://github.com/osameh15/YariZan/blob/main/LICENSE.txt",
    },
  },
  servers: [
    {
      url: "/",
      description: "Isolated local development only",
    },
  ],
  paths,
  components: {
    securitySchemes: {
      DeviceBearer: { type: "http", scheme: "bearer" },
      CustomerCookie: { type: "apiKey", in: "cookie", name: "yz_customer" },
      AdminCookie: { type: "apiKey", in: "cookie", name: "yz_admin" },
    },
    schemas: {
      Error: json(
        z.strictObject({
          error: z.strictObject({ code: z.string(), request_id: schemas.uuid }),
        }),
      ),
    },
  },
};
const target = "../docs/YARIZAN-OPENAPI-BACKEND-V2.json",
  serialized = JSON.stringify(spec, null, 2) + "\n";
if (process.argv.includes("--write")) writeFileSync(target, serialized);
else
  assert.equal(
    readFileSync(target, "utf8").replace(/\r\n/g, "\n"),
    serialized,
    "Implemented OpenAPI snapshot drift; build then regenerate/review",
  );
// Existing desktop routes and request fields must match the production .NET client.
const source = readFileSync(
  "../src/YariZan.Core/V2/DesktopV2Client.cs",
  "utf8",
);
for (const route of [
  "desktop/licenses/pickup",
  "desktop/licenses/sync",
  "desktop/activation-codes/redeem",
])
  assert.ok(source.includes(route));
for (const field of [
  "device_id",
  "client_nonce",
  "client_process_session_id",
  "sku",
  "license_id",
  "activation_code",
  "request_id",
])
  assert.ok(source.includes(field));
console.log(
  `Implemented API snapshot verified: ${routes.length} controller routes; five desktop response profiles`,
);
