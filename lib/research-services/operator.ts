import { one, type SqlClient } from '../customer/sql.ts';
import { buildResearchInquiryNotice, type InquiryMailer } from './notify.ts';
import type { ResearchInquiryInput } from './inquiry.ts';

const STALE_MS = 2 * 60 * 1000;
const LIST_LIMIT = 50;

export type ResearchInquiryRecord = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  organization: string;
  role: string;
  vendor_count: string;
  message: string;
  notification_status: string;
  notification_error_code: string | null;
  provider_message_ref: string | null;
};

export type RetryResult = {
  id: string;
  notificationStatus: string;
  attempted: boolean;
};

const LIST_SQL = `SELECT id::text AS id, created_at::text AS created_at, name, email, organization, role,
    vendor_count, message, notification_status, notification_error_code, provider_message_ref
  FROM ath_research_service_inquiries`;

export async function listResearchInquiries(
  sql: SqlClient,
  filter: { status?: 'pending' | 'sending' | 'sent' | 'failed'; limit?: number } = {}
): Promise<ResearchInquiryRecord[]> {
  const limit = Math.min(Math.max(filter.limit ?? LIST_LIMIT, 1), 100);
  if (filter.status) {
    const result = await sql.query<ResearchInquiryRecord>(
      `${LIST_SQL} WHERE notification_status = $1 ORDER BY created_at DESC LIMIT $2`,
      [filter.status, limit]
    );
    return result.rows;
  }
  const result = await sql.query<ResearchInquiryRecord>(
    `${LIST_SQL} ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function retryResearchInquiryNotifications(deps: {
  transaction: <T>(fn: (sql: SqlClient) => Promise<T>) => Promise<T>;
  mailer: InquiryMailer;
  now: () => Date;
  send: boolean;
}): Promise<RetryResult[]> {
  const cutoff = new Date(deps.now().getTime() - STALE_MS).toISOString();
  const due = await deps.transaction(async (sql) => {
    const result = await sql.query<ResearchInquiryRecord>(
      `${LIST_SQL}
        WHERE notification_status = 'failed'
          OR (notification_status = 'pending' AND created_at <= $1)
          OR (notification_status = 'sending' AND notification_attempted_at <= $1)
        ORDER BY created_at ASC
        LIMIT 50`,
      [cutoff]
    );
    return result.rows;
  });
  if (!deps.send) {
    return due.map((row) => ({ id: row.id, notificationStatus: row.notification_status, attempted: false }));
  }
  const results: RetryResult[] = [];
  for (const row of due) {
    results.push(await retryOne(row, deps));
  }
  return results;
}

async function retryOne(
  row: ResearchInquiryRecord,
  deps: {
    transaction: <T>(fn: (sql: SqlClient) => Promise<T>) => Promise<T>;
    mailer: InquiryMailer;
    now: () => Date;
  }
): Promise<RetryResult> {
  const at = deps.now().toISOString();
  const claimed = await deps.transaction(async (sql) => {
    const locked = await one<{ id: string }>(
      sql,
      `UPDATE ath_research_service_inquiries
          SET notification_status = 'sending', notification_attempted_at = $3, notification_sent_at = NULL, notification_error_code = NULL
        WHERE id = $1::uuid AND notification_status = $2
        RETURNING id::text AS id`,
      [row.id, row.notification_status, at]
    );
    return Boolean(locked?.id);
  });
  if (!claimed) return { id: row.id, notificationStatus: row.notification_status, attempted: false };
  const value: ResearchInquiryInput = {
    name: row.name,
    email: row.email,
    organization: row.organization,
    role: row.role,
    vendorCount: row.vendor_count,
    message: row.message,
  };
  let delivered = false;
  let providerRef: string | null = null;
  let errorCode: 'unconfigured' | 'provider_rejected' | 'network' = 'network';
  try {
    const result = await deps.mailer(buildResearchInquiryNotice(row.id, value));
    delivered = result.delivered;
    providerRef = result.providerRef ?? null;
    if (!delivered) errorCode = result.errorCode ?? 'provider_rejected';
  } catch {
    delivered = false;
  }
  const status = delivered ? 'sent' : 'failed';
  await deps.transaction(async (sql) => {
    await sql.query(
      `UPDATE ath_research_service_inquiries
          SET notification_status = $2,
              notification_sent_at = CASE WHEN $2 = 'sent' THEN $3::timestamptz ELSE NULL END,
              notification_error_code = CASE WHEN $2 = 'sent' THEN NULL ELSE $4 END,
              provider_message_ref = $5
        WHERE id = $1::uuid AND notification_status = 'sending'`,
      [row.id, status, at, delivered ? null : errorCode, providerRef]
    );
  });
  return { id: row.id, notificationStatus: status, attempted: true };
}
