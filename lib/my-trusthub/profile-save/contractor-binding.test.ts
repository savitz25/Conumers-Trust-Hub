import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { profileCapability } from '../contracts/v2-3-profile-save.ts';
import { resolveExactProfile } from './identity.ts';
import {
  CONTRACTOR_BINDING_SQL, CONTRACTOR_CANARY, CONTRACTOR_DBPR_NAMESPACE, CONTRACTOR_PARENT_SYNC,
  CONTRACTOR_PROFILE_CLASS, CONTRACTOR_SPECIALIST_ENTITY_ID_FORMAT, classifyContractorRows,
  contractorCanaryEnabled, contractorParentSyncEnabled, contractorReturnAgrees, contractorSpecialistEntityId,
  parseContractorNativeId, type ContractorBindingRow,
} from './contractor-binding.ts';
import { isContractorStage } from './contractor-channel.ts';
import { CONTRACTOR_CONTEXT_HUB, accountContextIssueQuery } from './contractor-context-seam.ts';
import { PRODUCTION_TARGET } from './isolated-config.ts';
import type { FoundationSql } from './p12-p13.ts';
import { RuntimeError } from './runtime.ts';

assert.equal(CONTRACTOR_PARENT_SYNC, 'OFF');
assert.equal(CONTRACTOR_CANARY, 'OFF');
assert.equal(contractorParentSyncEnabled(), false);
assert.equal(contractorCanaryEnabled(), false);
assert.equal(CONTRACTOR_PROFILE_CLASS, 'contractor_profile');
assert.equal(CONTRACTOR_DBPR_NAMESPACE, 'fl.dbpr.license');
assert.equal(CONTRACTOR_SPECIALIST_ENTITY_ID_FORMAT, 'fl.dbpr.license:<DBPR external_key>');

const CANARIES = [
  { externalKey: 'CCC057187', slug: 'ccc057187-a-r-roofing-inc', name: 'A & R ROOFING INC' },
  { externalKey: 'CFC1427249', slug: 'cfc1427249-a-sunny-plumbing-company', name: 'A SUNNY PLUMBING COMPANY' },
  { externalKey: 'CGC1506243', slug: 'cgc1506243-abs-contracting-inc', name: 'ABS CONTRACTING INC' },
] as const;

function row(patch: Partial<ContractorBindingRow> = {}): ContractorBindingRow {
  return {
    id: 'binding-1', network_entity_id: 'entity-1', binding_status: 'accepted',
    specialist_entity_type: 'contractor_profile', specialist_entity_id: 'fl.dbpr.license:CCC057187',
    identifier_namespace: 'fl.dbpr.license', source_identifier: 'CCC057187', jurisdiction: 'FL',
    entity_status: 'active', canonical_public_profile_ref: '/contractors/ccc057187-a-r-roofing-inc', ...patch,
  };
}

function denied(nativeId: string, rows: ContractorBindingRow[]) {
  const decision = classifyContractorRows(nativeId, rows);
  assert.equal(decision.outcome, 'denied');
  if (decision.outcome !== 'denied') throw new Error('expected a denial');
  return decision.reason;
}

function stage(nativeId: string, slug: string, profileClass = 'contractor_profile') {
  const profile = { hub: 'contractor' as const, nativeId, profileClass };
  return {
    version: 'v2-3/selected-profiles/3' as const, sourceHub: 'contractor' as const, audience: 'ask' as const,
    selected: [{ localItemId: slug, revision: '1', digest: 'a'.repeat(64), profile }],
    returnTask: { kind: 'profile' as const, hub: 'contractor' as const, canonicalSlug: slug, profile, returnPath: `/contractors/${slug}` },
  };
}

test('A exact DBPR keys are accepted and the slug is not the identity', () => {
  for (const canary of CANARIES) {
    const nativeId = contractorSpecialistEntityId(canary.externalKey);
    assert.equal(nativeId, `fl.dbpr.license:${canary.externalKey}`);
    const parts = nativeId!.split(':');
    assert.deepEqual(parts, ['fl.dbpr.license', canary.externalKey]);
    const decision = classifyContractorRows(nativeId!, [row({
      specialist_entity_id: nativeId!, source_identifier: canary.externalKey,
      canonical_public_profile_ref: `/contractors/${canary.slug}`,
    })]);
    assert.equal(decision.outcome, 'eligible');
    if (decision.outcome === 'eligible') assert.equal(contractorReturnAgrees(decision, `/contractors/${canary.slug}`), true);
    assert.equal(isContractorStage(stage(nativeId!, canary.slug)), true);
  }
  assert.equal(parseContractorNativeId('ccc057187-a-r-roofing-inc'), null);
});

test('B C D E F G wrong key, class, namespace, multiples, review, and inactive are denied', () => {
  assert.equal(denied('fl.dbpr.license:CCC057188', []), 'missing');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row({ source_identifier: 'CFC1427249', specialist_entity_id: 'fl.dbpr.license:CFC1427249' })]), 'identity_disagreement');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row({ specialist_entity_type: 'marketplace_company' })]), 'wrong_class');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row({ identifier_namespace: 'nj.dca.license' })]), 'identity_disagreement');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row(), row({ id: 'binding-2' })]), 'ambiguous');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row(), row({ id: 'binding-null', specialist_entity_id: 'fixture:null', jurisdiction: null })]), 'ambiguous');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row(), row({ id: 'binding-nj', specialist_entity_id: 'fixture:nj', jurisdiction: 'NJ' })]), 'ambiguous');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row({ specialist_entity_id: 'fixture:nj', jurisdiction: 'NJ' })]), 'identity_disagreement');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row({ specialist_entity_id: 'fixture:null', jurisdiction: null })]), 'identity_disagreement');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row({ binding_status: 'review_required' })]), 'review_required');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row({ entity_status: 'retired' })]), 'inactive');
  assert.equal(denied('fl.dbpr.license:CCC057187', [row({ canonical_public_profile_ref: '/providers/ccc057187-a-r-roofing-inc' })]), 'identity_disagreement');
  assert.equal(denied('11111111-1111-4111-8111-111111111111', [row()]), 'identity_disagreement');
  assert.equal(contractorSpecialistEntityId('ccc057187'), null);
  assert.equal(contractorSpecialistEntityId(' CCC057187 '), null);
  assert.equal(parseContractorNativeId('fl.dbpr.license:ccc057187'), null);
  assert.equal(parseContractorNativeId('fl.dbpr.license: CCC057187'), null);
  assert.equal(parseContractorNativeId(' fl.dbpr.license:CCC057187'), null);
  assert.equal(denied('fl.dbpr.license:ccc057187', []), 'identity_disagreement');
  assert.equal(denied(' fl.dbpr.license:CCC057187', [row()]), 'identity_disagreement');
  assert.equal(contractorReturnAgrees(classifyContractorRows('fl.dbpr.license:CCC057187', [row()]), '/contractors/someone-else'), false);
});

test('a browser network UUID, a slug, and the wrong class are not queried', async () => {
  let queried = false;
  const sql: FoundationSql = { async query() { queried = true; return { rows: [] }; } };
  for (const identity of [
    { hub: 'contractor' as const, nativeId: '11111111-1111-4111-8111-111111111111', profileClass: 'contractor_profile' },
    { hub: 'contractor' as const, nativeId: 'ccc057187-a-r-roofing-inc', profileClass: 'contractor_profile' },
    { hub: 'contractor' as const, nativeId: 'fl.dbpr.license:CCC057187', profileClass: 'marketplace_company' },
  ]) {
    const profile = await resolveExactProfile(identity, {
      resolve: async () => ({ identity, published: true, supportedClass: true }),
    }, sql);
    assert.equal(profile, null);
  }
  assert.equal(queried, false);
  const extra = stage('fl.dbpr.license:CCC057187', 'ccc057187-a-r-roofing-inc');
  const withUuid = { ...extra, networkEntityId: '11111111-1111-4111-8111-111111111111' };
  assert.equal(isContractorStage(withUuid), false);
  const disagreed = stage('fl.dbpr.license:CCC057187', 'ccc057187-a-r-roofing-inc');
  disagreed.selected[0]!.profile = { ...disagreed.selected[0]!.profile, nativeId: 'fl.dbpr.license:CFC1427249' };
  assert.equal(isContractorStage(disagreed), false);
});

test('resolution uses the DBPR function, fails closed on several rows, and does not save review_required', async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const many: FoundationSql = {
    async query() { throw new Error('classify throws before a second read'); },
  };
  const identity = { hub: 'contractor' as const, nativeId: 'fl.dbpr.license:CCC057187', profileClass: 'contractor_profile' as const };
  const ambiguous: FoundationSql = {
    async query<T>(text: string, values: unknown[]) {
      calls.push({ text, values });
      return { rows: [row(), row({ id: 'binding-2' })] as T[] };
    },
  };
  await assert.rejects(() => resolveExactProfile(identity, {
    resolve: async () => ({ identity, published: true, supportedClass: true }),
  }, ambiguous), (error: unknown) => error instanceof RuntimeError && error.code === 'conflict');
  assert.equal(calls[0]?.text, CONTRACTOR_BINDING_SQL);
  assert.equal(String(calls[0]?.text).includes('prod_contractor_dbpr_binding_for'), true);
  assert.deepEqual(calls[0]?.values, ['fl.dbpr.license:CCC057187']);
  const review: FoundationSql = {
    async query<T>(text: string, values: unknown[]) {
      assert.equal(text, CONTRACTOR_BINDING_SQL);
      assert.deepEqual(values, [identity.nativeId]);
      return { rows: [row({ binding_status: 'review_required' })] as T[] };
    },
  };
  const profile = await resolveExactProfile(identity, {
    resolve: async () => ({ identity, published: true, supportedClass: true }),
  }, review);
  assert.equal(profile?.binding?.status, 'review_required');
  assert.equal(profile ? profileCapability(profile) : '', 'IDENTITY_REVIEW_REQUIRED');
  void many;
});

test('packet 16 is prepared only and contractor requests the shared hub issuer', () => {
  const preflight = readFileSync(new URL('../../../docs/my-trusthub/v2/production/16-ask-prod-contractor-dbpr-preflight.sql', import.meta.url), 'utf8');
  const forward = readFileSync(new URL('../../../docs/my-trusthub/v2/production/16-ask-prod-contractor-dbpr-binding-forward.sql', import.meta.url), 'utf8');
  const rollback = readFileSync(new URL('../../../docs/my-trusthub/v2/production/16-ask-prod-contractor-dbpr-binding-rollback.sql', import.meta.url), 'utf8');
  const assembly = readFileSync(new URL('./preview-assembly.ts', import.meta.url), 'utf8');
  for (const canary of CANARIES) {
    assert.equal(preflight.includes(canary.externalKey), true);
    assert.equal(preflight.includes(`/contractors/${canary.slug}`), true);
    assert.equal(forward.includes(canary.name), true);
    assert.equal(forward.includes(`fl.dbpr.license:${canary.externalKey}`.replace('fl.dbpr.license:', '')), true);
  }
  assert.equal(preflight.includes('canonical_public_profile_ref'), true);
  assert.equal(preflight.includes('having count(*) > 1'), true);
  assert.match(preflight, /identifier_namespace is distinct from 'fl\.dbpr\.license'/);
  assert.equal(forward.includes('n <> 3'), true);
  assert.equal(forward.includes('prod_contractor_dbpr_binding_for'), true);
  assert.match(forward, /b\.source_identifier_normalized = lower\(btrim\(split_part\(\$1, ':', 2\)\)\)/);
  assert.match(forward, /lower\(btrim\(b\.specialist_entity_id\)\) = lower\(btrim\(\$1\)\)/);
  assert.equal(forward.includes("b.source_identifier = split_part($1, ':', 2)"), false);
  assert.equal(forward.includes('b.specialist_entity_id = $1'), false);
  assert.match(forward, /split_part\(\$1, ':', 2\) ~ '\^\[A-Z\]\{1,4\}\[0-9\]\{3,9\}\$'/);
  assert.equal(forward.includes("source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1506243')"), true);
  assert.equal(preflight.includes("source_identifier_normalized in ('ccc057187', 'cfc1427249', 'cgc1506243')"), true);
  assert.equal(preflight.includes("lower(btrim(specialist_entity_id)) in ('fl.dbpr.license:ccc057187', 'fl.dbpr.license:cfc1427249', 'fl.dbpr.license:cgc1506243')"), true);
  assert.equal(forward.includes("lower(btrim(specialist_entity_id)) in ('fl.dbpr.license:ccc057187', 'fl.dbpr.license:cfc1427249', 'fl.dbpr.license:cgc1506243')"), true);
  assert.equal(preflight.includes("source_identifier in ('CCC057187', 'CFC1427249', 'CGC1506243')"), false);
  assert.match(forward, /identifier_namespace='fl\.dbpr\.license' or lower\(btrim\(specialist_entity_id\)\) ~ '\^fl\\\.dbpr\\\.license:\[a-z\]\{1,4\}\[0-9\]\{3,9\}\$'/);
  assert.match(forward, /lower\(btrim\(b\.specialist_entity_id\)\) ~ '\^fl\\\.dbpr\\\.license:\[a-z\]\{1,4\}\[0-9\]\{3,9\}\$'/);
  assert.equal(forward.includes("specialist_entity_id ~ '^fl\\.dbpr\\.license:[A-Z]{1,4}[0-9]{3,9}$'"), false);
  assert.equal(forward.includes("b.jurisdiction = 'FL'"), false);
  assert.equal(preflight.includes("jurisdiction = 'FL'"), false);
  assert.equal(forward.includes('NOT APPLIED'), true);
  assert.equal(/\bdelete\b/i.test(rollback), false);
  assert.equal(rollback.includes('valid_to = clock_timestamp()'), true);
  assert.equal(rollback.includes('consumer.consumer_saved_entities'), true);
  assert.deepEqual(accountContextIssueQuery(PRODUCTION_TARGET, CONTRACTOR_CONTEXT_HUB), { text: 'select v23_private.prod_hub_issue_context($1,$2,$3,$4) as issued', hubArgument: true });
  assert.deepEqual(accountContextIssueQuery(PRODUCTION_TARGET, 'move'), { text: 'select v23_private.prod_issue_context($1,$2,$3) as issued', hubArgument: false });
  assert.equal(CONTRACTOR_CONTEXT_HUB, 'contractor');
  assert.match(assembly, /const hub = a\.caller\.hub;/);
  assert.match(assembly, /const issue = accountContextIssueQuery\(this\.target, hub\);/);
  assert.match(assembly, /issue\.hubArgument\s*\? \[JSON\.stringify\(proof\), p\.subject, p\.sessionBinding, hub\]/);
  assert.equal(assembly.includes('issueSharedAccountContext'), false);
  const authorityForward = readFileSync(new URL('../../../docs/my-trusthub/v2/production/16-ask-prod-contractor-authority-forward.sql', import.meta.url), 'utf8');
  const authorityRollback = readFileSync(new URL('../../../docs/my-trusthub/v2/production/16-ask-prod-contractor-authority-rollback.sql', import.meta.url), 'utf8');
  for (const packet of [preflight, forward, rollback, authorityForward, authorityRollback]) {
    assert.equal(packet.includes('hub_issue_context'), false);
    assert.equal(packet.includes('issue_context'), false);
  }
  assert.equal(assembly.includes("serviceHub === 'insurance' ? { ...link, requestPrefix: link.browser }"), true);
  assert.equal(assembly.includes("requestPrefix: claims.browser"), true);
  assert.equal(assembly.includes("sourceHub === 'insurance') throw new RuntimeError('unavailable')"), false);
  assert.equal(assembly.includes('prod_investor'), false);
  const returnTask = assembly.slice(assembly.indexOf('returnTask: async'), assembly.indexOf('project: async'));
  assert.match(returnTask, /this\.contractorBinding\(identity, db\)/);
  assert.equal(returnTask.split('this.contractorBinding(identity, db)').join('').includes('this.contractorBinding(identity)'), false);
  assert.match(preflight, /binding_status = 'review_required'/);
  assert.match(preflight, /ALREADY_APPLIED_HOLD/);
  assert.match(preflight, /not a silent skip/);
  assert.match(preflight, /Do not treat result 5 as clean/);
  const authorityBody = authorityForward.slice(authorityForward.indexOf('create or replace function v23_private.authority()'), authorityForward.lastIndexOf('do $$ begin'));
  assert.match(authorityBody, /c->>'hub' in \('move','insurance','lender','contractor'\)/);
  assert.match(authorityBody, /contractor_profile/);
  assert.match(authorityBody, /fl\\\.dbpr\\\.license/);
  assert.equal(authorityBody.includes('senior'), false);
  assert.equal(authorityBody.includes('investor'), false);
  assert.match(authorityForward, /already applied; review, do not re-apply/);
  assert.match(authorityRollback, /c->>'hub' in \('move','insurance','lender'\)/);
  assert.equal(/\bdelete\b/i.test(authorityRollback), false);
  assert.equal(authorityForward.includes('NOT APPLIED'), true);
  assert.equal(authorityRollback.includes('NOT APPLIED'), true);
});
