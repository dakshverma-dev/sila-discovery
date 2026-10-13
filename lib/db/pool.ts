import { Pool } from "pg";

/**
 * Server-only Postgres access. DATABASE_URL must authenticate as a login that
 * is a member of `scb_app` (for example `scb_app_login`), which can execute the
 * guarded `scb_api` functions and has no table privileges at all.
 */

declare global {
  var __scbPool: Pool | undefined;
}

export function databaseUrl(env: Record<string, string | undefined> = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not configured");
  return url;
}

export function createPool(connectionString: string, max = 10): Pool {
  return new Pool({ connectionString, max, idleTimeoutMillis: 10_000 });
}

export function getPool(): Pool {
  globalThis.__scbPool ??= createPool(databaseUrl());
  return globalThis.__scbPool;
}
