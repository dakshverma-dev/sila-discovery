# Sila

Sila helps smaller Edinburgh cultural clubs book experiences they are too small to arrange alone. A venue publishes a dated session with a fixed price and minimum; clubs commit conditionally for exact places, possibly weeks apart; once the minimum is reached each club pays its deposit directly to the venue, and the venue verifies receipts and confirms. At most two clubs per session in the pilot.

The specification is the **Sila product trial and build guide** (17 October 2026):

- `docs/Sila_Combined_Product_Trial_and_Build_Guide.pdf` — canonical source.
- `docs/Sila_Product_Trial_and_Build_Guide.md` — full transcription plus the repository status, audit and migration order.

Engineering instructions are in `AGENTS.md`. Decisions and risks are logged in `specs/decisions.csv` and `specs/risks.csv`.

## Current status

**The pilot is not built yet, and nothing is live.** No venue, club, booking or payment exists.

- `lib/sila/` contains the pilot rules (deadlines and payment clock, money, publication gates, commitment, confirmation, plan states) as pure functions with unit tests. They are not yet connected to the database, API or UI.
- The app that currently runs, locally and at https://shared-cultural-bookings.vercel.app, is the **superseded Qloo hackathon sandbox** (synthetic data, automated matching, per-participant reservations, no payment). It is being replaced ticket by ticket; see the ticket table in the guide document.

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
| `npm run test:db` | Integration tests against the local database (hackathon schema) |
| `npm run test:e2e` | Playwright journeys and axe accessibility scans (hackathon sandbox) |
| `npm run check:bundle` | After a build, fail if secrets or server-only markers appear in browser JavaScript |
| `npm run typecheck` / `npm run lint` / `npm run build` | Static checks and production build |
| `npm run db:reset` | Re-apply migrations and seed locally |

## Deployment

Pushes to `main` deploy to Vercel (bom1) against Supabase. Server-side environment variables: `DATABASE_URL` (IPv4 session-pooler string for the least-privilege `scb_app_login`), `DEMO_CAPABILITY_SECRET`, `WORKER_TRIGGER_SECRET` or `CRON_SECRET`, `APP_BASE_URL`. Keep staging and production separate before any real venue or club data is used (guide Part II §22).
