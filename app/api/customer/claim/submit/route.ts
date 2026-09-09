import { NextResponse } from 'next/server';
import { AuthError, ClaimError } from '@/lib/customer/store';
import { currentContext, readIntentId, readSessionToken, withPlatform } from '@/lib/customer/server';
import type { RelationshipType } from '@/lib/customer/types';
import {cookies} from 'next/headers';
import {withAskTx} from '@/lib/customer/db';
import {attributeClaim} from '@/lib/control-plane/business-growth';
import {customerLog} from '@/lib/customer/log';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const sessionToken = await readSessionToken();
  const intentId = (await readIntentId()) || '';
  const ctx = await currentContext();
  const body = (await request.json().catch(() => ({}))) as {
    relationshipType?: RelationshipType;
    legalName?: string;
    credentialAttestation?: string;
    authorized?: boolean;
    orgId?: string;
  };
  try {
    const result = await withPlatform((p) =>
      p.submitClaim({
        sessionToken: sessionToken || '',
        intentId,
        orgId: body.orgId,
        relationshipType: body.relationshipType || 'owner',
        legalName: body.legalName,
        credentialAttestation: body.credentialAttestation || '',
        authorized: Boolean(body.authorized),
        ctx,
      })
    );
    const attribution=(await cookies()).get('ath_campaign_attribution')?.value;
    if(attribution)try{await withAskTx(sql=>attributeClaim(sql,result.claimId,attribution));}catch(error){customerLog('claim_attribution_failed',{errorClass:error instanceof Error?error.name:'unknown'},'error')}
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ ok: false, error: e.code }, { status: e.code === 'missing_session' ? 401 : 400 });
    }
    if (e instanceof ClaimError) {
      return NextResponse.json({ ok: false, error: e.code }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 500 });
  }
}
