export type QueryResultRow = Record<string, unknown>;

export type SqlClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
  exec?: (sql: string) => Promise<void>;
};

export async function one<T extends QueryResultRow>(
  client: SqlClient,
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const res = await client.query<T>(text, params);
  return res.rows[0] ?? null;
}
