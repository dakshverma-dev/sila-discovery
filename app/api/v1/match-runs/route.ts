import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { assertSameOrigin, fromResult, handle, HttpError, idempotencyKey, readJson, resolveActor, uuid } from "@/lib/api/http";
import { processMatchRun } from "@/lib/agent/run";
import { callApi } from "@/lib/db/api";
import type { Overview } from "@/lib/demo/views";

const Body = z.strictObject({
  group_ids: z.array(uuid).min(1).max(20),
  experience_ids: z.array(uuid).max(10),
  expected_brief_versions: z.record(uuid, z.int().min(1)),
});

/**
 * POST /match-runs: queue a bounded run for the caller's own group (202).
 * group_ids must contain exactly one group the caller organises; the other
 * eligible groups come from the workspace snapshot, never from the client.
 */
export const POST = handle<unknown>(async (request) => {
  assertSameOrigin(request);
  idempotencyKey(request);
  const actor = await resolveActor();
  const body = await readJson(request, Body);
  const overview = await callApi<Overview>("get_workspace_overview", [actor.actorId, actor.workspaceId]);
  if (!overview.ok) throw new HttpError(overview.error.code, overview.error.message);
  const mine = new Set(overview.data.organised_groups.map((g) => g.id));
  const requested = body.group_ids.filter((g) => mine.has(g));
  if (requested.length !== 1) {
    throw new HttpError("FORBIDDEN", "Include exactly one group that you organise.", {
      group_ids: ["Exactly one group must be organised by you"],
    });
  }
  // Sandbox groups and anchors are fictional, so their evidence is synthetic.
  const result = await callApi<{ run_id: string; state: string }>("create_match_run", [
    actor.actorId, requested[0], "synthetic", randomUUID(),
    body.experience_ids.length ? body.experience_ids : null, body.expected_brief_versions,
  ]);
  if (result.ok) after(() => processMatchRun(result.data.run_id).then(() => undefined));
  return fromResult(result, (d) => ({ id: d.run_id, state: d.state }), 202);
});
