# Testing and Quality Assurance Plan


D21 | Version 0.1 | 12 October 2026


Define meaningful tests for product behaviour and failure recovery.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Test strategy

Use unit tests for arithmetic, ranks and predicates; database integration tests for permissions and state mutations; private provider contract tests for Qloo; browser tests for user journeys; and adversarial tests for injection and public demo abuse. Do not substitute UI snapshots for transaction or authorisation checks.

| Test | Requirement | Setup | Expected result |
| --- | --- | --- | --- |
| T01 | R01 N01 | Venue, organiser, participant, operator and separate sandbox identities. | Every allowed role action succeeds; wrong-workspace and wrong-object actions reveal no private data. |
| T02 | R02 | Unapproved programme, expired quote, negative price and overlapping slot. | Publication blocked; a valid reviewed offer stores an immutable quote. |
| T03 | R03 | Incomplete brief, missing sharing consent and conflicting time fields. | Draft saves; matching rejects missing fields with specific corrections. |
| T04 | R04 | Ambiguous title and no search result. | Human selection required; unresolved reference has no fabricated entity ID. |
| T05 | R05 | Live provider contract, cached hit, 401, 429, empty and malformed payload. | Correct source labels, bounded retry and schema-drift failure. |
| T06 | R06 | Unreviewed mapping and organiser-edited meaning. | Unapproved anchor not scored; corrected declared meaning retained. |
| T07 | R07 | Disjoint time, blocked access, budgets, capacity and known synthetic rank matrix. | Zero hard violations; deterministic feasible ranking with stable ties. |
| T08 | R08 N06 | Injected instruction and fake evidence reference in generated explanation. | Unsafe instruction ignored; ungrounded output rejected or replaced by template. |
| T09 | R09 | Change price or included groups after acceptance and seats. | New version invalidates decisions and releases old active seats. |
| T10 | R10 | Organiser accepts, declines and reverses current decision. | Only included organiser can act; readiness recalculates. |
| T11 | R11 N02 | 50 concurrent attempts for remaining seats; duplicate participant and idempotent retry. | No over-capacity or duplicate seat; one replay result; same key with changed payload conflicts. |
| T12 | R12 | Concurrent confirm, stale quote, withdrawn seat and manager from another venue. | Only valid current readiness confirms; one slot booked atomically. |
| T13 | R13 | Expired deadline, pre-confirm withdrawal and confirmed cancellation. | Correct state, released seats, retained audit and in-app notification. |
| T14 | R14 N05 | Terminate worker after provider result or draft write. | Expired lease resumes without duplicate draft; bounded terminal failure. |
| T15 | R15 | Two judges create and reset sessions; forged workspace or role. | Distinct workspaces; no pilot access; reset does not affect another judge. |
| T16 | R16 N07 | Withdraw external-query consent, export and account deletion. | No further optional query; scoped export; sessions revoked and erasure scheduled. |
| T17 | R17 | Paired benchmark case and delivery outcome events. | No duplicate counted event; same feasible inventory and clear synthetic status. |
| T18 | R18 | Operator cancellation, venue verification and unauthorised support action. | Scoped authority, mandatory reason and append-only audit. |
| T19 | N03 | Representative maximum-bound jobs and transaction load. | Measure p50 and p95; meet targets or record honest failure. |
| T20 | N04 | Keyboard, screen reader, 320px viewport and 200% text zoom. | Critical actions, errors and status remain accessible. |
| T21 | N08 | Provider fault, secret scan and simulated incident. | Traceable request IDs; no sensitive text or secrets in logs and bundles. |
| T22 | N09 | Clean checkout, fresh database and configured secrets. | Setup reproduces synthetic sandbox; dependency versions pinned. |
| T23 | N10 | External browser without private session. | End-to-end usable hosted demo and public repository links. |

## Fixtures

specs/synthetic_fixture.json uses fictional communities, programmes and ranks with source_mode=synthetic. It intentionally has no invented Qloo IDs. Private live captures used for contract tests must be redacted, access-controlled and excluded from public Git. The synthetic economic scenario is not a real venue quote.

## Test environments

| Environment | Provider mode | Data |
| --- | --- | --- |
| Unit and CI | Deterministic synthetic adapter | Synthetic only |
| Staging | Private live Qloo key with quotas | Approved fixture catalogue; test users |
| Judge demo | Live Qloo or visibly labelled cached evidence | Isolated synthetic workspace |
| Real pilot | Approved live integrations | Consented real groups; documented delivery terms |

## Release blockers

Any cross-workspace exposure, secret leak, capacity overflow, fabricated provenance, unauthorised confirmation or false payment claim blocks release. A noncritical visual defect may be triaged with owner and deadline; unresolved core journey failure cannot be accepted as a cosmetic issue.

## Evidence recording

Record commit, configuration, test mode, result and date for each release check. This documentation task validates the reference assets and document pack only; it does not claim that the application tests have run. The test matrix is an implementation plan.

## Related documents

D03, D20, D26
