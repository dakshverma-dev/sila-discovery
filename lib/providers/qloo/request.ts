import { createHash } from "node:crypto";
import { LIMITS } from "@/lib/domain/limits";
import { QLOO_DEFAULTS } from "./config";
import { QlooError } from "./errors";

/** Entity IDs are opaque provider strings; reject anything that could break a comma list. */
const ENTITY_ID = /^[A-Za-z0-9_-]{1,128}$/;

function invalid(): QlooError {
  return new QlooError("VALIDATION_FAILED", "INVALID_INPUT", false);
}

function uniqueValidIds(ids: readonly string[]): string[] {
  if (new Set(ids).size !== ids.length || !ids.every((id) => ENTITY_ID.test(id))) throw invalid();
  return [...ids];
}

/**
 * Fixed-universe anchor ranking query (D11). Every group in a run must use the
 * same anchor list and parameters; only the confirmed interest IDs differ.
 * No names, emails, group labels or access notes are ever included.
 */
export function buildInsightsParams(
  confirmedEntityIds: readonly string[],
  anchorEntityIds: readonly string[],
): URLSearchParams {
  const signals = uniqueValidIds(confirmedEntityIds);
  const anchors = uniqueValidIds(anchorEntityIds);
  if (signals.length < 1 || anchors.length < 2 || anchors.length > LIMITS.maximumAnchorUniverse) {
    throw invalid();
  }
  return new URLSearchParams({
    "filter.type": QLOO_DEFAULTS.outputType,
    "signal.interests.entities": signals.join(","),
    "filter.results.entities": anchors.join(","),
    take: String(anchors.length),
    "feature.explainability": "true",
  });
}

/** Entity lookup for organiser disambiguation. Search types differ from Insights filter.type. */
export function buildSearchParams(query: string, take = 5, types?: readonly string[]): URLSearchParams {
  const q = query.trim();
  if (q.length < 1 || q.length > 200 || !Number.isInteger(take) || take < 1 || take > 20) {
    throw invalid();
  }
  const params = new URLSearchParams({ query: q, take: String(take) });
  if (types?.length) params.set("types", types.join(","));
  return params;
}

/** Stable fingerprint of a canonical query, used for caching and provenance. */
export function queryFingerprint(path: string, params: URLSearchParams, scope = ""): string {
  const canonical = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return createHash("sha256").update(`${scope}|${path}?${canonical}`).digest("hex");
}
