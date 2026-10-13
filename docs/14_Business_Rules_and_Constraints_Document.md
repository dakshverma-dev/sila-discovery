# Business Rules and Constraints Document


D14 | Version 0.1 | 12 October 2026


Provide the normative business invariants and state transitions.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Normative rules

| Rule | Invariant | Enforcement point |
| --- | --- | --- |
| BR01 | All participants are adults; collect an adult declaration, not date of birth. | Reservation |
| BR02 | One currency GBP and integer pence throughout MVP. | Quote and API validation |
| BR03 | Coalitions contain 2 to 4 explicitly sharing-consenting groups. | Solver |
| BR04 | The same slot must satisfy every included group's exact availability interval. | Solver and confirmation |
| BR05 | All-in quoted ticket price must not exceed any group's declared per-person maximum. | Solver |
| BR06 | Declared access requirements must be explicitly supported by the venue; unknown is blocked. | Solver and venue review |
| BR07 | Quotes and published versions are immutable. Material changes require new acceptance. | Publication |
| BR08 | Only one OPEN or READY proposal version can hold a slot. CONFIRMED locks the slot as BOOKED. | Database uniqueness and transaction |
| BR09 | A person can hold only one active seat in the current slot; membership in multiple groups does not create extra seats. | Reservation transaction |
| BR10 | Expected group attendance is soft planning input; only individual active reservations count toward readiness. | Readiness calculation |
| BR11 | All included organisers must accept the current proposal version and sharing arrangement. | Readiness and confirmation |
| BR12 | Deadline and capacity checks use database time and row locks. | Every seat mutation |
| BR13 | Withdrawal before confirmation can move READY back to OPEN. After confirmation request venue support. | Lifecycle |
| BR14 | NOT_COLLECTED is the only MVP payment status. No receipt, paid commitment or refund success claim. | Every booking display |
| BR15 | The AI may save drafts but cannot publish terms or confirm a venue booking. | Tool permissions |
| BR16 | Provider failure cannot be disguised with synthetic evidence. | Adapter and UI |
| BR17 | Sharing a session never entails sharing another group's private membership or individual preferences. | Authorisation and DTO projections |
| BR18 | Cancellation requires actor, reason, timestamp and affected reservation audit. | Venue and operator actions |

## Proposal state machine

| From | To | Required guard |
| --- | --- | --- |
| DRAFT | OPEN | Venue publishes an immutable version; catalogue approval, future deadline and slot exclusivity pass. |
| OPEN | READY | All coalition organisers accept current terms and active reservations reach required_seats. |
| READY | OPEN | A pre-confirmation withdrawal or organiser reversal makes readiness false. |
| READY | CONFIRMED | Venue confirms before deadline; transaction rechecks quote, capacity, readiness and slot. |
| OPEN or READY | EXPIRED | Database time reaches reservation deadline; release active reservations and slot. |
| DRAFT or OPEN or READY | CANCELLED | Venue cancels with reason; invalidate reservations and notify in-app. |
| CONFIRMED | CANCELLED | Venue handles operational cancellation; preserve audit and notify; no automatic refund exists in MVP. |
| CONFIRMED | COMPLETED | Venue records that the experience was delivered; attendance recorded separately. |

## Version and decision scope

Decisions and reservations attach to proposal_version_id. A material revision creates a new immutable version and releases old active seats. Availability, experience, price, included groups and supported access conditions are material. Copy correction can amend a display note only if it does not alter terms and remains audited.

## Readiness predicate

```text
ready = all_included_organisers_accept_current_version
    and active_seats >= required_seats
    and active_seats <= capacity
    and db_now < reservation_deadline
    and quote_is_current
    and slot_is_held_by_this_proposal
```

## Exceptions

Only the operator can manage an exceptional cancellation or support workflow, with a reason. Operators cannot override adult declarations, privacy permissions, confirmed capacity or user consent. A special delivery arrangement is represented by a newly approved quote or catalogue version and re-acceptance.

## Commercial boundary

Fees and demand assumptions remain hypotheses. A reservation is a stated intention, and attendance is recorded after delivery. Paid conversion belongs to a later money-handling release. Published programme costs and terms must be approved by the institution that delivers them.

## Related documents

D05, D10, D13, D26
