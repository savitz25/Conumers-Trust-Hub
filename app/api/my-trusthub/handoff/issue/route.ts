import { NextResponse } from "next/server";
import { scopedRuntime } from "@/lib/my-trusthub/scoped-runtime";
import { authorized, contractorSaveEnabled, handoffError, opaque, safeHeaders, validOpaque } from "@/lib/my-trusthub/p13-runtime";
export async function POST(request: Request) {
  if (!contractorSaveEnabled()) return handoffError(404);
  if (!authorized(request.headers.get("authorization"), process.env.MY_TRUSTHUB_P13_CONTRACTOR_SECRET)) return handoffError(401);
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return handoffError();
  try {
    const raw = await request.text(); if (raw.length > 2048) return handoffError();
    const input = JSON.parse(raw);
    if (!validOpaque(input.intent) || input.issuer !== "contractor" || input.audience !== "ask") return handoffError();
    const code = opaque();
    await scopedRuntime("broker").query("select ops.issue_contractor_save($1,$2,$3,$4)", [input.intent, code, "contractor", "ask"]);
    return NextResponse.json({ code }, { headers: safeHeaders });
  } catch { return handoffError(); }
}
