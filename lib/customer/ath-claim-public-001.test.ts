import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_CLAIM_CONTRACT } from './public-claim-contract.ts';

const root=process.cwd();
const read=(p:string)=>fs.readFileSync(path.join(root,p),'utf8');
const publicFiles=['app/claim/what-claiming-means/page.tsx','app/claim/continue/page.tsx','app/claim/help/page.tsx','app/how-we-make-money/page.tsx','app/privacy/page.tsx','app/promise/page.tsx','app/who-we-are/page.tsx','app/corrections/page.tsx','components/customer/OrganizationTeamPanel.tsx','lib/content.ts'];

test('canonical contract separates access, evidence, corrections, responses, money and monitoring',()=>{
  const c=JSON.stringify(PUBLIC_CLAIM_CONTRACT);
  assert.match(PUBLIC_CLAIM_CONTRACT.claimedMeaning,/management access/i);
  assert.match(c,/does not change public evidence/i); assert.match(c,/does not automatically change or remove/i);
  assert.match(c,/does not replace source evidence or mean Trust Hub agrees/i); assert.match(c,/Purchasing software never changes/i);
  assert.match(c,/only for supported Trust Hubs and sources/i); assert.match(c,/company email is not sufficient by itself/i);
});

test('public explainer is indexable and private routes remain excluded',()=>{
  const page=read(publicFiles[0]),robots=read('app/robots.ts'),sitemap=read('app/sitemap.ts');
  assert.doesNotMatch(page,/noIndex/); assert.match(sitemap,/claim\/what-claiming-means/); assert.doesNotMatch(robots,/['"]\/claim['"]/);
  assert.match(robots,/claim\/continue/); assert.match(robots,/claim\/status/); assert.match(read('app/manage/page.tsx'),/noIndex:true/);
});

test('privacy reflects the customer platform and distinguishes account closure from evidence',()=>{
  const p=read('app/privacy/page.tsx');
  for(const term of ['passwordless','claim records','organizations','memberships','profile management grants','business-supplied information','correction requests','business responses','team invitations','monitoring','transactional','audit','acquisition source'])assert.match(p,new RegExp(term,'i'));
  assert.match(p,/does not automatically delete accurate, publication-eligible government or regulatory evidence/i);
});

test('revenue story contains no public lead promise or pay-to-play promise',()=>{
  const blob=publicFiles.map(read).join('\n');
  assert.doesNotMatch(blob,/opt-in lead products|pay per lead|buy leads|lead marketplace|priority placement|pay to rank/i);
  assert.match(blob,/Paying for software would not alter independent evidence/i);
});

test('billing is not offered as a customer role but historical billing remains renderable',()=>{
  const team=read('components/customer/OrganizationTeamPanel.tsx');
  assert.doesNotMatch(team,/<option value="billing">/); assert.match(team,/Billing \(existing access\)/);
});

test('claim entry, correction, workspace context and counsel flag are present',()=>{
  assert.match(read('app/claim/continue/page.tsx'),/PUBLIC_CLAIM_CONTRACT\.claimedMeaning/);
  assert.match(read('app/corrections/page.tsx'),/Payment and profile claiming are not required/i);
  assert.match(read('app/manage/page.tsx'),/Private business-owner workspace/); assert.match(read('app/manage/page.tsx'),/Personal \/ research: My Journey/);
  assert.match(read('docs/claim-public/public-copy-audit.md'),/Counsel review is recommended before broader outreach/i);
});

test('prohibited claimed-quality language is absent from production claim surfaces',()=>{
  const blob=publicFiles.map(read).join('\n');
  assert.doesNotMatch(blob,/verified owner|verified business|Trust Hub verified|TrustHub approved|claimed and verified|reputation score/i);
});
