# Security Privacy and Data Handling Specification


D19 | Version 0.1 | 12 October 2026


Define data boundaries, access controls and proposed retention obligations.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Security boundary

Use provider-managed authentication with object-level checks on every application route. Keep Qloo, LLM and database service credentials server-side. Database grants and policies fail closed until reviewed. Service-role functions need explicit workspace and role validation because privileged access can bypass RLS.

## Threat model

| Threat | Required control | Verification |
| --- | --- | --- |
| Cross-group data exposure | Private brief projections, composite workspace foreign keys and object permissions. | T01 multi-tenant and cross-group negative tests. |
| Prompt injection | Untrusted text isolation, strict tool schemas and permission checks outside the LLM. | T08 adversarial provider and catalogue descriptions. |
| Last-seat races | Row locks, uniqueness, idempotency and readiness transaction. | T11 concurrent reservation attempts. |
| Public demo abuse | Rate limits, separate synthetic workspaces, opaque expiring capability and provider-call budget. | T15 repeated sessions and cross-session access tests. |
| Secret leakage | Secret scans, redacted logs and no public raw provider fixtures. | T21 repository and client-bundle review. |
| Unauthorised cancellation | Venue ownership or scoped operator role, required reason, audit. | T18 privilege and cancellation tests. |

## Data handling

| Data | Who may access | Proposed retention |
| --- | --- | --- |
| Account contact details | Account owner, authorised support; venue contact only where necessary. | Until account deletion; erase live identity within 30 days of an accepted request. |
| Group meanings and cultural references | Group organiser and authorised operator; Qloo receives only consented IDs. | 90 days after inactive brief; user can delete optional data earlier. |
| Access requirements | Only necessary structured support flags; avoid medical narratives. | For the booking lifecycle; remove after 30 days unless required for support. |
| Reservation and decision records | Owning participant or organiser and the venue's scoped view. | Proposed 12 months, with personal identifiers removed when appropriate. |
| Qloo cache | Server adapter and worker only. | 24-hour freshness TTL; purge proposed after 7 days. |
| Audit metadata | Authorised operator. | Proposed 90 days; extend only with documented purpose. |
| Judge sandbox data | Only its sandbox capability. | 24-hour maximum lifetime; periodic purge. |
| Audio | Excluded from MVP. | No recording or storage. |

## Consent and lawful processing

Record separate sharing, external cultural-query and optional-input choices. Withdrawal stops future optional provider queries and invalidates cached profile use. A notice must explain purpose, recipients, retention and deletion. Before real users participate, determine controller and processor responsibilities, lawful bases, vendor terms and any access information that may require special handling. The pack does not assert legal compliance.

## Operational controls

Require secure cookies, CSRF protection for cookie-authenticated writes, allowlisted origins, request-size limits, dependency and secret scans, server input validation and bounded provider egress. Avoid server fetching arbitrary user-supplied URLs. Expiring invite tokens are hashed at rest and cannot grant cross-workspace access.

## Export and erasure

The user export contains only the requester's authorised data. Deletion revokes sessions and future queries immediately, removes private optional content and schedules remaining justified records for erasure or pseudonymisation. Document how encrypted backups expire; do not promise immediate erasure from immutable backups.

## Incident handling

Contain access, rotate affected secrets, preserve redacted evidence and identify scope. The operator follows applicable reporting obligations after establishing facts. Do not publish private event logs or participant information as hackathon evidence.

## Related documents

D15, D16, D20, D23

## Sources

- SRC10: Supabase Row Level Security. https://supabase.com/docs/guides/database/postgres/row-level-security
- SRC13: ICO data minimisation guidance. https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/
