export type CustomerExperienceFixture = { id: string; scenario: string; expected: string; area: string };

export const CUSTOMER_EXPERIENCE_FIXTURES: CustomerExperienceFixture[] = [
  { id:'new-claim',scenario:'New exact-profile claim',expected:'Exact business, hub and identifier with claim limits and progress.',area:'Claim' },
  { id:'sign-in',scenario:'Sign in and return',expected:'Secure email link returns to this exact workflow.',area:'Authentication' },
  { id:'verification',scenario:'Verification selection',expected:'Only implemented email, attestation and manual-review steps appear.',area:'Verification' },
  { id:'submitted',scenario:'Claim submitted',expected:'Timing, status and next actions appear.',area:'Claim status' },
  { id:'under-review',scenario:'Under review',expected:'Public evidence remains unchanged and support is available.',area:'Claim status' },
  { id:'needs-info',scenario:'More information needed',expected:'Specific request can be answered without starting over.',area:'Claim status' },
  { id:'approved',scenario:'Approved claim',expected:'Open your dashboard leads to the exact workspace.',area:'Claim status' },
  { id:'rejected',scenario:'Claim not approved',expected:'Request review and find-another-profile actions appear.',area:'Claim status' },
  { id:'competing',scenario:'Competing claim',expected:'Edits remain frozen; supporting information and help remain available.',area:'Claim status' },
  { id:'zero-profile',scenario:'Account with no profiles',expected:'Find, claim, continue, and support paths replace a dead end.',area:'Dashboard' },
  { id:'three-profile',scenario:'Three-profile account',expected:'Separate Contractor, Move, and Lender profiles appear.',area:'Dashboard' },
  { id:'contractor-profile',scenario:'Contractor workspace',expected:'Business information, official evidence, corrections, response and monitoring.',area:'Workspace' },
  { id:'move-profile',scenario:'Move workspace',expected:'USDOT identity and truthful monitoring-unavailable options.',area:'Workspace' },
  { id:'lender-profile',scenario:'Lender workspace',expected:'Institution NMLS identity and truthful monitoring-unavailable options.',area:'Workspace' },
  { id:'correction',scenario:'Official-record correction',expected:'Issue report stays separate from business edits and has status actions.',area:'Corrections' },
  { id:'business-response',scenario:'Business response',expected:'Draft, moderation, revision and withdrawal remain separate from evidence.',area:'Response' },
  { id:'contractor-monitoring',scenario:'Contractor monitoring',expected:'Opt-in, events and delivery status use neutral change language.',area:'Monitoring' },
  { id:'move-monitoring',scenario:'Move monitoring unavailable',expected:'Keep managing, view evidence and contact options appear.',area:'Monitoring' },
  { id:'team',scenario:'Team management',expected:'Invitations, roles and immediate revocation stay exact-profile scoped.',area:'Team' },
  { id:'support',scenario:'Support request',expected:'Safe context, message, confirmation and return actions appear.',area:'Support' },
];
