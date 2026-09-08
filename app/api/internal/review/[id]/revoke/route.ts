import { NextResponse } from "next/server";
import { AuthError, ClaimError } from "@/lib/customer/store";
import {
  currentContext,
  readSessionToken,
  withPlatform,
} from "@/lib/customer/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  const sessionToken = await readSessionToken(),
    ctx = await currentContext(),
    body = (await request.json().catch(() => ({}))) as {
      grantId?: string;
      internalReason?: string;
      accountFacingReason?: string;
    };
  try {
    await withPlatform((p) =>
      p.revokeGrant({
        sessionToken: sessionToken || "",
        grantId: body.grantId || "",
        reason: body.internalReason || "",
        accountFacingReason: body.accountFacingReason || "",
        ctx,
      }),
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json(
        { ok: false, error: e.code },
        { status: e.code === "not_staff" ? 403 : 401 },
      );
    if (e instanceof ClaimError)
      return NextResponse.json({ ok: false, error: e.code }, { status: 409 });
    return NextResponse.json(
      { ok: false, error: "unavailable" },
      { status: 500 },
    );
  }
}
