import { NextRequest, NextResponse } from 'next/server';
import { getInternalSearchUrl, getVerticalFromQuery, type ServiceVertical } from '@/lib/sites';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const zip = searchParams.get('zip')?.trim();
  const vertical = (searchParams.get('vertical') as ServiceVertical) || 'moving';
  const query = searchParams.get('q')?.trim();

  const valid: ServiceVertical[] = ['moving', 'lending', 'insurance'];
  const safe = valid.includes(vertical) ? vertical : 'moving';

  if (query) {
    const detected = getVerticalFromQuery(query) ?? safe;
    const path = zip ? getInternalSearchUrl(detected, zip) : getInternalSearchUrl(detected);
    return NextResponse.redirect(new URL(path, request.url), 308);
  }

  if (!zip) {
    return NextResponse.json({ error: 'ZIP code or search query required' }, { status: 400 });
  }

  return NextResponse.json({
    redirect: getInternalSearchUrl(safe, zip),
    vertical: safe,
    zip,
  });
}