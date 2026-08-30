import { NextResponse } from 'next/server';
import { AuthError, ClaimError } from '@/lib/customer/store';
import { currentContext, readIntentId, readSessionToken, withPlatform } from '@/lib/customer/server';
import type { RelationshipType } from '@/lib/customer/types';

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
  };
  try {
    const result = await withPlatform((p) =>
      p.submitClaim({
        sessionToken: sessionToken || '',
        intentId,
        relationshipType: body.relationshipType || 'owner',
        legalName: body.legalName,
        credentialAttestation: body.credentialAttestation || '',
        authorized: Boolean(body.authorized),
        ctx,
      })
    );
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
