import { headers } from "next/headers";
import { z } from "zod";
import { safeNextPath } from "@/lib/sila/auth";
import { createSupabaseServerClient } from "@/lib/sila/supabase-server";

/** Server-only: emails a one-time sign-in link. Shared by the sign-in page and the organiser request form. */

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** The public origin used inside the emailed link. APP_BASE_URL wins; otherwise the request's own host. */
async function appOrigin(): Promise<string> {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export type SignInLinkResult = { ok: true } | { ok: false; reason: "rate" | "send" };

/** Sends the link; after sign-in the person lands on `next` (a same-site path). */
export async function sendSignInLink(email: string, next: string): Promise<SignInLinkResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await appOrigin()}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}` },
  });
  if (!error) return { ok: true };
  const limited = error.status === 429 || /rate limit/i.test(error.message);
  return { ok: false, reason: limited ? "rate" : "send" };
}
