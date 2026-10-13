import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifyCapability } from "@/lib/auth/capability";
import { DEMO_COOKIE } from "@/lib/auth/demo-session";
import type { ApiResult } from "@/lib/db/api";
import { getPool } from "@/lib/db/pool";

/** D16 envelopes, status mapping and request guards for /api/v1 routes. */

const STATUS: Record<string, number> = {
  VALIDATION_FAILED: 400,
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  CAPACITY_EXCEEDED: 409,
  NOT_READY: 409,
  IDEMPOTENCY_CONFLICT: 409,
  ALREADY_RESERVED: 409,
  PROPOSAL_CLOSED: 409,
  SLOT_UNAVAILABLE: 409,
  PROPOSAL_EXPIRED: 410,
  NEEDS_INPUT: 422,
  NO_FEASIBLE_COALITION: 422,
  RATE_LIMITED: 429,
  PROVIDER_SCHEMA_CHANGED: 502,
  QLOO_UNAVAILABLE: 503,
  DATABASE_UNAVAILABLE: 503,
  JOB_DEADLINE_EXCEEDED: 504,
};

const RETRYABLE = new Set(["RATE_LIMITED", "QLOO_UNAVAILABLE", "DATABASE_UNAVAILABLE", "JOB_DEADLINE_EXCEEDED"]);
const MAX_BODY_BYTES = 64 * 1024;

export class HttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

export function success(data: unknown, status = 200, meta: Record<string, unknown> = {}): Response {
  return Response.json({ data, meta: { request_id: randomUUID(), ...meta } }, { status });
}

export function failure(code: string, message: string, fieldErrors: Record<string, string[]> = {}): Response {
  return Response.json(
    {
      error: { code, message, field_errors: fieldErrors, retryable: RETRYABLE.has(code) },
      meta: { request_id: randomUUID() },
    },
    { status: STATUS[code] ?? 500 },
  );
}

/** Converts a guarded-function envelope into an HTTP response. */
export function fromResult<T>(result: ApiResult<T>, project: (data: T) => unknown = (d) => d, status = 200): Response {
  if (result.ok) return success(project(result.data), status, result.replayed ? { replayed: true } : {});
  const fields = (result.error.details?.field_errors ?? {}) as Record<string, string[] | null>;
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => Array.isArray(v))) as Record<string, string[]>;
  return failure(result.error.code, result.error.message, clean);
}

export interface Actor {
  actorId: string;
  workspaceId: string;
  via: "demo";
}

/**
 * Resolves the caller. Only the signed sandbox capability is accepted until
 * pilot authentication ships; it is re-validated in the database each time.
 * Roles, organisations and workspaces in request bodies are never trusted.
 */
export async function resolveActor(): Promise<Actor> {
  const cap = verifyCapability((await cookies()).get(DEMO_COOKIE)?.value);
  if (!cap) throw new HttpError("AUTH_REQUIRED", "Sign in or start a sandbox session.");
  const { rows } = await getPool().query<{ valid: boolean }>("select scb_api.demo_persona_valid($1, $2) as valid", [
    cap.w,
    cap.p,
  ]);
  if (!rows[0]?.valid) throw new HttpError("AUTH_REQUIRED", "The sandbox session has expired.");
  return { actorId: cap.p, workspaceId: cap.w, via: "demo" };
}

/** Cookie-authenticated writes must come from this site (CSRF, D19). */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // Non-browser clients do not send Origin and carry no ambient cookies from other sites.
  const allowed = new Set([new URL(request.url).origin, process.env.APP_BASE_URL?.replace(/\/$/, "")].filter(Boolean));
  if (!allowed.has(origin)) throw new HttpError("FORBIDDEN", "Cross-site request refused.");
}

export function idempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 200) {
    throw new HttpError("VALIDATION_FAILED", "An Idempotency-Key header of 8 to 200 characters is required.", {
      "Idempotency-Key": ["Required"],
    });
  }
  return key;
}

export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) throw new HttpError("VALIDATION_FAILED", "Request body is too large.");
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new HttpError("VALIDATION_FAILED", "Request body is too large.");
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError("VALIDATION_FAILED", "Request body must be JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "body";
      (fields[key] ??= []).push(issue.message);
    }
    throw new HttpError("VALIDATION_FAILED", "Check the highlighted fields.", fields);
  }
  return parsed.data;
}

export const uuid = z.uuid();

/** Wraps a route handler with consistent error handling. */
export function handle<C>(fn: (request: Request, context: C) => Promise<Response>) {
  return async (request: Request, context: C): Promise<Response> => {
    try {
      return await fn(request, context);
    } catch (error) {
      if (error instanceof HttpError) return failure(error.code, error.message, error.fieldErrors);
      console.error("api error", error);
      return failure("DATABASE_UNAVAILABLE", "The service is temporarily unavailable. Nothing was changed.");
    }
  };
}
