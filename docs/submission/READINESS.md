# Sila discovery submission readiness

Prepared on 25 October 2026. The owner subsequently authorised publishing a separate repository and Vercel project. See `HOSTING.md` for the current deployment result. No final hackathon submission has been made.

## What is ready

- Real Qloo interest lookup with explicit entity disambiguation; signed, visitor-bound selections expire after one hour.
- Five Edinburgh venue mappings verified by actual Qloo names and addresses. Fictional 19–22 November sessions are explicitly labelled.
- Real place Insights calls constrained to those venue IDs. Provider order is retained; unavailable, unmapped, expensive, closed and out-of-window sessions are excluded. Maximum three recommendations.
- Two actual profiles show different recommendation order. Spirited Away: Garden → Fruitmarket → Museum. Miles Davis: Fruitmarket → Garden → Museum. Both return four of the five mapped venues; Stills is omitted by Qloo for these profiles. Printmakers is returned but exceeds the £35 test budget. No claims of complete coverage or taste causality.
- Private server-persisted conditional requests with exact integer GBP pence, ownership checks, same-origin JSON writes, RLS, immutable snapshots, version/price/capacity rechecks and concurrent idempotent retries. Requests reserve no places and cannot confirm a booking.
- Dedicated PostgreSQL database and least-privilege application role. It has no pilot credentials, session mutation rights or payment path.
- Per-request provider deadlines and retry budgets; persistent visitor quota and shared daily Qloo allowance. Each operation reserves two provider attempts, including its possible retry; unused reservations stay counted. Default daily budget 500, configurable up to 10,000.
- Editorial Sila interface, responsive layouts, labelled empty/error states, unranked catalogue, source evidence disclosure, privacy explanation and retained picture credits.
- Optional Claude Haiku 5.5 tool loop, official SDK, maximum three tool calls / four model turns / 30 seconds. Final IDs and order are validated. Model failure after successful Qloo discovery uses labelled factual fallback. Provider failure before results fails closed.
- Root MIT licence; third-party notices; reproducible local setup; judge walkthrough; Devpost copy; code and evidence map.

## Verification evidence

`evidence/verification.json` records the most recent successful local HTTP/database run. `evidence/live-traces.json` contains actual Qloo lookup-derived interests, returned venue IDs, ranks, exclusions, times and query fingerprints. Mocked assistant tests are not live evidence.

Baseline: 214 unit tests and TypeScript passed before edits. Current unit suite: 242 tests passed. HTTP/database verification passed 25 assertions against the final local production server. TypeScript, ESLint, production build and browser bundle secret scan passed; final verification is recorded separately in `evidence/final-checks.md`. Actual desktop/mobile screenshots and a local source archive with a SHA-256 manifest complete the handoff pack.

The narrow Next.js / eslint-config-next update from 16.4.0 to 16.4.3 removed the dependency audit's critical Next.js finding; `npm audit` reported zero vulnerabilities after installation. No blanket dependency upgrade was applied.

## What remains before an actual submission

1. **Separate source and hosting are now authorised and configured.** The owner requested a new repository and Vercel project. Current links and deployment details are in `HOSTING.md`. The old pilot repository, databases and deployments remain separate.
2. **Claude live verification is pending.** `ANTHROPIC_API_KEY` is not configured. Direct real Qloo discovery works. The tool loop compiles and its bounded/error paths have mocked tests; do not claim a successful live Claude run until one is captured. If submitting the direct workflow as an agentic tool, describe that scope precisely; no assertion of organizer acceptance is made here.
3. Hosted database TLS, secure production cookies and the provider allowance are configured. A retention/deletion policy and host-level rate limiting remain release improvements; visitor quotas alone do not stop creation of many new anonymous visitors. Hosted browser verification remains pending because Work settings disable local browser use.
4. Review the Devpost draft for ownership, contributor details, existing-work disclosure and category fit. Paste the final public demo/repository links and complete submission in the user's account. No legal agreement or final submission has been accepted here.

The [official rules](https://qloo.devpost.com/rules) require a working demo link and a public repository with an open-source licence. They allow existing work with a substantial in-period update and require that update to be explained. The published deadline is **31 October 2026, 09:15 IST** (30 October, 23:45 EDT). Use the separate discovery links from `HOSTING.md` for the entry. The rules do not list a mandatory video submission; optional presentation assets must match actual functionality.

## Scope and limits

This is a hackathon discovery module, not release of Sila's operating pilot. The canonical guide's manual introductions, two-club limit, venue approval, money and confirmation rules are unchanged. No recommendation or request enters `sila_api` or the pilot schema. The old hackathon sandbox is also separate.

Sessions are fictional, not venue offers. This edition does not establish partnerships, customer research results, conversion metrics, real inventory, an available staffed session or a confirmed booking. Anonymous ownership has no account recovery: losing the signed cookie loses access. Shortlists expire after 24 hours; cookies after seven days. Local records remain in the dedicated Docker volume until its owner removes them. The hosted edition uses its own Neon resource; anonymous hosted records also have no scheduled retention cleanup.
