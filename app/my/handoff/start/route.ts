import { NextResponse } from "next/server";
import { ASK_ORIGIN, CONTRACTOR_ORIGIN, contractorSaveEnabled, handoffError, opaque, safeHeaders } from "@/lib/my-trusthub/p13-runtime";
export async function POST(request: Request) {
  if (!contractorSaveEnabled()) return handoffError(404);
  if (request.headers.get("origin") !== CONTRACTOR_ORIGIN) return handoffError();
  const response = NextResponse.redirect(`${ASK_ORIGIN}/my/handoff/prepare`, { status: 303, headers: safeHeaders });
  response.cookies.set("__Host-myth-p13-start", opaque(), { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 90 });
  return response;
}
