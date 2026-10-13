# Evaluation Metrics and Benchmarking Plan


D22 | Version 0.1 | 12 October 2026


Test the product thesis and isolate the contribution of Qloo.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Evaluation questions

- Does pooling demand create a reservation booking that groups could not justify individually?
- Does Qloo identify accepted shared experiences that simpler suggestions miss?
- Does the workflow reduce coordination time without overriding minority requirements?
- Do reserved participants attend, and would venue and organisers repeat the process?

| Metric | Definition | Interpretation |
| --- | --- | --- |
| Hard-constraint violation rate | Infeasible recommended proposals / all recommended proposals. | Release requirement 0. |
| Evidence validity | Cultural rationale items with valid source references / all cultural rationale items. | Release requirement 100%; missing coverage reported separately. |
| Qloo candidate coverage | Approved catalogue anchors returned / anchors queried, by group. | Measure distribution; do not hide sparse coverage. |
| Group acceptance | Groups accepting current offered version / included groups offered that version. | Pilot observation; not willingness to pay. |
| Reservation conversion | Unique active reservations / unique eligible invitation visitors. | Define visitor deduplication and tracking consent; synthetic runs excluded. |
| Booking completion | Venue-confirmed reservation bookings / published proposals. | Keep expired and cancelled offers in denominator. |
| Attendance | Attended participants / confirmed reserved seats. | Record after delivery; no invented attendance. |
| Coordination effort | Organiser and venue minutes per completed booking. | Compare with their documented manual process. |
| Net contribution | Proposed service fee minus variable platform cost and valued manual effort. | Track costs; fees and savings are hypotheses. |
| Minimum group utility | Lowest ordinal utility among groups in each feasible coalition. | Compare distributions; no raw-score cross-query average. |
| Group omission | Times a group is eligible but not offered an option / eligible runs. | Review repeated omission alongside rejection reasons. |
| Latency and provider budget | Job p50/p95 duration, calls, retry counts and failure rate. | Engineering targets in D04; results measured in live staging. |

## Benchmark arms

| Arm | Information and workflow | Purpose |
| --- | --- | --- |
| A Manual or curator | Same approved catalogue, briefs and hard constraints; human suggestions. | Practical incumbent benchmark. |
| B LLM only | Same structured briefs, catalogue and deterministic feasibility; no Qloo evidence. | Tests a generic language-model baseline. |
| C Qloo plus agent | Same inputs and solver; real Qloo anchor ranks and evidence. | Isolates taste evidence contribution. |
| D Synthetic regression | Controlled rank matrix, including difficult edge cases. | Tests correctness only; not proof of customer value. |

## Study design

Begin with 20 paired evaluation cases covering conflicting tastes, sparse evidence, limited budgets and unsuitable access conditions. Present feasible proposals in random order with source branding hidden during initial preference ratings. Obtain independent group and venue judgements where possible. Repeat the live booking experiment with consented communities; a three-group pilot is directional evidence, not population validation.

## Analysis

Use case-level paired comparisons for acceptable proposals and organiser time. Report individual cases, sample size, missing data, uncertainty and costs. Do not treat repeated ratings from the same person as independent respondents. Use case-level bootstrap intervals if sample size supports them; do not claim statistical significance from a small convenience pilot.

## Ablations

Remove Qloo evidence while keeping wording, hard constraints and inventory fixed. Compare equal group weighting with attendance weighting, and the minimum-utility term with a simple mean. Report whether differences arise from taste discovery, pricing, coordination or persuasive wording.

## Decision rule

Continue toward a real service only if there is acceptable demand, manageable coordination cost and venue willingness to repeat. Retain Qloo as a core product dependency only if its contribution is observed. Negative and inconclusive results are valid outputs, not results to obscure.

## Related documents

D02, D13, D21, D27
