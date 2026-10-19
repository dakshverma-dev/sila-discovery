import { createHmac, timingSafeEqual } from "node:crypto";
import { PLAN_SOURCES, type PlanSource } from "@/lib/sila/commands/plans";

/**
 * The organiser's unfinished request, kept in a signed cookie while they verify
 * their email (§05: "returns to the retained draft"). The cookie is httpOnly and
 * HMAC-signed with SILA_DRAFT_SECRET so a visitor cannot forge a quantity or a
 * session. It holds the idempotency key of the form, so resuming twice replays
 * the same plan rather than creating another.
 */
export interface RequestDraft {
  sessionId: string;
  clubName: string;
  places: number;
  email: string;
  source: PlanSource;
  idempotencyKey: string;
  /** Expiry as epoch milliseconds. */
  exp: number;
}

export const DRAFT_COOKIE = "sila_request";
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

/** Cookie attributes; `secure` only in production so http://localhost works. Scoped to the session pages. */
export const DRAFT_COOKIE_PATH = "/s";

export function draftCookieOptions(now = new Date()) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: DRAFT_COOKIE_PATH,
    expires: new Date(now.getTime() + DRAFT_TTL_MS),
  };
}

function secret(): string {
  const value = process.env.SILA_DRAFT_SECRET;
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(`SILA_DRAFT_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters.`);
  }
  return value;
}

function sign(payload: string): Buffer {
  return createHmac("sha256", secret()).update(payload).digest();
}

/** Signs the draft and stamps a 24 hour expiry from `now`. Throws when the secret is missing or short. */
export function sealRequestDraft(draft: RequestDraft, now = new Date()): string {
  const key = secret(); // fail before any work when misconfigured
  const payload = Buffer.from(JSON.stringify({ ...draft, exp: now.getTime() + DRAFT_TTL_MS })).toString("base64url");
  const signature = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function isDraft(value: unknown): value is RequestDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.sessionId === "string" &&
    typeof d.clubName === "string" &&
    typeof d.email === "string" &&
    typeof d.idempotencyKey === "string" &&
    typeof d.places === "number" &&
    Number.isSafeInteger(d.places) &&
    d.places >= 1 &&
    typeof d.exp === "number" &&
    (PLAN_SOURCES as readonly unknown[]).includes(d.source)
  );
}

/**
 * Returns the draft, or null when the token is missing, malformed, tampered
 * with, expired or not a draft. Throws only when a token is present but the
 * secret is not configured, which is a deployment error rather than bad input.
 */
export function openRequestDraft(token: string | undefined, now = new Date()): RequestDraft | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payload, signature] = parts as [string, string];

  const expected = sign(payload);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isDraft(parsed) || parsed.exp <= now.getTime()) return null;
  return parsed;
}
