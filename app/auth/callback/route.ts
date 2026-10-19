import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/sila/auth";
import { createSupabaseServerClient } from "@/lib/sila/supabase-server";

/** Exchanges the one-time code from the emailed link for a session cookie, then returns to `next`. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin), 303);
  }
  const failed = new URL("/sign-in", url.origin);
  failed.searchParams.set("error", "link");
  if (next !== "/") failed.searchParams.set("next", next);
  return NextResponse.redirect(failed, 303);
}
