# Sila discovery

This repository is the separate Qloo hackathon edition of [Shared Cultural Bookings](https://github.com/dakshverma-dev/Shared-Cultural-Bookings). The original pilot repository and its deployments remain separate. This edition's hosted entry point is `/discover`; the hosted configuration blocks pilot routes and does not run the pilot cron job.

Try [the separate discovery preview](https://sila-discovery-4mxmd4sx7-dakshverma675-gmailcoms-projects.vercel.app/discover). Deployment details are recorded in [the hosting record](docs/submission/HOSTING.md). The inherited pilot source and Git history are retained for provenance; this deployment uses only the isolated `discovery` schema and a dedicated restricted database login.

## Hackathon discovery edition — 25 October 2026

The new Qloo discovery workflow is at **[/discover](http://localhost:3500/discover)**. It is separate from the pilot described below. This independent checkout is prepared for the new `sila-discovery` repository and Vercel project. Publication and deployment results are recorded in `docs/submission/HOSTING.md`.

With Node.js 22.19+ and Docker running:

```bash
npm ci
# Set QLOO_API_KEY in ignored .env.local. Never put it in a NEXT_PUBLIC variable.
npm run discovery
```

The command prepares its own PostgreSQL container and persistent volume on loopback port 57432, generates local credentials in ignored `.discovery-local.json`, and starts the app on port 3500. It never connects to the pilot database. Open `/discover`, select an actual Qloo search result, and find a fictional session for seven places under £35. Try Spirited Away (movie), then Miles Davis (artist), to compare live venue orders.

Search and ranking use real Qloo calls. Sessions and requests are fictional; no seats, messages, venue approvals or payments are created in the pilot. Signed visitor cookies and PostgreSQL row-level ownership protect persisted discovery records. Claude tool calling is optional and implemented with the official SDK; no live Anthropic run has been verified because its key is not configured.

- [Submission readiness and remaining external steps](docs/submission/READINESS.md)
- [Judge walkthrough and setup](docs/submission/JUDGE_GUIDE.md)
- [Devpost description draft](docs/submission/DEVPOST.md)
- [Real Qloo traces](docs/submission/evidence/live-traces.json)
- [MIT software licence](LICENSE) and [third-party credits](THIRD_PARTY_NOTICES.md)

After building, `npm run discovery:start` runs the production server locally. `npm run discovery:verify` exercises real Qloo and the isolated database, including concurrent retries and ownership checks. Stop the app with Ctrl+C; `docker stop sila-discovery-local` stops its database without deleting records. Existing pilot and customer-demo commands below remain separate.

Sila helps smaller Edinburgh cultural clubs book experiences they are too small to arrange alone. A venue publishes a dated session with a fixed price and minimum; clubs commit conditionally for exact places, possibly weeks apart; once the minimum is reached each club pays its deposit directly to the venue, and the venue verifies receipts and confirms. At most two clubs per session in the pilot.

The specification is the **Sila product trial and build guide** (17 October 2026):

- `docs/Sila_Combined_Product_Trial_and_Build_Guide.pdf` — canonical source.
- `docs/Sila_Product_Trial_and_Build_Guide.md` — full transcription plus the repository status, audit and migration order.

Engineering instructions are in `AGENTS.md`. Decisions and risks are logged in `specs/decisions.csv` and `specs/risks.csv`.

## Current status

**The product interface with sample records is hosted; the real booking path is implemented locally. The live pilot is not released.** All rehearsal contacts, sessions and payment records are synthetic.

- Pilot routes support email sign-in, venue drafts/publication, retained club requests, approval, atomic commitment, staffed payment release, receipt recording, checked confirmation, full-return closure/refund records and private practical downloads. Venue and organiser records are isolated; operators have audited venue scopes.
- The superseded hackathon sandbox remains alongside the local pilot. Private evidence uploads, notification delivery, balance default/remedy, amendments, recovery and remaining release controls are unfinished; see the guide's repository status.

## Show customers the product

Open [Sila with sample records](https://sila-demo-preview.vercel.app). It has normal experience pages and organiser, venue, finance and operations dashboards. Use the account menu to choose a supplied sample user. Requests, approvals, commitments, receipts, confirmation, refunds, conversations, draft publication and introductions update records that persist in your browser.

This separate static Vercel project uses isolated browser persistence, with no booking database or Auth connection. It does not accept real bookings, send emails or move money. The authenticated application remains separate and shares the dashboard presentation. See [the account guide and walkthrough](docs/Sila_Customer_Demo_Walkthrough.md) for the sample scenarios and remaining live-service work.

Build with `npm run demo:build`; preview with `node scripts/serve-customer-app.mjs` at http://localhost:3400. It exports and scans `customer-demo/out`, including fallback routes for newly created sample records. Deploy only that export to the existing separate preview project; the root project still refers to the legacy app.

## Try the local pilot demo

With Node.js 22+, npm dependencies and Docker available:

```bash
npm run demo
```

Open [the local demo](http://localhost:3300/pilot-demo). Start as the venue coordinator, review/publish the prepared fictional workshop, then switch to the club organiser. Sign-in links arrive in [the local email inbox](http://127.0.0.1:56324); follow a link in the browser profile that requested it. Use separate profiles to act as two clubs.

The demo has its own Supabase Docker project, database on port 56322, email inbox and Next output directory. It cannot use a hosted database. `npm run demo:seed` prepares the data without starting the web app. Re-running preserves existing agreements and receipts. The workshop starts as a draft; no real terms, hold, coverage or payment are approved. Payment opening retains the real staffed-release checks; the browser rehearsal advances only its isolated synthetic fixture's clock.

The source for the separate stack is copied under ignored `.supabase/sila-demo/`. To stop its Docker services, run `npx supabase stop --workdir .supabase/sila-demo`; stop the web app with Ctrl+C.

## Development

Requires Node.js 22+, npm and Docker (for the local Supabase stack).

```bash
npm install
npx supabase start            # local Postgres and Auth in Docker; applies migrations and seed
cp .env.example .env.local    # then set:
#   DATABASE_URL=postgresql://scb_app_login:scb_local_dev_only@127.0.0.1:54322/postgres
#   DEMO_CAPABILITY_SECRET=<at least 32 random characters>
npm run dev                   # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `npm test` | Unit tests, including the Sila rules in `tests/unit/sila-*.test.ts` |
| `npm run test:db` | Integration tests for the hackathon and pilot schemas, including 100 competing commitment commands |
| `npm run test:e2e` | Playwright journeys and axe accessibility scans; `tests/e2e/sila-*.spec.ts` cover the pilot |
| `npm run check:bundle` | After a build, fail if secrets or server-only markers appear in browser JavaScript |
| `npm run demo:build` | Build and scan the product UI with isolated sample records; no booking backend is included |
| `npm run typecheck` / `npm run lint` / `npm run build` | Static checks and production build |
| `npm run db:reset` | Re-apply migrations and seed locally |

Pilot development also needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `APP_BASE_URL` and `SILA_DRAFT_SECRET` (at least 32 random characters). Keep synthetic browser tests on loopback services. Set `DATABASE_ADMIN_URL`, `DATABASE_URL`, `MAILPIT_URL` and `E2E_BASE_URL` when using an alternate local stack. The demo command sets its own local credentials and does not edit `.env.local`.

## Deployment

Pushes to `main` deploy to Vercel (bom1) against Supabase. Server-side environment variables: `DATABASE_URL` (IPv4 session-pooler string for the least-privilege `scb_app_login`), `DEMO_CAPABILITY_SECRET`, `WORKER_TRIGGER_SECRET` or `CRON_SECRET`, `APP_BASE_URL`. Keep staging and production separate before any real venue or club data is used (guide Part II §22).
