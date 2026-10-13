# API Contracts and Interface Specifications


D16 | Version 0.1 | 12 October 2026


Specify application HTTP contracts independently from Qloo endpoints.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Contract conventions

All application routes use /api/v1. Browser authentication uses an HttpOnly secure session cookie; trusted clients may use a verified bearer JWT. Never accept a role, organisation or workspace claim without server verification. A separate signed judge capability is valid only for its synthetic workspace. Mutations require an Idempotency-Key; version-sensitive writes include expected_version.

| Method | Path after /api/v1 | Authorised actor | Operation |
| --- | --- | --- | --- |
| GET | /health/live | Public | Service health |
| POST | /demo/sessions | Public rate-limited | Isolated judge workspace |
| POST | /demo/role | Judge sandbox capability | Synthetic role context |
| GET | /venues | Workspace member | Approved venue summaries |
| POST | /venues | Operator | Create venue organisation |
| POST | /experiences | Venue manager | Create approved programme |
| POST | /experiences/{id}/anchors | Venue manager | Approve cultural mapping |
| POST | /experiences/{id}/quotes | Venue manager | Create immutable quote |
| POST | /experiences/{id}/slots | Venue manager | Create programme slot |
| POST | /groups | Organiser | Create community group |
| POST | /groups/{id}/invites | Organiser of group | Create scoped expiring invitation |
| POST | /invites/inspect | Public rate-limited | Read safe invitation summary |
| POST | /invites/accept | Authenticated invited user | Join authorised community group |
| POST | /groups/{id}/briefs | Organiser of group | Create versioned brief |
| POST | /qloo/resolve | Consented organiser | Resolve typed reference |
| POST | /match-runs | Organiser or operator | Queue bounded matching run |
| GET | /match-runs/{id} | Authorised requester or operator | Job status and scoped drafts |
| GET | /proposals/{id} | Venue manager or included group member | Scoped current proposal view |
| POST | /proposals/{id}/publish | Venue manager | Publish reviewed immutable terms |
| POST | /proposals/{id}/decisions | Included group organiser | Accept or decline current terms |
| POST | /proposals/{id}/reservations | Included group participant | Reserve one seat |
| DELETE | /reservations/{id} | Owning participant | Withdraw pre-confirmation seat |
| POST | /proposals/{id}/confirm | Venue manager | Confirm reservation booking |
| POST | /proposals/{id}/cancel | Venue manager or operator | Cancel with audited reason |
| POST | /proposals/{id}/complete | Venue manager | Record delivery and attendance |
| POST | /consents | Current authenticated user | Record purpose-specific choice |
| GET | /me/export | Current authenticated user | Export own authorised data |
| DELETE | /me | Current authenticated user | Schedule deletion and revoke session |

## Success and error envelopes

```text
{"data": {"id": "uuid", "version": 2},
 "meta": {"request_id": "uuid", "source_mode": "live"}}

{"error": {"code": "VERSION_CONFLICT",
 "message": "The proposal terms changed.",
 "field_errors": {}, "retryable": false},
 "meta": {"request_id": "uuid"}}
```

## Proposal view

The response includes programme title, venue, UTC slot and local timezone, quoted ticket_pence and GBP currency, current proposal_version_id, included approved group summaries, required_seats, active_reservations, state, deadline, evidence source and payment_status=NOT_COLLECTED. It excludes private member lists, private taste text, access notes and provider credentials.

## Reservation request

```text
{
  "proposal_version_id": "uuid",
  "expected_version": 2,
  "group_id": "uuid",
  "accept_shared_session": true,
  "adult_declaration": true
}
```

## Errors

| HTTP | Application code | Client action |
| --- | --- | --- |
| 400 | VALIDATION_FAILED | Show field errors; preserve valid inputs. |
| 401 | AUTH_REQUIRED | Sign in or renew sandbox session. |
| 403 | FORBIDDEN | Do not reveal restricted object details. |
| 404 | NOT_FOUND | Use for an absent or inaccessible object to avoid enumeration. |
| 409 | VERSION_CONFLICT | Refresh terms; require explicit re-acceptance. |
| 409 | CAPACITY_EXCEEDED | No seat allocated; show availability update. |
| 409 | NOT_READY | Show authorised readiness blockers. |
| 409 | IDEMPOTENCY_CONFLICT | Generate a new key for changed payload. |
| 410 | PROPOSAL_EXPIRED | Offer a new proposal; do not retry reservation. |
| 422 | NO_FEASIBLE_COALITION | Explain blockers without silently relaxing them. |
| 429 | RATE_LIMITED | Show retry guidance; protect provider quota. |
| 502 | PROVIDER_SCHEMA_CHANGED | Mark provider unavailable; operator investigates parser. |
| 503 | QLOO_UNAVAILABLE | Offer labelled manual catalogue review; retain reservations. |
| 504 | JOB_DEADLINE_EXCEEDED | Return checkpoint and a safe retry action. |

## Contract asset and review

specs/openapi.yaml provides the proposed route and data schemas. The Qloo upstream contract is in D11 and remains independently versioned. Validate unknown fields, pagination bounds and duplicate IDs; return cursor pagination for lists. Run request/response conformance tests before shipping.

## Idempotency and expiry

Scope keys to workspace, actor and route; store the request payload hash with the result. Replay a matching request result, including an expired reservation's original outcome, without creating a new seat. Retain idempotency records for a proposed 24 hours. State-changing requests still enforce database time before first execution.

## Related documents

D10, D11, D15, D20
