import { NextResponse } from "next/server";
import { assertSameOrigin, handle } from "@/lib/api/http";
import { createSupabaseServerClient } from "@/lib/sila/supabase-server";

/** POST only: a link or prefetch must never sign someone out. */
export const POST = handle(async (request: Request) => {
  assertSameOrigin(request);
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), 303);
});
