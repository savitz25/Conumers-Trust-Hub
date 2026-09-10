import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ProductionMyTrustHubAdapter } from "@/lib/my-trusthub/production-adapter";
import { scopedRuntime } from "@/lib/my-trusthub/scoped-runtime";
import { ASK_ORIGIN, P13_COOKIE, P13_ARRIVAL_COOKIE, contractorSaveEnabled, handoffError, safeHeaders, validOpaque } from "@/lib/my-trusthub/p13-runtime";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!contractorSaveEnabled()) return handoffError(404);
  const adapter = await ProductionMyTrustHubAdapter.create(); const user = await adapter?.getUser();
  if (!adapter || !user) return handoffError(401);
  const jar = await cookies(); const code = jar.get(P13_ARRIVAL_COOKIE)?.value;
  const [state, nonce] = (jar.get(P13_COOKIE)?.value ?? "").split(".");
  if (!validOpaque(code) || !validOpaque(state) || !validOpaque(nonce)) return handoffError();
  try {
    const result = await scopedRuntime("broker").query<{ binding_id: string }>("select ops.consume_contractor_save($1,$2,$3,$4,$5,$6) as binding_id", [code, state, nonce, user.id, "contractor", "ask"]);
    await adapter.saveEntity(result.rows[0].binding_id);
    const response = NextResponse.redirect(`${ASK_ORIGIN}/my/saved?handoff=saved`, { status: 303, headers: safeHeaders });
    for (const name of [P13_COOKIE, P13_ARRIVAL_COOKIE]) response.cookies.set(name, "", { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch { return handoffError(); }
}
