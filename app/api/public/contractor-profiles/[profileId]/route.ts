import { NextResponse } from 'next/server';
import { publicReadHeaders, readPublicContractorState } from '@/lib/customer/public-read-server';

export async function GET(_request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  try {
    const result = await readPublicContractorState(profileId);
    const headers = publicReadHeaders(result.source);
    if (!result.state.hasPublicBusinessProfile || !result.state.profile) {
      return NextResponse.json({ error: 'not_found' }, { status: 404, headers });
    }
    return NextResponse.json(result.state.profile, { headers });
  } catch {
    return NextResponse.json(
      { error: 'not_found' },
      { status: 404, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400', 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }
}
