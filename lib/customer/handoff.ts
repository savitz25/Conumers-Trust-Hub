import {
  HANDOFF_AUDIENCE,
  HANDOFF_TTL_SECONDS,
  HOME_STATE_FL,
  HUB_CONTRACTOR,
  SOURCE_FL_DBPR,
  type CustomerHubId,
  type HandoffPayload,
} from './types.ts';
import { hmacSha256, randomToken, timingSafeEqualText } from './crypto.ts';

export type HandoffVerifyFailure =
  | 'malformed'
  | 'tampered'
  | 'expired'
  | 'wrong_audience'
  | 'unsupported_hub'
  | 'unsupported_state'
  | 'unsupported_source'
  | 'reused_nonce';

export class HandoffError extends Error {
  readonly code: HandoffVerifyFailure;
  constructor(code: HandoffVerifyFailure) {
    super(code);
    this.name = 'HandoffError';
    this.code = code;
  }
}

function encodePayload(payload: HandoffPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(raw: string): HandoffPayload | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as HandoffPayload;
    if (parsed?.v !== 1 && parsed?.v !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isCompleteV2(payload: HandoffPayload): boolean {
  const capability = payload.hub_id === 'contractor'
    ? { namespace: 'credential', entityClass: 'contractor' }
    : null;
  if (!capability) return true;
  return payload.identifier_namespace === capability.namespace
    && payload.entity_class === capability.entityClass
    && payload.source_system === SOURCE_FL_DBPR
    && payload.home_state === HOME_STATE_FL
    && typeof payload.canonical_profile_url === 'string'
    && payload.canonical_profile_url.length > 0
    && typeof payload.display_name === 'string'
    && payload.display_name.trim().length > 0;
}

export function mintHandoffToken(
  secret: string,
  input: {
    hubId?: CustomerHubId;
    nativeProfileId: string;
    slug: string;
    externalKey: string;
    now?: Date;
    ttlSeconds?: number;
    nonce?: string;
    sourceSystem?: string;
    homeState?: string | null;
    identifierNamespace?: HandoffPayload['identifier_namespace'];
    entityClass?: HandoffPayload['entity_class'];
    providerClass?: HandoffPayload['provider_class'];
    canonicalProfileUrl?: string;
    displayName?: string;
    version?: 1 | 2;
  }
): { token: string; payload: HandoffPayload } {
  if (!secret || secret.length < 32) {
    throw new Error('ATH_HANDOFF_SECRET must be at least 32 characters');
  }
  const now = input.now ?? new Date();
  const ttl = input.ttlSeconds ?? HANDOFF_TTL_SECONDS;
  const completeContractorV2 = input.hubId === HUB_CONTRACTOR
    && input.identifierNamespace === 'credential'
    && input.entityClass === 'contractor'
    && Boolean(input.canonicalProfileUrl)
    && Boolean(input.displayName?.trim());
  const payload: HandoffPayload = {
    v: input.version ?? (input.hubId === HUB_CONTRACTOR || !input.hubId ? (completeContractorV2 ? 2 : 1) : 2),
    aud: HANDOFF_AUDIENCE,
    hub_id: input.hubId ?? HUB_CONTRACTOR,
    native_profile_id: input.nativeProfileId,
    slug: input.slug,
    external_key: input.externalKey,
    source_system: input.sourceSystem ?? SOURCE_FL_DBPR,
    home_state: input.homeState === undefined ? HOME_STATE_FL : input.homeState,
    identifier_namespace: input.identifierNamespace,
    entity_class: input.entityClass,
    provider_class: input.providerClass,
    canonical_profile_url: input.canonicalProfileUrl,
    display_name: input.displayName,
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(now.getTime() / 1000) + ttl,
    nonce: input.nonce ?? randomToken(24),
  };
  const body = encodePayload(payload);
  const sig = hmacSha256(secret, body);
  return { token: `${body}.${sig}`, payload };
}

export function parseAndAuthenticateHandoff(
  secret: string,
  token: string,
  now: Date = new Date()
): HandoffPayload {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new HandoffError('malformed');
  }
  const [body, sig] = parts;
  const expected = hmacSha256(secret, body);
  if (!timingSafeEqualText(sig, expected)) {
    throw new HandoffError('tampered');
  }
  const payload = decodePayload(body);
  if (!payload) throw new HandoffError('malformed');
  if (payload.aud !== HANDOFF_AUDIENCE) throw new HandoffError('wrong_audience');
  if (payload.exp < Math.floor(now.getTime() / 1000)) throw new HandoffError('expired');
  if (payload.v === 1 && payload.hub_id !== HUB_CONTRACTOR) throw new HandoffError('unsupported_hub');
  if (payload.v === 1 && payload.home_state !== HOME_STATE_FL) throw new HandoffError('unsupported_state');
  if (payload.v === 1 && payload.source_system !== SOURCE_FL_DBPR) throw new HandoffError('unsupported_source');
  if (payload.v === 2 && !isCompleteV2(payload)) throw new HandoffError('malformed');
  return payload;
}

export function mutateHandoffToken(
  token: string,
  mutator: (payload: HandoffPayload) => HandoffPayload,
  secret: string
): string {
  const [body] = token.split('.');
  const payload = decodePayload(body);
  if (!payload) throw new Error('cannot mutate malformed token');
  const next = encodePayload(mutator(payload));
  return `${next}.${hmacSha256(secret, next)}`;
}
