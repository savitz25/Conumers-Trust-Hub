/** HUB-RETURN v1. `next` and safeReturn() stay path-only. This module validates `return` only. */
import { readFileSync } from "node:fs";

const hubRegistry = JSON.parse(readFileSync(new URL("./hub-registry.json", import.meta.url), "utf8")) as {
  hubs: HubRecord[];
};

export const HUB_RETURN_CONTRACT = "CONTRACT-HUB-RETURN-v1" as const;
export const HUB_RETURN_MAX_LENGTH = 512;

const LABELS: Record<string, string> = {
  ask: "Ask Trust Hub",
  move: "Move Trust Hub",
  lender: "Lender Trust Hub",
  insurance: "Insurance Trust Hub",
  contractor: "Contractor Trust Hub",
  senior: "Senior Trust Hub",
  investor: "Investor Trust Hub",
};

type HubRecord = {
  key: string;
  enabled?: boolean;
  productionOrigins: string[];
  stagingOrigins: string[];
  developmentOrigins: string[];
  returnPrefixes: string[];
};

export type HubReturnResult =
  | { ok: true; href: string; hubKey: string; hubLabel: string }
  | { ok: false };

const hubs = hubRegistry.hubs;

function forbidden(value: string): boolean {
  if (value.length > HUB_RETURN_MAX_LENGTH) return true;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return true;
  if (/%2f%2f/i.test(value) || /%2e%2e/i.test(value) || /%5c/i.test(value)) return true;
  return false;
}

function prefixMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function validateHubReturn(value: unknown, options: { production: boolean }): HubReturnResult {
  if (typeof value !== "string" || forbidden(value)) return { ok: false };
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return { ok: false };
  }
  if (decoded !== value && forbidden(decoded)) return { ok: false };
  if (!/^https?:\/\//i.test(value) || value.startsWith("//")) return { ok: false };
  const rawPath = value.slice(value.indexOf("/", value.indexOf("://") + 3));
  const rawSegments = rawPath.split(/[?#]/)[0]?.split("/") ?? [];
  // WHATWG treats ".", "..", "%2e", "%2e%2e", ".%2e", and "%2e." as dot segments.
  if (rawSegments.some((segment) => /^(\.|%2e){1,2}$/i.test(segment))) return { ok: false };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false };
  }
  const authority = value.slice(value.indexOf("://") + 3).split(/[/?#]/)[0] ?? "";
  if (authority.includes("@") || authority.endsWith(".") || url.username || url.password || url.hostname.endsWith(".")) return { ok: false };
  if (url.href.length > HUB_RETURN_MAX_LENGTH) return { ok: false };
  const segments = url.pathname.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) return { ok: false };
  const matches = hubs.filter((hub) => {
    if (hub.enabled === false) return false;
    const allowed = options.production
      ? hub.productionOrigins
      : [...hub.productionOrigins, ...hub.stagingOrigins, ...hub.developmentOrigins];
    return allowed.includes(url.origin) && hub.returnPrefixes.some((prefix) => prefixMatches(url.pathname, prefix));
  });
  if (matches.length !== 1) return { ok: false };
  const hub = matches[0];
  const href = `${url.origin}${url.pathname}${url.search}${url.hash}`;
  if (href.length > HUB_RETURN_MAX_LENGTH || forbidden(href)) return { ok: false };
  return { ok: true, href, hubKey: hub.key, hubLabel: LABELS[hub.key] ?? hub.key };
}

/** Carry a validated hub URL on an Ask path. Never returns the hub URL as the destination. */
export function withHubReturn(path: string, value: unknown, production: boolean): string {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return path;
  // profile-save accepts only auth=complete. A return parameter makes that request invalid.
  if (path.split(/[?#]/)[0] === "/my/profile-save") return path;
  const result = validateHubReturn(value, { production });
  if (!result.ok) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}return=${encodeURIComponent(result.href)}`;
}
