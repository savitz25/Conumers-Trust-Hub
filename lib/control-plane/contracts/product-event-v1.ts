import { CONTROL_PLANE_HUBS, isRecord, oneOf, requiredString, type ControlPlaneHub, type ValidationResult } from './common.ts';

export const PRODUCT_EVENT_SCHEMA_VERSION = 'product_event.v1' as const;
export const SEARCH_TERMINAL_OUTCOMES = ['RESULTS', 'CLARIFICATION', 'FAIL_CLOSED_WITH_ACTION', 'FAIL_CLOSED_DEAD_END', 'ERROR'] as const;
export type SearchTerminalOutcome = (typeof SEARCH_TERMINAL_OUTCOMES)[number];
export const PRODUCT_EVENT_PROHIBITED_FIELDS = ['email', 'phone', 'raw_query', 'query', 'question', 'handoff_token', 'magic_link_token', 'auth_token', 'private_note', 'private_decision', 'street_address', 'personal_name', 'password', 'secret', 'service_role_key'] as const;

export type ProductEventV1 = {
  schema_version: typeof PRODUCT_EVENT_SCHEMA_VERSION;
  event_id: string;
  event_name: string;
  occurred_at: string;
  surface: string;
  hub: ControlPlaneHub;
  route_family?: string;
  jurisdiction?: string;
  profile_class?: string;
  intent?: string;
  terminal_outcome?: SearchTerminalOutcome;
  failure_reason?: string;
  next_action_type?: string;
  auth_state?: 'ANONYMOUS' | 'AUTHENTICATED' | 'UNKNOWN';
  acquisition_source?: 'ORGANIC' | 'MANUAL_OUTREACH' | 'EMAIL_CAMPAIGN' | 'INTERNAL_TEST' | 'UNKNOWN';
  campaign_id?: string;
  duration_ms?: number;
  result_count_bucket?: '0' | '1' | '2-10' | '11-25' | '26-100' | '101-500' | '501-1000' | '1001+';
  build_id?: string;
};

export function validateProductEventV1(input: unknown): ValidationResult<ProductEventV1> {
  if (!isRecord(input)) return { ok: false, errors: ['event:not_object'] };
  const errors: string[] = [];
  oneOf(input, 'schema_version', [PRODUCT_EVENT_SCHEMA_VERSION], errors);
  for (const key of ['event_id', 'event_name', 'occurred_at', 'surface']) requiredString(input, key, errors);
  oneOf(input, 'hub', CONTROL_PLANE_HUBS, errors);
  if (input.terminal_outcome !== undefined) oneOf(input, 'terminal_outcome', SEARCH_TERMINAL_OUTCOMES, errors);
  if(input.auth_state!==undefined)oneOf(input,'auth_state',['ANONYMOUS','AUTHENTICATED','UNKNOWN'],errors);
  if(input.acquisition_source!==undefined)oneOf(input,'acquisition_source',['ORGANIC','MANUAL_OUTREACH','EMAIL_CAMPAIGN','INTERNAL_TEST','UNKNOWN'],errors);
  if(input.result_count_bucket!==undefined)oneOf(input,'result_count_bucket',['0','1','2-10','11-25','26-100','101-500','501-1000','1001+'],errors);
  if(input.duration_ms!==undefined&&(!Number.isInteger(input.duration_ms)||Number(input.duration_ms)<0||Number(input.duration_ms)>300000))errors.push('duration_ms:invalid');
  const lowerKeys = Object.keys(input).map((key) => key.toLowerCase());
  for (const key of PRODUCT_EVENT_PROHIBITED_FIELDS) if (lowerKeys.includes(key)) errors.push(`${key}:prohibited`);
  return errors.length ? { ok: false, errors } : { ok: true, value: input as ProductEventV1 };
}
