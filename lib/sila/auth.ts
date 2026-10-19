import { redirect } from "next/navigation";
import { HttpError } from "@/lib/api/http";
import { callSila } from "@/lib/sila/db";
import { createSupabaseServerClient, createSupabaseTokenClient } from "@/lib/sila/supabase-server";

/** Who is acting. Derived only from a verified Supabase Auth user; never from request bodies. */
export interface SilaActor {
  personId: string;
  email: string;
}

/**
 * Accepts only same-site absolute paths for post-sign-in redirects. Anything
 * else (full URLs, protocol-relative `//host`, `/\host`) becomes `/`. Control
 * characters are rejected because the URL parser strips tab/CR/LF, which would turn
 * `/\t/evil.example` into `//evil.example`. The final check resolves the value
 * against a placeholder origin and requires that it stays there.
 */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "/";
  try {
    if (new URL(raw, "http://x.invalid").origin !== "http://x.invalid") return "/";
  } catch {
    return "/";
  }
  return raw;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header.trim()) : null;
  return match ? match[1]! : null;
}

/**
 * Resolves the signed-in person. With `request`, a `Authorization: Bearer <access token>`
 * header is used when present; otherwise the Supabase session cookie. The user is
 * always verified with `auth.getUser()` (a round trip to Auth), never `getSession()` alone.
 * Returns null when there is no valid session or the email is unconfirmed.
 */
export async function getSilaActor(request?: Request): Promise<SilaActor | null> {
  const token = request ? bearerToken(request) : null;
  const supabase = token ? createSupabaseTokenClient() : await createSupabaseServerClient();
  const { data, error } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
  if (error || !data.user) return null;

  const person = await callSila<{ person_id: string; email: string }>("ensure_person", [data.user.id]);
  if (!person.ok) {
    if (person.error.code === "AUTH_REQUIRED") return null;
    throw new Error(`ensure_person failed: ${person.error.code}`);
  }
  return { personId: person.data.person_id, email: person.data.email };
}

/** For pages and server actions: redirects to sign-in, returning to `nextPath` afterwards. */
export async function requireSilaActor(nextPath: string): Promise<SilaActor> {
  const actor = await getSilaActor();
  if (!actor) redirect(`/sign-in?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  return actor;
}

/** For API route handlers: throws AUTH_REQUIRED (401) when the caller is not signed in. */
export async function requireApiActor(request: Request): Promise<SilaActor> {
  const actor = await getSilaActor(request);
  if (!actor) throw new HttpError("AUTH_REQUIRED", "Sign in to continue.");
  return actor;
}
