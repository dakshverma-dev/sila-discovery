# Shared Cultural Bookings

Small Edinburgh communities pool interest and attendance to reserve a venue-approved cultural experience. The system finds a feasible coalition of two to four groups, explains why it fits, collects individual seat reservations and lets the venue confirm the reservation booking. No payment is collected (`payment_status = NOT_COLLECTED`). Built for the Qloo Agentic Hackathon.

## Current status

Hackathon build in progress. **Live judge sandbox: https://shared-cultural-bookings.vercel.app** (Vercel, Mumbai region, with Supabase in ap-south-1). Everything in it is fictional and synthetic.

What exists and is covered by automated tests:

| Area | What is implemented |
| --- | --- |
| Matching (`lib/domain/`) | Integer-pence quote economics, hard feasibility (sharing, budget, exact time, access, capacity), ordinal cultural utility with tie averaging, 2-to-4-group solver with blocker reports, readiness predicate and proposal state machine (D13, D14). |
| Database (`supabase/migrations/`) | D15 model with composite workspace keys and RLS. Every write is a guarded `scb_api` function that locks proposal then slot, uses database time, re-checks authority and versions, and records idempotent outcomes and audit events. The app login can only execute these functions. |
| Agent (`lib/agent/`) | Durable match runs with frozen snapshots, leases, checkpoints and deadlines; evidence from synthetic rankings or live Qloo within a 24-call budget; up to three drafts with template explanations that cite evidence. Provider failure fails the run; synthetic data is never substituted. |
| Qloo adapter (`lib/providers/qloo/`) | `/search` and `/v2/insights` against the hackathon host only, `X-Api-Key` header, 8 s timeout, four concurrent calls, one bounded retry, strict parsing. |
| Judge sandbox (`/demo`) | Isolated synthetic workspace per visitor with persona switching: request suggestions, send for venue review, publish, accept or decline, reserve one seat, withdraw, confirm, revise the price, cancel, complete, edit the group brief, export or delete data. |
| HTTP API (`/api/v1`) | D16 routes for proposals, decisions, reservations, confirmation, cancellation, completion, withdrawal, match runs, demo sessions, consents, export and deletion. |

Acceptance-test coverage for T01 to T23 is tracked honestly in `specs/test_status.csv`.

**Not yet done or not yet verified**

- **No live Qloo call has been made.** The adapter and live-mode runs are tested against hand-written responses only; the `/search` envelope and affinity field are unverified (RISK11). The sandbox always uses synthetic evidence because its programmes and groups are fictional.
- Pilot (non-sandbox) sign-in with Supabase Auth, venue catalogue editing and operator tools beyond the audit view are not built. Only the signed sandbox capability is accepted by the API.
- No real venue, organiser, booking or payment is involved.
- No LLM is used; explanations are deterministic templates (DEC19).

## Development

Requires Node.js 22+, npm and Docker (for the local Supabase stack). Python 3 is only needed for the specification's reference checks.

```bash
npm install
npx supabase start            # local Postgres, Auth and pg_cron in Docker; applies migrations and seed
cp .env.example .env.local    # then set:
#   DATABASE_URL=postgresql://scb_app_login:scb_local_dev_only@127.0.0.1:54322/postgres
#   DEMO_CAPABILITY_SECRET=<at least 32 random characters>
npm run dev                   # http://localhost:3000 -> "Start a sandbox"
```

| Script | Purpose |
| --- | --- |
| `npm test` | Unit tests (domain, Qloo adapter, explanations, capability, brief parsing) |
| `npm run test:db` | Integration tests against the local database: lifecycle, cross-workspace access, last-seat race, competing confirmations, revision, expiry, match runs, privacy |
| `npm run test:e2e` | Playwright journeys at desktop and 320 px, the `/api/v1` contract and axe WCAG 2.2 AA scans (builds and starts the app on port 3100) |
| `npm run perf` | Worst-case solver benchmark at the input caps |
| `npm run check:bundle` | After a build, fail if secrets or server-only markers appear in browser JavaScript |
| `npm run typecheck` / `npm run lint` / `npm run build` | Static checks and production build |
| `npm run test:reference` | Python reference checks in `specs/` |
| `npm run db:reset` | Re-apply migrations and seed locally |

### Measured solver performance

`npm run perf` evaluates the D13 worst case: 20 groups, 10 programmes x 5 slots, 30 anchors, every group eligible everywhere (308,750 coalition evaluations). On an Intel i7-11850H with Node 22.19 on Windows, five runs took 1.2 to 1.9 s (median 1.6 s). This is a synthetic CPU benchmark, not a measure of end-to-end latency or demand.

## Architecture

```text
app/                  pages (/, /demo, /sandbox) and /api/v1 route handlers
lib/domain/           pure rules: economics, feasibility, utility, solver, readiness, lifecycle
lib/agent/            match-run worker and template explanations
lib/providers/qloo/   hackathon API client, request builders, parsers
lib/db/               least-privilege connection and the scb_api function allowlist
lib/auth/             signed sandbox capability and session handling
lib/api/              D16 envelopes, validation, idempotency and origin guards
supabase/migrations/  schema, guarded functions, projections, pg_cron schedules
tests/                unit, db, e2e and perf suites
```

The browser never receives database or provider credentials. Route handlers and server actions take the actor from the verified session only and call guarded database functions, which independently check membership, object version, deadline and capacity in one transaction.

## Deployment

1. Create a Supabase project, then `npx supabase link --project-ref <ref>` and `npx supabase db push`.
2. In the SQL editor create the application login with a generated secret: `create role scb_app_login login password '<secret>' in role scb_app;`
3. Import the repository into Vercel and set server-side environment variables: `DATABASE_URL` (the IPv4 session-pooler connection string for `scb_app_login`, user `scb_app_login.<project-ref>`; the direct database host is IPv6-only), `DEMO_CAPABILITY_SECRET`, `WORKER_TRIGGER_SECRET` or `CRON_SECRET`, `APP_BASE_URL` and, once issued, `QLOO_API_KEY`.
4. pg_cron (enabled by the migrations) expires proposals and purges sandboxes inside the database. `/api/v1/internal/tick` recovers match runs whose worker lease lapsed; schedule it with Vercel Cron or an external scheduler using the bearer secret.
5. Run a private, redacted live Qloo contract test before describing any result as Qloo-powered.

Qloo keys only work against `https://hackathon.api.qloo.com`; the adapter refuses other hosts. Never commit Qloo responses.

# Specification pack

Version 0.1, 12 October 2026. Proposed implementation baseline.

## What is included
All 28 requested items are present. Items 1-24 and 26-28 have editable Word and Markdown versions; item 25 is root agents.md. Start with 00_Documentation_Index.docx or specs/document_index.json.

## Product boundary
One initial Edinburgh exchange; venue-approved programmes; GBP; adult groups; one seat per participant; two-to-four-group coalitions; reservations with payment_status=NOT_COLLECTED. Venue confirmation is approval of a reservation booking, not payment settlement. Voice and automatic external outreach are later work.

## Reference assets
- specs/openapi.yaml: proposed application HTTP contracts.
- specs/schema.sql: fail-closed SQL design reference, not a deploy-ready migration.
- specs/matching_reference.py and test_matching_reference.py: deterministic synthetic reference checks.
- specs/synthetic_fixture.json: fictional groups and quote; no invented Qloo entity IDs.
- specs/config.json, design_tokens.json, requirements.json, traceability.csv, risks.csv, decisions.csv.
- diagrams/: Mermaid, SVG and PNG workflows; editable topology in .mmd sources.
- specs/.env.example: blank secret configuration template.

## Source and precedence
The product brief in this conversation is the product basis. D14 owns business invariants; D16 and openapi.yaml own application interfaces; D11 owns upstream Qloo integration; D15 and schema.sql own the relational design. If these conflict, pause implementation and reconcile the contract. Defaults are proposed decisions; D27 lists validation gaps.

## Validation and remaining work
The reference module has six executable synthetic checks. That is not application QA or real demand validation. The pack records document and contract consistency checks in specs/validation_report.json. No app is deployed and no live API call, customer booking or payment was made by this task.
Implement guarded database functions, column-safe permissions and migrations before using schema.sql with real users. Complete a private live Qloo parser/coverage test with the issued key. Source responses and keys must stay out of public Git.

## Deadline
Official deadline: 31 October 2026 03:45 Europe/London, equivalent to 30 October 23:45 EDT and 31 October 09:15 Asia/Kolkata. Internal target: 29 October 18:00 UK. Recheck qloo.devpost.com before submission.

## Repository instruction filename
The requested filename is agents.md. If the implementation environment automatically loads only AGENTS.md, copy the content to that filename when integrating this pack into the repository.
