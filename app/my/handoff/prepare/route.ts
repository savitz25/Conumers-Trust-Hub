import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ProductionMyTrustHubAdapter } from "@/lib/my-trusthub/production-adapter";
import { scopedRuntime } from "@/lib/my-trusthub/scoped-runtime";
import { ASK_ORIGIN, CONTRACTOR_ORIGIN, P13_COOKIE, contractorSaveEnabled, handoffError, opaque, relayForm, safeHeaders } from "@/lib/my-trusthub/p13-runtime";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!contractorSaveEnabled()) return handoffError(404);
  const jar = await cookies();
  if (!jar.get("__Host-myth-p13-start")?.value) return handoffError();
  jar.set("__Host-myth-p13-start", "", { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  const adapter = await ProductionMyTrustHubAdapter.create(); const user = await adapter?.getUser();
  if (!user) return NextResponse.redirect(`${ASK_ORIGIN}/my/sign-in`, { status: 303, headers: safeHeaders });
  try {
    const intent = opaque(), state = opaque(), nonce = opaque();
    await scopedRuntime("broker").query("select ops.prepare_contractor_save($1,$2,$3,$4)", [intent, state, nonce, user.id]);
    const response = relayForm(`${CONTRACTOR_ORIGIN}/api/my-trusthub/issue`, "intent", intent);
    response.cookies.set(P13_COOKIE, `${state}.${nonce}`, { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 90 });
    return response;
  } catch { return handoffError(503); }
}
