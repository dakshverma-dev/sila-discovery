import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSilaActor } from "@/lib/sila/auth";
import { submitPlan } from "@/lib/sila/commands/plans";
import { DRAFT_COOKIE, DRAFT_COOKIE_PATH, openRequestDraft } from "@/lib/sila/request-draft";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where the emailed sign-in link lands (`next=/s/{id}/resume`). Opens the signed
 * draft, requires the verified actor and sends the request under the draft's own
 * idempotency key, so visiting this link twice replays the same plan. A route
 * handler rather than a page because it must clear the draft cookie.
 *
 * - No usable draft for this session: back to the session page.
 * - Signed in as a different email than the draft: back to the session page with
 *   the draft prefilled for review (`?review=1`); nothing is submitted.
 * - Rejected (for example the session filled meanwhile): back to the session page
 *   with the reason; the draft is kept so the details are not lost.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const origin = new URL(request.url).origin;
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), 303);

  if (!UUID.test(id)) return go("/");
  const draft = openRequestDraft((await cookies()).get(DRAFT_COOKIE)?.value);
  if (!draft || draft.sessionId !== id) return go(`/s/${id}`);

  const actor = await getSilaActor();
  if (!actor) return go(`/sign-in?next=${encodeURIComponent(`/s/${id}/resume`)}`);
  if (actor.email.toLowerCase() !== draft.email.toLowerCase()) return go(`/s/${id}?review=1`);

  const submitted = await submitPlan(actor, draft.idempotencyKey, {
    sessionId: id,
    clubName: draft.clubName,
    places: draft.places,
    source: draft.source,
  });
  if (!submitted.ok) {
    const code = /^[A-Z_]{3,40}$/.test(submitted.error.code) ? submitted.error.code : "UNKNOWN";
    return go(`/s/${id}?resume_error=${code}`);
  }
  const response = go(`/plans/${submitted.data.plan_id}`);
  response.cookies.set(DRAFT_COOKIE, "", { path: DRAFT_COOKIE_PATH, maxAge: 0 });
  return response;
}
