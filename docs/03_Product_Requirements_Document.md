# Product Requirements Document


D03 | Version 0.1 | 12 October 2026


Specify the user-facing MVP and its release conditions.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Release objective

Deliver an accessible judge demo: isolated synthetic groups, real Qloo reference resolution, feasible shared proposals, rejection and revision, seat reservations and simulated venue confirmation.

## Core requirements

| ID | Capability | Requirement |
| --- | --- | --- |
| R01 | Identity and access | Authenticate actors; authorise workspace, organisation, group and proposal access on every request. |
| R02 | Approved catalogue | Venue managers maintain deliverable experiences, quotes, cultural anchors and available slots. |
| R03 | Group brief | Organisers record declared references, meanings, sharing consent, budget, group size and exact availability. |
| R04 | Entity resolution | Resolve references through Qloo search and obtain organiser selection for ambiguous results. |
| R05 | Qloo discovery | Fetch genuine server-side Qloo evidence and label live, cached, unavailable and synthetic modes. |
| R06 | Interpretation and mapping | Use venue-approved links between experience anchors and cultural entities; preserve declared meanings. |
| R07 | Coalition formation | Generate ranked feasible coalitions of two to four groups without violating hard constraints. |
| R08 | Explanations | Explain suitability, uncertainty and exclusions with valid evidence references. |
| R09 | Versioned proposals | Publish immutable terms; every material revision invalidates prior decisions and reservations. |
| R10 | Group decisions | Each included group organiser accepts or declines the current version and sharing arrangement. |
| R11 | Reservations | Each authenticated participant reserves one seat, subject to capacity and consent. |
| R12 | Venue confirmation | Confirm a reservation booking atomically only when readiness, slot and quote checks pass. |
| R13 | Lifecycle recovery | Handle withdrawal, cancellation, expiry and completion without hidden state changes. |
| R14 | Agent job visibility | Expose bounded job progress, failures, retries and in-app status changes. |
| R15 | Public judge sandbox | Create isolated synthetic workspaces for unauthenticated judges, with scoped role simulation. |
| R16 | Privacy controls | Provide consent choices, account export, deletion and retention enforcement. |
| R17 | Evaluation evidence | Record outcome events and comparable benchmark runs without claiming unmeasured improvement. |
| R18 | Operator control | Operators review venue eligibility, resolve support issues and audit privileged actions. |

## Scope and dependencies

Use 5 to 10 approved experiences, at most 20 groups per run and 2 to 4 groups per coalition. Venue records supply prices and slots. Qloo and an LLM provider are dependencies; credentials remain to be configured.

## Meaning of completion

Confirmation means venue approval of a reservation booking. Show payment_status=NOT_COLLECTED. Do not present paid tickets, receipts or successful refunds.

## Release acceptance

- R01 to R18 have traceable acceptance tests or a documented release exception.
- Critical authorisation, transaction, provenance and public-demo tests pass with no exceptions.
- The no-feasible-result and provider-unavailable journeys are usable.
- The published repository contains source and setup instructions but no secrets or Qloo response dumps.

## Change control

The product owner maintains priorities. Changes to payments, agent authority, lifecycle or consent require updates to D04, D14, D16, D19 and D26. Synthetic fixtures are not customer evidence.

## Related documents

D04, D05, D08, D26

## Sources

- SRC01: Product brief approved in this conversation. Shared_Cultural_Bookings_Product_Brief.docx
- SRC07: Qloo official hackathon overview. https://qloo.devpost.com/
