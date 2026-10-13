# Shared Cultural Bookings

Small Edinburgh communities pool interest and attendance to reserve a venue-approved cultural experience. The system finds a feasible coalition of two to four groups, explains why it fits, collects individual seat reservations and lets the venue confirm the reservation booking. No payment is collected (`payment_status = NOT_COLLECTED`). Built for the Qloo Agentic Hackathon.

## Current status

Early build. Implemented and covered by automated tests:

- `lib/domain/`: deterministic quote economics, hard feasibility checks, ordinal cultural utility, the 2-to-4-group coalition solver with blocker reports, the readiness predicate and the proposal state machine (D13, D14).
- `lib/providers/qloo/`: server-side adapter for the hackathon host (`/search` and `/v2/insights`) with a per-job call budget, timeouts, bounded retries and strict response parsing (D11). It has only been tested against hand-written synthetic responses; no live Qloo call has been made yet.
- `/sandbox`: a synthetic judge sandbox that runs the solver on fictional groups. It makes no Qloo requests, reservations or payments.

Not yet built: authentication, Supabase schema and guarded transactions, group briefs, publication, organiser decisions, reservations, venue confirmation, the match-run worker and live Qloo evidence.

## Development

Requires Node.js 22+ and npm. Python 3 is only needed for the specification's reference checks.

```bash
npm install
cp .env.example .env.local   # fill in server-side secrets; never commit them
npm run dev                  # http://localhost:3000
```

| Script | Purpose |
| --- | --- |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run test:reference` | Python reference checks in `specs/` |

`QLOO_API_KEY` is read only on the server, and the adapter refuses any host other than `https://hackathon.api.qloo.com`. Do not commit Qloo responses.

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
