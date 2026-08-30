type LogFields = Record<string, unknown>;

const REDACT = new Set([
  'token',
  'magicUrl',
  'handoff',
  'secret',
  'ATH_HANDOFF_SECRET',
  'ASK_DATABASE_URL',
  'CTH_READ_DATABASE_URL',
  'RESEND_API_KEY',
  'ATH_OPERATOR_SECRET',
  'neon_tech_database',
]);

function sanitize(fields?: LogFields): LogFields | undefined {
  if (!fields) return fields;
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT.has(k) || /token|secret|password|cookie/i.test(k)) {
      out[k] = '[redacted]';
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function customerLog(
  event: string,
  fields?: LogFields,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  const line = JSON.stringify({
    src: 'ath-customer',
    event,
    level,
    ...sanitize(fields),
    ts: new Date().toISOString(),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}
