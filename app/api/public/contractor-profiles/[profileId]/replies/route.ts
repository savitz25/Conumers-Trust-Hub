import { NextResponse } from 'next/server';
import { publicReadHeaders, readPublicContractorState } from '@/lib/customer/public-read-server';

export async function GET(_r: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  try {
    const result = await readPublicContractorState(profileId);
    return NextResponse.json(result.state.replies, { headers: publicReadHeaders(result.source) });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
  }
}
