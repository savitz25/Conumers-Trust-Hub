import type { ParsedNetworkAsk } from './ask-parse.ts';

export function contractorAskUrlFromParsed(parsed: ParsedNetworkAsk, query = parsed.query): string {
  const params = new URLSearchParams();
  params.set('q', query);
  if (parsed.geography?.countySlug === 'broward') params.set('geo', 'broward');
  if (parsed.geography?.countySlug === 'palm-beach') params.set('geo', 'palm-beach');
  if (parsed.trade?.toLowerCase() === 'roofing') params.set('trade', 'roofing');
  if (parsed.credentialStatus) params.set('status', 'active_current');
  return `https://www.contractortrusthub.com/ask?${params.toString()}`;
}
