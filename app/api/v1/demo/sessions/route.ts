import { assertSameOrigin, failure, handle, success } from "@/lib/api/http";
import { callApi } from "@/lib/db/api";
import { createSandbox } from "@/lib/demo/session";
import type { Persona } from "@/lib/demo/views";

/** POST /demo/sessions: isolated synthetic judge workspace (R15). Rate limited. */
export const POST = handle<unknown>(async (request) => {
  assertSameOrigin(request);
  const r = await createSandbox();
  if (!r.ok) return failure(r.code, "The sandbox could not be created.");
  const personas = await callApi<{ personas: Persona[] }>("list_demo_personas", [r.workspaceId]);
  return success(
    {
      workspace_id: r.workspaceId,
      acting_persona_id: r.personaId,
      expires_at: new Date(r.expiresAt * 1000).toISOString(),
      personas: personas.ok ? personas.data.personas : [],
      synthetic: true,
    },
    201,
  );
});
