/**
 * ASK-SEARCH-004 — adapter + handoff regression tests.
 * Zero network / LLM / Places.
 */
import { parseUniversalSearchQuery } from '../lib/search/parser';
import {
  SEARCH_HANDOFF_KEYS,
  buildSearchBackLabel,
  intentToHandoffContext,
  parseHandoffContext,
  serializeHandoffContext,
} from '../lib/search/handoff';
import {
  HUB_SEARCH_ADAPTERS,
  buildEntityHandoff,
  buildViewMoreHandoff,
  listHubSearchAdapters,
} from '../lib/search/adapters';
import type { NetworkDiscoveryEntity } from '../lib/search/adapters/types';

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('PASS:', msg);
  }
}

// Registry completeness
const hubs = ['move', 'lender', 'insurance', 'contractor', 'senior', 'investor'] as const;
assert(listHubSearchAdapters().length === 6, 'six adapters registered');
for (const h of hubs) {
  assert(!!HUB_SEARCH_ADAPTERS[h], `adapter exists: ${h}`);
}

// View More — movers in Keansburg NJ
{
  const intent = parseUniversalSearchQuery('movers in Keansburg NJ');
  const handoff = buildViewMoreHandoff(intent);
  assert(!!handoff, 'view_more handoff produced');
  assert(handoff?.destinationHub === 'move', 'view_more hub=move');
  assert(handoff?.handoffType === 'view_more', 'handoffType=view_more');
  assert(handoff?.context.src === 'ask', 'src=ask');
  assert(handoff?.context.state === 'NJ', 'state=NJ');
  assert(handoff?.context.city === 'keansburg', 'city=keansburg');
  assert(handoff?.context.entity === 'mover', 'entity=mover');
  assert(!handoff?.url.includes('movers+in'), 'no raw free-text query in URL');
  assert(handoff?.url.startsWith('https://www.movetrusthub.com/'), 'move origin');
  assert(!!handoff?.backLabel?.toLowerCase().includes('keansburg'), 'backLabel mentions Keansburg');
  const q = serializeHandoffContext(handoff!.context);
  assert(q.includes('src=ask') && q.includes('entity=mover'), 'serialized context');
  const round = parseHandoffContext(q);
  assert(round.entity === 'mover' && round.state === 'NJ', 'parse round-trip');
}

// Entity Option A
{
  const intent = parseUniversalSearchQuery('movers in Keansburg NJ');
  const entity: NetworkDiscoveryEntity = {
    network_entity_id: 'move:abc-123',
    hub: 'move',
    source_entity_id: 'abc-123',
    entity_type: 'mover',
    display_name: 'Sample Moving Co',
    canonical_profile_url: 'https://www.movetrusthub.com/movers/abc-123',
    city: 'Keansburg',
    state: 'NJ',
  };
  const handoff = buildEntityHandoff(entity, intent);
  assert(handoff.handoffType === 'entity', 'entity handoff type');
  assert(handoff.url.includes('/movers/abc-123'), 'profile path');
  assert(handoff.context.state === 'NJ', 'entity retains state');
  assert(handoff.context.entity === 'mover', 'entity retains entity');
  assert(handoff.backLabel?.startsWith('Back to movers serving'), 'back label shape');
  assert(handoff.networkEntityId === 'move:abc-123', 'network entity id');
}

// Lender / Insurance view more
{
  const lender = buildViewMoreHandoff(parseUniversalSearchQuery('mortgage companies in Florida'));
  assert(lender?.destinationHub === 'lender', 'lender hub');
  assert(lender?.url.includes('lendertrusthub.com'), 'lender origin');
  assert(lender?.context.state === 'FL', 'lender state');

  const ins = buildViewMoreHandoff(parseUniversalSearchQuery('Medicare agents Indiana'));
  assert(ins?.destinationHub === 'insurance', 'insurance hub');
  assert(ins?.context.entity === 'medicare_agent', 'medicare entity');
}

// Soft hubs still emit structured context
{
  const c = buildViewMoreHandoff(parseUniversalSearchQuery('roofers Miami'));
  assert(c?.destinationHub === 'contractor', 'contractor hub');
  assert(c?.maturity === 'soft_handoff', 'contractor soft');
  assert(c?.context.category === 'roofing', 'roofing category');
  assert(c?.context.city === 'miami', 'miami city');

  const s = buildViewMoreHandoff(parseUniversalSearchQuery('nursing homes Austin Texas'));
  assert(s?.destinationHub === 'senior', 'senior hub');
  assert(s?.context.entity === 'nursing_facility', 'nursing entity');

  const inv = buildViewMoreHandoff(parseUniversalSearchQuery('RIA Boca Raton'));
  assert(inv?.destinationHub === 'investor', 'investor hub');
  assert(inv?.context.entity === 'ria', 'ria entity');
}

// Ambiguous: no unique view-more
{
  const amb = buildViewMoreHandoff(parseUniversalSearchQuery('broker in Tampa'));
  assert(amb === null, 'ambiguous broker → null view_more (needs clarification)');
}

// Allowlist rejects raw query / PII keys
{
  const dirty = parseHandoffContext(
    'src=ask&entity=mover&state=NJ&query=movers+in+Keansburg&email=a@b.com&name=Jane'
  );
  assert(dirty.src === 'ask' && dirty.entity === 'mover', 'allowlist keeps safe fields');
  assert(!(dirty as Record<string, unknown>).query, 'rejects query');
  assert(!(dirty as Record<string, unknown>).email, 'rejects email');
  assert(SEARCH_HANDOFF_KEYS.includes('entity'), 'entity allowlisted');
  assert(!SEARCH_HANDOFF_KEYS.includes('query' as never), 'query not allowlisted');
}

// intent→context never copies raw query
{
  const intent = parseUniversalSearchQuery('movers in Keansburg NJ');
  const ctx = intentToHandoffContext(intent);
  const ser = serializeHandoffContext(ctx);
  assert(!ser.toLowerCase().includes('movers+in'), 'serializer omits free text');
  assert(buildSearchBackLabel(intent)?.includes('Keansburg'), 'back label helper');
}

// Life-event still resolves primary hub view-more
{
  const le = buildViewMoreHandoff(
    parseUniversalSearchQuery("I'm moving from New Jersey to Florida and buying a house")
  );
  assert(le?.destinationHub === 'move', 'life-event primary move');
  assert(le?.context.state === 'FL' || le?.context.state === 'NJ', 'life-event has state');
}

if (failed) {
  console.error(`ASK-SEARCH-004 FAILED (${failed})`);
  process.exit(1);
}
console.log('ASK-SEARCH-004 adapter/handoff assertions passed.');
