# Definition of Done and Acceptance Criteria


D26 | Version 0.1 | 12 October 2026


Define the evidence required to call the MVP complete.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Completion standard

A feature is done when its observable behaviour, data integrity, access controls and failure paths pass the relevant acceptance tests, the current contracts reflect the implementation and the deployed interface communicates the correct status. A feature being visible on screen is insufficient.

| Req ID | Acceptance criterion | Evidence test |
| --- | --- | --- |
| R01 | Authenticate actors; authorise workspace, organisation, group and proposal access on every request. | T01 |
| R02 | Venue managers maintain deliverable experiences, quotes, cultural anchors and available slots. | T02 |
| R03 | Organisers record declared references, meanings, sharing consent, budget, group size and exact availability. | T03 |
| R04 | Resolve references through Qloo search and obtain organiser selection for ambiguous results. | T04 |
| R05 | Fetch genuine server-side Qloo evidence and label live, cached, unavailable and synthetic modes. | T05 |
| R06 | Use venue-approved links between experience anchors and cultural entities; preserve declared meanings. | T06 |
| R07 | Generate ranked feasible coalitions of two to four groups without violating hard constraints. | T07 |
| R08 | Explain suitability, uncertainty and exclusions with valid evidence references. | T08 |
| R09 | Publish immutable terms; every material revision invalidates prior decisions and reservations. | T09 |
| R10 | Each included group organiser accepts or declines the current version and sharing arrangement. | T10 |
| R11 | Each authenticated participant reserves one seat, subject to capacity and consent. | T11 |
| R12 | Confirm a reservation booking atomically only when readiness, slot and quote checks pass. | T12 |
| R13 | Handle withdrawal, cancellation, expiry and completion without hidden state changes. | T13 |
| R14 | Expose bounded job progress, failures, retries and in-app status changes. | T14 |
| R15 | Create isolated synthetic workspaces for unauthenticated judges, with scoped role simulation. | T15 |
| R16 | Provide consent choices, account export, deletion and retention enforcement. | T16 |
| R17 | Record outcome events and comparable benchmark runs without claiming unmeasured improvement. | T17 |
| R18 | Operators review venue eligibility, resolve support issues and audit privileged actions. | T18 |

## Nonfunctional release gates

| Gate | Required result |
| --- | --- |
| Permissions | T01 passes all allowed and denied role cases. |
| Seat and state integrity | T11 and T12 pass concurrency and stale-version cases. |
| Grounding | T05 and T08 show real provider provenance and no invented evidence. |
| Public demo | T15 and T23 pass separate sessions and external access. |
| Privacy and secrets | T16 and T21 pass deletion, log and bundle checks. |
| Accessible journeys | T20 passes the defined critical journeys. |
| Reproduction | T22 passes from a clean environment. |

## End-to-end acceptance scenario

Given three sharing-consenting synthetic groups and an approved experience, a judge submits references, inspects live or visibly cached Qloo evidence, receives a feasible coalition, publishes it as a synthetic venue manager, obtains current-version organiser acceptance, reserves sufficient individual seats and confirms the reservation booking. The interface retains NOT_COLLECTED. Rejecting revised terms prevents confirmation until the correct decisions and seats are collected again.

## Failure acceptance scenario

Given disjoint availability or a blocked access requirement, the system produces no feasible coalition and explains the blocker. Given Qloo failure, it labels the state and retains existing reservations. Given fifty competing last-seat attempts, capacity remains intact.

## Application release status

All listed application checks are pending implementation. The documentation pack itself is complete only when all 28 requested items, reference assets, diagrams, source notes and validation results are present and internally consistent.

## Submission gate

Verify the live hosted URL, public repository, complete run instructions, visible open-source licence and accurate project description. A local-only app or synthetic-only cultural integration does not meet the stated hackathon requirements.

## Related documents

D21, D23, D28

## Sources

- SRC07: Qloo official hackathon overview. https://qloo.devpost.com/
