import type { SqlClient } from './sql.ts';

export const R2_FIXTURE_BRANCH = 'ath-launch-001b-r2-preview-fixture';
export const R2_FIXTURE_CONFIRMATION = 'ATH-LAUNCH-001B-R2';

export const R2_FIXTURE = {
  ownerEmail: 'owner@ath-browser-fixture.test',
  emptyEmail: 'empty@ath-browser-fixture.test',
  staffEmail: 'staff@ath-browser-fixture.test',
  revokedEmail: 'revoked@ath-browser-fixture.test',
  invitedEmail: 'invitee@ath-browser-fixture.test',
  users: {
    owner: 'a2100000-0000-4000-8000-000000000001',
    empty: 'a2100000-0000-4000-8000-000000000002',
    staff: 'a2100000-0000-4000-8000-000000000003',
    revoked: 'a2100000-0000-4000-8000-000000000004',
  },
  organizations: {
    harbor: 'a2200000-0000-4000-8000-000000000001',
    seaside: 'a2200000-0000-4000-8000-000000000002',
    denied: 'a2200000-0000-4000-8000-000000000003',
  },
  profiles: {
    builder: 'a2300000-0000-4000-8000-000000000001',
    moving: 'a2300000-0000-4000-8000-000000000002',
    capital: 'a2300000-0000-4000-8000-000000000003',
    senior: 'a2300000-0000-4000-8000-000000000004',
    monitored: 'a2300000-0000-4000-8000-000000000005',
    needsInfo: 'a2300000-0000-4000-8000-000000000006',
    inReview: 'a2300000-0000-4000-8000-000000000007',
    denied: 'a2300000-0000-4000-8000-000000000008',
  },
} as const;

export type FixtureEnvironment = Record<string, string | undefined>;

export function assertR2FixtureEnvironment(env: FixtureEnvironment, confirmation: string): void {
  if (env.VERCEL_ENV === 'production' || env.NODE_ENV !== 'production') throw new Error('fixture_environment_refused');
  if (env.VERCEL_ENV !== 'preview' || env.ATH_FIXTURE_ENV !== 'preview') throw new Error('fixture_environment_refused');
  if (env.ATH_ALLOW_SYNTHETIC_FIXTURE !== '1') throw new Error('fixture_not_enabled');
  if (env.VERCEL_GIT_COMMIT_REF !== R2_FIXTURE_BRANCH) throw new Error('fixture_branch_refused');
  if (confirmation !== R2_FIXTURE_CONFIRMATION) throw new Error('fixture_confirmation_refused');
  if (!env.ATH_PREVIEW_DB_DATABASE_URL) throw new Error('fixture_database_missing');
  if (env.ATH_PREVIEW_DB_DATABASE_URL === env.neon_tech_database) throw new Error('fixture_database_not_isolated');
}

const ids = R2_FIXTURE;
const managedProfiles = [
  { row: 'a2400000-0000-4000-8000-000000000001', native: ids.profiles.builder, org: ids.organizations.harbor, hub: 'contractor', slug: 'harbor-test-builders', key: 'ATH-FIXTURE-CBC-0001', source: 'synthetic_fixture', state: 'FL', name: 'Harbor Test Builders', ns: 'credential', entity: 'contractor' },
  { row: 'a2400000-0000-4000-8000-000000000002', native: ids.profiles.moving, org: ids.organizations.harbor, hub: 'move', slug: 'harbor-test-moving', key: 'ATH-FIXTURE-USDOT-0002', source: 'synthetic_fixture', state: 'FL', name: 'Harbor Test Moving', ns: 'USDOT', entity: 'mover' },
  { row: 'a2400000-0000-4000-8000-000000000003', native: ids.profiles.capital, org: ids.organizations.harbor, hub: 'lender', slug: 'harbor-test-capital', key: 'ATH-FIXTURE-NMLS-0003', source: 'synthetic_fixture', state: 'FL', name: 'Harbor Test Capital', ns: 'NMLS', entity: 'institution' },
  { row: 'a2400000-0000-4000-8000-000000000004', native: ids.profiles.senior, org: ids.organizations.seaside, hub: 'senior', slug: 'seaside-test-senior', key: 'ATH-FIXTURE-CCN-0004', source: 'synthetic_fixture', state: 'FL', name: 'Seaside Test Senior Services', ns: 'CMS_CCN', entity: 'nursing_home' },
  { row: 'a2400000-0000-4000-8000-000000000005', native: ids.profiles.monitored, org: ids.organizations.seaside, hub: 'contractor', slug: 'seaside-test-contracting', key: 'ATH-FIXTURE-CBC-0005', source: 'synthetic_fixture', state: 'FL', name: 'Seaside Test Contracting', ns: 'credential', entity: 'contractor' },
] as const;
const claimOnlyProfiles = [
  { row: 'a2400000-0000-4000-8000-000000000006', native: ids.profiles.needsInfo, org: ids.organizations.harbor, hub: 'insurance', slug: 'harbor-test-insurance', key: 'ATH-FIXTURE-NAIC-0006', source: 'synthetic_fixture', state: 'FL', name: 'Harbor Test Insurance', ns: 'NAIC', entity: 'legal_insurer', status: 'needs_info' },
  { row: 'a2400000-0000-4000-8000-000000000007', native: ids.profiles.inReview, org: ids.organizations.harbor, hub: 'investor', slug: 'harbor-test-advisory', key: 'ATH-FIXTURE-CRD-0007', source: 'synthetic_fixture', state: 'FL', name: 'Harbor Test Advisory', ns: 'CRD', entity: 'firm', status: 'in_review' },
] as const;

async function upsertProfile(sql: SqlClient, p: (typeof managedProfiles)[number] | (typeof claimOnlyProfiles)[number]) {
  await sql.query(`INSERT INTO ath_hub_profiles(id,hub_id,native_profile_id,native_slug,native_credential_key,native_source_system,home_state,display_name_snapshot,identifier_namespace,entity_class,canonical_url,publication_state)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,'public') ON CONFLICT(id) DO UPDATE SET display_name_snapshot=EXCLUDED.display_name_snapshot,last_validated_at=now()`,
  [p.row,p.hub,p.native,p.slug,p.key,p.source,p.state,p.name,p.ns,p.entity]);
}

export async function createR2Fixture(sql: SqlClient): Promise<void> {
  const users = [[ids.users.owner,ids.ownerEmail],[ids.users.empty,ids.emptyEmail],[ids.users.staff,ids.staffEmail],[ids.users.revoked,ids.revokedEmail]];
  for (const [id,email] of users) await sql.query(`INSERT INTO ath_users(id,email,email_normalized,email_confirmed_at,status) VALUES($1,$2,$2,now(),'active') ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,email_normalized=EXCLUDED.email_normalized,status='active'`,[id,email]);
  for (const [id,name] of [[ids.organizations.harbor,'Harbor Test Holdings'],[ids.organizations.seaside,'Seaside Test Services'],[ids.organizations.denied,'Denied Fixture Organization']]) await sql.query(`INSERT INTO ath_organizations(id,display_name,status) VALUES($1,$2,'active') ON CONFLICT(id) DO UPDATE SET display_name=EXCLUDED.display_name,status='active'`,[id,name]);
  const memberships = [
    ['a2500000-0000-4000-8000-000000000001',ids.organizations.harbor,ids.users.owner,'owner','active'],
    ['a2500000-0000-4000-8000-000000000002',ids.organizations.seaside,ids.users.owner,'owner','active'],
    ['a2500000-0000-4000-8000-000000000003',ids.organizations.seaside,ids.users.staff,'staff','active'],
    ['a2500000-0000-4000-8000-000000000004',ids.organizations.denied,ids.users.revoked,'owner','revoked'],
  ];
  for (const m of memberships) await sql.query(`INSERT INTO ath_memberships(id,org_id,user_id,role,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,status=EXCLUDED.status`,m);
  for (const p of [...managedProfiles,...claimOnlyProfiles]) await upsertProfile(sql,p);
  for (let i=0;i<managedProfiles.length;i++) {
    const p=managedProfiles[i],claimId=`a2600000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,grantId=`a2700000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
    await sql.query(`INSERT INTO ath_claims(id,org_id,hub_profile_id,claimant_user_id,status,verification_method,relationship_type,free_email) VALUES($1,$2,$3,$4,'approved','manual_review','owner',false) ON CONFLICT(id) DO UPDATE SET status='approved'`,[claimId,p.org,p.row,ids.users.owner]);
    await sql.query(`INSERT INTO ath_management_grants(id,org_id,hub_profile_id,status,granted_from_claim_id) VALUES($1,$2,$3,'active',$4) ON CONFLICT(id) DO UPDATE SET status='active'`,[grantId,p.org,p.row,claimId]);
  }
  for (let i=0;i<claimOnlyProfiles.length;i++) { const p=claimOnlyProfiles[i]; await sql.query(`INSERT INTO ath_claims(id,org_id,hub_profile_id,claimant_user_id,status,verification_method,relationship_type,free_email) VALUES($1,$2,$3,$4,$5,'manual_review','owner',false) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status`,[`a2800000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,p.org,p.row,ids.users.owner,p.status]); }

  for (const p of managedProfiles) await sql.query(`INSERT INTO ath_business_profile_revisions(org_id,hub_profile_id,version,updated_at) VALUES($1,$2,1,now()) ON CONFLICT(org_id,hub_profile_id) DO UPDATE SET version=1`,[p.org,p.row]);
  const fieldKeys = ['description','website','public_phone','public_email','founded_year','emergency_service','contact_context'];
  for (const p of managedProfiles) {
    const keys=p.native===ids.profiles.builder?fieldKeys.slice(0,2):fieldKeys;
    const confirmed=p.native===ids.profiles.capital?'2025-01-01T00:00:00Z':new Date().toISOString();
    for (const key of keys) await sql.query(`INSERT INTO ath_business_profile_fields(org_id,hub_profile_id,field_key,value_text,supplied_by_user_id,last_confirmed_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(org_id,hub_profile_id,field_key) DO UPDATE SET value_text=EXCLUDED.value_text,last_confirmed_at=EXCLUDED.last_confirmed_at`,[p.org,p.row,key,`Synthetic ${key}`,ids.users.owner,confirmed]);
    if (p.native!==ids.profiles.builder) {
      for (const [position,category] of ['service','service_area','language'].entries()) await sql.query(`INSERT INTO ath_business_profile_items(org_id,hub_profile_id,category,value_text,position,supplied_by_user_id,last_confirmed_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(org_id,hub_profile_id,category,value_text) DO UPDATE SET last_confirmed_at=EXCLUDED.last_confirmed_at`,[p.org,p.row,category,`Synthetic ${category}`,position,ids.users.owner,confirmed]);
      await sql.query(`INSERT INTO ath_business_profile_hours(org_id,hub_profile_id,weekday,is_closed,opens_at,closes_at,supplied_by_user_id,last_confirmed_at) VALUES($1,$2,1,false,'09:00','17:00',$3,$4) ON CONFLICT(org_id,hub_profile_id,weekday) DO UPDATE SET last_confirmed_at=EXCLUDED.last_confirmed_at`,[p.org,p.row,ids.users.owner,confirmed]);
    }
  }
  await sql.query(`INSERT INTO ath_monitoring_subscriptions(id,org_id,hub_profile_id,enabled,email_enabled,in_app_enabled,created_by_user_id,activated_at,baseline_at) VALUES
    ('a2900000-0000-4000-8000-000000000001',$1,'a2400000-0000-4000-8000-000000000001',false,false,true,$3,NULL,now()),
    ('a2900000-0000-4000-8000-000000000002',$2,'a2400000-0000-4000-8000-000000000005',true,false,true,$3,now(),now())
    ON CONFLICT(id) DO UPDATE SET enabled=EXCLUDED.enabled`,[ids.organizations.harbor,ids.organizations.seaside,ids.users.owner]);
  await sql.query(`INSERT INTO ath_regulatory_change_events(id,contractor_sequence,hub_profile_id,native_profile_id,source_system,source_dataset,source_record_id,change_type,current_state,detected_at,fingerprint_sha256,provenance) VALUES('a2a00000-0000-4000-8000-000000000001',-92001,'a2400000-0000-4000-8000-000000000005',$1,'synthetic_fixture','ath_r2_fixture','fixture-change','SOURCE_REFRESH','{"synthetic":true}',now(),repeat('a',64),'{"fixture":true}') ON CONFLICT(id) DO NOTHING`,[ids.profiles.monitored]);
  await sql.query(`INSERT INTO ath_notifications(id,org_id,user_id,event_key,title,body,payload,hub_profile_id,monitoring_subscription_id,monitoring_event_id) VALUES('a2b00000-0000-4000-8000-000000000001',$1,$2,'synthetic_source_change','Synthetic source-change notice','A synthetic preview-only source change is ready to review.','{"fixture":true}','a2400000-0000-4000-8000-000000000005','a2900000-0000-4000-8000-000000000002','a2a00000-0000-4000-8000-000000000001') ON CONFLICT(id) DO UPDATE SET read_at=NULL`,[ids.organizations.seaside,ids.users.owner]);
  await sql.query(`INSERT INTO ath_record_issues(id,org_id,hub_profile_id,submitted_by_user_id,issue_type,target_layer,target_record_type,explanation,status,submission_fingerprint) VALUES('a2c00000-0000-4000-8000-000000000001',$1,'a2400000-0000-4000-8000-000000000001',$2,'OUTDATED_INFORMATION','AUTHORITATIVE_EVIDENCE','PROFILE','Synthetic preview fixture issue requiring additional information.','NEEDS_INFORMATION','ath-r2-synthetic-issue') ON CONFLICT(id) DO UPDATE SET status='NEEDS_INFORMATION'`,[ids.organizations.harbor,ids.users.owner]);
  await sql.query(`INSERT INTO ath_business_replies(id,org_id,hub_profile_id,submitted_by_user_id,reply_type,target_type,status) VALUES('a2d00000-0000-4000-8000-000000000001',$1,'a2400000-0000-4000-8000-000000000001',$2,'GENERAL_RESPONSE','PROFILE_GENERAL','DRAFT') ON CONFLICT(id) DO UPDATE SET status='DRAFT'`,[ids.organizations.harbor,ids.users.owner]);
  await sql.query(`INSERT INTO ath_business_reply_revisions(id,reply_id,revision_number,body,created_by_user_id,moderation_status) VALUES('a2e00000-0000-4000-8000-000000000001','a2d00000-0000-4000-8000-000000000001',1,'This is a clearly synthetic preview-only draft business response for browser acceptance testing.',$1,'DRAFT') ON CONFLICT(id) DO NOTHING`,[ids.users.owner]);
  await sql.query(`UPDATE ath_business_replies SET active_revision_id='a2e00000-0000-4000-8000-000000000001' WHERE id='a2d00000-0000-4000-8000-000000000001'`);
  await sql.query(`INSERT INTO ath_organization_invitations(id,org_id,invited_email_normalized,invited_role,invited_by_user_id,status,token_hash,expires_at) VALUES('a2f00000-0000-4000-8000-000000000001',$1,$2,'manager',$3,'PENDING',repeat('b',64),now()+interval '14 days') ON CONFLICT(id) DO UPDATE SET status='PENDING',expires_at=EXCLUDED.expires_at`,[ids.organizations.seaside,ids.invitedEmail,ids.users.owner]);
}

export async function verifyR2Fixture(sql: SqlClient) {
  const row=(await sql.query<Record<string,number>>(`SELECT
    (SELECT count(*)::int FROM ath_users WHERE email_normalized LIKE '%@ath-browser-fixture.test') users,
    (SELECT count(*)::int FROM ath_organizations WHERE id IN ($1,$2,$3)) organizations,
    (SELECT count(*)::int FROM ath_hub_profiles WHERE native_source_system='synthetic_fixture') profiles,
    (SELECT count(*)::int FROM ath_claims WHERE claimant_user_id=$4) claims,
    (SELECT count(*)::int FROM ath_management_grants WHERE org_id IN ($1,$2)) grants,
    (SELECT count(*)::int FROM ath_monitoring_subscriptions WHERE id::text LIKE 'a2900000-%') monitoring,
    (SELECT count(*)::int FROM ath_record_issues WHERE submission_fingerprint='ath-r2-synthetic-issue') issues,
    (SELECT count(*)::int FROM ath_organization_invitations WHERE id='a2f00000-0000-4000-8000-000000000001') invitations`,[ids.organizations.harbor,ids.organizations.seaside,ids.organizations.denied,ids.users.owner])).rows[0];
  return row;
}

export async function cleanupR2Fixture(sql: SqlClient): Promise<void> {
  await sql.query(`DELETE FROM ath_notifications WHERE id='a2b00000-0000-4000-8000-000000000001'`);
  await sql.query(`DELETE FROM ath_regulatory_change_events WHERE id='a2a00000-0000-4000-8000-000000000001'`);
  await sql.query(`DELETE FROM ath_monitoring_subscriptions WHERE id::text LIKE 'a2900000-%'`);
  await sql.query(`UPDATE ath_business_replies SET active_revision_id=NULL,published_revision_id=NULL WHERE id='a2d00000-0000-4000-8000-000000000001'`);
  await sql.query(`DELETE FROM ath_business_reply_revisions WHERE id='a2e00000-0000-4000-8000-000000000001'`);
  await sql.query(`DELETE FROM ath_business_replies WHERE id='a2d00000-0000-4000-8000-000000000001'`);
  await sql.query(`DELETE FROM ath_record_issues WHERE id='a2c00000-0000-4000-8000-000000000001'`);
  for (const table of ['ath_business_profile_hours','ath_business_profile_items','ath_business_profile_fields','ath_business_profile_revisions']) await sql.query(`DELETE FROM ${table} WHERE hub_profile_id::text LIKE 'a2400000-%'`);
  await sql.query(`DELETE FROM ath_management_grants WHERE id::text LIKE 'a2700000-%'`);
  await sql.query(`DELETE FROM ath_claims WHERE id::text LIKE 'a2600000-%' OR id::text LIKE 'a2800000-%'`);
  await sql.query(`DELETE FROM ath_organization_invitations WHERE id='a2f00000-0000-4000-8000-000000000001'`);
  await sql.query(`DELETE FROM ath_memberships WHERE id::text LIKE 'a2500000-%'`);
  await sql.query(`DELETE FROM ath_hub_profiles WHERE native_source_system='synthetic_fixture'`);
  await sql.query(`DELETE FROM ath_auth_challenges WHERE email_normalized LIKE '%@ath-browser-fixture.test'`);
  await sql.query(`DELETE FROM ath_sessions WHERE user_id::text LIKE 'a2100000-%'`);
  await sql.query(`DELETE FROM ath_rate_events WHERE rate_key LIKE '%ath-browser-fixture.test%'`);
  await sql.query(`ALTER TABLE ath_audit_events DISABLE TRIGGER ath_audit_events_no_delete`);
  try {
    await sql.query(`DELETE FROM ath_audit_events WHERE actor_user_id::text LIKE 'a2100000-%' OR object_id::text LIKE 'a2100000-%' OR org_id::text LIKE 'a2200000-%'`);
  } finally {
    await sql.query(`ALTER TABLE ath_audit_events ENABLE TRIGGER ath_audit_events_no_delete`);
  }
  await sql.query(`DELETE FROM ath_users WHERE id::text LIKE 'a2100000-%'`);
  await sql.query(`DELETE FROM ath_organizations WHERE id::text LIKE 'a2200000-%'`);
}
