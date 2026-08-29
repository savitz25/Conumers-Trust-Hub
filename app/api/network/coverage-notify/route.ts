import { NextResponse } from 'next/server';
import { coverageNotifyIntent } from '@/lib/network/coverage-notify';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    hubId?: string;
    geographyCode?: string;
    coverageLevel?: string;
  };
  return NextResponse.json(
    coverageNotifyIntent(body.hubId ?? 'contractor', body.geographyCode ?? 'FL', body.coverageLevel ?? 'not_yet_researched'),
    { status: 501 }
  );
}
