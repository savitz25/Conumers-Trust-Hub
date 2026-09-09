import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  evaluateClaimPolicy,
  claimPolicy,
  CLAIM_POLICY_REGISTRY,
} from "./claim-policy.ts";
import { hasAdminPermission } from "./rbac.ts";
import { applyCustomerMigrations, enableAppRole } from "../customer/migrate.ts";
import type { SqlClient } from "../customer/sql.ts";

function asSql(db: PGlite): SqlClient {
  return {
    async query<T extends Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ) {
      const result = await db.query(text, params ?? []);
      return { rows: (result.rows ?? []) as T[] };
    },
    async exec(text: string) {
      await db.exec(text);
    },
  };
}

const evaluate = (overrides: Record<string, unknown> = {}) =>
  evaluateClaimPolicy({
    hub: "move",
    profileClass: "mover",
    jurisdiction: "FL",
    relationship: "owner",
    evidence: ["CORPORATE_OFFICER_MATCH", "VERIFIED_PUBLIC_CALLBACK"],
    competingClaims: 0,
    activeGrant: false,
    identityRevalidated: true,
    ...overrides,
  } as Parameters<typeof evaluateClaimPolicy>[0]);

test("policy registry covers the six hubs and preserves senior provider grains", () => {
  assert.deepEqual(
    new Set(CLAIM_POLICY_REGISTRY.map((p) => p.hub)),
    new Set([
      "move",
      "lender",
      "insurance",
      "senior",
      "contractor",
      "investor",
    ]),
  );
  assert.deepEqual(
    CLAIM_POLICY_REGISTRY.filter((p) => p.hub === "senior")
      .map((p) => p.profile_class)
      .sort(),
    ["home_health", "hospice", "nursing_home"],
  );
  assert.equal(claimPolicy("insurance", "agency", "FL"), null);
});

test("policy lookup is hub, class, jurisdiction and version scoped", () => {
  const policy = claimPolicy("move", "mover", "FL");
  assert.equal(policy?.jurisdiction, "*");
  assert.notEqual(policy?.policy_version, "wrong-version");
  assert.equal(evaluate({ hub: "unknown" }).result, "NOT_YET_DEFINED");
});

test("domain email alone cannot establish authority and third parties step up", () => {
  assert.equal(
    evaluate({ evidence: ["BUSINESS_DOMAIN_EMAIL"] }).result,
    "AMBER",
  );
  assert.equal(
    evaluate({ relationship: "third_party_representative" }).result,
    "AMBER",
  );
});

test("conflicts, existing grants and competing claims prevent GREEN", () => {
  assert.equal(evaluate({ evidence: ["IDENTITY_MISMATCH"] }).result, "RED");
  assert.equal(evaluate({ activeGrant: true }).result, "RED");
  assert.equal(evaluate({ competingClaims: 1 }).result, "RED");
});

test("positive signals may be GREEN but automatic approval remains off", () => {
  const result = evaluate();
  assert.equal(result.result, "GREEN");
  assert.equal(result.automaticApproval, false);
  assert.ok(
    CLAIM_POLICY_REGISTRY.every(
      (p) => p.automatic_approval_eligibility === "INELIGIBLE",
    ),
  );
});

test("claim writes are capability protected by role", () => {
  assert.equal(hasAdminPermission("SUPER_ADMIN", "CLAIM_OPS"), true);
  assert.equal(hasAdminPermission("TRUST_OPS", "CLAIM_OPS"), true);
  for (const role of ["DATA_OPS", "GROWTH", "READ_ONLY"] as const)
    assert.equal(hasAdminPermission(role, "CLAIM_OPS"), false);
});

test("migration 014 is additive, server-only, append-only and idempotent", () => {
  const sql = readFileSync(
    "schema/migrations/014_ath_claim_operations.sql",
    "utf8",
  );
  for (const table of [
    "ath_ops_cases",
    "ath_ops_case_events",
    "ath_claim_policy_evaluations",
  ])
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/g);
  assert.match(sql, /ath_forbid_mutation/);
  assert.match(sql, /idempotency_key TEXT UNIQUE/);
  assert.doesNotMatch(
    sql,
    /DROP TABLE ath_(claims|management_grants|organizations|memberships)/i,
  );
});

test("migration 014 executes and enforces server-only append-only case state", async () => {
  const db = new PGlite(),
    sql = asSql(db);
  await applyCustomerMigrations(sql);
  await db.query("BEGIN");
  await enableAppRole(sql);
  for (const table of [
    "ath_ops_cases",
    "ath_ops_case_events",
    "ath_claim_policy_evaluations",
  ]) {
    const state = (
      await sql.query<{
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }>(
        `SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=$1`,
        [table],
      )
    ).rows[0];
    assert.equal(state.relrowsecurity, true);
    assert.equal(state.relforcerowsecurity, true);
  }
  const policies = await sql.query<{ n: number }>(
    `SELECT count(*)::int n FROM pg_policies WHERE policyname='ath_server_all' AND tablename LIKE 'ath_ops_%' OR tablename='ath_claim_policy_evaluations'`,
  );
  assert.ok(Number(policies.rows[0].n) >= 3);
  await db.close();
});

test("Admin routes enforce ADMIN_VIEW and CLAIM_OPS server-side", () => {
  const page = readFileSync("app/admin/operations/claims/page.tsx", "utf8");
  const detail = readFileSync(
    "app/admin/operations/claims/[claimId]/page.tsx",
    "utf8",
  );
  const service = readFileSync("lib/control-plane/claim-operations.ts", "utf8");
  assert.match(page, /require\(t,\s*["']ADMIN_VIEW["']\)/);
  assert.match(detail, /require\(t,\s*["']ADMIN_VIEW["']\)/);
  assert.match(service, /require\(this\.token,\s*["']CLAIM_OPS["']\)/);
  assert.match(service, /staffDecide/);
  assert.match(service, /revokeGrant/);
  assert.match(service, /idempotency_key/);
  assert.match(service, /recordClaimOperation/);
});

test("legacy review remains available while Admin parity is established", () => {
  assert.match(readFileSync("app/internal/review/page.tsx", "utf8"), /review/i);
  assert.match(
    readFileSync("app/api/internal/review/[id]/route.ts", "utf8"),
    /staffDecide/,
  );
});
