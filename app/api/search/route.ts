import { NextRequest, NextResponse } from 'next/server';
import { getSearchUrl, getVerticalFromQuery, type ServiceVertical } from '@/lib/sites';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const zip = searchParams.get('zip')?.trim();
  const vertical = (searchParams.get('vertical') as ServiceVertical) || 'moving';
  const query = searchParams.get('q')?.trim();

  if (query) {
    const detected = getVerticalFromQuery(query);
    const target = detected ?? vertical;
    const url = zip ? getSearchUrl(target, zip) : getSearchUrl(target);
    return NextResponse.redirect(url);
  }

  if (!zip) {
    return NextResponse.json(
      { error: 'ZIP code or search query required' },
      { status: 400 }
    );
  }

  const validVerticals: ServiceVertical[] = ['moving', 'lending', 'insurance'];
  const safeVertical = validVerticals.includes(vertical) ? vertical : 'moving';

  return NextResponse.json({
    redirect: getSearchUrl(safeVertical, zip),
    vertical: safeVertical,
    zip,
  });
}