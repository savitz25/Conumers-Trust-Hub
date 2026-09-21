import { moveOrigin, PRODUCTION_MOVE_ORIGIN } from '../network/move-origin.ts';

export type SpecialistHubId = 'move' | 'lender' | 'insurance' | 'contractor' | 'senior' | 'investor';

export type AskClickTelemetry = {
  searchResultOpened?: { specialistHub?: string; surface: string };
  specialistHandoff?: { specialistHub: string; surface: string };
};

const SPECIALIST_HUBS = new Set<SpecialistHubId>([
  'move',
  'lender',
  'insurance',
  'contractor',
  'senior',
  'investor',
]);

export function isSpecialistHubId(value: string | undefined | null): value is SpecialistHubId {
  return Boolean(value && SPECIALIST_HUBS.has(value as SpecialistHubId));
}

/** Specialist hub the consumer is leaving Ask for. Internal Ask URLs return null. */
export function specialistHubFromHref(href: string, currentOrigin: string): SpecialistHubId | null {
  try {
    const url = new URL(href, currentOrigin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const current = new URL(currentOrigin);
    if (url.origin === current.origin) return null;
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const configuredMove = new URL(moveOrigin()).hostname.toLowerCase();
    if (configuredMove !== new URL(PRODUCTION_MOVE_ORIGIN).hostname && url.hostname.toLowerCase() === configuredMove) {
      return 'move';
    }
    const hub =
      host === 'movetrusthub.com'
        ? 'move'
        : host === 'lendertrusthub.com'
          ? 'lender'
          : host === 'insurancetrusthub.com'
            ? 'insurance'
            : host === 'contractortrusthub.com'
              ? 'contractor'
              : host === 'seniortrusthub.com'
                ? 'senior'
                : host === 'investortrusthub.com'
                  ? 'investor'
                  : null;
    if (!hub) return null;
    return hub;
  } catch {
    return null;
  }
}

/**
 * Classify an Ask click. Result-open stays tagged.
 * Crossing onto a specialist Trust Hub always starts a handoff, even when the
 * same link is labeled search_result_opened (the Move founder path).
 */
export function classifyAskClick(input: {
  href: string | null | undefined;
  currentOrigin: string;
  athEvent?: string;
  athHub?: string;
  athSurface?: string;
}): AskClickTelemetry {
  const href = input.href?.trim() || '';
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return {};
  }
  const specialistFromHref = specialistHubFromHref(href, input.currentOrigin);
  const taggedHub = isSpecialistHubId(input.athHub) ? input.athHub : undefined;
  const surface = input.athSurface || (specialistFromHref && !input.athEvent ? 'outbound_link' : 'ask_results');
  const out: AskClickTelemetry = {};

  if (input.athEvent === 'search_result_opened') {
    out.searchResultOpened = {
      specialistHub: taggedHub || specialistFromHref || undefined,
      surface,
    };
  }

  const handoffHub =
    (input.athEvent === 'specialist_handoff_started' ? taggedHub : undefined) || specialistFromHref;
  if (handoffHub) {
    out.specialistHandoff = { specialistHub: handoffHub, surface };
  }

  return out;
}
