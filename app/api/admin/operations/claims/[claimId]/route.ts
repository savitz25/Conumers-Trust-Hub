import { NextResponse } from "next/server";
import { withAdminSecurity } from "@/lib/control-plane/server";
import { ClaimOperationsService } from "@/lib/control-plane/claim-operations";
import type {
  AuthorityEvidenceCode,
  ClaimDecisionCategory,
} from "@/lib/customer/claim-governance";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ claimId: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  const { claimId } = await params;
  const idempotencyKey = request.headers.get("idempotency-key") ?? "",
    body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const result = await withAdminSecurity((s, t, c, sql) =>
      new ClaimOperationsService(sql, s, t, c).decide(claimId, {
        decision: String(body.decision) as "approve" | "reject" | "needs_info",
        evidenceCodes: Array.isArray(body.evidenceCodes)
          ? (body.evidenceCodes as AuthorityEvidenceCode[])
          : [],
        evidenceNote: String(body.evidenceNote ?? ""),
        internalRationale: String(body.internalRationale ?? ""),
        claimantMessage: String(body.claimantMessage ?? ""),
        reasonCategory: String(
          body.reasonCategory ?? "OTHER_POLICY_REASON",
        ) as ClaimDecisionCategory,
        idempotencyKey,
      }),
    );
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "unavailable";
    return NextResponse.json(
      { ok: false, error: code },
      {
        status: /UNAUTHENTICATED/.test(code)
          ? 401
          : /FORBIDDEN/.test(code)
            ? 403
            : 409,
      },
    );
  }
}
