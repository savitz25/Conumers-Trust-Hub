import { NextResponse, after } from 'next/server';
import { decideNameCandidateSearch } from '@/lib/network/name-candidates/decision';
import { searchNameCandidates } from '@/lib/network/name-candidates/orchestrator';
import { MAX_PAGE } from '@/lib/network/name-candidates/contract';
import { SPECIALIST_HUB_IDS, isSpecialistHubId, type SpecialistHubId } from '@/lib/network/registry';
import { recordNameCandidateSearch } from '@/lib/control-plane/product-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Overall orchestration deadline is 9s (see orchestrator.ts); leave headroom for the response.
export const maxDuration = 15;

const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

/**
 * Explicit-submit / View-more only (never per keystroke). The client sends the ORIGINAL input, an
 * optional user-selected hub and per-hub pages. The server re-derives the authoritative decision --
 * a client can never supply its own name interpretation, endpoint URL or SQL.
 */
export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? '0') > 4_096) return NextResponse.json({ error: 'payload_too_large' }, { status: 413, headers: noStore });
  let body: Record<string, unknown>;
  try { const parsed = await request.json(); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape'); body = parsed as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: noStore }); }
  const allowed = new Set(['q', 'hub', 'pages', 'revision']);
  if (Object.keys(body).some((key) => !allowed.has(key)) || typeof body.q !== 'string') return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: noStore });
  const hub = body.hub === undefined || body.hub === 'all' ? null : typeof body.hub === 'string' && isSpecialistHubId(body.hub) ? body.hub : undefined;
  if (hub === undefined) return NextResponse.json({ error: 'invalid_hub' }, { status: 400, headers: noStore });

  const pages: Partial<Record<SpecialistHubId, number>> = {};
  if (body.pages !== undefined) {
    if (!body.pages || typeof body.pages !== 'object' || Array.isArray(body.pages)) return NextResponse.json({ error: 'invalid_pages' }, { status: 400, headers: noStore });
    for (const [key, value] of Object.entries(body.pages as Record<string, unknown>)) {
      if (!SPECIALIST_HUB_IDS.includes(key as SpecialistHubId) || !Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_PAGE) return NextResponse.json({ error: 'invalid_pages' }, { status: 400, headers: noStore });
      pages[key as SpecialistHubId] = value as number;
    }
  }
  const revision = Number.isSafeInteger(body.revision) ? body.revision as number : 0;

  const decision = decideNameCandidateSearch(body.q, { selectedHub: hub });
  if (decision.operation !== 'NAME_CANDIDATES') return NextResponse.json({ error: 'not_a_name_search', reason: decision.reason }, { status: 422, headers: noStore });

  const response = await searchNameCandidates({ originalInput: decision.originalInput, name: decision.name, hubScope: decision.hubScope, priorityHubs: decision.priorityHubs, pages, revision, unresolvedConditions: decision.unresolvedConditions });
  after(() => recordNameCandidateSearch(response));
  return NextResponse.json(response, { headers: { ...noStore, 'Server-Timing': `name-candidates;dur=${response.timing.totalMs}` } });
}
