import { NextResponse } from 'next/server';
import { isDbUnavailableError, serviceUnavailableResponse } from '@/lib/customer/db-unavailable';
import { timingSafeEqualText } from '@/lib/customer/crypto';
import { mintHandoffToken } from '@/lib/customer/handoff';
import { cthReadDirectory } from '@/lib/customer/cth-read';
import { compositeCustomerDirectory } from '@/lib/customer/specialist-read';
import { customerHub } from '@/lib/customer/hub-registry';
import { resolveProfileForHandoffMint } from '@/lib/customer/handoff-mint-resolution';
import { customerLog } from '@/lib/customer/log';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { SOURCE_FL_DBPR, contractorClaimState, type HandoffPayload } from '@/lib/customer/types';
import { contractorMintIdentity } from '@/lib/customer/contractor-handoff';

export const runtime = 'nodejs';

function operatorAuthorized(header: string | null): boolean {
  const expected = process.env.ATH_OPERATOR_SECRET || '';
  if (!expected || expected.length < 16) return false;
  const got = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!got || got.length !== expected.length) return false;
  return timingSafeEqualText(got, expected);
}

export async function POST(request: Request) {
  const staffSession = await readSessionToken();
  let staff: Awaited<ReturnType<typeof withPlatform<Awaited<ReturnType<import('@/lib/customer/store').CustomerPlatform['sessionUser']>>>>> | null = null;
  try { staff = staffSession ? await withPlatform((p) => p.sessionUser(staffSession)) : null; }
  catch (e) { if (isDbUnavailableError(e)) return serviceUnavailableResponse(); throw e; }
  const opOk = operatorAuthorized(request.headers.get('authorization'));
  if (!opOk && !staff?.isStaff) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    nativeProfileId?: string;
    slug?: string;
    externalKey?: string;
    hubId?: string;
    sourceSystem?: string;
    providerClass?: 'nursing_home'|'home_health'|'hospice';
    entityType?: string;
    canonicalProfileUrl?: string;
    acquisitionSource?: string;
  };
  if (!body.nativeProfileId) {
    return NextResponse.json({ ok: false, error: 'nativeProfileId required' }, { status: 400 });
  }

  // ATH-CLAIM-V2-001R4 — trusted attribution. This route is reachable only with the operator secret or a staff
  // session, never by a claimant's browser, so it is the one place an operator may label a handoff
  // manual_outreach (or internal_test for QA). The value is SIGNED into the token; nothing downstream trusts a
  // query string. organic/email_campaign/unknown are not assignable here.
  const OPERATOR_SOURCES = ['manual_outreach', 'internal_test'] as const;
  if (body.acquisitionSource !== undefined && !(OPERATOR_SOURCES as readonly string[]).includes(body.acquisitionSource)) {
    return NextResponse.json({ ok: false, error: 'unsupported_acquisition_source' }, { status: 400 });
  }
  const operatorSource = body.acquisitionSource as (typeof OPERATOR_SOURCES)[number] | undefined;
  const capability=customerHub(body.hubId||'contractor');
  if(!capability)return NextResponse.json({ok:false,error:'unsupported_customer_hub'},{status:400});
  if(capability.hubId==='investor'&&body.entityType&&body.entityType!=='firm')return NextResponse.json({ok:false,error:'unsupported_source'},{status:400});
  if(capability.hubId==='insurance'&&body.entityType&&body.entityType!=='legal_insurer')return NextResponse.json({ok:false,error:'unsupported_source'},{status:400});
  const contractorIdentity=capability.hubId==='contractor'?contractorMintIdentity(body):null;
  if(contractorIdentity&&!contractorIdentity.ok)return NextResponse.json({ok:false,error:contractorIdentity.error},{status:400});
  const canonicalProfileUrl=contractorIdentity?.ok?contractorIdentity.canonicalProfileUrl:body.canonicalProfileUrl;
  const payload:HandoffPayload={
      v:2,aud:'asktrusthub' as const,
      hub_id: capability.hubId,
      native_profile_id: body.nativeProfileId,
      slug: body.slug || '',external_key:body.externalKey||'',source_system:body.sourceSystem||(capability.hubId==='contractor'?SOURCE_FL_DBPR:capability.hubId==='move'?'fmcsa':capability.hubId==='lender'?'nmls':capability.hubId==='investor'?'sec_iard':capability.hubId==='insurance'?'naic':'cms'),home_state:capability.hubId==='contractor'?contractorClaimState(body.sourceSystem||SOURCE_FL_DBPR):null,
      identifier_namespace:capability.identifierNamespace,entity_class:capability.hubId==='senior'?body.providerClass:capability.identityClass,provider_class:body.providerClass,canonical_profile_url:canonicalProfileUrl,display_name:undefined,iat:0,exp:0,nonce:''
    };
  const directory=compositeCustomerDirectory(cthReadDirectory);
  const resolution=await resolveProfileForHandoffMint(directory,payload);
  if (!resolution.ok) {
    if (resolution.status === 500) {
      customerLog('internal_handoff_profile_resolution_failed', { category: 'unexpected' }, 'error');
    }
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status });
  }
  const profile=resolution.profile;

  const secret = process.env.ATH_HANDOFF_SECRET || '';
  const minted = mintHandoffToken(secret, {
    hubId:capability.hubId,
    nativeProfileId: profile.id,
    slug: profile.slug,
    externalKey: profile.externalKey,
    sourceSystem:profile.sourceSystem,homeState:capability.hubId==='contractor'?contractorClaimState(profile.sourceSystem):profile.homeState,identifierNamespace:capability.identifierNamespace,entityClass:('entityClass' in profile?profile.entityClass:'contractor') as HandoffPayload['entity_class'],providerClass:body.providerClass,canonicalProfileUrl:'canonicalUrl' in profile?String(profile.canonicalUrl):undefined,displayName:profile.displayName,
    acquisitionSource: operatorSource,
  });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.asktrusthub.com';
  return NextResponse.json({
    ok: true,
    continuePath: `/claim/continue?handoff=${encodeURIComponent(minted.token)}`,
    continueUrl: `${origin.replace(/\/$/, '')}/claim/continue?handoff=${encodeURIComponent(minted.token)}`,
    payload: {
      native_profile_id: minted.payload.native_profile_id,
      hub_id: minted.payload.hub_id,
      slug: minted.payload.slug,
      external_key: minted.payload.external_key,
      exp: minted.payload.exp,
      acquisition_source: minted.payload.acquisition_source ?? null,
    },
  });
}
