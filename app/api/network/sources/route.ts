import { NextResponse } from 'next/server';
import { publicSourceRegistryPayload } from '@/lib/network/source-registry';

export const revalidate = 3600;

export function GET() {
  return NextResponse.json(publicSourceRegistryPayload(), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
