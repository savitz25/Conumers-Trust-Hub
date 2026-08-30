import { NextResponse } from 'next/server';
import { timingSafeEqualText } from '@/lib/customer/crypto';
import { mintHandoffToken } from '@/lib/customer/handoff';
import { cthReadDirectory } from '@/lib/customer/cth-read';
import { validateContractorAdapter } from '@/lib/customer/adapter';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { HOME_STATE_FL, HUB_CONTRACTOR, SOURCE_FL_DBPR } from '@/lib/customer/types';

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
  const staff = staffSession
    ? await withPlatform((p) => p.sessionUser(staffSession))
    : null;
  const opOk = operatorAuthorized(request.headers.get('authorization'));
  if (!opOk && !staff?.isStaff) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    nativeProfileId?: string;
    slug?: string;
    externalKey?: string;
  };
  if (!body.nativeProfileId) {
    return NextResponse.json({ ok: false, error: 'nativeProfileId required' }, { status: 400 });
  }

  const profile = await cthReadDirectory.getById(body.nativeProfileId);
  const check = validateContractorAdapter(
    {
      hub_id: HUB_CONTRACTOR,
      native_profile_id: body.nativeProfileId,
      slug: body.slug || profile?.slug || '',
      external_key: body.externalKey || profile?.externalKey || '',
      source_system: SOURCE_FL_DBPR,
      home_state: HOME_STATE_FL,
    },
    profile
  );
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.code }, { status: 400 });
  }

  const secret = process.env.ATH_HANDOFF_SECRET || '';
  const minted = mintHandoffToken(secret, {
    nativeProfileId: check.profile.id,
    slug: check.profile.slug,
    externalKey: check.profile.externalKey,
  });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.asktrusthub.com';
  return NextResponse.json({
    ok: true,
    continuePath: `/claim/continue?handoff=${encodeURIComponent(minted.token)}`,
    continueUrl: `${origin.replace(/\/$/, '')}/claim/continue?handoff=${encodeURIComponent(minted.token)}`,
    payload: {
      native_profile_id: minted.payload.native_profile_id,
      slug: minted.payload.slug,
      external_key: minted.payload.external_key,
      exp: minted.payload.exp,
    },
  });
}
