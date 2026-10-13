# Matching and Coalition Formation Algorithm Specification


D13 | Version 0.1 | 12 October 2026


Define deterministic feasibility, ranking and proposal generation.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Input and output

Inputs are frozen group briefs, venue-approved experiences, exact slots, immutable GBP quotes and group-specific Qloo anchor ranks. Output contains up to three distinct DRAFT coalition proposals, constraint checks, indicative economics, evidence coverage and exclusion reasons. Existing participants are deduplicated by authenticated identity when they reserve; estimated group totals remain uncertain.

## Hard feasibility

Enumerate group subsets of size 2 to 4. Require a common slot, explicit sharing consent, price within every group budget, declared access support, approved programme and a current quote. The sum of expected attendance must reach the quoted required seat count without exceeding slot capacity. If a group would need to reduce attendance to fit, request clarification; do not silently exclude its members.

## Economics

```text
For N from venue_min_seats through capacity:
  venue_charge = max(fixed_pence + variable_pence * N,
                     minimum_venue_charge_pence)
  total_cost = venue_charge + platform_fee_pence * N
  feasible_count = ticket_pence * N >= total_cost
required_seats = first feasible N; none => infeasible quote
```

The platform fee is a proposed quote field, not an enacted pricing model. Venue managers approve the full quote. Costs are all-in quoted values; do not infer VAT. Reservations satisfy an indicative financial threshold, not payment settlement. Free sessions are valid only when quoted costs are zero and venue minimum attendance is met.

## Cultural utility

Use a fixed book-anchor universe of at most 30 entities for every group query. Convert returned position r among n ranked results to 1 - (r - 1)/(n - 1). For n=1 use 0.5. If raw scores reveal ties, use average ranks. For an experience, average utilities of its returned approved anchors. A scored group requires at least two candidates and a complete returned comparison universe. If any universe anchor is missing, mark that group utility unknown and require review. Missing anchors remain unknown; disclose coverage.

```text
cultural_score = 0.70 * min(group_utilities)
               + 0.30 * mean(group_utilities)
rank feasible candidates by cultural_score descending
tie-break by expected surplus descending,
             earlier slot start, sorted group IDs, experience ID
```

Groups have equal weight, so a larger group does not dominate cultural ranking. Unknown utility makes a candidate NEEDS_REVIEW rather than assigning zero dislike or silently dropping the group. Score values order suggestions; they are not probabilities or claims that every member will enjoy the experience. Initial weights are design defaults to evaluate.

## Computational bounds

With 20 groups there are 6,175 subsets of size 2 to 4. Ten experiences with five slots each produce at most 308,750 candidate evaluations. Filter time, consent and budget before scoring. Enforce the input cap; benchmark CPU time rather than claiming an unmeasured runtime.

## Reference implementation and verification

specs/matching_reference.py implements quote thresholds, hard filtering and rank aggregation for synthetic fixtures. It is a reference module, not a production scheduler. Test infeasible quotes, capacity, disjoint time windows, one-candidate neutrality, unknown evidence and reversal of readiness after a withdrawal.

## Feedback and fairness

Classify rejection as subject, interpretation, cost, time, access or sharing. Only subject or interpretation feedback changes taste inputs after organiser review. A preference for private attendance is a constraint, not an error in the person's taste. Track each group's inclusion and rejection rate across runs without inferring protected traits.

## Related documents

D11, D14, D21, D22
