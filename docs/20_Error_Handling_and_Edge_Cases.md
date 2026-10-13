# Error Handling and Edge Cases


D20 | Version 0.1 | 12 October 2026


Specify recoverable failure behaviours and protected invariants.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Error contract

Use the codes in D16 with a request ID, safe message, retryable flag and field errors where relevant. Never return provider keys, raw database errors or another group's private fields. Distinguish an empty recommendation from an infrastructure failure.

| Case | Required behaviour | Invariant |
| --- | --- | --- |
| Ambiguous reference | Require organiser selection; keep unresolved until confirmed. | No guessed entity ID. |
| Sparse Qloo evidence | Mark coverage unknown and NEEDS_REVIEW. | No zero-dislike or fabricated match. |
| Qloo 401 or 403 | Stop live calls; report environment or permission failure. | No retry loop with same request. |
| Qloo 429 or timeout | Bound retry by budget and deadline; surface failure. | No hidden synthetic substitution. |
| LLM malformed output | One schema repair within budget, then template fallback. | No uncontrolled free-text tool invocation. |
| No shared time | Explain incompatible exact intervals. | Do not change a group's availability. |
| Budget too low | Show approved quote and threshold conflict. | No predicted discount or altered venue terms. |
| Unknown access support | Require venue confirmation before eligibility. | Unknown never becomes supported. |
| Sharing refused | Exclude from sharing coalition with clear reason. | Taste score cannot override consent. |
| Group in two coalitions | Allow drafts; only one active proposal holds a slot. | Final seat uniqueness uses identity and slot. |
| Last seat reserved twice | One transaction wins; other receives capacity conflict. | Active seats never exceed capacity. |
| Withdrawal from READY | Recompute; move to OPEN if below threshold. | Venue cannot confirm stale readiness. |
| Terms revised during reservation | Reject stale version; show revision. | No seat created on unaccepted new price. |
| Expired browser page | Check database time on action. | No late reservation or confirmation. |
| Venue cancels confirmed session | Audit and notify with support route. | No fictitious automatic refund. |
| Worker crashes | Lease expiry and checkpoint recovery. | No duplicate proposal publication. |
| Cache stale or catalogue changed | Invalidate query hash and refresh within budget. | No stale price or anchor mapping. |
| Judge shares role-switch URL | Capability restricted to synthetic workspace and expiry. | No pilot-role escalation. |
| Deleted user has future reservation | Withdraw or route necessary venue support; purge optional data. | No silent active seat tied to inaccessible account. |
| Clock or DST ambiguity | Ask for offset-resolved UTC slot; show venue timezone. | No implicit shift of meeting time. |

## Recovery ownership

Participants recover input and capacity errors through the interface. Organisers revise their own briefs and respond to proposal changes. Venue managers clarify programme support and decide cancellations. Operators investigate provider schema drift, job failures and suspected access problems.

## Retry design

GET requests may retry transient faults under provider limits. Mutations use idempotency and cannot create new seats through repeated clicks. A stale version requires refreshed terms and a new request key; it is not a network retry. Retry-After longer than the remaining job budget ends the job with an explicit retry-later state.

## Uncertain outcomes

If a client times out after a write, query the idempotent result or refresh the reservation status before retrying. Do not tell a user a booking failed when the database may have committed. Confirmed operational cancellations require venue handling and a clear status record.

## Related documents

D14, D16, D21
