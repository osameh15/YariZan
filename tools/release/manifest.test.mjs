import { test } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "./manifest.mjs";

const sha = "a".repeat(40);
const d = (c) => "sha256:" + c.repeat(64);
const valid = () => ({
  schema: "yarizan-release-manifest/v1",
  release_scope: "stage-a-brochure",
  source_commit: sha,
  ci_run_url: "https://github.com/osameh15/YariZan/actions/runs/123",
  built_at: "2026-10-16T12:00:00Z",
  migrations: 9,
  environment_changes: ["YARIZAN_SITE_MODE (web, required)"],
  route_changes: [],
  images: [
    {
      name: "yarizan-web",
      profile: "brochure",
      tag: "brochure-" + sha.slice(0, 12),
      digest: d("1"),
      reference: "ghcr.io/osameh15/yarizan-web@" + d("1"),
      eligibility: "stage-a-brochure-candidate",
      scan: {
        tool: "trivy",
        policy: "stage-a-zero-high-critical",
        artifact_digest: d("1"),
        critical: 0,
        high: 0,
      },
    },
  ],
});
const api = () => ({
  name: "yarizan-api",
  tag: sha.slice(0, 12),
  digest: d("2"),
  reference: "ghcr.io/osameh15/yarizan-api@" + d("2"),
  eligibility: "full-stack-candidate",
  scan: { tool: "trivy", critical: 0, high: 0 },
});
const fullWeb = () => ({
  name: "yarizan-web",
  profile: "full",
  tag: "full-" + sha.slice(0, 12),
  digest: d("4"),
  reference: "ghcr.io/osameh15/yarizan-web@" + d("4"),
  eligibility: "full-stack-candidate",
  scan: { tool: "trivy", critical: 0, high: 0 },
});
const rehearsal = () => {
  const m = valid();
  m.release_scope = "local-rehearsal";
  m.ci_run_url = "local-rehearsal";
  m.images.push(api());
  for (const image of m.images)
    image.reference = image.reference.replace(
      "ghcr.io/osameh15/",
      "localhost:5000/",
    );
  return m;
};
const opts = { expectedMigrations: 9 };

test("accepts a complete digest-pinned manifest", () => {
  assert.deepEqual(validateManifest(valid(), opts), []);
});
test("rejects mutable tags, malformed or mismatched digests", () => {
  for (const reference of [
    "ghcr.io/osameh15/yarizan-web:latest",
    "ghcr.io/osameh15/yarizan-web:brochure-aaaaaaaaaaaa",
    "ghcr.io/osameh15/yarizan-web@" + d("3"),
    "docker.io/osameh15/yarizan-web@" + d("1"),
    "localhost:5000/yarizan-web@" + d("1"),
  ]) {
    const m = valid();
    m.images[0].reference = reference;
    assert.ok(
      validateManifest(m, opts).some((e) => e.includes("reference")),
      reference,
    );
  }
  const m = valid();
  m.images[0].digest = "sha256:1234";
  assert.ok(validateManifest(m, opts).some((e) => e.includes("digest")));
});
test("rejects wrong migration count, short commit and missing evidence", () => {
  const m = valid();
  m.migrations = 8;
  m.source_commit = "abc1234";
  m.ci_run_url = "https://example.com/run";
  delete m.images[0].scan;
  const errors = validateManifest(m, opts);
  for (const field of ["migrations", "source_commit", "ci_run_url", "scan"])
    assert.ok(
      errors.some((e) => e.includes(field)),
      field,
    );
});
test("full application images are only full-stack candidates", () => {
  const m = rehearsal();
  m.images[1].eligibility = "stage-a-brochure-candidate";
  const local = { ...opts, allowLocalRegistry: true };
  assert.ok(
    validateManifest(m, local).some((e) => e.includes("full-stack-candidate")),
  );
  const w = valid();
  w.images[0].profile = "full";
  assert.ok(validateManifest(w, opts).some((e) => e.includes("eligibility")));
});
test("a Stage A release carries only the brochure web image", () => {
  for (const extra of [api(), fullWeb()]) {
    const m = valid();
    m.images.push(extra);
    assert.ok(
      validateManifest(m, opts).some((e) =>
        e.includes("stage-a-brochure must contain exactly"),
      ),
      extra.name + (extra.profile ?? ""),
    );
  }
  const m = valid();
  m.images = [api()];
  assert.ok(
    validateManifest(m, opts).some((e) => e.includes("must contain exactly")),
  );
});
test("no published scope exists for Stage B images", () => {
  for (const scope of [
    undefined,
    "stage-b",
    "stage-b-full",
    "local-rehearsal",
    "all",
  ]) {
    const m = valid();
    m.release_scope = scope;
    m.images.push(api(), fullWeb());
    assert.ok(
      validateManifest(m, opts).some((e) => e.includes("release_scope")),
      String(scope),
    );
  }
});
test("local rehearsal scope and registry are accepted only when explicitly allowed", () => {
  const m = rehearsal();
  assert.ok(validateManifest(m, opts).length > 0);
  assert.deepEqual(
    validateManifest(m, { ...opts, allowLocalRegistry: true }),
    [],
  );
});
test("a Stage A image with HIGH or CRITICAL findings or missing policy evidence is not eligible", () => {
  for (const change of [
    (s) => (s.high = 1),
    (s) => (s.critical = 1),
    (s) => delete s.policy,
    (s) => (s.policy = "ignore-unfixed"),
    (s) => (s.artifact_digest = d("9")),
  ]) {
    const m = valid();
    change(m.images[0].scan);
    assert.ok(
      validateManifest(m, opts).some((e) =>
        e.includes("zero HIGH and CRITICAL"),
      ),
    );
  }
});

const storefront = () => {
  const m = valid();
  m.release_scope = "public-storefront";
  Object.assign(m.images[0], {
    profile: "storefront",
    tag: "storefront-" + sha.slice(0, 12),
    eligibility: "public-storefront-candidate",
  });
  return m;
};
test("a public storefront release carries only the storefront image with passing scan evidence", () => {
  assert.deepEqual(validateManifest(storefront(), opts), []);
  const wrongImage = storefront();
  wrongImage.images[0].profile = "brochure";
  assert.ok(validateManifest(wrongImage, opts).length > 0);
  const extra = storefront();
  extra.images.push(api());
  assert.ok(
    validateManifest(extra, opts).some((e) =>
      e.includes("must contain exactly"),
    ),
  );
  const eligibilityMix = storefront();
  eligibilityMix.images[0].eligibility = "stage-a-brochure-candidate";
  assert.ok(
    validateManifest(eligibilityMix, opts).some((e) =>
      e.includes("eligibility"),
    ),
  );
  for (const change of [
    (s) => (s.high = 2),
    (s) => (s.critical = 1),
    (s) => delete s.policy,
  ]) {
    const m = storefront();
    change(m.images[0].scan);
    assert.ok(
      validateManifest(m, opts).some((e) =>
        e.includes("zero HIGH and CRITICAL"),
      ),
    );
  }
});
test("Stage A and storefront scopes cannot carry each other image", () => {
  const m = valid();
  Object.assign(m.images[0], {
    profile: "storefront",
    tag: "storefront-" + sha.slice(0, 12),
    eligibility: "public-storefront-candidate",
  });
  assert.ok(
    validateManifest(m, opts).some((e) =>
      e.includes("stage-a-brochure must contain exactly"),
    ),
  );
});

const fullStack = () => {
  const m = valid();
  m.release_scope = "full-stack";
  const scan = (digest) => ({
    tool: "trivy",
    policy: "stage-a-zero-high-critical",
    artifact_digest: digest,
    critical: 0,
    high: 0,
  });
  m.images = [
    { ...api(), scan: scan(d("2")) },
    { ...fullWeb(), scan: scan(d("4")) },
  ];
  m.capabilities = {
    approved: ["PRODUCTION_CORE"],
    closed_gates: ["G8_SECRET_CUSTODY"],
  };
  m.required_secrets = [
    "CODE_HMAC_KEY",
    "TOKEN_HMAC_KEY",
    "MFA_ENCRYPTION_KEY",
  ];
  return m;
};
test("a full-stack release carries the API and full web images, capabilities and secret names", () => {
  assert.deepEqual(validateManifest(fullStack(), opts), []);
  const missing = fullStack();
  missing.images.pop();
  assert.ok(
    validateManifest(missing, opts).some((e) =>
      e.includes("must contain exactly"),
    ),
  );
  const brochure = fullStack();
  brochure.images.push(valid().images[0]);
  assert.ok(
    validateManifest(brochure, opts).some((e) =>
      e.includes("must contain exactly"),
    ),
  );
  const scan = fullStack();
  scan.images[0].scan.high = 1;
  assert.ok(validateManifest(scan, opts).some((e) => e.includes("scan")));
});
test("a full-stack manifest never carries secret values or unapproved real money", () => {
  for (const secrets of [
    [],
    ["CODE_HMAC_KEY=abcdef"],
    ["code_hmac_key"],
    "CODE_HMAC_KEY",
    undefined,
  ]) {
    const m = fullStack();
    m.required_secrets = secrets;
    assert.ok(
      validateManifest(m, opts).some((e) => e.includes("required_secrets")),
      String(secrets),
    );
  }
  for (const approved of [
    [],
    ["CUSTOMER_AUTH"],
    ["PRODUCTION_CORE", "ROOT"],
    ["PRODUCTION_CORE", "LIVE_COMMERCE"],
  ]) {
    const m = fullStack();
    m.capabilities.approved = approved;
    assert.ok(
      validateManifest(m, opts).some((e) => e.includes("capabilities")),
      approved.join(),
    );
  }
  const storefront = valid();
  storefront.required_secrets = ["CODE_HMAC_KEY"];
  assert.ok(
    validateManifest(storefront, opts).some((e) =>
      e.includes("full-stack scope only"),
    ),
  );
});
