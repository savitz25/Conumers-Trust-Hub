import assert from "node:assert/strict";
import test from "node:test";
import { safeReturn } from "./account-policy.ts";
import { HUB_RETURN_MAX_LENGTH, validateHubReturn, withHubReturn } from "./hub-return.ts";

const move = "https://www.movetrusthub.com/companies/hindman-isaacs-moving-storage-inc";
const lender = "https://www.lendertrusthub.com/lenders/freedom-mortgage";

const rejects = [
  ["protocol-relative", "//www.movetrusthub.com/companies/acme"],
  ["http production host", "http://www.movetrusthub.com/companies/acme"],
  ["mixed-case lookalike host", "https://www.MoveTrustHub.com.evil.example/companies/acme"],
  ["idn punycode lookalike", "https://www.xn--movetrusthub-ewb.com/companies/acme"],
  ["userinfo", "https://user@www.movetrusthub.com/companies/acme"],
  ["userinfo password", "https://user:pw@www.movetrusthub.com/companies/acme"],
  ["encoded slash slash", "https://www.movetrusthub.com/companies/%2f%2f"],
  ["encoded slash slash upper", "https://www.movetrusthub.com/companies/%2F%2F"],
  ["encoded dots", "https://www.movetrusthub.com/companies/%2e%2e/secret"],
  ["encoded dots upper", "https://www.movetrusthub.com/%2E%2E/companies"],
  ["mixed dot encoding .%2e", "https://www.lendertrusthub.com/lenders/.%2e/my-lending"],
  ["mixed dot encoding %2e.", "https://www.lendertrusthub.com/lenders/%2e./my-lending"],
  ["mixed dot encoding .%2E", "https://www.lendertrusthub.com/lenders/.%2E/local-lenders"],
  ["backslash", "https://www.movetrusthub.com/companies\\evil"],
  ["encoded backslash", "https://www.movetrusthub.com/companies/%5c/evil"],
  ["crlf", "https://www.movetrusthub.com/companies/acme%0d%0aLocation:%20https://evil.example"],
  ["oversize", `https://www.movetrusthub.com/companies/${"a".repeat(HUB_RETURN_MAX_LENGTH)}`],
  ["non-registered prefix", "https://www.movetrusthub.com/shortlist"],
  ["prefix without segment boundary", "https://www.lendertrusthub.com/lendersX"],
  ["ask prefix without boundary", "https://www.asktrusthub.com/my-trusthub"],
  ["javascript", "javascript:alert(1)"],
  ["data url", "data:text/html,hi"],
  ["foreign origin", "https://evil.example/companies/acme"],
  ["suffix host", "https://www.movetrusthub.com.evil.example/companies/acme"],
  ["empty", ""],
  ["dot segment", "https://www.movetrusthub.com/companies/../auth"],
  ["dot segment single", "https://www.movetrusthub.com/./companies/acme"],
  ["dot segment that normalizes onto a prefix", "https://www.movetrusthub.com/companies/../companies/acme"],
  ["staging on production", "https://move-trust-hub.vercel.app/companies/acme"],
  ["localhost on production", "http://localhost:3001/companies/acme"],
  ["trailing dot host", "https://www.movetrusthub.com./companies/acme"],
  ["tab", "https://www.movetrusthub.com/companies/acme\t"],
  ["null byte", "https://www.movetrusthub.com/companies/acme%00"],
  ["insurance boundary", "https://www.insurancetrusthub.com/my-insuranceX"],
  ["ftp", "ftp://www.movetrusthub.com/companies/acme"],
  ["newline", "https://www.movetrusthub.com/companies/acme\n"],
  ["contractor legacy workspace", "https://www.contractortrusthub.com/my-contractor"],
  ["investor legacy workspace", "https://www.investortrusthub.com/my-investor-trust-hub"],
  ["senior shortlist", "https://www.seniortrusthub.com/shortlist"],
  ["hash host swap", "https://evil.example/companies#https://www.movetrusthub.com"],
  ["whitespace", " https://www.movetrusthub.com/companies/acme"],
  ["double encoded dots", "https://www.movetrusthub.com/companies/%252e%252e"],
  ["port", "https://www.movetrusthub.com:444/companies/acme"],
  ["userinfo encoded", "https://www.movetrusthub.com%40evil.example/companies/acme"],
] as const;

test("hostile return values are rejected on Production", () => {
  assert.ok(rejects.length >= 30);
  for (const [name, value] of rejects) {
    assert.deepEqual(validateHubReturn(value, { production: true }), { ok: false }, name);
  }
  assert.deepEqual(validateHubReturn(null, { production: true }), { ok: false });
  assert.deepEqual(validateHubReturn(["https://www.movetrusthub.com/companies/acme"], { production: true }), { ok: false });
});

test("registered production returns match a segment boundary and keep next unchanged", () => {
  const accepted = validateHubReturn(move, { production: true });
  assert.equal(accepted.ok && accepted.hubKey, "move");
  assert.equal(accepted.ok && accepted.hubLabel, "Move Trust Hub");
  assert.equal(accepted.ok && accepted.href, move);
  const mixed = validateHubReturn("https://WWW.MOVETRUSTHUB.COM/companies/acme", { production: true });
  assert.equal(mixed.ok && mixed.href, "https://www.movetrusthub.com/companies/acme");
  const lenders = validateHubReturn(lender, { production: true });
  assert.equal(lenders.ok && lenders.hubKey, "lender");
  assert.equal(validateHubReturn("https://www.lendertrusthub.com/lenders", { production: true }).ok, true);
  assert.equal(validateHubReturn("https://www.movetrusthub.com/companies/acme?ref=1", { production: true }).ok, true);
  assert.equal(safeReturn(move), "/my");
  assert.equal(safeReturn("/my/saved"), "/my/saved");
  const carried = withHubReturn("/my/saved", move, true);
  assert.equal(new URL(carried, "https://www.asktrusthub.com").searchParams.get("return"), move);
  assert.equal(carried.startsWith("/my/saved?"), true);
  assert.equal(withHubReturn("/my/saved", "https://evil.example", true), "/my/saved");
  assert.equal(withHubReturn("https://evil.example", move, true), "https://evil.example");
  const profileSave = withHubReturn("/my/profile-save?auth=complete", move, true);
  assert.equal(profileSave, "/my/profile-save?auth=complete");
  const profileParams = new URL(profileSave, "https://www.asktrusthub.com").searchParams;
  assert.equal(profileParams.size, 1);
  assert.equal(profileParams.get("auth"), "complete");
  assert.equal(withHubReturn("/my/profile-save", lender, true), "/my/profile-save");
});

test("staging and development origins are eligible only outside Production", () => {
  const staging = "https://move-trust-hub.vercel.app/companies/acme";
  const local = "http://localhost:3001/my-move";
  assert.equal(validateHubReturn(staging, { production: false }).ok, true);
  assert.equal(validateHubReturn(local, { production: false }).ok, true);
  assert.equal(validateHubReturn(staging, { production: true }).ok, false);
  assert.equal(validateHubReturn(local, { production: true }).ok, false);
});


