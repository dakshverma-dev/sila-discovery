# User Personas and User Stories


D06 | Version 0.1 | 12 October 2026


Define the people the MVP serves and the observable behaviours they need.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Persona status

These are fictional role-based personas constructed for design. They are not interview findings or demographic segments. Discovery should test the situations and constraints, rather than validate invented biographies.

| Persona | Context | Goal | Critical need |
| --- | --- | --- | --- |
| Venue manager | Runs a small cultural programme and controls staff time, prices and available sessions. | Wants an additional deliverable booking, with evidence of attendance and no promise the team cannot honour. | Needs authority over publication, a transparent threshold, cancellation records and a clear distinction between reserved and paid seats. |
| Community organiser | Arranges outings for a book club, film society or makers' community. | Wants an experience members value at an acceptable cost, without repeated coordination across chats. | Needs control over cultural interpretation, sharing consent, partner suitability and current terms. |
| Participant | Receives an invitation through a community they already know. | Wants to understand the outing, price and sharing conditions before reserving. | Needs one clear action, an accessible interface and a way to withdraw before confirmation. |
| Platform operator | Supports the pilot and handles venue verification and exceptions. | Wants to identify broken proposals and resolve issues without concealing uncertainty. | Needs scoped administration, useful audit events and a supported manual path. |

## User stories and acceptance examples

| ID | Actor | Story | Req IDs | Acceptance example |
| --- | --- | --- | --- | --- |
| US01 | Venue manager | Publish programmes I can actually deliver, so suggestions remain practical. | R02 | Given an unapproved programme, publication is rejected until venue review. |
| US02 | Organiser | Explain why our references matter, so the system does not flatten our interests into a label. | R03 R06 | Declared meaning survives extraction and is visible for correction. |
| US03 | Organiser | Choose the correct entity when a title is ambiguous. | R04 | Search alternatives show name, subtype and disambiguation before selection. |
| US04 | Organiser | See feasible partners and understand excluded options. | R07 R08 | A proposal passes every hard predicate and each rationale has evidence. |
| US05 | Organiser | Decline sharing without being overridden by a matching score. | R10 | A declined group cannot contribute readiness. |
| US06 | Participant | Reserve a seat on current terms without entering payment details. | R11 | The UI shows NOT_COLLECTED and the transaction allocates at most one seat. |
| US07 | Participant | Withdraw while the booking is open. | R13 | Withdrawal releases a seat and recalculates readiness atomically. |
| US08 | Venue manager | Confirm only a ready reservation booking. | R12 | Insufficient attendance, stale quote or unavailable slot produces 409. |
| US09 | Judge | Try all roles without accessing anyone else's data. | R15 | A new sandbox creates a separate workspace with synthetic fixtures. |
| US10 | Participant | Delete my account and optional taste data. | R16 | An authenticated deletion request revokes access and schedules erasure. |
| US11 | Operator | See when an external service failed and retry safely. | R14 R18 | The job retains a bounded checkpoint and does not duplicate proposals. |
| US12 | Product owner | Compare Qloo-assisted choices with simpler alternatives. | R17 | Identical feasible inventory is used for paired benchmark cases. |

## Decision rights

Venue managers control operational commitments. Organisers can represent their groups' willingness to share, but cannot reserve or consent for members. Participants make their own seat reservations. Platform operators can support or cancel with an audit reason, but cannot manufacture participant consent or payment.

## Recruitment for validation

Seek organisers with a recent failed or expensive booking, venue managers who can explain minimum delivery economics and adults who have accepted or rejected shared outings. Include people who reject the idea; enthusiasm alone is weak evidence of a problem.

## Related documents

D02, D07, D17, D26
