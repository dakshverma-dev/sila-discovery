# Technical Design Document


D10 | Version 0.1 | 12 October 2026


Specify module boundaries, write paths and concurrency behaviour.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Suggested code organisation

```text
app/                  role-scoped pages and /api/v1 routes
lib/auth/             session verification and object permissions
lib/domain/           pricing, feasibility, coalition ranking, states
lib/providers/qloo/   client, parser, allowlists, retry policy
lib/providers/llm/    structured generation with provider adapter
lib/agent/            orchestration, checkpoints, tools
supabase/migrations/  reviewed schema, grants, policies, guarded RPCs
supabase/functions/   bounded job worker
tests/                fixtures, contracts, security, concurrency, e2e
```

## Match run

POST /api/v1/match-runs validates the requester and eligible groups, creates an idempotent job and returns 202. A worker atomically leases the job, reads frozen brief and catalogue versions, resolves references, obtains Qloo evidence and runs the solver. Each completed stage is checkpointed. Renew a worker lease at least every 10 seconds while running; before each provider request and cached-profile use, recheck current external-query consent. The browser polls the job and can inspect a final result or explicit failure.

## Reservation transaction

- Lock the proposal row, then its slot row in a consistent order. Check current version, database deadline, organiser acceptance and user membership.
- Return the previous result for an existing scoped idempotency key with the same payload hash. Reject reuse with different payload.
- Count active reservations for this slot across the current proposal. Insert at most one reservation for this participant if capacity remains.
- Recompute readiness and commit the seat and state update with an audit event together.

## Confirmation transaction

The venue action locks the same rows, checks actor authority, current quote version, slot availability, deadline, all included organiser decisions, active reservations and quoted economics. It changes the proposal to CONFIRMED and the slot to BOOKED in one transaction. A second competing or stale confirmation cannot succeed.

## Version changes

Published versions are immutable. Replacing terms closes the prior version, invalidates its decisions, releases reservations and publishes a new version in one controlled transaction. An experience or slot edit that changes delivery, price or access support also invalidates dependent open proposals.

## Job limits

| Control | Proposed default |
| --- | --- |
| Job wall-clock deadline | 90 seconds across checkpoints |
| Provider request timeout | 8 seconds |
| Qloo calls per job | Maximum 24 including retries |
| LLM calls per job | Maximum 2 |
| Worker lease | 30 seconds; recover only after lease expiry |
| Request body size | 64 KiB |
| Reference inputs | 3 to 8 declared references; at least 1 confirmed entity for live ranking |

## Implementation assets

specs/openapi.yaml, specs/schema.sql, specs/matching_reference.py and specs/config.json contain reference contracts. They are design assets, not deployed application code. The schema intentionally denies browser data access until explicit policies and guarded functions are implemented and tested.

## Related documents

D11, D12, D13, D15, D16
