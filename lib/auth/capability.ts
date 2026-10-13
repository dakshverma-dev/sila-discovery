import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed judge-sandbox capability (R15, D16). Grants one synthetic persona in
 * one DEMO workspace until expiry; it can never address a pilot workspace
 * because the database re-validates the persona on every request.
 */
export interface DemoCapability {
  /** DEMO workspace ID. */
  w: string;
  /** Acting synthetic persona (scb.users.id). */
  p: string;
  /** Expiry, seconds since epoch. */
  exp: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(env: Record<string, string | undefined> = process.env): Buffer {
  const value = env.DEMO_CAPABILITY_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("DEMO_CAPABILITY_SECRET must be at least 32 characters");
  return Buffer.from(value);
}

function mac(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function signCapability(cap: DemoCapability, key: Buffer = secret()): string {
  const payload = Buffer.from(JSON.stringify(cap)).toString("base64url");
  return `${payload}.${mac(payload, key)}`;
}

export function verifyCapability(
  token: string | undefined,
  now: number = Date.now(),
  key: Buffer = secret(),
): DemoCapability | null {
  if (!token || token.length > 1024) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(mac(payload, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const cap = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DemoCapability;
    if (!UUID.test(cap.w) || !UUID.test(cap.p) || typeof cap.exp !== "number") return null;
    if (cap.exp * 1000 <= now) return null;
    return cap;
  } catch {
    return null;
  }
}
