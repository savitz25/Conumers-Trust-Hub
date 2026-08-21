import { askFallbackPng, askNetworkCard, shareOgHead } from '@/lib/og/ask-share-og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return askNetworkCard();
  } catch {
    return askFallbackPng();
  }
}

export function HEAD() {
  return shareOgHead();
}
