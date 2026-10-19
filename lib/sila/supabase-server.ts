import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Supabase Auth clients for the Sila pilot. Only the public URL and anon key are used here. */

function config(): { url: string; anonKey: string } {
  const url = process.env.SILA_AUTH_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SILA_AUTH_PUBLIC_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
  return { url, anonKey };
}

/**
 * Cookie-backed client for server components, server actions and route handlers.
 * Cookie writes are ignored where Next forbids them (server components); the
 * proxy refreshes the session on every request so that is safe.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, anonKey } = config();
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {
          // Called from a server component: the proxy persists the refreshed session instead.
        }
      },
    },
  });
}

/** Stateless client used only to verify a Bearer access token with `auth.getUser(token)`. */
export function createSupabaseTokenClient(): SupabaseClient {
  const { url, anonKey } = config();
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
