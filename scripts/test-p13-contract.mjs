import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CROSS_HUB_BATCH_LIMIT,
  HANDOFF_SAFE_HEADERS,
  allowedOrigin,
  assertBatchSize,
  assertServiceIdentity,
  buildHandoffUrl,
  generateOpaqueSecret,
  guestContinuation,
  hashOpaqueSecret,
  normalizeReturnPath,
  redactHandoffUrl,
  validateCsrf,
} from "../lib/my-trusthub/cross-hub-security.mjs";

const registry = JSON.parse(readFileSync(new URL("../lib/my-trusthub/hub-registry.json", import.meta.url), "utf8"));
const expectError = (fn, code) => assert.throws(fn, (error) => error instanceof Error && error.message === code);

assert.equal(registry.version, "mytrusthub-hubs/v1");
assert.equal(registry.hubs.length, 7);
assert.equal(new Set(registry.hubs.map((hub) => hub.key)).size, 7);
assert.equal(CROSS_HUB_BATCH_LIMIT, 50);

for (const hub of registry.hubs) {
  assert.equal(allowedOrigin(hub.key, hub.productionOrigins[0], "production"), true, hub.key);
  assert.equal(assertServiceIdentity({ hub: hub.key, serviceIdentity: hub.serviceIdentity, requiredScope: "entity:read" }).key, hub.key);
  assert.ok(hub.productionOrigins.every((origin) => origin.startsWith("https://")));
  assert.ok(hub.developmentOrigins.every((origin) => origin.startsWith("http://localhost:")));
}

assert.equal(allowedOrigin("move", "https://evil.example", "production"), false);
assert.equal(allowedOrigin("move", "https://www.movetrusthub.com@evil.example", "production"), false);
assert.equal(allowedOrigin("move", "http://localhost:3001", "production"), false);
assert.equal(allowedOrigin("move", "http://localhost:3001", "development"), true);

assert.equal(normalizeReturnPath("move", "/companies/example?source=my"), "/companies/example?source=my");
for (const unsafe of [
  "javascript:alert(1)",
  "data:text/html,broken",
  "//evil.example/path",
  "/companies\\evil",
  "/companies/%252f%252fevil.example",
  "/companies?next=https://evil.example",
  "/unregistered/path",
]) expectError(() => normalizeReturnPath("move", unsafe), "RETURN_NOT_ALLOWED");

const code = generateOpaqueSecret();
assert.equal(Buffer.from(code, "base64url").length, 32);
assert.match(hashOpaqueSecret(code), /^[a-f0-9]{64}$/);
const handoffUrl = buildHandoffUrl({ hub: "move", origin: "https://www.movetrusthub.com", code });
assert.equal(new URL(handoffUrl).searchParams.get("code"), code);
assert.equal(new URL(handoffUrl).searchParams.has("state"), false);
assert.equal(new URL(handoffUrl).searchParams.has("nonce"), false);
assert.ok(!handoffUrl.includes("project"));

const redacted = redactHandoffUrl(`https://www.movetrusthub.com/auth/network-handoff?code=${code}&state=private&next=%2Fcompanies`);
assert.ok(!redacted.includes(code));
assert.ok(!redacted.includes("private"));
assert.match(redacted, /%5BREDACTED%5D/);

const csrf = generateOpaqueSecret();
assert.equal(validateCsrf({ method: "POST", origin: "https://www.movetrusthub.com", expectedOrigin: "https://www.movetrusthub.com", cookieToken: csrf, headerToken: csrf }), true);
expectError(() => validateCsrf({ method: "POST", origin: "https://evil.example", expectedOrigin: "https://www.movetrusthub.com", cookieToken: csrf, headerToken: csrf }), "INVALID_STATE");
expectError(() => validateCsrf({ method: "POST", origin: "https://www.movetrusthub.com", expectedOrigin: "https://www.movetrusthub.com", cookieToken: csrf, headerToken: generateOpaqueSecret() }), "INVALID_STATE");

assert.equal(assertBatchSize(["one"]), 1);
expectError(() => assertBatchSize([]), "RATE_LIMITED");
expectError(() => assertBatchSize(Array.from({ length: 51 }, (_, index) => String(index))), "RATE_LIMITED");
expectError(() => assertServiceIdentity({ hub: "contractor", serviceIdentity: "svc:trusthub:move:bff:v1", requiredScope: "saved:write" }), "INVALID_AUDIENCE");

assert.equal(HANDOFF_SAFE_HEADERS["Referrer-Policy"], "no-referrer");
assert.match(HANDOFF_SAFE_HEADERS["Cache-Control"], /no-store/);
assert.deepEqual(guestContinuation(), {
  canonicalMutationAllowed: false,
  transport: "browser-local",
  next: "parent-auth-then-explicit-import",
});

console.log("P13 cross-hub executable contract: PASS");
