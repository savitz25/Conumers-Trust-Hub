import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

const registry = JSON.parse(
  readFileSync(new URL("./hub-registry.json", import.meta.url), "utf8"),
);

export const HANDOFF_TTL_SECONDS = 90;
export const HANDOFF_SECRET_BYTES = 32;
export const CROSS_HUB_BATCH_LIMIT = registry.batchLimit;
export const HANDOFF_SAFE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

const SENSITIVE_QUERY_KEYS = new Set(["code", "state", "nonce", "handoff", "token"]);
const FORBIDDEN_ENCODED = /%(?:25|2f|5c|3a|00|0a|0d)/i;
const FORBIDDEN_SCHEME = /(?:javascript|data|https?):/i;

export function hubConfig(hub) {
  const match = registry.hubs.find((candidate) => candidate.key === hub && candidate.enabled);
  if (!match) throw new Error("INVALID_AUDIENCE");
  return match;
}

export function generateOpaqueSecret() {
  return randomBytes(HANDOFF_SECRET_BYTES).toString("base64url");
}

export function hashOpaqueSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32 || secret.length > 512) {
    throw new Error("INVALID_STATE");
  }
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function secretsEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function allowedOrigin(hub, origin, environment = "production") {
  let normalized;
  try {
    const parsed = new URL(origin);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return false;
    normalized = parsed.origin;
  } catch {
    return false;
  }
  const config = hubConfig(hub);
  const allowed = environment === "development"
    ? config.developmentOrigins
    : environment === "staging"
      ? config.stagingOrigins
      : config.productionOrigins;
  return allowed.includes(normalized);
}

export function normalizeReturnPath(hub, rawPath) {
  if (typeof rawPath !== "string" || rawPath.length < 1 || rawPath.length > 1024) {
    throw new Error("RETURN_NOT_ALLOWED");
  }
  if (!rawPath.startsWith("/") || rawPath.startsWith("//") || rawPath.includes("\\") || rawPath.includes("#")) {
    throw new Error("RETURN_NOT_ALLOWED");
  }
  if (/[\u0000-\u001f\u007f]/.test(rawPath) || FORBIDDEN_ENCODED.test(rawPath) || FORBIDDEN_SCHEME.test(rawPath)) {
    throw new Error("RETURN_NOT_ALLOWED");
  }
  const pathOnly = rawPath.split("?", 1)[0];
  const allowed = hubConfig(hub).returnPrefixes.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`),
  );
  if (!allowed) throw new Error("RETURN_NOT_ALLOWED");
  return rawPath;
}

export function buildHandoffUrl({ hub, origin, code, environment = "production" }) {
  if (!allowedOrigin(hub, origin, environment)) throw new Error("RETURN_NOT_ALLOWED");
  hashOpaqueSecret(code);
  const target = new URL("/auth/network-handoff", origin);
  target.searchParams.set("code", code);
  return target.toString();
}

export function redactHandoffUrl(input) {
  try {
    const url = new URL(input);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch {
    return "[REDACTED_HANDOFF_URL]";
  }
}

export function validateCsrf({ method, origin, expectedOrigin, cookieToken, headerToken }) {
  if (["GET", "HEAD", "OPTIONS"].includes(String(method).toUpperCase())) return true;
  if (origin !== expectedOrigin || !secretsEqual(cookieToken, headerToken)) {
    throw new Error("INVALID_STATE");
  }
  return true;
}

export function assertServiceIdentity({ hub, serviceIdentity, requiredScope }) {
  const config = hubConfig(hub);
  if (config.serviceIdentity !== serviceIdentity || !config.scopes.includes(requiredScope)) {
    throw new Error("INVALID_AUDIENCE");
  }
  return config;
}

export function assertBatchSize(ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > CROSS_HUB_BATCH_LIMIT) {
    throw new Error("RATE_LIMITED");
  }
  return ids.length;
}

export function guestContinuation() {
  return Object.freeze({
    canonicalMutationAllowed: false,
    transport: "browser-local",
    next: "parent-auth-then-explicit-import",
  });
}
