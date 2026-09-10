import { NextResponse } from "next/server";
import { ASK_ORIGIN, CONTRACTOR_ORIGIN, P13_ARRIVAL_COOKIE, contractorSaveEnabled, handoffError, safeHeaders, validOpaque } from "@/lib/my-trusthub/p13-runtime";
export async function POST(request: Request) {
  if (!contractorSaveEnabled()) return handoffError(404);
  if (request.headers.get("origin") !== CONTRACTOR_ORIGIN || Number(request.headers.get("content-length") ?? 0) > 1024) return handoffError();
  const raw = await request.text(); if (raw.length > 1024) return handoffError();
  const code = new URLSearchParams(raw).get("code"); if (!validOpaque(code)) return handoffError();
  const response = NextResponse.redirect(`${ASK_ORIGIN}/my/handoff/finish`, { status: 303, headers: safeHeaders });
  response.cookies.set(P13_ARRIVAL_COOKIE, code, { secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 90 });
  return response;
}
