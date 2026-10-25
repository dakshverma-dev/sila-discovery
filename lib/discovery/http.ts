import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DiscoveryError } from "./store";
import { QlooError } from "@/lib/providers/qloo/errors";
import { allowRequest } from "@/lib/server/rate-limit";

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function guard(request: Request, owner: string, limit = 20) {
  if (
    !allowRequest(
      `discovery:${owner}:${new URL(request.url).pathname}`,
      limit,
      60000,
    )
  )
    throw new DiscoveryError(429, "Too many requests. Please wait a minute.");
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    const expected =
      process.env.DISCOVERY_ORIGIN || new URL(request.url).origin;
    if (!origin || origin !== expected)
      throw new DiscoveryError(
        403,
        "Open Sila in the same browser to continue.",
      );
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new DiscoveryError(422, "Send JSON input.");
  }
}
export async function body(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new DiscoveryError(422, "Missing request details.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new DiscoveryError(422, "Request is too large.");
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DiscoveryError(422, "Check your request details.");
  }
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return json(
      {
        error: "Check your club, interests, places, budget and dates.",
        fields: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      422,
    );
  if (error instanceof DiscoveryError)
    return json({ error: error.message }, error.status);
  if (error instanceof QlooError)
    return json(
      {
        error:
          "Qloo is temporarily unavailable. Retry discovery or browse the unranked fictional catalogue.",
        code: error.code,
      },
      error.code === "RATE_LIMITED" ? 429 : 503,
    );
  return json(
    {
      error:
        "Discovery could not complete. Please retry or browse the fictional catalogue. No request has been confirmed.",
    },
    503,
  );
}
