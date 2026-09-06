import contractorFallback from '../../data/network-metrics/contractor-v1-fallback.json' with { type: 'json' };
import seniorFallback from '../../data/network-metrics/senior-v1-fallback.json' with { type: 'json' };
import moveFallback from '../../data/network-metrics/move-v1-fallback.json' with { type: 'json' };
import lenderFallback from '../../data/network-metrics/lender-v1-fallback.json' with { type: 'json' };
import insuranceFallback from '../../data/network-metrics/insurance-v1-fallback.json' with { type: 'json' };
import investorFallback from '../../data/network-metrics/investor-v1-fallback.json' with { type: 'json' };
import {
  ACCEPTED_SPECIALIST_FINGERPRINTS,
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
import type { LoadedSpecialistContract, SpecialistHubPresentation } from './types.ts';

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

function validated(hub: SpecialistHubId, raw: unknown): Record<string, unknown> {
  const value = hub === 'contractor' ? validateContractorManifest(raw)
    : hub === 'senior' ? validateSeniorManifest(raw)
      : hub === 'move' ? validateMoveManifest(raw)
        : hub === 'lender' ? validateLenderManifest(raw)
          : hub === 'insurance' ? validateInsuranceManifest(raw)
            : validateInvestorManifest(raw);
  if (value.sourceFingerprint !== ACCEPTED_SPECIALIST_FINGERPRINTS[hub]) {
    throw new Error(`${hub}: specialist fingerprint is not accepted by AskTrustHub`);
  }
  return value;
}

export async function loadSpecialistContract(
  hub: SpecialistHubId,
  options: LoadSpecialistOptions = {},
): Promise<LoadedSpecialistContract> {
  const config = SPECIALIST_SOURCES[hub];
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const fallbackRaw = options.fallbackRaw ?? readFallback(hub);
  let origin: 'UPSTREAM' | 'FALLBACK' = 'UPSTREAM';
  let raw: Record<string, unknown>;
  try {
    raw = validated(hub, await fetchUpstream(config, fetchImpl, timeoutMs));
  } catch {
    origin = 'FALLBACK';
    raw = validated(hub, fallbackRaw);
  }
  return { hub, origin, raw, presentation: present(hub, raw, origin) };
}

export async function loadSpecialistNetworkContracts(
  options: LoadSpecialistOptions = {},
): Promise<Record<SpecialistHubId, LoadedSpecialistContract>> {
  const contracts = await Promise.all(SPECIALIST_OWNED_HUBS.map((hub) => loadSpecialistContract(hub, options)));
  return Object.fromEntries(SPECIALIST_OWNED_HUBS.map((hub, index) => [hub, contracts[index]])) as Record<
    SpecialistHubId,
    LoadedSpecialistContract
  >;
}

export async function loadSpecialistCard(
  hub: SpecialistHubId,
  options: LoadSpecialistOptions = {},
): Promise<SpecialistHubPresentation> {
  return (await loadSpecialistContract(hub, options)).presentation;
}

export async function loadSpecialistNetworkCards(
  options: LoadSpecialistOptions = {},
): Promise<Record<SpecialistHubId, SpecialistHubPresentation>> {
  const contracts = await loadSpecialistNetworkContracts(options);
  return Object.fromEntries(SPECIALIST_OWNED_HUBS.map((hub) => [hub, contracts[hub].presentation])) as Record<SpecialistHubId, SpecialistHubPresentation>;
}
