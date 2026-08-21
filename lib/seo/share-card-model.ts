/**
 * SHARE-003 — Ask Trust Hub content share-card models (no I/O).
 * Parent discovery layer: network, guides, and journeys only.
 */

export type AskShareCardKind = 'fallback' | 'content';

export type AskShareCardModel = {
  kind: AskShareCardKind;
  eyebrow: string;
  title: string;
  subtitle?: string;
  fact?: string;
};

export function truncateShareText(value: string, maxChars: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function askNetworkShareModel(): AskShareCardModel {
  return {
    kind: 'content',
    eyebrow: 'ASK TRUST HUB NETWORK',
    title: 'The Trust Hub Network',
    fact: 'Independent research across specialist Hubs',
  };
}

export function askGuideShareModel(input: { title: string; vertical?: string | null }): AskShareCardModel {
  const vertical = (input.vertical || '').trim().toUpperCase();
  return {
    kind: 'content',
    eyebrow: vertical ? `${vertical} RESEARCH GUIDE` : 'CONSUMER RESEARCH GUIDE',
    title: truncateShareText(input.title || 'Consumer research guide', 52),
    fact: 'Independent research across the TrustHub Network',
  };
}

export function askJourneyShareModel(input: { title: string }): AskShareCardModel {
  return {
    kind: 'content',
    eyebrow: 'CONSUMER RESEARCH JOURNEY',
    title: truncateShareText(input.title || 'Life journey research', 52),
    fact: 'Independent research across the TrustHub Network',
  };
}
