import { z } from "zod";
import { venueFor, type Session } from "./catalog";

const day = z.iso.date();
export const discoveryInput = z
  .strictObject({
    clubName: z.string().trim().min(2).max(80),
    interestEntityIds: z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,128}$/))
      .min(1)
      .max(3),
    interestProofs: z.array(z.string().max(2000)).min(1).max(3),
    city: z.literal("Edinburgh"),
    startDate: day,
    endDate: day,
    maxPricePence: z.number().int().min(0).max(100000),
    places: z.number().int().min(1).max(12),
    useAssistant: z.boolean().default(false),
  })
  .refine(
    (v) => new Set(v.interestEntityIds).size === v.interestEntityIds.length,
    "Choose distinct interests",
  )
  .refine(
    (v) => v.interestProofs.length === v.interestEntityIds.length,
    "Select verified search results",
  )
  .refine((v) => {
    const span = Date.parse(v.endDate) - Date.parse(v.startDate);
    return span >= 0 && span <= 30 * 86400000;
  }, "Choose a date window of at most 30 days");

export type DiscoveryInput = z.infer<typeof discoveryInput>;
export type Constraints = Pick<
  DiscoveryInput,
  "city" | "startDate" | "endDate" | "maxPricePence" | "places"
>;
export type Exclusion = { sessionId: string; reasons: string[] };
export function eligibility(session: Session, input: Constraints): string[] {
  const reasons: string[] = [];
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(session.startsAt));
  if (!venueFor(session)?.qlooId)
    reasons.push("Venue has no verified Qloo mapping");
  if (input.city !== "Edinburgh") reasons.push("Outside Edinburgh");
  if (session.status !== "open") reasons.push("Session is closed");
  if (date < input.startDate || date > input.endDate)
    reasons.push("Outside your dates");
  if (session.pricePence > input.maxPricePence)
    reasons.push("Above your per-person budget");
  if (session.remaining < input.places)
    reasons.push("Not enough sample places");
  return reasons;
}

/** Only provider-returned venues may enter the recommendations. Never invent coverage. */
export function recommend(
  catalogue: Session[],
  providerIds: string[],
  input: Constraints,
) {
  const order = new Map(providerIds.map((id, i) => [id.toUpperCase(), i + 1]));
  const exclusions: Exclusion[] = [];
  const candidates = catalogue.flatMap((session) => {
    const reasons = eligibility(session, input);
    const rank = order.get(venueFor(session)?.qlooId.toUpperCase() ?? "");
    if (rank === undefined)
      reasons.push("Qloo returned no ranking for this venue");
    if (reasons.length) {
      exclusions.push({ sessionId: session.id, reasons });
      return [];
    }
    return [{ ...session, providerRank: rank! }];
  });
  candidates.sort(
    (a, b) =>
      a.providerRank - b.providerRank ||
      a.startsAt.localeCompare(b.startsAt) ||
      a.id.localeCompare(b.id),
  );
  return { recommendations: candidates.slice(0, 3), exclusions };
}

export const placeRequestInput = z.strictObject({
  runId: z.uuid(),
  sessionId: z.string().min(1).max(80),
  places: z.number().int().min(1).max(12),
  expectedPricePence: z.number().int().min(0),
  expectedVersion: z.number().int().min(1),
  requestKey: z.uuid(),
});
