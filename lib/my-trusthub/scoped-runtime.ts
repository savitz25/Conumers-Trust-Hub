import "server-only";
import { Pool } from "pg";

const pools = new Map<string, Pool>();
export function scopedRuntime(kind: "broker" | "dbpr" | "notification") {
  const key = kind === "broker" ? "MY_TRUSTHUB_P13_DATABASE_URL" : kind === "notification" ? "MY_TRUSTHUB_P17_DATABASE_URL" : "MY_TRUSTHUB_P15_DATABASE_URL";
  const url = process.env[key];
  const ca = process.env.MY_TRUSTHUB_DATABASE_CA;
  if (!url || !ca) throw new Error("SCOPED_RUNTIME_UNAVAILABLE");
  if (!pools.has(key)) pools.set(key, new Pool({ connectionString: url, ssl: { ca, rejectUnauthorized: true }, max: 2, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 }));
  return pools.get(key)!;
}
