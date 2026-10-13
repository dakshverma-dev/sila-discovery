# Software Requirements Specification


D04 | Version 0.1 | 12 October 2026


Define verifiable functional, operational and interface obligations.


Status: proposed implementation specification. Application acceptance tests remain pending.


## System boundary

The system includes the web client, authenticated application API, deterministic domain services, an agent job worker, PostgreSQL storage, Qloo adapter and optional LLM adapter. Authentication and cultural inference providers remain outside the product boundary. Venue scheduling and programme delivery remain human responsibilities.

## Functional obligations

R01 to R18 in D03 are normative. D05 specifies feature behaviour, D14 specifies lifecycle guards and D16 defines HTTP interfaces. Implementers must trace every obligation to an observable test, rather than treating screens as sufficient evidence.

## Nonfunctional requirements

| ID | Area | Acceptance target |
| --- | --- | --- |
| N01 | Authorisation | All role and cross-workspace negative tests pass; no client receives service credentials. |
| N02 | Transaction integrity | Zero over-capacity or duplicate active seat allocations under 50 concurrent attempts. |
| N03 | Performance | Targets: non-AI reads p95 <1 s; write transactions p95 <2 s; a bounded agent job finishes within 90 s or fails explicitly. |
| N04 | Accessibility | Target WCAG 2.2 AA; keyboard, focus, labels, contrast and reduced-motion checks on critical journeys. |
| N05 | Recovery | Reservation and confirmation retries are idempotent; interrupted jobs recover from a durable checkpoint. |
| N06 | Provenance | Every cultural rationale references an existing evidence record; source mode is visible. |
| N07 | Privacy | No names, email, raw access notes or invite tokens enter Qloo requests or public logs. |
| N08 | Operability | Trace a failed request using request_id and job_id without accessing participant taste text. |
| N09 | Reproducibility | Pinned dependencies, clean migrations and synthetic seeds reproduce the demo from a clean checkout. |
| N10 | Availability | Submission URL works externally and remains supported through judging; avoid unsupported SLA claims. |

## Data and interface conventions

- Identifiers are UUIDs unless explicitly documented as provider-issued entity strings.
- Monetary values are integer pence with currency GBP. Never calculate pricing with floating-point currency.
- Persist timestamps as UTC timestamptz and an IANA venue timezone; show the relevant local timezone.
- Updates use optimistic versions; mutating requests use scoped idempotency keys.
- Externally supplied text is data, never authority to invoke privileged tools.

## Capacity and support boundary

Engineering targets are selected for the small pilot, not measured SLAs. A matching run accepts at most 20 groups, 10 experiences and 5 slots per experience. Inputs exceeding these bounds return a visible validation error rather than silently truncating.

## Requirement precedence

Security and transaction rules override ranking. A low score cannot relax a hard constraint. Confirmed terms cannot be silently edited. Source outages can reduce discovery availability but cannot corrupt reservations or authorise a booking.

## Related documents

D03, D14, D16, D21

## Sources

- SRC10: Supabase Row Level Security. https://supabase.com/docs/guides/database/postgres/row-level-security
