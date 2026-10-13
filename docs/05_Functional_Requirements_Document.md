# Functional Requirements Document


D05 | Version 0.1 | 12 October 2026


Describe feature inputs, actor permissions, successful results and failure behaviour.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Feature definitions

| Feature | Actor and inputs | Successful output | Failure behaviour |
| --- | --- | --- | --- |
| Catalogue management | Venue manager; programme, anchor mapping, quote, slot, access support. | Approved experience and immutable quote snapshot. | Reject invalid capacity, past slot or unreviewed programme. |
| Group brief | Organiser; references, declared meaning, budget, expected attendance, availability, sharing consent. | Versioned brief ready for resolution. | Show missing fields; no consent means no external taste query. |
| Reference resolution | Organiser; typed reference and desired category. | Confirmed Qloo entity ID or explicitly unresolved reference. | Show disambiguation, not a fabricated best match. |
| Matching run | Organiser requests; server checks eligible invited groups. | Up to three feasible draft proposals and exclusion reasons. | Return none feasible with actionable blockers. |
| Publication | Venue manager; draft and expected version. | One current OPEN proposal version for the slot. | 409 for stale terms or competing open proposal. |
| Group response | Included organiser; version, decision and optional reason. | Acceptance or decline on current terms. | 409 for superseded version; decline triggers review. |
| Reserve seat | Participant in an included group; version and sharing acceptance. | One active seat allocation and NOT_COLLECTED status. | Reject duplicate, capacity, expired terms or ineligible membership. |
| Confirmation | Venue manager; expected version and idempotency key. | Atomic CONFIRMED reservation booking. | Recheck current reservations; reject stale or unready booking. |

## Replanning

A decline pauses progression and records its category. The operator or organiser can request a new match run; the agent can prepare revised DRAFT terms. Publication requires venue action. Previously accepted terms and seat allocations are invalidated only as part of an explicit material revision or cancellation transaction.

## Notifications

Use an in-app activity feed for proposal publication, revision, readiness, expiry and cancellation. The MVP does not send automated email, SMS or WhatsApp outreach. Invitation links are copied and shared by an authorised user.

## Participant protections

Participants see the venue, experience, date, quoted price, reservation deadline, source mode and the fact that the session is shared. Their identity is not exposed to other groups. Withdrawal is self-service before confirmation; after confirmation the interface routes a cancellation request to the venue.

## Related documents

D03, D14, D20
