import { z } from "zod";
import { QlooError } from "./errors";

/**
 * Response parsers. Only `results.entities` for Insights is documented in D11;
 * the affinity field path and the /search envelope are PROVISIONAL until a
 * private live contract test pins them. Unknown fields are ignored.
 */

const insightsEntity = z.looseObject({
  entity_id: z.string().min(1),
  name: z.string(),
  subtype: z.string().optional(),
  query: z.looseObject({ affinity: z.number().optional() }).optional(),
});

const insightsEnvelope = z.looseObject({
  results: z.looseObject({ entities: z.array(insightsEntity) }),
});

export interface ParsedInsightEntity {
  entity_id: string;
  name: string;
  subtype?: string;
  /** 1-based order as returned by the provider. */
  rank: number;
  /** Provisional field path; audit only, never shown as a likelihood. */
  raw_score?: number;
}

export function parseInsights(body: unknown): ParsedInsightEntity[] {
  const parsed = insightsEnvelope.safeParse(body);
  if (!parsed.success) throw new QlooError("PROVIDER_SCHEMA_CHANGED", "MALFORMED_RESPONSE", false);
  // A 200 with an empty list is valid data: it means unknown coverage, not dislike.
  return parsed.data.results.entities.map((e, i) => ({
    entity_id: e.entity_id,
    name: e.name,
    subtype: e.subtype,
    rank: i + 1,
    raw_score: e.query?.affinity,
  }));
}

const searchEntity = z.looseObject({
  entity_id: z.string().min(1),
  name: z.string(),
  subtype: z.string().optional(),
  types: z.array(z.string()).optional(),
});

const searchEnvelope = z.looseObject({ results: z.array(searchEntity) });

export interface SearchCandidate {
  entity_id: string;
  name: string;
  subtype?: string;
  types: string[];
}

export function parseSearch(body: unknown): SearchCandidate[] {
  const parsed = searchEnvelope.safeParse(body);
  if (!parsed.success) throw new QlooError("PROVIDER_SCHEMA_CHANGED", "MALFORMED_RESPONSE", false);
  return parsed.data.results.map((e) => ({
    entity_id: e.entity_id,
    name: e.name,
    subtype: e.subtype,
    types: e.types ?? [],
  }));
}
