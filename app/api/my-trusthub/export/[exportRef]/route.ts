import { NextResponse } from "next/server";
import { isMyTrustHubFeatureEnabled } from "@/lib/my-trusthub/feature-flags";
import { ProductionMyTrustHubAdapter } from "@/lib/my-trusthub/production-adapter";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ exportRef: string }> }) {
  if (!isMyTrustHubFeatureEnabled("MY_TRUSTHUB_EXPORT_ENABLED")) return new NextResponse(null, { status: 404 });
  const { exportRef } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(exportRef)) return new NextResponse(null, { status: 404 });
  const adapter = await ProductionMyTrustHubAdapter.create();
  if (!adapter || !(await adapter.getUser())) return new NextResponse(null, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const bundle = await adapter.downloadExport(exportRef);
  if (!bundle) return new NextResponse("Export unavailable or expired", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return new Response(JSON.stringify(bundle, null, 2), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="my-trusthub-export-${exportRef}.json"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
}
