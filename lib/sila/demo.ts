/** Synthetic pilot fixtures are available only in the separate local demo stack. */
export const DEMO_SESSION_ID = "de000000-0000-4000-8000-000000000002";
export const DEMO_VENUE_ID = "de000000-0000-4000-8000-000000000001";

export function localDemoEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.SILA_DEMO_MODE !== "local") return false;
  const targets = [env.DATABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL, env.APP_BASE_URL];
  return targets.every((value) => {
    if (!value) return false;
    try {
      const url = new URL(value);
      return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
        && ["http:", "https:", "postgres:", "postgresql:"].includes(url.protocol);
    } catch { return false; }
  });
}
