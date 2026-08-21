import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { getGuideBySlug } from '@/lib/growth/guides';
import { getJourneyBySlug } from '@/lib/growth/journeys';
import { renderAskShareImage } from '@/lib/og/ask-share-card';
import {
  askGuideShareModel,
  askJourneyShareModel,
  askNetworkShareModel,
  type AskShareCardModel,
} from '@/lib/seo/share-card-model';

const PNG_HEADERS = {
  'Content-Type': 'image/png',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
};

export function askFallbackPng(): NextResponse {
  const buf = readFileSync(join(process.cwd(), 'public/og/ask-trust-hub-social-card.png'));
  return new NextResponse(buf, { status: 200, headers: PNG_HEADERS });
}

export function shareOgHead(): NextResponse {
  return new NextResponse(null, { status: 200, headers: { 'Content-Type': 'image/png' } });
}

export function renderAskCardOrFallback(model: AskShareCardModel | null) {
  if (!model) return askFallbackPng();
  try {
    return renderAskShareImage(model);
  } catch {
    return askFallbackPng();
  }
}

export function resolveAskGuideCard(slug: string): AskShareCardModel | null {
  const guide = getGuideBySlug(decodeURIComponent(String(slug ?? '').trim()));
  if (!guide) return null;
  return askGuideShareModel({ title: guide.title, vertical: guide.vertical });
}

export function resolveAskJourneyCard(slug: string): AskShareCardModel | null {
  const journey = getJourneyBySlug(decodeURIComponent(String(slug ?? '').trim()));
  if (!journey) return null;
  return askJourneyShareModel({ title: journey.title });
}

export function askNetworkCard() {
  return renderAskCardOrFallback(askNetworkShareModel());
}
