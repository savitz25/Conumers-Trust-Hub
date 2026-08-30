/**
 * ASKTRUSTHUB INTELLIGENCE NETWORK V1 — COMPLETE
 *
 * Concise architectural lock / test fixture. Not a homepage, product surface,
 * or new workstream.
 */

export const V1_STATUS = 'ASKTRUSTHUB INTELLIGENCE NETWORK V1 — COMPLETE' as const;

export const V1_VERDICT =
  'ASKTRUSTHUB INTELLIGENCE NETWORK V1 COMPLETE — 6/6 SPECIALISTS LIVE / EXECUTE' as const;

export const V1_PRINCIPLES = [
  'AskTrustHub is the network orchestration layer.',
  'Specialist hubs own domain facts and deterministic execution.',
  'Parent routes; specialist executes and proves.',
  'Natural language does not generate underlying regulatory facts.',
  'Every answer retains provenance.',
  'Geography meanings remain source-specific.',
  'Incompatible grains are never summed.',
  '“Most” is raw count; rates need denominators.',
  'Missing evidence is not a clean finding.',
  'Complaints are not wrongdoing.',
  'Regulatory status is not recommendation.',
  'No universal Trust Score.',
  'Paid status never changes evidence/ranking/conclusions.',
  'Ask access does not authorize mass publication.',
  'Unsupported questions fail closed.',
] as const;

export const V1_SPECIALISTS = {
  contractor: {
    askStatus: 'live',
    federatedExecution: 'execute',
    askContract: null,
    structuredAskUrl: 'https://www.contractortrusthub.com/ask',
  },
  senior: {
    askStatus: 'live',
    federatedExecution: 'execute',
    askContract: 'senior-ask-v1',
    structuredAskUrl: 'https://www.seniortrusthub.com/ask',
  },
  investor: {
    askStatus: 'live',
    federatedExecution: 'execute',
    askContract: 'investor-ask-v1',
    structuredAskUrl: 'https://www.investortrusthub.com/ask',
  },
  insurance: {
    askStatus: 'live',
    federatedExecution: 'execute',
    askContract: 'insurance-ask-v1',
    structuredAskUrl: 'https://www.insurancetrusthub.com/ask',
  },
  move: {
    askStatus: 'live',
    federatedExecution: 'execute',
    askContract: 'move-ask-v1',
    structuredAskUrl: 'https://www.movetrusthub.com/ask',
  },
  lender: {
    askStatus: 'live',
    federatedExecution: 'execute',
    askContract: 'lender-ask-v1',
    structuredAskUrl: 'https://www.lendertrusthub.com/ask',
  },
} as const;
