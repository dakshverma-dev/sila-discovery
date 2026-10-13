import { headers } from "next/headers";
import { setDemoCookie } from "@/lib/auth/demo-session";
import { callApi } from "@/lib/db/api";
import { allowRequest } from "@/lib/server/rate-limit";
import { buildDemoDefinition } from "./catalogue";

export type SandboxOutcome =
  | { ok: true; workspaceId: string; personaId: string; expiresAt: number }
  | { ok: false; code: string };

/** Creates an isolated synthetic workspace and sets the signed capability cookie. */
export async function createSandbox(): Promise<SandboxOutcome> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = Number(process.env.SANDBOX_RATE_LIMIT) || 5;
  if (!allowRequest(`sandbox:${ip}`, limit, 10 * 60_000)) return { ok: false, code: "RATE_LIMITED" };
  let result;
  try {
    result = await callApi<{ workspace_id: string; users: Record<string, string> }>("create_demo_workspace", [
      buildDemoDefinition(),
    ]);
  } catch {
    return { ok: false, code: "DATABASE_UNAVAILABLE" };
  }
  if (!result.ok) return { ok: false, code: result.error.code };
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600;
  const personaId = result.data.users.org_book!;
  await setDemoCookie({ w: result.data.workspace_id, p: personaId, exp: expiresAt });
  return { ok: true, workspaceId: result.data.workspace_id, personaId, expiresAt };
}
