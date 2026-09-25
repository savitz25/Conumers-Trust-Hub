import { NextResponse } from "next/server";
import { isDbUnavailableError, serviceUnavailableResponse } from '@/lib/customer/db-unavailable';
import { withAdminSecurity } from "@/lib/control-plane/server";
import { ClaimOperationsService } from "@/lib/control-plane/claim-operations";
export const runtime = "nodejs";
/** ATH-CLAIM-V2-001 — explicit reviewer timer (start / stop). Bounded, staff-only, same-origin. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ claimId: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { claimId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action === "stop" ? "stop" : "start";
  try {
    const result: Record<string, unknown> = await withAdminSecurity(async (s, t, c, sql) => {
      const service = new ClaimOperationsService(sql, s, t, c);
      if (action === "stop") return { ...(await service.stopReview(claimId)) };
      return { ...(await service.startReview(claimId, { evidenceReady: typeof body.evidenceReady === "boolean" ? body.evidenceReady : null })) };
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {if (isDbUnavailableError(error)) return serviceUnavailableResponse();
    const driverCode = typeof error === "object" && error && "code" in error && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "";
    const code = /^[0-9A-Z]{5}$/.test(driverCode) || !(error instanceof Error) ? "unavailable" : error.message;
    return NextResponse.json(
      { ok: false, error: code },
      { status: /UNAUTHENTICATED/.test(code) ? 401 : /FORBIDDEN|not_staff/.test(code) ? 403 : 409 },
    );
  }
}
