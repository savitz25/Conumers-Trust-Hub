import {
  askFallbackPng,
  renderAskCardOrFallback,
  resolveAskGuideCard,
  shareOgHead,
} from '@/lib/og/ask-share-og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    return renderAskCardOrFallback(resolveAskGuideCard(slug));
  } catch {
    return askFallbackPng();
  }
}

export function HEAD() {
  return shareOgHead();
}
