import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 request proxy (the renamed middleware). Keeps the Supabase Auth session
 * fresh: expired access tokens are refreshed and the new cookies are written to both
 * the forwarded request and the response. It only reads the session; authorisation
 * stays in the pages and handlers (`lib/sila/auth.ts`).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const privatePath = /^\/(?:account|auth|plans|venue|ops|sign-in|pilot-demo)(?:\/|$)/.test(request.nextUrl.pathname)
    || request.nextUrl.pathname.startsWith("/api/v1/sila/");
  const protectedResponse = (response: NextResponse) => {
    if (privatePath || hasSession) response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const url = process.env.SILA_AUTH_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SILA_AUTH_PUBLIC_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Only people who already hold a Supabase session cookie pay for the Auth round trip.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!url || !anonKey || !hasSession) return protectedResponse(NextResponse.next({ request }));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });
  await supabase.auth.getUser();
  return protectedResponse(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)"],
};
