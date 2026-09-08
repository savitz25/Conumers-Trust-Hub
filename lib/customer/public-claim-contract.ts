export const PUBLIC_CLAIM_CONTRACT = {
  claimedMeaning: 'Claiming a profile confirms management access for an authorized business representative. It does not change public evidence, rankings, source status, Trust Hub research, or create an endorsement.',
  claimedLabel: 'Profile managed by an authorized representative',
  businessSuppliedMeaning: 'Business-supplied information is provided and managed by an authorized business representative and remains separate from public-source evidence.',
  correctionMeaning: 'Anyone may report a factual inaccuracy without paying or claiming a profile. A report starts a review; it does not automatically change or remove evidence.',
  businessResponseMeaning: 'A business response is business-supplied context reviewed before publication. It does not replace source evidence or mean Trust Hub agrees with it.',
  paidIndependenceMeaning: 'Optional business software may be offered separately. Purchasing software never changes evidence, rankings, research findings, or publication standards.',
  monitoringAvailabilityMeaning: 'Monitoring is available only for supported Trust Hubs and sources. Capabilities vary by Trust Hub and source availability.',
  authoritySummary: 'Claims require authority review. Knowing a public credential or using a company email is not sufficient by itself, and Ask Trust Hub may request additional verification or decline access.',
} as const;

export const PROHIBITED_PUBLIC_CLAIM_PHRASES = ['verified owner', 'verified business', 'Trust Hub verified', 'TrustHub approved', 'opt-in lead products', 'sponsored ranking', 'priority placement'] as const;
