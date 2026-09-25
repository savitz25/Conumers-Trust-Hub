import { NextResponse } from 'next/server';
import { isDbUnavailableError, serviceUnavailableResponse } from '@/lib/customer/db-unavailable';
import { publicReadHeaders, readPublicContractorState } from '@/lib/customer/public-read-server';

export async function GET(_request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  try {
    const result = await readPublicContractorState(profileId);
    return NextResponse.json(result.state, { headers: publicReadHeaders(result.source) });
  } catch (error) {
    if (isDbUnavailableError(error)) return serviceUnavailableResponse();
    return NextResponse.json(
      { error: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  }
}
