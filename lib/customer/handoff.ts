import {
  HANDOFF_AUDIENCE,
  HANDOFF_TTL_SECONDS,
  HOME_STATE_FL,
  HUB_CONTRACTOR,
  SOURCE_FL_DBPR,
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
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function mintHandoffToken(
  secret: string,
  input: {
    nativeProfileId: string;
    slug: string;
    externalKey: string;
    now?: Date;
    ttlSeconds?: number;
    nonce?: string;
  }
): { token: string; payload: HandoffPayload } {
  if (!secret || secret.length < 32) {
    throw new Error('ATH_HANDOFF_SECRET must be at least 32 characters');
  }
  const now = input.now ?? new Date();
  const ttl = input.ttlSeconds ?? HANDOFF_TTL_SECONDS;
  const payload: HandoffPayload = {
    v: 1,
    aud: HANDOFF_AUDIENCE,
    hub_id: HUB_CONTRACTOR,
    native_profile_id: input.nativeProfileId,
    slug: input.slug,
    external_key: input.externalKey,
    source_system: SOURCE_FL_DBPR,
    home_state: HOME_STATE_FL,
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
  if (payload.hub_id !== HUB_CONTRACTOR) throw new HandoffError('unsupported_hub');
  if (payload.home_state !== HOME_STATE_FL) throw new HandoffError('unsupported_state');
  if (payload.source_system !== SOURCE_FL_DBPR) throw new HandoffError('unsupported_source');
  if (payload.exp < Math.floor(now.getTime() / 1000)) throw new HandoffError('expired');
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
