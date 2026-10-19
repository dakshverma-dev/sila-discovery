# Sila product workspace with sample records

Open [Sila](https://sila-demo-preview.vercel.app). The interface has normal pages and role dashboards, rather than a guided presentation. The supplied v5 reference governs the hero, artwork composition, typography and paper palette. The canonical guide governs booking rules.

## Accounts and pages

Use the account menu in the top right to change the supplied sample account. The workspace opens automatically for that account.

| Account | Workspace | Useful starting record |
|---|---|---|
| Maya Okafor | Meadows Book Circle organiser | Seven conditional places; a pending receipt; confirmed booking SL1042; a refund |
| Elliot Reid | Leith Arts Club organiser | Nine requested places awaiting venue approval |
| Rowan Ellis | Venue coordinator | Request approvals, session publication, diary check and confirmation |
| Alex Campbell | Venue finance | Payment reconciliation, append-only receipts and actual refund returns |
| Sila operations | Operations | Manual introductions, activity history and audited intake pause |

The landing page follows the complete v5 discovery composition: hero, process, searchable index, large illustrated experience bands, organiser and venue sections, booking questions and closing/footer. Its audience buttons open the corresponding sample workspace directly. Motion follows the supplied prototype: staggered title reveals, wipe/fan/circle artwork reveals, pointer depth, scroll drift, eased scrolling and shared artwork transitions into an experience. Reduced-motion preferences disable the effects, including when changed with the page open. The public experience index supports search and category filters. Each dated session has its own page. Venue screens include overview, sessions, draft editor, requests, payments/refunds, agreement/deadlines, activity and settings. Organisers have their own plans, private conversation, agreement, payment history and practical downloads. An invitation reserves nothing; conditional commitment and venue confirmation remain visibly distinct.

## Walk through the product in a meeting

1. Start with the hero and the print-room experience. The £35 price, minimum 16 and capacity 20 are venue-set; the artwork is illustrative public-domain art, not a museum partnership or collection claim.
2. Choose Rowan Ellis. Open **An evening in the print room**, then **Club requests**. Approve Leith Arts Club's nine places after the suitability acknowledgement.
3. Choose Elliot Reid. Open the same plan, review the agreement and commit the nine approved places. The seven existing places plus nine reach 16. The screen shows the staffed payment opening scheduled for 11:45, with no payment due before the actual opening. This remains conditional.
4. Choose Alex Campbell and open **The art of the woodcut**, then **Payments & refunds**. This separate sample session already has payment open and a pending Meadows report. Record the £61.25 receipt using an actual-received sample timestamp before 3 November noon, a unique reference and evidence reference. The saved receipt alone does not confirm a booking.
5. Choose Rowan Ellis. Open that session and complete the external diary/hold acknowledgement before confirming. Choose Maya Okafor to see the confirmed reference and download that club's practical details. Another club's plan is unavailable to this organiser.
6. In finance, open **An autumn print gathering** to see £61.25 due back. Record an actual sample return with its reference and evidence. The ledger retains the received payment and verified return separately; no money moves through Sila.
7. Show the draft editor and publication checks, venue settings, private conversation, or operations introduction/pause screens according to the audience's work.

Ask how the venue handles a recent sub-minimum enquiry, who would approve clubs and verify receipts, and which named people could cover release windows. Capture meeting feedback outside sample booking records.

## Persistence and operating boundary

Only the records are sample data. This public build uses an isolated browser adapter: edits persist in that browser and propagate between its tabs. A separate browser or visitor starts with its own records. The account menu can reset the sample dataset. A new record's address works in the browser where it was created; sharing its URL does not share that browser's records.

The sample snapshot is 4 November 2026 at 10:50 London. Different dated records show waiting, payment, confirmed and refund stages without a time-jump control. The sample build sends no email, processes no money and connects to no booking database or Auth service. It is suitable for showing and discussing the product interface; it does not establish a contract or approval from a real venue. Do not enter real personal or payment information.

The authenticated application remains separate. It uses verified email access, guarded server commands, row-locked allocations, an append-only database ledger and a worker. Its organiser, venue and operations pages share the new presentation primitives. Private evidence files, durable outbox delivery/reminders, balance notice/remedy, amendments, commercial records and recovery/release checks remain unfinished. Real legal entity/privacy contacts, venue terms and staffed coverage also remain required before live use. See the [working guide's repository status](Sila_Product_Trial_and_Build_Guide.md#repository-status).

Personal access arrangements go directly to the venue. There are no member rosters, health-note forms, automatic matching, live diary integration or payment custody.

## Local preview and packaging

Run `npm run demo:build`, then `node scripts/serve-customer-app.mjs`. Open http://localhost:3400. The export is `customer-demo/out`; the build scans it for server-only markers. The local server and static hosting rewrites support addresses for newly created sample records.

The main application serves the same sample interface at `/` and `/sample/...`; verified booking routes stay at `/venue`, `/plans` and `/ops`. Run `npm run demo` for the separate local Supabase rehearsal at http://localhost:3300/pilot-demo. Production payment timing remains enforced there.

Deploy only `customer-demo/out` to the existing separate preview project. The root Vercel link still refers to the legacy booking deployment. The old guided tour remains in source as an unlinked reference; it is no longer the public product interface.
