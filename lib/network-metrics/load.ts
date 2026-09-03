import contractorFallback from '../../data/network-metrics/contractor-v1-fallback.json' with { type: 'json' };
import seniorFallback from '../../data/network-metrics/senior-v1-fallback.json' with { type: 'json' };
import {
  SPECIALIST_METRIC_REVALIDATE_SECONDS,
  SPECIALIST_SOURCES,
  type SpecialistHubId,
  type SpecialistSourceConfig,
} from './sources.ts';
import { adaptContractorCard, adaptSeniorCard } from './adapt.ts';
import { validateContractorManifest, validateSeniorManifest } from './validate.ts';
import type { SpecialistHubPresentation } from './types.ts';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type LoadSpecialistOptions = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  fallbackRaw?: unknown;
};

function readFallback(hub: SpecialistHubId): unknown {
  return hub === 'contractor' ? contractorFallback : seniorFallback;
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
  if (hub === 'contractor') {
    return adaptContractorCard(validateContractorManifest(raw), origin);
  }
  return adaptSeniorCard(validateSeniorManifest(raw), origin);
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
  const [contractor, senior] = await Promise.all([
    loadSpecialistCard('contractor', options),
    loadSpecialistCard('senior', options),
  ]);
  return { contractor, senior };
}
