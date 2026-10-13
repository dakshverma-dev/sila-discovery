import fixture from "@/specs/synthetic_fixture.json";
import type { SolverInput } from "@/lib/domain/solver";
import type { Offer } from "@/lib/domain/types";

/**
 * Maps the specification's synthetic fixture onto solver input. Anchor labels
 * stand in for entity IDs; they are fictional and never sent to Qloo.
 */
export type SyntheticFixture = typeof fixture;

export function syntheticOffer(f: SyntheticFixture = fixture): Offer {
  return {
    experience: {
      id: f.experience.id,
      title: f.experience.title,
      approved: true,
      access_support: f.experience.access_support,
      anchor_entity_ids: f.experience.anchor_labels,
    },
    quote: { id: "quote_1", version: 1, currency: "GBP", ...f.quote },
    slots: [{ ...f.slot, experience_id: f.experience.id }],
  };
}

export function syntheticSolverInput(f: SyntheticFixture = fixture): SolverInput {
  return {
    groups: f.groups.map((g) => ({
      group_id: g.id,
      expected_seats: g.expected_seats,
      budget_pence: g.budget_pence,
      sharing: g.sharing_consent ? "WILLING_TO_SHARE" : "PRIVATE_ONLY",
      access_requirements: g.access_requirements,
      availability: g.availability,
    })),
    offers: [syntheticOffer(f)],
    anchor_universe: f.anchor_universe,
    rankings: Object.fromEntries(
      Object.entries(f.synthetic_ranked_anchor_labels).map(([groupId, labels]) => [
        groupId,
        labels.map((entity_id) => ({ entity_id })),
      ]),
    ),
    source_mode: "synthetic",
  };
}

export const SYNTHETIC_GROUP_NAMES: Record<string, string> = Object.fromEntries(
  fixture.groups.map((g) => [g.id, g.name]),
);

export const SYNTHETIC_EXPECTED = fixture.expected;
