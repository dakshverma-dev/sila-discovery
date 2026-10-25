# Sila discovery: judge walkthrough

No private account is needed. Use a fictional club name. The current candidate runs locally at http://localhost:3500/discover; a public judging URL is pending the owner's later publishing approval.

## A 90-second walkthrough

1. Open `/discover`. Keep seven places, £35 per person and 19–22 November 2026. Click **Spirited Away**, then select its **movie** result from the live Qloo search.
2. Click **Find our next experience**. The live shortlist should reflect the current Qloo response; the captured run returned Garden, Fruitmarket and Museum. Inspect **See what Qloo returned & what Sila checked** for source, fetch time, venue IDs, exclusions and fingerprint.
3. Open a recommended experience. Check the fixed date, per-person price, minimum and sample availability. Save **seven conditional sample places**. The receipt remains private to the same browser, with the server-computed total. Reload the receipt to verify persistence. Nothing is booked and no money moves.
4. Return to discovery and choose **Miles Davis**, selecting the **artist** result. With the same constraints the captured live order changes to Fruitmarket, Garden, Museum. This difference comes from Qloo, not a locally invented score.
5. Set budget to £10. The result should be empty. Sila does not substitute an expensive option or pretend omitted venues were ranked.

Qloo is a live service: exact order can change. The checked-in traces record the actual calls captured during preparation. The five-venue candidate set is deliberate and visible, not a claim of citywide coverage.

## Local setup

Requirements: Node.js 22.19+, npm, Docker and a valid Qloo hackathon API key.

```bash
npm ci
# Create ignored .env.local containing QLOO_API_KEY=<your key>
npm run discovery
```

The launcher starts only `sila-discovery-local` (PostgreSQL 16), bound to `127.0.0.1:57432`, with volume `sila-discovery-local-data`. Generated admin/app passwords and signing secret are saved in ignored `.discovery-local.json`. Preserve that file with the Docker volume when restarting; deleting one without the other breaks authentication. The existing Supabase pilot stacks on 54322 and 56322 are not used.

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run check:bundle
npm run discovery:start       # production server on loopback port 3500
# In a second terminal:
npm run discovery:verify
```

Stop a running discovery web server before starting another on the same port. `npm run discovery:prepare` applies the idempotent isolated schema and seeds missing sample sessions without starting Next or replacing existing sample state. It never resets the pilot or discovery database.

## Optional model path

Add `ANTHROPIC_API_KEY` to ignored `.env.local`, optionally `DISCOVERY_MODEL=claude-haiku-5-5`, and restart. Enable the Claude checkbox. Inspect the trace and assistant status. A configured key does not itself prove a successful model run; require status `verified` in actual evidence before making that claim.

The model receives immutable structured constraints and tool results. `discover_sessions` calls Qloo and deterministic filters; `get_session` can inspect only an eligible returned ID. The final list must exactly match eligible IDs and order. No model text can override dates, money, capacity or booking status. Request creation remains a separate explicit user action.

## HTTP and database verification

`scripts/verify-discovery.mjs` only runs against loopback and its named isolated database. It makes real Qloo calls, compares two profiles, tests empty results, invalid input, signed selection ownership, cross-origin rejection, duplicate concurrent commands, private retrieval, conflicting keys, stale prices and changed capacity/version. It temporarily changes one fictional session and restores it in `finally`. It also verifies database RLS and lack of catalogue update permission. No real booking record is written.

## Files to inspect

For a local source handoff, `npm run submission:package` (Python 3 required) creates `submission-local/Sila-discovery-source.zip` and a SHA-256 manifest. It includes tracked and untracked source while excluding ignored configuration, dependencies and build output. It scans the archive inputs for the configured local credentials. This creates local files only; it does not publish code.

| Concern | Source |
| --- | --- |
| Verified mappings and fictional facts | `lib/discovery/catalog.ts` |
| Validation and deterministic eligibility/order | `lib/discovery/rules.ts` |
| Qloo adapter and place query | `lib/providers/qloo/client.ts`, `request.ts` |
| Bounded optional model orchestration | `lib/discovery/workflow.ts` |
| Signed identity and interest provenance | `lib/discovery/identity.ts` |
| Ownership, snapshots, idempotency and locks | `lib/discovery/store.ts`, `discovery/schema.sql` |
| UI and disclosures | `app/discover/`, `app/requests/`, `components/discovery/` |
| Actual provider evidence | `docs/submission/evidence/live-traces.json` |
| Existing pilot boundaries | `AGENTS.md`, canonical guide, `specs/decisions.csv` |
