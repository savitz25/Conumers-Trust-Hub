import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { analyticsEnvironment } from '@/lib/analytics/environment';
import {
  createSentryProbeError,
  sentryProbeAuthorized,
  sentryProbeEnabled,
} from '@/lib/sentry/probe';
import { sentryRelease } from '@/lib/sentry/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

function disabled() {
  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404, headers });
}

export async function GET() {
  return disabled();
}

export async function POST(request: Request) {
  if (!sentryProbeEnabled()) return disabled();
  if (!sentryProbeAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403, headers });
  }

  const eventId = Sentry.captureException(createSentryProbeError(), {
    tags: {
      probe: 'ath-rel-001a',
      runtime: 'nodejs',
      hub: 'ask',
    },
    fingerprint: ['ath-rel-001a-probe'],
  });
  await Sentry.flush(2000);

  return NextResponse.json(
    {
      ok: true,
      eventId: eventId || null,
      environment: analyticsEnvironment(),
      release: sentryRelease() || null,
    },
    { headers },
  );
}
