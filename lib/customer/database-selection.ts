export function selectAskDatabaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  if (
    env.VERCEL_ENV === 'preview' &&
    env.ATH_FIXTURE_ENV === 'preview' &&
    env.ATH_ALLOW_SYNTHETIC_FIXTURE === '1' &&
    env.ATH_PREVIEW_DB_DATABASE_URL
  ) return env.ATH_PREVIEW_DB_DATABASE_URL;
  return env.neon_tech_database || env.ASK_DATABASE_URL || undefined;
}
