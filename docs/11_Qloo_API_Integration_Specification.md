# Qloo API Integration Specification


D11 | Version 0.1 | 12 October 2026


Define the verified provider surface and the adapter contract to test with a live key.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Provider scope

Use the official hackathon environment and GET requests. Resolve organiser references during onboarding, before a matching job. For each matching run, query each eligible group against the same approved cultural-anchor universe. The initial output domain is book; cross-domain input references can still include films, music artists, brands and places. Other output domains require a separate contract test and benchmark.

| Operation | Provider contract | Application use |
| --- | --- | --- |
| Entity lookup | GET https://hackathon.api.qloo.com/search; query and take parameters. | Return candidates for organiser disambiguation. Do not invent an ID. |
| Anchor ranking | GET https://hackathon.api.qloo.com/v2/insights; filter.type=urn:entity:book. | Rank approved catalogue anchors for one group. |
| Inputs | signal.interests.entities as comma-separated confirmed entity IDs. | No names, email, group labels or access notes. |
| Candidate restriction | filter.results.entities as comma-separated approved anchor IDs; take=universe size. | Same candidates and parameters for every group in the run. |
| Explanations | feature.explainability=true when supported by the key. | Optional provider metadata; absence does not justify invented evidence. |
| Authentication | X-Api-Key server-side header. | Store in server secret configuration only. |

## Request construction

```text
const params = new URLSearchParams({
  "filter.type": "urn:entity:book",
  "signal.interests.entities": confirmedIds.join(","),
  "filter.results.entities": anchorIds.join(","),
  "take": String(anchorIds.length),
  "feature.explainability": "true"
});
// GET QLOO_BASE_URL + "/v2/insights?" + params
// X-Api-Key: process.env.QLOO_API_KEY
```

## Normalised adapter result

Expose entity_id, name, subtype, ordinal rank, optional raw score, optional explainability, query fingerprint, fetched_at and source_mode. The documented Insights envelope uses results.entities. Search and affinity-field paths must be pinned by a redacted private live contract test; the specification does not claim that this task has observed a live payload. A malformed or missing expected envelope produces PROVIDER_SCHEMA_CHANGED.

## Ranking interpretation

Use ordinal ranks within a fixed candidate query, not averages of raw scores across requests. Provider scores are not attendance probabilities. A missing anchor is unknown; it is not a negative preference. A single returned candidate has neutral rank utility. Raw provider values are preserved only for audit and never displayed as a purchase likelihood.

## Catalogue mapping

Each experience has one to three venue-reviewed book anchors, with a stated reason the anchor relates to the programme. These mappings are the product's interpretation, not a Qloo endorsement of an artwork. The shared universe contains at most 30 anchors. An experience without approved anchors can be booked manually but cannot be labelled as a Qloo-assisted recommendation.

## Reliability and limits

Set an 8-second timeout, maximum four concurrent provider calls and a 24-call job budget including retries. Twenty group queries leave four retry opportunities. Entity search has separate per-user limits. Retry transient 429 and 5xx failures at most once within the remaining budget; honour Retry-After or fail visibly when the job deadline would be exceeded. Do not retry 401, 403 or validation failures unchanged.

## Private caching and release checks

Use a private database cache keyed by environment, canonical parameters and catalogue version, with a proposed 24-hour freshness TTL. Never publish provider response dumps in source control. Confirm key access, entity lookup, fixed-universe completeness, explanation metadata and parser fields with a live key before submission. Cache hits must remain visibly labelled cached, with their original timestamp.

## Related documents

D10, D13, D19, D22

## Sources

- SRC02: Qloo hackathon developer guide. https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide
- SRC03: Qloo entity search reference. https://github.com/qloo/docs-public/blob/main/reference/get-search.md
- SRC04: Qloo Insights parameter reference. https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md
- SRC05: Qloo affinity interpretation. https://github.com/qloo/docs-public/blob/main/docs/interpreting-affinity-scores.md
- SRC06: Qloo recommendation response example. https://github.com/qloo/docs-public/blob/main/reference/basic-insights-use-case.md
