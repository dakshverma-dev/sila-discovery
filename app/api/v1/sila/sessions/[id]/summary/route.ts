import { fromResult, handle, HttpError, uuid } from "@/lib/api/http";
import { requireApiActor } from "@/lib/sila/auth";
import { formatPracticalSummary, getPracticalSummary } from "@/lib/sila/commands/practical-summary";

/** Download a current, private offline summary (§17, §19, §27). */
export const GET = handle<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  const actor = await requireApiActor(request);
  const { id } = await params;
  if (!uuid.safeParse(id).success) throw new HttpError("NOT_FOUND", "Not found.");
  const result = await getPracticalSummary(actor, id);
  if (!result.ok) return fromResult(result);
  return new Response(formatPracticalSummary(result.data), { headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": `attachment; filename="Sila-${result.data.booking_ref}.txt"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
});
