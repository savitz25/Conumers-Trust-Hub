import 'server-only';
import { askDatabaseUrl, withAskTx } from '../customer/db';

const CACHE_MS = 60_000;
let cached: { at: number; value: boolean } | null = null;

export async function researchInquiryStorageAvailable(now = Date.now()): Promise<boolean> {
  if (!askDatabaseUrl()) return false;
  if ((process.env.ATH_HANDOFF_SECRET || '').trim().length < 16) return false;
  if (cached && now - cached.at < CACHE_MS) return cached.value;
  const value = await probe();
  cached = { at: now, value };
  return value;
}

async function probe(): Promise<boolean> {
  const query = withAskTx(async (client) => {
    const result = await client.query<{ rel: string | null }>(
      `SELECT to_regclass('public.ath_research_service_inquiries') AS rel`
    );
    return Boolean(result.rows[0]?.rel);
  }).catch(() => false);
  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), 800);
  });
  return Promise.race([query, timeout]);
}
