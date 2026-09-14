import { assembleNetworkAnswerWithSpecialist } from '../lib/network/ask-plan.ts';

const QUERIES = [
  // MOVE
  'USDOT 3244649',
  'MC 225850',
  'JK Moving Services',
  'moving from Miami Florida to New York City',
  'Can JK Moving handle my move from Virginia to Florida?',
  // LENDER
  'NMLS 3030',
  'NMLS 9999999',
  'lenders in New Jersey',
  'how many mortgage originations in New Jersey?',
  'compare mortgage originations in Broward and Palm Beach',
  // INSURANCE
  'NPN 20000635',
  'NAIC code 10064',
  'NPN 88887777',
  'insurance agency near me',
  'insurance agencies in ZIP 33441',
  // SENIOR
  'CMS CCN 455799',
  'CMS CCN 000000',
  'senior homes in Austin Texas',
  'nursing homes in Austin Texas',
  // INVESTOR
  'CRD 166089',
  'CRD 999999999',
  'state-registered investment advisers in Wyoming',
  'investment advisers in Austin Texas',
  // CONTRACTOR
  'roofers in Broward County',
  'HVAC contractors in Austin Texas',
  'how do I verify a contractor license in Florida?',
  // PARENT / CONTROL
  'What does TrustHub know about Broward?',
  "I'm buying a home in Broward County. What should I research?",
  'What is the one universal Trust score for this company?',
  'lender in new jersey' + ' x'.repeat(150) + ' New Jersey',
];

for (const q of QUERIES) {
  const started = Date.now();
  let result: unknown;
  try {
    const answer = await assembleNetworkAnswerWithSpecialist(q);
    result = {
      resultClass: answer.resultClass,
      identityResolutionClass: (answer as { identityResolutionClass?: string }).identityResolutionClass,
      hubs: answer.plan.hubs.map((h) => ({
        hubId: h.hubId,
        capabilityStatus: h.capabilityStatus,
        mode: h.mode,
        failKind: h.failKind,
        optionsCount: h.options?.length ?? 0,
        firstOption: h.options?.[0] ? { name: h.options[0].name, fields: h.options[0].fields } : undefined,
        previewHeadline: h.preview?.headline,
      })),
      topOptionsCount: answer.options?.length ?? 0,
      noResult: answer.noResult ? { headline: answer.noResult.headline } : undefined,
      followUp: answer.followUp ? { prompt: answer.followUp.prompt } : undefined,
      matchWhy: answer.matchWhy,
      diagnostics: answer.diagnostics,
      elapsedMs: Date.now() - started,
    };
  } catch (error) {
    result = { ERROR: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - started };
  }
  console.log(JSON.stringify({ q: q.length > 80 ? q.slice(0, 80) + `...[${q.length} chars]` : q, result }, null, 2));
}
