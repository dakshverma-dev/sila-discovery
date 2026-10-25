# Final local verification — 25 October 2026 (Asia/Kolkata)

All checks below were actually run against this working tree. No CI, deployment or submission result is implied.

| Check | Result |
| --- | --- |
| Baseline `npm test`, before changes | 214 tests passed |
| Current `npm test -- --reporter=dot` | 242 tests / 25 files passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; Next.js 16.4.3 production output, 46 static pages plus dynamic routes |
| `npm run check:bundle` | Passed; 31 browser files, eight known secret/server markers, no matches |
| Dependency audit | Zero vulnerabilities reported after install; `npm audit --omit=dev` also passed |
| `git diff --check` | Passed |
| Local HTTP / database verification | 25 assertions passed against both development and the final production server |
| Actual Qloo calls | Two disambiguated profiles; distinct real place orders, recorded in `live-traces.json` |
| Request persistence after app restart | Verified in the browser: the earlier seven-place Garden request reopened with the same reference and £154 total after switching from development to production |
| Browser journey | Live search → shortlist → session → conditional receipt succeeded |
| Responsive review | Desktop 1440×1000 and mobile 390×844; mobile input boundaries fit without horizontal document overflow; temporary viewport override reset |
| Credentials | `.env.local` and `.discovery-local.json` confirmed ignored; configured local values absent from client build |
| Publishing | No commit, push, deployment, external upload or final submission performed |

Screenshots are actual browser captures: `discovery-desktop.png`, `discovery-mobile.png`, `form-mobile.png`, `shortlist-desktop.png`, `shortlist-cards.png`, `request-desktop.png`. Artwork is decorative; sessions and club records are fictional.

The 25 HTTP/database assertions cover real provider results, two-profile order changes, budget/capacity exclusion, £10 empty results, signed-interest ownership, invalid party size, cross-origin rejection, stale price, six concurrent identical retries, owner-only persisted retrieval, conflicting idempotency details, changed capacity/version, no inventory reservation, database RLS, denied catalogue mutations, a single durable request row, shared provider quota rejection and rejection of another visitor's private run.

The unit suite includes mocked assistant contract tests for exact eligible order, missing configuration, invented IDs, provider failure and the three-tool-call limit. These do **not** establish a successful live Anthropic call. No Anthropic key was configured. Full live-pilot database/e2e release gates were not rerun or completed; this module does not release the pilot.

The production server is started with `npm run discovery:start`, bound to loopback port 3500. The separate discovery PostgreSQL container persists on loopback port 57432. Existing pilot stacks were not modified.
