import {CONTROL_PLANE_HUBS,isRecord,oneOf,requiredString,type ControlPlaneHub,type ValidationResult} from './common.ts';

export const CAPABILITY_HEALTH_SCHEMA_VERSION='capability_health.v1' as const;
export const CAPABILITY_HEALTH_STATES=['CURRENT','DELAYED','DEGRADED','UNKNOWN'] as const;
export type CapabilityHealthState=(typeof CAPABILITY_HEALTH_STATES)[number];
export type CapabilityHealthV1={
  schema_version:typeof CAPABILITY_HEALTH_SCHEMA_VERSION; observation_id:string; capability_key:string;
  hub:ControlPlaneHub; status:CapabilityHealthState; reason_code:string; checked_at:string;
  last_success_at?:string; last_failure_at?:string; source_as_of?:string; retrieved_at?:string;
  snapshot_as_of?:string; accepted_at?:string; generated_at?:string; published_at?:string;
  records_observed?:number; previous_records_observed?:number; build_id?:string; contract_version?:string;
  evidence_ref:string; observed_by:string;
};
const clocks=['checked_at','last_success_at','last_failure_at','source_as_of','retrieved_at','snapshot_as_of','accepted_at','generated_at','published_at'] as const;
export function validateCapabilityHealthV1(input:unknown,now=new Date()):ValidationResult<CapabilityHealthV1>{
  if(!isRecord(input))return{ok:false,errors:['observation:not_object']}; const errors:string[]=[];
  oneOf(input,'schema_version',[CAPABILITY_HEALTH_SCHEMA_VERSION],errors); oneOf(input,'hub',CONTROL_PLANE_HUBS,errors); oneOf(input,'status',CAPABILITY_HEALTH_STATES,errors);
  for(const key of ['observation_id','capability_key','reason_code','checked_at','evidence_ref','observed_by'])requiredString(input,key,errors);
  for(const key of clocks){const value=input[key];if(value===undefined)continue;const ms=Date.parse(String(value));if(!Number.isFinite(ms))errors.push(`${key}:invalid_timestamp`);else if(ms>now.getTime()+300_000)errors.push(`${key}:future_timestamp`)}
  for(const key of ['records_observed','previous_records_observed'])if(input[key]!==undefined&&(!Number.isInteger(input[key])||Number(input[key])<0))errors.push(`${key}:invalid_count`);
  return errors.length?{ok:false,errors}:{ok:true,value:input as CapabilityHealthV1};
}
