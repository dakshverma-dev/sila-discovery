"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/sila/auth";
import { emailSchema, sendSignInLink } from "@/lib/sila/sign-in";

function signInUrl(next: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  if (next !== "/") query.set("next", next);
  const qs = query.toString();
  return qs ? `/sign-in?${qs}` : "/sign-in";
}

/** Emails a one-time sign-in link. Responds the same way whether or not the address is already known. */
export async function requestSignInLink(formData: FormData): Promise<void> {
  const next = safeNextPath(String(formData.get("next") ?? "/"));
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) redirect(signInUrl(next, { error: "email" }));

  const sent = await sendSignInLink(parsed.data, next);
  if (!sent.ok) redirect(signInUrl(next, { error: sent.reason }));
  redirect(signInUrl(next, { sent: "1" }));
}
