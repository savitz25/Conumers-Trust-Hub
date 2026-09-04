import contractorFallback from '../../data/network-metrics/contractor-v1-fallback.json' with { type: 'json' };
import seniorFallback from '../../data/network-metrics/senior-v1-fallback.json' with { type: 'json' };
import moveFallback from '../../data/network-metrics/move-v1-fallback.json' with { type: 'json' };
import lenderFallback from '../../data/network-metrics/lender-v1-fallback.json' with { type: 'json' };
import insuranceFallback from '../../data/network-metrics/insurance-v1-fallback.json' with { type: 'json' };
import investorFallback from '../../data/network-metrics/investor-v1-fallback.json' with { type: 'json' };
import {
  SPECIALIST_METRIC_REVALIDATE_SECONDS,
  SPECIALIST_OWNED_HUBS,
  SPECIALIST_SOURCES,
  type SpecialistHubId,
  type SpecialistSourceConfig,
} from './sources.ts';
import {
  adaptContractorCard,
  adaptInsuranceCard,
  adaptLenderCard,
  adaptInvestorCard,
  adaptMoveCard,
  adaptSeniorCard,
} from './adapt.ts';
import {
  validateContractorManifest,
  validateInsuranceManifest,
  validateLenderManifest,
  validateInvestorManifest,
  validateMoveManifest,
  validateSeniorManifest,
} from './validate.ts';
import type { SpecialistHubPresentation } from './types.ts';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type LoadSpecialistOptions = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  fallbackRaw?: unknown;
};

function readFallback(hub: SpecialistHubId): unknown {
  if (hub === 'contractor') return contractorFallback;
  if (hub === 'senior') return seniorFallback;
  if (hub === 'move') return moveFallback;
  if (hub === 'lender') return lenderFallback;
  if (hub === 'insurance') return insuranceFallback;
  return investorFallback;
}

async function fetchUpstream(
  config: SpecialistSourceConfig,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(config.publicationUrl, {
      signal: controller.signal,
      next: { revalidate: SPECIALIST_METRIC_REVALIDATE_SECONDS },
    } as RequestInit);
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    const text = await response.text();
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function present(hub: SpecialistHubId, raw: unknown, origin: 'UPSTREAM' | 'FALLBACK'): SpecialistHubPresentation {
  if (hub === 'contractor') return adaptContractorCard(validateContractorManifest(raw), origin);
  if (hub === 'senior') return adaptSeniorCard(validateSeniorManifest(raw), origin);
  if (hub === 'move') return adaptMoveCard(validateMoveManifest(raw), origin);
  if (hub === 'lender') return adaptLenderCard(validateLenderManifest(raw), origin);
  if (hub === 'insurance') return adaptInsuranceCard(validateInsuranceManifest(raw), origin);
  return adaptInvestorCard(validateInvestorManifest(raw), origin);
}

export async function loadSpecialistCard(
  hub: SpecialistHubId,
  options: LoadSpecialistOptions = {},
): Promise<SpecialistHubPresentation> {
  const config = SPECIALIST_SOURCES[hub];
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const fallbackRaw = options.fallbackRaw ?? readFallback(hub);
  try {
    const upstream = await fetchUpstream(config, fetchImpl, timeoutMs);
    return present(hub, upstream, 'UPSTREAM');
  } catch {
    return present(hub, fallbackRaw, 'FALLBACK');
  }
}

export async function loadSpecialistNetworkCards(
  options: LoadSpecialistOptions = {},
): Promise<Record<SpecialistHubId, SpecialistHubPresentation>> {
  const cards = await Promise.all(SPECIALIST_OWNED_HUBS.map((hub) => loadSpecialistCard(hub, options)));
  return Object.fromEntries(SPECIALIST_OWNED_HUBS.map((hub, index) => [hub, cards[index]])) as Record<
    SpecialistHubId,
    SpecialistHubPresentation
  >;
}
