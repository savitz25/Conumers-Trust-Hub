export const RECORD_ISSUE_TYPES = ['WRONG_BUSINESS','WRONG_LICENSE','WRONG_LICENSE_STATUS','WRONG_ADDRESS','WRONG_CONTACT_INFORMATION','WRONG_QUALIFIER_RELATIONSHIP','WRONG_DISCIPLINE_LINK','DUPLICATE_PROFILE','BUSINESS_CLOSED_OR_CHANGED','OUTDATED_INFORMATION','OTHER_RECORD_ISSUE'] as const;
export const RECORD_TARGET_TYPES = ['PROFILE','BUSINESS_IDENTITY','DBPR_CREDENTIAL','OFFICIAL_ADDRESS','QUALIFIER_RELATIONSHIP','DISCIPLINE_EVENT','TRUSTHUB_INTELLIGENCE'] as const;
export const RECORD_ISSUE_STATUSES = ['OPEN','UNDER_REVIEW','NEEDS_INFORMATION','RESOLVED_CORRECTED','RESOLVED_NO_CHANGE','RESOLVED_SOURCE_PENDING','REJECTED','WITHDRAWN'] as const;
export type RecordIssueType = typeof RECORD_ISSUE_TYPES[number];
export type RecordTargetType = typeof RECORD_TARGET_TYPES[number];
export type RecordIssueStatus = typeof RECORD_ISSUE_STATUSES[number];

export class RecordIssueError extends Error {
  readonly code: 'validation_failed'|'forbidden'|'not_found'|'duplicate'|'rate_limited'|'open_limit'|'stale_version'|'invalid_transition';
  constructor(code: RecordIssueError['code']) { super(code); this.code=code; }
}

const TARGETS: Record<RecordIssueType, readonly RecordTargetType[]> = {
  WRONG_BUSINESS:['PROFILE','BUSINESS_IDENTITY'], WRONG_LICENSE:['DBPR_CREDENTIAL'], WRONG_LICENSE_STATUS:['DBPR_CREDENTIAL'],
  WRONG_ADDRESS:['OFFICIAL_ADDRESS'], WRONG_CONTACT_INFORMATION:['PROFILE','BUSINESS_IDENTITY'], WRONG_QUALIFIER_RELATIONSHIP:['QUALIFIER_RELATIONSHIP'],
  WRONG_DISCIPLINE_LINK:['DISCIPLINE_EVENT'], DUPLICATE_PROFILE:['PROFILE'], BUSINESS_CLOSED_OR_CHANGED:['PROFILE','BUSINESS_IDENTITY'],
  OUTDATED_INFORMATION:['PROFILE','DBPR_CREDENTIAL','OFFICIAL_ADDRESS','QUALIFIER_RELATIONSHIP','DISCIPLINE_EVENT','TRUSTHUB_INTELLIGENCE'],
  OTHER_RECORD_ISSUE:['PROFILE','BUSINESS_IDENTITY','DBPR_CREDENTIAL','OFFICIAL_ADDRESS','QUALIFIER_RELATIONSHIP','DISCIPLINE_EVENT','TRUSTHUB_INTELLIGENCE'],
};

export function validateRecordIssue(input: unknown) {
  if (!input || typeof input !== 'object') throw new RecordIssueError('validation_failed');
  const row=input as Record<string,unknown>; const issueType=String(row.issueType||'') as RecordIssueType; const targetRecordType=String(row.targetRecordType||'') as RecordTargetType;
  if (!RECORD_ISSUE_TYPES.includes(issueType) || !RECORD_TARGET_TYPES.includes(targetRecordType) || !TARGETS[issueType].includes(targetRecordType)) throw new RecordIssueError('validation_failed');
  const explanation=String(row.explanation||'').trim(); const targetRecordId=String(row.targetRecordId||'').trim() || null;
  if (explanation.length<20 || explanation.length>2000 || /<\/?[a-z][\s\S]*>/i.test(explanation)) throw new RecordIssueError('validation_failed');
  if (targetRecordId && (targetRecordId.length>160 || !/^[A-Za-z0-9][A-Za-z0-9 ._:/#-]*$/.test(targetRecordId))) throw new RecordIssueError('validation_failed');
  if (['DBPR_CREDENTIAL','QUALIFIER_RELATIONSHIP','DISCIPLINE_EVENT'].includes(targetRecordType) && !targetRecordId) throw new RecordIssueError('validation_failed');
  return { issueType,targetRecordType,targetRecordId,explanation,targetLayer: targetRecordType==='TRUSTHUB_INTELLIGENCE'?'TRUSTHUB_INTELLIGENCE' as const:'AUTHORITATIVE_EVIDENCE' as const };
}

export const CUSTOMER_TRANSITIONS: Record<string, readonly string[]> = { OPEN:['WITHDRAWN'], NEEDS_INFORMATION:['OPEN'] };
export const STAFF_TRANSITIONS: Record<string, readonly string[]> = { OPEN:['UNDER_REVIEW','NEEDS_INFORMATION','RESOLVED_CORRECTED','RESOLVED_NO_CHANGE','RESOLVED_SOURCE_PENDING','REJECTED'], UNDER_REVIEW:['NEEDS_INFORMATION','RESOLVED_CORRECTED','RESOLVED_NO_CHANGE','RESOLVED_SOURCE_PENDING','REJECTED'], NEEDS_INFORMATION:['UNDER_REVIEW','RESOLVED_NO_CHANGE','RESOLVED_SOURCE_PENDING','REJECTED'] };
