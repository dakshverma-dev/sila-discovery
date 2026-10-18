# Sila — engineering instructions

> Scope: the Sila pilot. One Edinburgh anchor venue, venue-set dated sessions, at most two clubs per session. This repository started as a Qloo hackathon pack; that build is being replaced. Never describe a specified, mocked, or planned feature as shipped.

## Source of truth

**`docs/Sila_Combined_Product_Trial_and_Build_Guide.pdf` (17 October 2026) is the canonical product and build specification.** `docs/Sila_Product_Trial_and_Build_Guide.md` is the single working document: a full transcription of the guide (the PDF wins if they differ) followed by the repository status, P0 01 audit and migration order. Part I is the product and trial brief; Part II is the build and user flow specification. Cite its section numbers (Part II unless stated) in code reviews, decisions and tests.

- The hackathon documentation pack (docs 01–28, Word copies, diagrams, OpenAPI, schema and reference specs) has been deleted; it remains in Git history only. `specs/synthetic_fixture.json` stays until the hackathon sandbox code that imports it is removed.
- Keep the repository status section of the working document accurate whenever a ticket lands.
- If the guide is ambiguous or internally inconsistent, stop and identify the conflict; record the resolution in `specs/decisions.csv` and remaining risks in `specs/risks.csv`.
- The guide's policies (fees, deadlines, thresholds, windows) are proposed pilot defaults. The venue must approve actual terms, resource hold and staffed coverage before a session goes live.

## Product definition (guide Part I, Part II §01–§21)

A venue publishes a dated session with a fixed GBP per-person price, a headcount minimum, capacity and deadlines. Club organisers request exact places; the venue approves each club and quantity; the organiser commits conditionally. When current commitments reach the minimum, payment opens at a staffed 11:45 London release. Each club pays its deposit directly to the venue; the venue verifies receipts, checks its diary and confirms.

- Geography Edinburgh; times in `Europe/London` with stored UTC instants; money in GBP minor units.
- At most two clubs per session. One live allocation per plan. Commitment quantity equals the venue-approved quantity.
- Sila neither collects card details nor holds funds. The venue receives, verifies and refunds money; Sila records it in an append-only ledger.
- No member accounts, roster, participant RSVPs, personal access-note fields, consent forms or health-note storage. Personal access arrangements go directly to the venue.
- No automated matching, slot intersection, ranking, three-club combinations, live diary integration, payment custody or AI decisions. Vas introduces clubs manually; the system enforces arithmetic, permissions, capacity, deadlines and notifications.
- Only the venue approves clubs and confirms; only the organiser commits their club; an operator can pause new commercial actions but cannot commit, verify payments or change terms.
- Conditional commitment and confirmed booking stay visibly different. No state says confirmed until the venue's checked confirmation succeeds.

## Rules that must hold (guide §07, §12, §15–§18, §22–§24, §27)

Pure rules live in `lib/sila/` and are covered by `tests/unit/sila-*.test.ts`. Database transactions must repeat the same checks under row locks rather than reimplement them differently.

- **Deadlines (§12):** business day = Mon–Fri excluding Scottish bank holidays and venue closures (versioned calendar). Minimum reached strictly before 11:00 on a covered business day opens the same day at 11:45; otherwise the next covered business day. Pay-by = actual opening + 5 local calendar days, rounded forward to business-day noon. Verify-by = next business-day noon, strictly before the final decision. Final decision ≥ 7 calendar days before the event. fill_by is the latest feasible business-day noon. Commit at fill_by is allowed, after is rejected.
- **Commitment (§15, §23):** atomically check session version, venue approval, deadline, capacity, two-club limit, a second club reaching the minimum, maximum 21-day wait. Invitations reserve nothing. Reaching the minimum freezes the contributing set and schedules one opening.
- **Money (§18):** server-computed totals; percentage deposit rounded half up once per group; balance is the remainder. Timeliness uses `received_at`, never `verified_at`. Receipt IDs unique per venue. A valid receipt is kept even when confirmation is blocked.
- **Withdrawal and failure (§15, §17, §18):** free before payment opens (cancel the scheduled opening if the minimum breaks); venue review after. Before confirmation, failure returns all payments. After confirmation, venue fault refunds in full; club default follows notice and remedy. No automatic deposit forfeiture.
- **Interfaces (§24):** every write carries an idempotency key and verified actor; changes carry `expected_version`. 422 field errors, 409 stale/closed/capacity, neutral 404 for unauthorised records.

## Architecture and module boundaries (§22)

Next.js + TypeScript, Supabase Auth and PostgreSQL, private storage, Vercel hosting, a durable worker with an outbox.

```text
app/                   role-specific pages and /api/v1 routes
lib/sila/              pure pilot rules: time, calendar, schedule, money, session, commitment, confirmation, status
lib/auth/              session verification and object-level authorisation
supabase/migrations/   reviewed schema, RLS, grants, guarded functions
tests/                 unit, db, concurrency and e2e
```

- Authorise every server command and data read at object level; UI hiding is not protection. Privileged keys stay in narrowly scoped server code.
- Lock session, resource and plan rows in a consistent order. Write domain change and outbox event in one transaction; workers recheck current state before every reminder.
- Keep staging and production separate. Synthetic contacts and payment evidence stay in staging; no demo booking enters production counts.

## UX and product copy
Use Exact Design folder reference

## Verification and definition of done

- Trace work to the guide's ticket groups P0 01–P0 12 (§25–§26) and the release checks in §27.
- For every changed rule, cover a positive path, a negative path, and stale-state/concurrency cases. Prioritise cross-tenant access, last-place races, immutable terms, deadline arithmetic and receipt deduplication.
- Run targeted tests, TypeScript checks, lint and the production build before declaring work complete. Never claim a command passed if it was not run.
- End each substantial task with: changed files, reason for the design, tests actually run, known limitations, and the next smallest step.

## Git, PRs and engineering communication

- Use the repository owner's genuine configured Git identity. Never invent an author, co-author, reviewer, test result or approval.
- Commit small, logical, reviewable changes. Avoid unrelated formatting churn, generated lockfile noise, secrets, dumps and blanket dependency upgrades.
- Write commit messages in natural, professional engineering language with an imperative subject, e.g. `feat(sessions): block publication when fill_by is infeasible`.
- Never add automatic coding-assistant credit, generated-by banners, session links, promotional footers, or tool signatures to files, commits or PR descriptions. Preserve legally required licences, third-party credits, truthful provenance and required disclosures.
- Do not make a commit/push without approval. If asked to commit, review `git diff --staged`, run applicable checks, and write an accurate message.
