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
  const result = z.toJSONSchema(s);
  delete result.$schema;
  return result;
};
const claim = schemas.claimSchema;
const login = z.strictObject({
  username: z.string().max(64),
  password: z.string().max(128),
});
const requests = {
  "/api/v2/devices/challenges": schemas.challengeSchema,
  "/api/v2/device-pairings": schemas.proofSchema,
  "/api/v2/device-pairings/{id}/confirm": z.strictObject({
    pairing_secret: schemas.secret,
  }),
  "/api/v2/device-pairings/{id}/desktop-confirm": schemas.proofSchema,
  "/api/v2/devices/authenticate": schemas.proofSchema,
  "/api/v2/devices/register": claim,
  "/api/v2/auth/claim": claim,
  "/api/v2/auth/login": login,
  "/api/v2/auth/password-reset/complete": z.strictObject({
    reset_grant: schemas.secret,
    password: schemas.password,
  }),
  "/api/v2/admin/auth/login": login.extend({
    mfa_code: z.string().regex(/^[0-9]{6}$/),
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
const responses = {
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
    admin = r.path.includes("/admin/") && !r.path.includes("/auth/"),
    customer =
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
  const successful = responses[r.path]
    ? json(responses[r.path])
    : {
        description: "See the Phase 2 API guide for this operation",
        type: "object",
      };
  const parameters = [...r.path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: json(name === "sku" ? schemas.sku : schemas.uuid),
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
            "Development-only paired claim response includes enrollment and a desktop bearer. Production browser integration must use a reviewed desktop-controlled pickup flow; see YARIZAN-PHASE-3-PROVISIONING-BOUNDARY.md. Both aliases enforce identical Origin, ownership and rate checks before password hashing.",
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
}
const spec = {
  openapi: "3.1.0",
  info: {
    title: "YariZan implemented Phase 2 backend API",
    version: "2.0.0",
    description:
      "Development backend only. Production gate closed. No payments or deployment.",
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
