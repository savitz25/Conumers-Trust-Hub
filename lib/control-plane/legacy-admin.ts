export const LEGACY_MIGRATION_STATUSES=['MIGRATED','FEDERATED','RETAINED_LEGACY','QA_ONLY','MACHINE_ONLY','SAFE_TO_RETIRE','BLOCKED'] as const;
export type LegacyMigrationStatus=(typeof LEGACY_MIGRATION_STATUSES)[number];
export type LegacyAdapterStatus='LIVE'|'NOT_INSTRUMENTED'|'UNAVAILABLE'|'DEGRADED';
export type LegacyAdminSurface={hub:'move'|'insurance'|'lender';surfaceKey:string;displayName:string;capability:string;destinationPath:string;migrationStatus:LegacyMigrationStatus;authRisk:'LEGACY_SHARED_SECRET'|'SPECIALIST_SESSION';status:LegacyAdapterStatus;queueCount:number|null;limitation:string};
export const LEGACY_ADMIN_SURFACES:readonly LegacyAdminSurface[]=[
  ['move','fmcsa','FMCSA operations','source refresh and exception operations','https://www.movetrusthub.com/admin/fmcsa'],
  ['move','bbb','BBB operations','BBB enrichment and review','https://www.movetrusthub.com/admin/bbb'],
  ['move','my-move-users','My Move users','specialist consumer accounts','https://www.movetrusthub.com/admin/users'],
  ['move','portal-claims','Portal claims','legacy Move portal claims','https://www.movetrusthub.com/admin/claims'],
  ['move','portal-disputes','Portal disputes','legacy Move disputes','https://www.movetrusthub.com/admin/disputes'],
  ['move','quotes','Quotes','quote operations','https://www.movetrusthub.com/admin/quotes'],
  ['move','reviews','Reviews','specialist review moderation','https://www.movetrusthub.com/admin/reviews'],
  ['move','suggestions','Company suggestions','specialist company suggestions','https://www.movetrusthub.com/admin/suggestions'],
  ['insurance','enrichment','Enrichment','insurance enrichment operations','https://www.insurancetrusthub.com/admin/enrichment'],
  ['insurance','leads','Leads','insurance lead operations','https://www.insurancetrusthub.com/admin/leads'],
  ['insurance','license-backfill','License backfill','license backfill operations','https://www.insurancetrusthub.com/admin/license-backfill'],
  ['insurance','listing-requests','Listing requests','listing request operations','https://www.insurancetrusthub.com/admin/listing-requests'],
  ['insurance','providers','Providers','provider operations','https://www.insurancetrusthub.com/admin/providers'],
  ['insurance','reviews','Reviews','specialist review moderation','https://www.insurancetrusthub.com/admin/reviews'],
  ['lender','admin','Lender Admin','limited specialist administration','https://www.lendertrusthub.com/admin'],
].map(([hub,surfaceKey,displayName,capability,destinationPath])=>({hub:hub as LegacyAdminSurface['hub'],surfaceKey,displayName,capability,destinationPath,migrationStatus:'RETAINED_LEGACY',authRisk:'LEGACY_SHARED_SECRET',status:'NOT_INSTRUMENTED',queueCount:null,limitation:'No bounded read-only adapter is deployed; absence of data is not reported as zero.'}));

export function validateLegacyAdapterV1(value:unknown){if(!value||typeof value!=='object')return false;const r=value as Record<string,unknown>;return r.schema_version==='legacy_admin_adapter.v1'&&['move','insurance','lender'].includes(String(r.hub))&&typeof r.surface_key==='string'&&typeof r.display_name==='string'&&(r.queue_count===null||Number.isInteger(r.queue_count)&&Number(r.queue_count)>=0)&&['LIVE','NOT_INSTRUMENTED','UNAVAILABLE','DEGRADED'].includes(String(r.status))&&!Object.keys(r).some(k=>/(email|phone|name|quote|review_text|secret|token)/i.test(k)&&!['display_name'].includes(k));}
