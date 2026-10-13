import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db/pool";
import { signCapability, verifyCapability, type DemoCapability } from "./capability";

export const DEMO_COOKIE = "scb_demo";

export interface DemoSession {
  workspaceId: string;
  actorId: string;
  expiresAt: number;
}

/** Reads and re-validates the sandbox capability against the database. */
export async function getDemoSession(): Promise<DemoSession | null> {
  const store = await cookies();
  const cap = verifyCapability(store.get(DEMO_COOKIE)?.value);
  if (!cap) return null;
  const { rows } = await getPool().query<{ valid: boolean }>(
    "select scb_api.demo_persona_valid($1, $2) as valid",
    [cap.w, cap.p],
  );
  if (!rows[0]?.valid) return null;
  return { workspaceId: cap.w, actorId: cap.p, expiresAt: cap.exp };
}

export async function requireDemoSession(): Promise<DemoSession> {
  const session = await getDemoSession();
  if (!session) redirect("/?error=SANDBOX_EXPIRED");
  return session;
}

export async function setDemoCookie(cap: DemoCapability): Promise<void> {
  const store = await cookies();
  store.set(DEMO_COOKIE, signCapability(cap), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(cap.exp * 1000),
  });
}

export async function clearDemoCookie(): Promise<void> {
  (await cookies()).delete(DEMO_COOKIE);
}
