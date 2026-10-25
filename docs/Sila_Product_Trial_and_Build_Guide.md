# Sila product trial and build guide

Product and trial brief followed by the complete build and user flow specification.

Prepared for Vas and Daksh | Source documents dated 17 October 2026

> This Markdown file transcribes `docs/Sila_Combined_Product_Trial_and_Build_Guide.pdf`, which is the canonical source. If the two ever differ, the PDF wins. The final section, **Repository status**, is not part of the guide; it records what this repository actually implements.

Sila helps smaller cultural clubs combine demand for a venue-approved experience. This guide brings the product hypothesis, trial decisions, user journeys, screen examples and implementation requirements into one reference.

## Reading guide

Part I covers the product, demand validation, commercial proposal, trial measures and responsibilities. Part II contains the detailed workflows, operating rules, data contracts, backlog and release checks.

The original section numbers are retained within each part. References to sections in Part II refer to that part. Repeated requirements are retained to preserve the context of each source. Screen examples are accompanied by searchable text summaries. The proposed policies and example dates remain proposals and examples.

## Contents

**Part I Product and trial brief**

- 01 Validate the problem before the shared build
- 02 The complete user journey
- 03 Build through three evidence gates
- 04 Test a fee and the volume behind it
- 05 A trial that can change the decision
- 06 Launch responsibilities and the first invitation

**Part II Build and user flow specification**

- 01 Navigation and screen inventory
- 02 The first five minutes for a venue
- 03 Venue invitation and publication screens
- 04 What a dated session contains
- 05 The organiser chooses a session
- 06 Club request and conditional plan screens
- 07 What a conditional commitment means
- 08 The venue approves and monitors the session
- 09 Payment and failure screens
- 10 Venue session and receipt screens
- 11 Refund and incident screens
- 12 Deadlines and the payment clock
- 13 Conditional commitment and confirmation screens
- 14 The venue set session lifecycle
- 15 Manual introductions and capacity rules
- 16 States people can understand
- 17 Confirmation changes and cancellation
- 18 Money receipts and refunds
- 19 Privacy permissions and direct access contact
- 20 Platform terms and legal responsibilities
- 21 What the pilot builds and handles manually
- 22 Architecture and operational foundations
- 23 Records and field validation
- 24 Application contracts
- 25 Developer backlog for one complete booking
- 26 Backlog for operations privacy and release
- 27 Checks before a live invitation
- 28 Support hours and incident authority
- 29 A complete worked session
- 30 Design and usability
- 31 Implementation and privacy references

---

# Part I Product and trial brief

## Make an experience possible for a smaller club

Sila helps cultural clubs book experiences they are too small to arrange alone. The venue sets a workshop, date, price and minimum. One club commits for seven places, another later brings nine, and a session needing 16 can go ahead once payment and venue checks are complete.

The useful distinction is a booking that becomes possible through combining demand. A smooth enquiry tool supports that job. It does not by itself establish a reason for venues to pay.

Start with one Edinburgh venue, one workshop and one priority date. Test interest across two or three venue approved dates, then concentrate real clubs on the strongest session. Keep the first session to at most two clubs. Expand beyond the anchor only after delivery and a specific paid continuation have been reviewed.

| The example | What it means |
|---|---|
| 7 places plus 9 places | Exact conditional club commitments |
| Minimum 16 and capacity 20 | Venue approved commercial and operating limits |
| GBP 35 per person | Full price visible before an organiser commits |
| GBP 560 session total | GBP 245 for Club A and GBP 315 for Club B |
| Confirmed | Required deposits verified and venue checks passed |

Clubs can arrive weeks apart. They join an actual session rather than waiting for an algorithm to find another independent enquiry with the same constraints. A single club large enough to meet the minimum can use the same journey.

The unresolved question is whether this improves on what venues already do. Some sell the remaining places publicly or reprice a smaller private booking. The first task is to understand those alternatives before building the full shared workflow.

Prepared for Vas and Daksh, 17 October 2026.

## 01 Validate the problem before the shared build

### Ask venues about actual recent cases

Vas speaks to three to five venues. Ask each about its last three sub-minimum group enquiries from roughly the previous three months. Record group size, activity, outcome, price and staff time. Ask what happened to the remaining places and whether public ticketing, an existing class or repricing solved the problem.

Ask whether the venue will hold the room and instructor for about four weeks without guaranteed revenue, and whether it needs to sell the four spare places publicly. Public top-ups are outside the pilot; an essential requirement changes the offer before commitments.

Proceed to the anchor trial only if at least two venues describe repeated specific problems and one will test a dated workshop against its current method. Use anonymised records where available. Enthusiasm for the idea is insufficient evidence.

### Recruit around one real opportunity

Identify about 30 reachable Edinburgh club organisers and aim for 12 qualified conversations and eight genuine plans. These are recruitment targets, not existing commitments. Concentrate on the anchor workshop and its approved dates. Qualify Club B as a compatible, interested lead before Club A commits; it still makes its own later booking decision.

| Ask the organiser | What the answer tests |
|---|---|
| Can the club attend this date and afford the full price? | Actual compatibility rather than generic interest |
| How many places can you commit for? | Accountable demand rather than a poll count |
| Who collects and pays the deposit? | Whether one group payer is practical |
| Does a treasurer need to approve it? | Actual payment lead time |
| How long can you wait for a final decision? | Cost of the conditional period |
| What would you do without Sila? | The alternative we must improve |

The 21-day wait limit permits A to commit from 22 October at noon for a 12 November noon decision. Fill-by is 4 November noon, leaving 13 calendar days to secure B, or 11 days if A commits on 24 October. This is about two weeks of active recruitment.

Before finalising payment, walk through deposits, the earlier balance, collection, treasurer approval and transfers with three real organisers. Then seek two clubs wanting the same session with enough combined places. Interview interest is not a binding booking.

The first demonstration should show those clubs making a workshop possible together. Use the commitment, payment, failure and refund screens to test understanding. A clickable prototype should follow these actual constraints; the build specification supplies the screen states and rules.

If compatible demand does not emerge, change the workshop, date or use case. More matching code will not supply the missing people.

## 02 The complete user journey

### One plan from request to confirmed details

| Step | What the person does | What Sila does |
|---|---|---|
| Venue preparation | Approves a prepared dated session | Publishes the price, minimum, deadlines and link |
| Club request | Gives club name, exact places and organiser contact | Saves the plan and verifies email |
| Venue approval | Approves that club and quantity | Reuses the published price and terms |
| Conditional commitment | Reviews the full amount and selects Commit 7 places if the session reaches 16 | Holds the exact allocation and updates the conditional count |
| Later club joins | Commits the remaining nine | Schedules the earliest eligible staffed midday payment opening |
| Group payment | Payer pays the venue by the stated deadline | Keeps the club deadline separate from venue verification |
| Confirmation | Venue verifies funds and its diary | Preserves the booking and sends practical details |
| Balance and outcome | Payer pays the later balance; venue reports delivery | Tracks overdue balances under venue terms, or release and refund |

No member account, roster, budget question or custom date window is needed for a fixed price dated session. An alternative date is explicitly on request. The organiser continues using the club's existing chat.

### Put a real end to the uncertainty

For Thursday 19 November at 18:00, fill_by is Wednesday 4 November at 12:00 London. A minimum reached at that cutoff schedules payment opening on Thursday 5 at 11:45. On a business day before 11:00, approved coverage permits same-day opening. Clubs pay by Tuesday 10 at 12:00; the venue verifies by Wednesday 11 at 12:00; final decision is Thursday 12 at 12:00. Verification lag does not shorten the club's window. The proposed balance is due Friday 13 at noon, allowing verification and a remedy sequence to finish Wednesday 18 before the event. The venue and organisers must approve that earlier cash schedule before commitment.

If the minimum is not reached by fill_by, close and release the conditional commitments. Before confirmation, payment or venue failure returns all session payments. After confirmation, venue delivery failure refunds each club fully; payment default by a club uses its agreed notice and remedy policy. If its default cancels the session, the other club gets a full refund. There is no automatic deposit forfeiture. Another date or a higher price requires a new decision.

The organiser accepts the final decision date, at most 21 calendar days from commitment. Send progress every three business days and after material changes; permit easy withdrawal before payment opens. The conditional agreement, later deposit obligation and confirmed booking remain distinct in the approved terms.

## 03 Build through three evidence gates

### Keep safety while reducing scope

| Gate | Evidence needed | Build and operational scope |
|---|---|---|
| A Demand validation | One anchor workshop and two genuinely interested compatible clubs | Venue interviews, organiser constraints, manual introductions and screen tests |
| B Ordinary booking | A complete secure booking works without developer intervention | Identity, dated session, terms, exact commitment, venue receipt, confirmation, change and recovery |
| C Shared booking | Two clubs can commit at different times, pay and confirm correctly | Two club capacity, minimum trigger, complete payment window, failure, refund and operational support |

Gate B can use a group large enough to meet the minimum itself. Use a staging rehearsal if no genuine ordinary booking is available; label it as rehearsal evidence. Do not fabricate demand to claim a live booking.

The detailed specification has 12 prioritised ticket groups. All security, commitment and financial controls apply to every live transaction. The saving comes from a narrower product, rather than weaker records.

### What stays manual

Vas finds the clubs and proposes a suitable published session. The venue approves the club and quantity, checks its actual diary, receives money and verifies receipts. Sila records the decisions and enforces their consequences. Log the time these tasks take.

Defer automatic search, slot intersection, ranking, three club combinations, participant responses, individual payment collection and live diary integration. The pilot does not need a matching algorithm to discover eight plans.

### Design the moments that determine trust

The build pack includes twelve screen layouts covering venue setup, conditional counts, commitment, deposits, failure, refunds, confirmation and incident pause. Discovery can be editorial and culturally expressive; financial decisions should be calm and precise.

Test whether a new organiser can explain what is conditional, what they owe now and who acts next. A returning coordinator should approve a standard request in under a minute when no exception needs review. Any mistaken belief about confirmation or payment blocks release.

## 04 Test a fee and the volume behind it

### State the repeat rule before the trial

The proposed paid model is 10 percent of delivered venue charges retained after refunds, excluding separately stated taxes. It applies to a club Sila introduced and its repeat group bookings with the same venue for 12 months, whether arranged through Sila or directly.

The proposed nonrolling clock starts with the first delivered paid booking retaining positive revenue. Cancelled or fully refunded bookings do not start it. Only qualifying deliveries before its 12-month local-date anniversary are charged. A later full refund of the starter requires audited recalculation and credits. Trial bookings stay free. Relationships evidenced before Sila's first introduction, other venues and members' individual purchases are excluded. Pilot introductions retain their Sila source. The agreement includes minimal monthly reporting of eligible repeats and refunds. No fee applies without a separate signed paid agreement.

Test this proposal against a fee on the first delivered booking only and a priced coordination service with the budget owner. Record willingness to buy a concrete next booking. Choose one model at the day-28 review, before paid continuation; implement one fee rule. If no model is accepted then, pause the paid follow-on and record the unresolved decision. A contract alone does not give venues a reason to return.

### Make the scale assumption visible

| Illustration | Amount |
|---|---|
| Fee on GBP 560 of eligible delivered revenue | GBP 56 |
| 20 minutes support at GBP 30 per hour plus assumed GBP 2 software | GBP 12 |
| Contribution before acquisition and fixed costs | GBP 44 per session |
| Sessions for roughly GBP 1000 monthly contribution | 23, yielding GBP 1012 |
| Three venues doing two eligible sessions monthly | Six sessions, GBP 264 |
| Twelve venues doing two eligible sessions monthly | 24 sessions, GBP 1056 |

Four hours of cohort recruitment and setup valued at GBP 30 per hour is GBP 120. Spread over three sessions, that leaves GBP 4 per session; over eight, GBP 29. These are illustrative costs, not a forecast of earnings.

This trial tests the booking mechanism and willingness to pay. It does not establish a business that can pay salaries. Even 12 venues at two sessions monthly produce only GBP 1056 before acquisition and fixed costs. Scaling needs a separate target for founder pay and fixed costs, supported by achievable volume, ticket value and fee evidence.

Record all recruitment and support work, eligible enquiry frequency, conversion, repeat plans, attribution disputes and unpaid fees. Higher ticket values remain a later hypothesis.

## 05 A trial that can change the decision

### Four active weeks and delivery by day 42

Begin with one anchor venue and one activity. Aim for eight genuine plans around its approved dates and two delivered sessions, including one that required pooling and one with Sila introduced demand. Keep unsuccessful plans in the denominator. A positive phone call is not a delivery or a payment.

Day 28 reviews demand and workflow and selects one fee model with the budget owner. Day 42 closes outcomes for sessions already due. A later event remains pending. Review before adding another venue; the next step should be a specific paid continuation with the anchor.

Measure the time the first club waits, withdrawal during that period, requests becoming commitments and commitments becoming confirmed bookings. For each group, measure payment opening to first payment report and verified deposit. Include missing payments and reasons: member collection, treasurer approval, bank settlement, venue verification or deadline.

| Decision | Evidence |
|---|---|
| Test one paid continuation | Two due sessions delivered, one requiring pooling and one with introduced demand; budget owner accepts one chosen, priced next booking; routine Sila effort at most 20 minutes per session; no unresolved money or correctness incident |
| Change the proposition | Real demand exists but dates, waiting, payer arrangements or price repeatedly prevent completion |
| Repair before continuing | Incorrect privacy, allocation, commitment, receipt or refund records |
| Reconsider the use case | Existing public ticketing or pricing solves the venue problem adequately, or qualified clubs do not value this alternative |

This permits one capped paid follow-on test with the anchor, not hiring, expansion or approval of the full backlog. The booking needs signed terms and Sila's invoice must actually be paid after delivery. Willingness to pay remains unproven until then.

Source is recorded at the first request: venue existing enquiry, Sila introduction, referral or unknown. Ask both venue and organiser what would have happened without Sila. An introduction is observable; additional demand needs separate evidence.

Volume remains a separate gate. Two successful sessions cannot establish a 23 session monthly business. Use repeat plans, venue capacity and recruitment cost to decide whether that next experiment deserves investment.

## 06 Launch responsibilities and the first invitation

### Agree the service the team can actually provide

Vas owns venue discovery, recruitment, commercial conversations, support and trial decisions. Daksh owns technical correctness and recovery. Every live session needs an actual approved coverage record naming hours, primary owners, backup and contact route.

Staff payment opening and the fill, pay, verify and final-decision moments. The proposed window is 11:00 to 12:30 London, or 16:30 to 18:00 Delhi in November, with named owners and backup. Before 11:00, approved cover permits same-day release; later minimums queue the next covered business day. A blocked opening notifies both clubs, names the coordinator and Vas, and gives the next update time, with no payment due. Keep workshops at evenings or weekends according to demand; the venue supplies day-of support and an offline booking summary. Agree Vas's customer cover separately.

Vas can pause new requests, invitations, commitments and deposit requests from a phone usable operations control. Existing agreements and receipts remain preserved. A technical fallback and an exported practical booking summary are required.

### Complete the legal and privacy preparation

Name the actual Sila operating entity, data responsibilities and privacy contact. Complete the ICO fee or exemption assessment. Version Sila's platform terms alongside venue terms and review the conditional agreement, consumer responsibilities, cancellation and refund matrix.

Personal access arrangements go directly to the venue. There are no member accounts, access-note records or consent forms in the pilot. Provide public venue access facts and direct contact details. Restrict and resolve accidental sensitive information in ordinary messages.

### The venue invitation

> Hi [name], we have prepared [venue]'s [activity] session for you to review. Clubs can commit to the published date, and it goes ahead only when the minimum and payment conditions are met and you confirm it. The four week trial is free. Please review the draft, publish it and handle one real club request. I will support the trial and review the results with you. We are testing a proposed 10 percent fee on delivered introduced-club bookings, including 12 months of repeats, alongside a first-booking fee or paid coordination offer. Relationships evidenced before our first introduction are excluded. No fees apply without a separate agreement. We will choose one model at the day-28 review. [Draft link] [Full fee rule] [Agreed trial dates and contact]

Before using it, agree the activity, dates, hold, coverage and actual terms. Then test the commitment and payment screens with the first two real organisers.

---

# Part II Build and user flow specification

## Build through the evidence gates

The pilot centres on a venue set session with a fixed date, price and minimum. A first club can conditionally commit places while another joins later. The system records exact obligations, schedules a staffed midday payment opening after the minimum is met, preserves the club payment window and separate venue verification, and allows venue confirmation only after the required receipts and resource checks.

Read the separate product and trial brief for the market hypothesis, anchor recruitment, commercial terms and success criteria. This document is the implementation reference for Daksh and the product designer. It contains the full role journeys, twelve screen layouts, rules, contracts, twelve prioritised ticket groups and release checks.

Build through three gates. Gate A establishes real demand for an anchor workshop. Gate B proves one secure ordinary booking. Gate C adds the two club conditional session. Preserve security and financial correctness at every live stage; defer automated matching, three club support and participant response management.

The five day payment window and seven day final notice are proposed pilot defaults. The venue must approve the actual terms, resource hold and staffed coverage before a session goes live. Conditional commitment and confirmed booking remain visibly different.

Prepared for Vas and Daksh, 17 October 2026.

## 01 Navigation and screen inventory

### Open the decision directly

Public navigation is Sessions, Your plans and Help. A venue invitation opens its prepared draft. A club link opens the actual dated session. A notification opens the relevant plan decision, showing the current record if the email is old.

The organiser's plan has Overview, Messages and Agreement. Overview holds the next action and payment status. Messages contains the venue conversation. Agreement preserves the session terms, exact allocation and platform terms accepted. No roster or participant response tab is needed in the pilot.

The venue workspace has Sessions, Requests, Bookings and Settings. The default view prioritises requests awaiting approval, sessions approaching deadlines and receipts needing verification. A chronological bookings list is sufficient initially.

| Screen | Main decision | Exceptional state |
|---|---|---|
| Dated session | Does this activity, date and price suit our club? | Closed intake offers another actual session or an on request route |
| Club request | Group, exact places, contact and practical questions | Retained draft and inline errors |
| Conditional commitment | Full cost, obligations and failure conditions | Changed terms require fresh review |
| Club plan | Next actor and deadline | Failed session gives a clear release or refund outcome |
| Venue request | Approve the club and quantity or ask a question | No invented availability or implied commitment |
| Venue session | Current commitments, deposits, hold and confirmation | Explicit blockers beside the next action |
| Operations | Support, overdue actions, pause and audit | Private data remains scoped to the task |

The twelve wireframes use hypothetical venue and club details. They specify information order and copy; the designer should develop the cultural identity around them. Desktop must support the same decisions.

Shared practical details contain no private invoice, organiser contact or member health information. In the pilot, the organiser can copy an accurate update into the club chat rather than asking every member to create an account.

## 02 The first five minutes for a venue

### Prepare one real draft

Vas agrees a viable activity and date with the coordinator, then prepares the draft. Record who approved the price, minimum, capacity, access facts and terms. The venue checks these facts before publication. An unknown fact stays visibly unresolved.

The trial invitation names the first task, free trial dates, support contact and proposed future fee, including its 12 month repeat booking scope. Complete the legal identity and support preparations before inviting the venue to publish. Do not create fake enquiries to make the trial look active.

| Time target | Coordinator action | System result |
|---|---|---|
| First minute | Open the personal invitation and verify the invited email | Return to the prepared session |
| Minutes 1 to 3 | Check activity, date, price, minimum and capacity | Inline corrections and retained draft |
| Minute 4 | Review venue terms, access facts, payment route and deadlines | The actual public preview |
| Minute 5 | Publish and copy the session link | A usable link and a specific recruitment task |

Five minutes is a target for a prepared draft, excluding email delivery. A venue starting from nothing can save and return. Additional biography, images, staff accounts and bank credentials must not block setup.

### The first useful task

Give the venue one genuine club request to handle, or ask it to route an existing enquiry through the link. Vas owns recruitment if the proposition depends on Sila introduced demand. Record the source accurately.

A staff entered request becomes an organiser's live plan only after the organiser verifies and reviews it. Staff cannot create their commitment. Training records belong in a separate environment.

Publication completes setup. Activation means the venue has handled a real request by approving, replying or declining with a useful reason. Measure both milestones and the assistance required.

Publishing a dated session requires a valid resource hold through the final decision deadline and an approved coverage record for payment opening, fill closure, verification and final decision. A draft can be shared privately for review before those gates pass.

## 03 Venue invitation and publication screens

### Screen examples 1

**V1 — Personal venue invitation**

```text
sila
Your shared session is ready to review
Prepared for Edinburgh Print Studio

[ A free four week trial
  Review one dated workshop and handle one genuine club request. ]

PROPOSED PAID CONTINUATION
10% on introduced club bookings, including repeats at your venue for 12 months.
Separate agreement required.

YOUR FIRST TASK
Check the draft, publish it and copy the session link.

[ Review your draft ]
Verify your invited email. We will return you to this draft.
Read the full fee rule and exclusions
Contact your Sila trial lead
```

**V2 — Review the prepared session**

```text
sila
Review your session

ACTIVITY            [ Printmaking for clubs ]
DATE AND PRICE      19 November · 18:00 to 20:00
                    GBP 35 per person · All in
MINIMUM AND CAPACITY Runs at 16 · Maximum 20
                    At most two clubs
DEADLINES           Fill by 4 November at 12:00 London
                    Final decision 12 November at 12:00 London
                    Five calendar days to pay, then verification
READY TO PUBLISH    Venue terms and access facts reviewed
                    Resource hold and coverage approved

[ Publish and copy link ]
Preview public page
Save draft
```

**Searchable screen summary.** V1 Personal venue invitation: Prepared for Edinburgh Print Studio. Free four week trial: review one dated workshop and handle one genuine club request. Proposed paid continuation: 10% on introduced club bookings, including repeats at the venue for 12 months; separate agreement required. First task: check the draft, publish and copy the session link. Action: Review your draft. Verify invited email and return to the draft. Links: full fee rule and exclusions; Sila trial lead. V2 Session review: Printmaking for clubs; 19 November, 18:00 to 20:00; GBP 35 per person, all in. Runs at 16; capacity 20; at most two clubs. Fill by 4 November at 12:00 London; final decision 12 November at 12:00 London. Five calendar days to pay, then verification. Venue terms and access facts reviewed; resource hold and coverage approved. Action: Publish and copy link. Preview and save draft available.

V1 Personal invitation. Review the prepared session and the proposed commercial arrangement before signing in. The invitation links to the full fee rule, including repeat bookings and exclusions.

V2 Session review. Date, price, minimum, fill deadline and final decision are visible together. Publishing is blocked by unresolved terms, resource or coverage requirements. A successful publication returns the session link immediately.

The example dates preserve the five calendar day payment window, separate verification period and seven day final notice in section 12. The venue can approve a longer payment window before publication; the fill deadline then moves earlier.

## 04 What a dated session contains

### Publish the decision people can join

An offering describes the reusable activity. A session adds the exact date and commercial conditions. A club plan belongs to that session and keeps its own organiser, allocation, invoice and conversation.

| Information | Required before publication |
|---|---|
| Activity | Title, description, inclusions, approved image and venue |
| Time and place | Exact start and end, meeting point and Europe/London time zone |
| Economics | All compulsory charges within a fixed GBP per person price |
| Numbers | Minimum people, maximum people and maximum two clubs |
| Fill deadline | Latest time the current minimum may be reached |
| Payment schedule | Staffed midday opening, at least five calendar days to pay, then venue verification |
| Final decision | Venue confirmation or a clear failure outcome by this time |
| Venue hold | Actual resource checked and held through that decision |
| Practical constraints | Applicable age, format and access information |
| Terms | Versioned venue terms, conditional failure treatment and platform terms |
| Support | Named owners at payment opening and each operational deadline |

The pilot uses a headcount minimum and fixed per person pricing. Minimum spend, variable pricing and fixed hire charges can follow. A group that meets the minimum on its own uses the same process.

### Keep the terms stable

The published session has a version. The venue approves each club's exact quantity before inviting it to commit. Invitation links do not reserve capacity. The server checks availability and creates a held allocation when the organiser commits.

Show 7 places conditionally committed; 16 needed to run; 20 maximum. Requests and unaccepted invitations do not contribute. Keep public club identities private; aggregate session numbers can be displayed as explained in the platform notice.

Pause new requests without deleting existing commitments. A date, price, minimum, deadline or cancellation change requires a new terms version and affected organisers' acceptance. The venue cannot reduce an accepted group's rights by editing the public activity page.

## 05 The organiser chooses a session

### Remove dates and budget questions already answered

The session page shows the actual date, duration, exact per person price, minimum, current conditional places and final decision date. The organiser selects Request places and enters the club name, number and contact. The price summary updates from that number. No member list is required.

Show public venue access facts and a direct venue phone or email for personal arrangements. Sila has no access-note form, member account or health-note record in this pilot. Ordinary activity questions must not invite medical details. Section 19 covers accidental disclosure.

Sending the request verifies the organiser's email and returns to the retained draft. A verified organiser sends once. The plan shows Waiting for the venue to approve your places, with the venue's actual reply expectation.

### Approval is a small venue decision

The coordinator confirms that this club and exact quantity suit the session, checks any essential arrangement and sends the commitment link. The session's date and price are already set; no bespoke quote needs to be recreated. Vas may prepare the record, but only the venue can approve it. A returning coordinator should complete a standard approval in under a minute when no exception needs review.

Before commitment, the organiser reviews the full amount, deposit, payment window, terms and withdrawal treatment. They can ask for a different quantity in the same plan. Approval of a request does not count as their commitment.

If the session fills before they commit, show that fact and preserve their details for a chosen alternative. Never overbook because an old invitation is still open.

### Other dates are requests

The reference venue offers 19 November. Ask about another date is a secondary route labelled on request. It does not put 26 November into confirmed availability. A new date becomes bookable only when the venue publishes or approves a corresponding session and the organiser explicitly chooses it.

The pilot list contains only real approved sessions. A request with no available session stays in Vas's review queue; no venue is said to have received it until a named recipient has actually been chosen.

## 06 Club request and conditional plan screens

### Screen examples 2

**O1 — Request the published session**

```text
sila
Request group places
Printmaking · 19 November
18:00 to 20:00 · GBP 35 per person

CLUB NAME        [ Club A ]
PLACES REQUESTED [ 7 ]
ORGANISER EMAIL  [ organiser@club.example ]

[ Your group total GBP 245
  Deposit GBP 61.25 only if the minimum is reached. ]

This requests venue approval. You have not committed or paid.

[ Request 7 places ]
Access questions? Contact the venue
Ask about another date · On request
Verify email here if needed. Draft saved.
```

**O2 — After the organiser commits**

```text
sila
Waiting for more places

[ 7 places conditionally committed
  9 more needed to reach 16 · Maximum 20
  This session is not confirmed. ]

YOUR GROUP   Club A · 7 places · GBP 245
             19 November · 18:00 to 20:00
DEADLINES    Fill by 4 November at 12:00 London
             Final decision 12 November at 12:00 London

No deposit due yet.
If the minimum is reached, we schedule payment opening. You then have at least
five calendar days to pay.
Next progress update: 28 October. You can withdraw before payment opens.

[ Copy conditional club update ]
Message the venue
Withdraw before payment opens
```

**Searchable screen summary.** O1 Request group places: Printmaking, 19 November, 18:00 to 20:00; GBP 35 per person. Club A requests 7 places; organiser email organiser@club.example. Group total GBP 245; deposit GBP 61.25 only if minimum is reached. This requests venue approval; no commitment or payment yet. Action: Request 7 places. Access questions go to the venue; another date is on request; draft saved through email verification. O2 Waiting for more places: 7 conditionally committed; 9 more needed to reach 16; maximum 20. Not confirmed. Club A: 7 places, GBP 245. Fill by 4 November noon London; final decision 12 November noon London. No deposit due yet. At least five calendar days to pay after opening. Next progress update 28 October. Actions: copy conditional club update, message venue, withdraw before payment opens.

O1 A session specific request. The known date and price remain visible. The organiser enters the club and quantity rather than being asked to repeat availability and budget questions.

O2 The plan after commitment. Show seven committed, nine still needed, the fill deadline, the accepted final decision and the next progress update. Send an update every three business days and after a material change, including when the count is unchanged. Keep withdrawal before payment opening easy to find.

The venue approval and commitment review sit between these states. An unapproved request never appears in the public committed count.

## 07 What a conditional commitment means

### An exact obligation subject to stated conditions

The proposed terms form a conditional agreement when the organiser commits, for an exact number and amount. The duty to pay the deposit starts only at the scheduled payment opening after the current minimum is reached; the session becomes a confirmed booking only after venue confirmation. State the contracting party and the organiser's authority explicitly. Have this mechanism and applicable consumer responsibilities reviewed before live use. The interface records the agreed terms rather than deciding their legal effect by label.

The main action is Commit 7 places if the session reaches 16. Immediately above it, show Your group total is GBP 245. Deposit GBP 61.25 if the minimum is reached. This session is not confirmed. Link the venue's conditions and Sila's platform terms in place.

Committing reserves that allocation through the disclosed decision period. The organiser explicitly accepts the final decision date, with at most 21 calendar days from commitment to that decision. Earlier interest remains an uncommitted lead. It does not collect money. The exact effect of withdrawal belongs in the approved terms, including the point at which an organiser may owe a cancellation charge. The interface must not imply a cost free cancellation if the terms provide otherwise.

The pilot permits withdrawal before payment opens without a charge. Once payment opens, the venue's explicitly accepted cancellation policy applies. A conditional session that fails before confirmation releases the clubs and returns all session payments. After confirmation, distinguish a venue delivery failure from a club default under section 18. The venue must approve these refund and remedy rules before publication.

### Check the payer arrangement now

Before committing, the organiser can see the deposit amount and the payment window. Ask whether they can arrange one group payment or need a treasurer to act. Let them copy the payment summary for approval without exposing another group's information.

Do not require them to front the full GBP 245 within a day. The reference obligation is the GBP 61.25 deposit during the stated window; the balance has its own later due date. The pilot still leaves member collection to the club, so measure that work explicitly.

Test the proposed amounts and dates with three real organisers, including a treasurer where relevant, before finalising payment. Ask them to walk through actual collection, approval and transfer steps. Record whether they can honour the conditional obligation when payment opens. If one payer is consistently unworkable, change the payment model before expanding. Individual collection is a later product decision, not a capability to imply during this trial.

## 08 The venue approves and monitors the session

### Approve clubs without rebuilding the offer

Requests show the chosen session, club size, group total and outstanding practical questions. The coordinator can approve that allocation, ask a question or decline with a reason. Reuse the published price and terms. A sent commitment invitation remains subject to available capacity until the organiser acts.

Vas can identify another suitable club manually and ask whether its organiser wants an introduction. Sharing the activity with another club is part of the session description and commitment. Sharing organiser identities or contact details is a separate optional introduction requiring permission.

### The minimum changes the next action

Once current conditional commitments reach the minimum, freeze the contributing set and schedule the earliest eligible 11:45 payment opening under section 12. Show Minimum reached, payment opens [date and time]. Recheck current commitments before that release. The first pilot does not add more clubs after this point. The pilot reserves the session for these clubs and does not sell spare places publicly. Record the venue coordinator's explicit approval of the room and instructor hold and the economics of running at 16 with four unsold places, against the current terms version, before publication. If public top-ups are essential, revise the offer before taking commitments. Extra club demand can be offered the next session.

Show each group's exact obligation and verified deposit status in the venue workspace. The organisers see only their own invoice and an aggregate explanation of the session condition. Do not show a participant poll count as commitment or payment.

The coordinator prepares a group invoice or payment route when approving its request. The system releases the instructions only when payment opens. The venue remains responsible for receiving and verifying the funds.

### One final action where possible

When the last required deposit arrives, offer Record receipt and confirm session. Record the actual receipt even if another prerequisite prevents confirmation. Return the blocker in place, such as an expired resource hold or unresolved venue check.

The coordinator must verify the external diary before confirmation. A valid Sila record cannot prevent an unrecorded external booking. Confirmation creates the common booking and each group's own financial snapshot, then queues practical details.

Vas may pause new requests, invitations and commitments during a problem. Only the venue can make the commercial decision to confirm its session, and only the organiser can commit their club.

## 09 Payment and failure screens

### Screen examples 3

**O5 — Deposit payment instructions**

```text
sila
Pay your group deposit

[ GBP 61.25 due
  Pay Edinburgh Print Studio directly.
  Your group has 7 conditional places. ]

PAY BY          10 November at 12:00 London
                Opened 5 November at 11:45 London
Bank transfer must reach the venue by pay-by.
Venue verifies by 11 November at 12:00.
PLAN REFERENCE  PL1042-A · Venue invoice INV-A

[ Open venue invoice ]
[ I have paid ]
After reporting: Verification pending. A venue checking delay does not make a
timely payment late.
Copy instructions for your treasurer
Your total is GBP 245. The later balance is GBP 183.75 due 13 November at 12:00.
Need more time? Contact the venue
```

**O6 — The minimum was not reached**

```text
sila
This session will not go ahead

[ 7 of 16 needed places
  The fill deadline passed on 4 November at 12:00 London. ]

Your 7 conditional places are released. No payment was requested.

YOUR PLAN  Printmaking · 19 November
           Club A · No balance due
You can ask about another session. Your commitment will not move automatically.

[ Ask about another session ]
Message the venue
View the closed agreement
```

**Searchable screen summary.** O5 Pay your group deposit: GBP 61.25 due directly to Edinburgh Print Studio for 7 conditional places. Pay by 10 November at 12:00 London; opened 5 November at 11:45. Bank transfer must reach venue by pay-by; venue verifies by 11 November at noon. Plan PL1042-A; venue invoice INV-A. Actions: Open venue invoice; I have paid. Reporting leaves verification pending; venue checking delay does not make timely payment late. Group total GBP 245; later balance GBP 183.75 due 13 November noon. Copy instructions for treasurer or contact venue for more time. O6 Session will not go ahead: 7 of 16 needed places at fill deadline 4 November noon. Seven conditional places released; no payment requested; no balance due. An alternative requires a fresh decision. Actions: Ask about another session, message venue, view closed agreement.

O5 Deposit instructions. Show Pay by 10 November at 12:00 London, the separate venue verification deadline and a plan reference. For bank transfer, explain that funds must reach the venue by the pay-by time. Reporting payment does not verify it. Only a confirmed booking receives a booking reference.

O6 Unfilled session. The minimum was not reached by fill_by. The conditional commitment is released, no payment is requested and any alternative requires a new decision. This state must feel as clear as success.

## 10 Venue session and receipt screens

### Screen examples 4

**V3 — Venue session overview**

```text
sila
Printmaking
19 November

[ 7 conditionally committed
  Club A 7 · Minimum 16 · Capacity 20 ]

NEXT REQUEST  Club B requests 9 places
              GBP 315 total · Deposit GBP 78.75
A second club of nine would reach the minimum when its organiser commits.

[ Approve 9 places and invite ]
Ask a question
SESSION DEADLINES  Fill by 4 November at 12:00 London
                   Final decision 12 November at 12:00 London
Approval reuses your published price and terms. It does not commit for the club.
Pause new intake
```

**V4 — Venue verifies the final receipt**

```text
sila
Record receipt and confirm

[ Minimum met · 16 places
  Club A 7 · Club B 9
  Both on current session terms ]

SEPARATE DEADLINES       Clubs pay by 10 November at 12:00 London
                         Venue verifies by 11 November at 12:00
DEPOSITS                 Club A GBP 61.25 verified
                         Club B GBP 78.75 to record
VENUE RECEIPT IDENTIFIER [ RC-2026-B ]
FUNDS ACTUALLY RECEIVED  10 November at 11:00 London
CURRENT VENUE CHECK      External diary checked
                         Resource available and hold valid

[ Record GBP 78.75 and confirm ]
If a condition fails, the receipt stays saved and the blocker is shown.
```

**Searchable screen summary.** V3 Venue session overview: Printmaking, 19 November. Seven conditional places, Club A; minimum 16, capacity 20. Club B requests 9 places: GBP 315 total, deposit GBP 78.75. A second club of nine would reach minimum when its organiser commits. Action: Approve 9 places and invite; ask a question. Fill by 4 November noon; final decision 12 November noon London. Approval reuses published price and terms and does not commit the club. Pause new intake available. V4 Record receipt and confirm: Minimum met, 16 places: Club A 7 and Club B 9 on current terms. Clubs pay by 10 November noon; venue verifies by 11 November noon. A deposit GBP 61.25 verified; B deposit GBP 78.75 to record. Receipt RC-2026-B; funds actually received 10 November at 11:00 London. External diary checked; resource available and hold valid. Action: Record GBP 78.75 and confirm. A failed condition preserves the receipt and displays a blocker.

V3 Session overview. Count current conditional allocations separately from requests. Add the second club manually after venue approval. No matching score or automatic search is required.

V4 Verify and confirm. Show separate club pay-by and venue verify-by times. Record when the money actually reached the venue and when staff verified it. A timely deposit remains timely even if checked later. The last receipt and confirmation can share one action; a blocker preserves the receipt.

Neither Vas nor a notification worker can bypass the venue's approval, the minimum, payment conditions or the actual resource check.

## 11 Refund and incident screens

### Screen examples 5

**O7 — Session failed after a deposit arrived**

```text
sila
Your deposit is due back

[ GBP 61.25 refund due
  Edinburgh Print Studio is responsible for returning the deposit. ]

WHY            The shared session did not confirm.
               Your group commitment is released.
REFUND TARGET  By 19 November at 12:00 London
               Five business days from closure
Status: awaiting venue refund.
We will show Refunded only when the return is verified.

[ Ask for a refund update ]
View receipt and agreement
```

**V5 — Vas can pause commercial intake**

```text
sila
Pause new actions
Operations · Authorised Sila operator

PAUSE SCOPE  New requests, invitations, commitments and further deposit requests
REASON       [ Investigating a confirmation issue ]
Existing agreements and actual receipts stay recorded. Upcoming booking details
remain available.

[ Pause and record reason ]
Open upcoming booking exports
Contact the named technical owner
Resume after resolution with an audited decision. This control cannot accept for
a club or verify a venue payment.
```

**Searchable screen summary.** O7 Your deposit is due back: GBP 61.25 refund due; Edinburgh Print Studio returns it because the shared session did not confirm. Club commitment released. Refund target 19 November noon London, five business days from closure. Status: awaiting venue refund. Refunded only after verification. Actions: Ask for a refund update; view receipt and agreement. V5 Pause new actions: Authorised Sila operator. Scope: new requests, invitations, commitments and further deposit requests. Example reason: Investigating a confirmation issue. Existing agreements and actual receipts preserved; upcoming booking details remain available. Action: Pause and record reason. Open upcoming booking exports or contact technical owner. Resume after resolution with audited decision. This control cannot accept for a club or verify a venue payment.

O7 Refund due. A session that failed after a deposit arrived shows the exact amount to return, the venue owner and the agreed completion target. It becomes refunded only after verification.

V5 Pause during an incident. Vas can stop new commercial actions from her phone, with a reason and visible scope. Existing agreements and actual receipts remain preserved. Resume follows the resolution procedure.

## 12 Deadlines and the payment clock

### Separate paying from checking the payment

Keep the workshop on a date and time clubs want. All customer deadlines are at 12:00 Europe/London on a venue business day. Target payment opening at 11:45. If the minimum is reached strictly before 11:00 on a business day and that day's coverage and payment route are approved, open the same day. At or after 11:00, or without approved same-day cover, use the next covered business day. Recheck the contributing set and schedule feasibility at release.

| Clock | Reference session in November 2026 |
|---|---|
| Fill deadline | Wednesday 4 at 12:00 London |
| Payment opening in the example | Thursday 5 at 11:45 London |
| Clubs pay by | Tuesday 10 at 12:00 London |
| Venue verifies by | Wednesday 11 at 12:00 London |
| Final go or no go | Thursday 12 at 12:00 London |
| Balance pay-by | Friday 13 at 12:00 London |
| Workshop | Thursday 19 at 18:00 to 20:00 London |

The club completes payment by its pay-by time. For bank transfer, funds must reach the venue by then; initiating a transfer alone is insufficient. The venue checks by the next business day noon. Store received_at separately from verified_at. A report still being checked is Verification pending, not an automatic missed payment. Early verification and confirmation are allowed.

### Calculate the schedule in local calendar time

A business day is Monday to Friday excluding Scottish bank holidays and agreed venue closure dates. Version this calendar. Add five local calendar days to actual payment_opened_at, then round forward to the first business-day noon at or after that instant. This means local calendar days, not a fixed 120 hours. Preserve the zone and resolved UTC instants. [11] [12]

Verification is due the next business day noon after pay-by. It must be strictly before the final decision, which must give at least seven calendar days before the workshop. Work backwards through the approved calendar using the worst case of a minimum reached at the noon fill cutoff. That is too late for same-day release, so 4 November remains the latest feasible noon fill deadline. Earlier eligible minimums can open payment sooner.

The commit at fill_by is allowed; after it is rejected. Closure runs only after the cutoff and rechecks committed transactions. Pay-by is inclusive of received_at; later verified_at does not change timeliness. If opening is delayed past noon, recompute from actual opening and block payment if verification would no longer precede the final decision. Agree a viable new schedule or release the clubs, without shrinking their window.

If an opening cannot proceed, notify both clubs in the plan and by email: Payment opening is delayed. Nothing is due yet. [Named coordinator] and Vas will update you by [time]. Show the reason, owner and next update, normally within 30 minutes in cover. Do not release invoices or invent an extension. Preserve receipts and resolve before the final decision.

## 13 Conditional commitment and confirmation screens

### Screen examples 6

**O3 — Review the conditional commitment**

```text
sila
Commit conditionally
Printmaking · Session terms version 1

DATE AND GROUP  19 November · 18:00 to 20:00
                Club A · 7 places

[ Your group total GBP 245
  Deposit GBP 61.25 if minimum met
  Balance GBP 183.75 due 13 November at 12:00 ]

Minimum 16. This session is not confirmed. No payment is due now.

DEADLINES YOU ACCEPT  Fill by 4 November at 12:00 London
                      Final decision 12 November at 12:00 London
I can wait until this decision date. Payment opens at the next eligible midday,
with at least five calendar days to pay.
Venue conditions and withdrawal policy
Sila platform terms

[ Commit 7 places if the session reaches 16 ]
Ask for a different quantity
```

**O4 — The same plan after venue confirmation**

```text
sila
Your booking is confirmed

[ Booking SL1042
  Printmaking at Edinburgh Print Studio ]

DATE AND PLACES  19 November · 18:00 to 20:00
                 Your group has 7 places
YOUR PAYMENT     Deposit GBP 61.25 received
                 Balance GBP 183.75 due 13 November at 12:00
ON THE DAY       Meet at the main reception
                 View directions and access details

[ Copy practical details ]
Message the venue
Request a change
View agreement
You manage this club booking. Other clubs cannot see your invoice or messages.
```

**Searchable screen summary.** O3 Commit conditionally: Printmaking, session terms version 1. Club A, 7 places; 19 November, 18:00 to 20:00. Group total GBP 245; deposit GBP 61.25 if minimum met; balance GBP 183.75 due 13 November noon. Minimum 16; not confirmed; no payment due now. Accepted deadlines: fill by 4 November noon London; final decision 12 November noon London. Organiser can wait until decision; payment opens at next eligible midday with at least five calendar days to pay. Links to venue withdrawal policy and Sila platform terms. Action: Commit 7 places if the session reaches 16. Different quantity may be requested. O4 Confirmed booking: SL1042, Printmaking at Edinburgh Print Studio; 19 November, 18:00 to 20:00; 7 places. Deposit GBP 61.25 received; balance GBP 183.75 due 13 November noon. Meet at main reception; review directions and access details. Actions: Copy practical details, message venue, request a change, view agreement. Organiser manages the club booking; other clubs cannot see its invoice or messages.

O3 Conditional commitment. The primary action states the minimum condition. The full cost sits beside it. The fill deadline and final decision date replace the old short offer acceptance clock.

O4 Organiser booking. Once the venue confirms, the same plan shows the reference, actual agreed places, deposit received, balance due and practical details. Its footer addresses the organiser directly.

The intermediate payment panel names the actual opening, club pay-by, venue verify-by, plan reference and venue payment route. No state uses the word confirmed until the venue's checked confirmation has succeeded.

## 14 The venue set session lifecycle

### Clubs can arrive weeks apart

The venue publishes a dated session and its conditions. Vas introduces Club A, which requests seven places. The venue approves that allocation; A's organiser conditionally commits. The page now shows seven committed places against a minimum of 16, with no payment due yet.

The session stays open until its fill deadline. Vas can introduce Club B later, using the same date and price. If B requests nine, the venue approves it and B's organiser commits. Current commitments reach 16, so the two allocations become the contributing set and the earliest eligible staffed payment opening is scheduled. There is no payment obligation before that opening.

Each group pays its deposit directly to the venue within its full payment window. The venue verifies both receipts and the resource, then confirms. Confirmation may happen before the final decision deadline. Each group keeps its own liability, invoice and conversation.

### The session can also fail clearly

If the minimum is not met by the fill deadline, close the conditional session and notify the clubs that it will not proceed. No deposit should have been requested. Release their allocations and offer an actual alternative without transferring their commitment automatically.

If the minimum was met but a deposit or venue condition fails, the venue must resolve or close the session by the final decision. A failure before confirmation releases the group and returns all session payments under the pilot terms. After confirmation, use the cause-based refund treatment in section 18. Track that refund until verified.

### No new matching engine

The session already supplies the date, duration, price and threshold. Vas checks club suitability and makes introductions by hand. There is no slot intersection, ranking, 30 minute grid or three club combination to implement in the pilot.

Keep requests for alternative dates as uncommitted leads. If the venue chooses another date, it creates a new session and each organiser decides afresh. Moving an existing conditional commitment requires explicit acceptance of the changed terms.

The system automates the arithmetic, permissions, capacity, deadlines and notifications. It records who made the introduction and why the venue accepted it. Those controls remain necessary even when the introduction itself is manual.

## 15 Manual introductions and capacity rules

### A small checklist before an invitation

| Check | Pilot requirement |
|---|---|
| Activity and format | Club wants this actual venue approved session |
| Date | Organiser confirms the published date suits the group |
| Numbers | Exact requested places fit remaining capacity |
| Viability | First club can wait; a second club must bring the total to the minimum |
| Price | All in group total is understood and acceptable |
| Payer | A plausible organiser or treasurer payment arrangement exists |
| Practical arrangements | Organiser checks personal arrangements directly with the venue |
| Disclosure | Contact introduction requires permission; roster stays private |

Qualify B as an interested, compatible lead before inviting A to commit. B's later request and commitment remain its own decision. Vas records the proposed session, source, introduction time and outcome. Venue approval remains separate; an operator cannot commit a group.

### Make concurrency safe

At most two clubs can hold live allocations. If seven places are committed, a proposed second group of eight cannot complete this pilot session. Ask whether either club can genuinely increase its quantity, choose a different second club or offer a different session. Never invent the additional person or introduce a third group to hide the failed assumption.

An invitation alone reserves no capacity. Commitment atomically checks the current session version, venue approval, deadline, held places and club limit, then reserves the exact allocation. Two people opening old links cannot both acquire the same remaining places.

One plan can have only one live session allocation. Requests may remain available as leads, but no plan may commit to two alternatives. A club may legitimately have separate plans for different activities.

### Handle withdrawal deliberately

Before payment opens, a permitted withdrawal releases places and changes the count. If it breaks the minimum, cancel the scheduled payment opening and return to waiting until fill_by. Never open payment on an obsolete contributing set. After payment opens, freeze new commitments and require venue review. Do not roll the session into a new cycle of indefinite conditional commitments or erase received money.

After confirmation, capacity changes use an amendment. Keep the original booking valid while that amendment is proposed. The venue's external diary remains an operational check as well as a Sila resource constraint.

## 16 States people can understand

### Keep the current actor visible

Store request approval, commitment, finance and delivery separately. Derive the viewer's status from those records. The displayed count must explain what it measures.

| Status | Meaning | Next action |
|---|---|---|
| Draft | Unsent club details | Organiser finishes request |
| Waiting for venue approval | Submitted request; no commitment | Venue approves quantity or replies |
| Review conditions | Club approved; places not reserved | Organiser decides whether to commit |
| Waiting for more places | Current conditional allocation; minimum not met | Vas recruits while organiser can see the fill date |
| Payment scheduled or delayed | Minimum met; staffed release pending or blocked | Recheck conditions; if blocked, notify both clubs with owner and next update |
| Deposit due | Payment window opened | Group payer pays the venue by pay-by |
| Verification pending | Payment reported; actual receipt not yet checked | Venue checks by verify-by; no automatic late flag |
| Waiting for another deposit | Own condition satisfied; other group still outstanding | Remaining payer or venue verifies |
| Waiting for confirmation | Deposits verified; final venue checks remain | Venue confirms or resolves blocker |
| Confirmed | Immutable checked booking exists | Organiser shares details and pays any later balance |
| Balance overdue | Actual payment default established after receipt check | Venue issues notice, allows remedy and records its decision |
| Change proposed | Amendment pending against original booking | Affected organisers and venue decide |
| Not proceeding or cancelled | Conditional session failed or booking cancelled | Named refund or alternative owner |

Use Request places for an enquiry and Commit conditionally for the agreement. After that, show the exact deposit and its own due time. Avoid a generic progress percentage that hides the difference between commitments and receipts.

The session count sums current conditional allocations. Requests, invitations, member interest and reported payments do not add places. A venue verified receipt changes a financial condition, not headcount.

A closed session stays in history. Preserve the terms, actions, reason and financial resolution. A return from an old email shows the current state and explains the relevant change.

The worker can close an unfilled session at its fill deadline. At the final decision, an unconfirmed session cannot quietly become confirmed or keep collecting deposits. Escalate, stop further payment requests and follow the failure and refund procedure.

## 17 Confirmation changes and cancellation

### Confirmation is a checked venue action

Only the venue can confirm. The server checks current commitments, minimum, verified deposits, resource validity and a current external diary check, then saves the snapshot and notification outbox. Retain a valid receipt if confirmation is blocked. Email failure cannot undo the booking.

| Situation | Required behaviour |
|---|---|
| Session reaches fill deadline below minimum | Close, release commitments and offer an actual alternative |
| Club pay-by passed | Check receipt time during verification period; do not cancel for a staff checking delay |
| Venue verify-by missed | Escalate the venue task; preserve reports and receipts; resolve before final decision |
| Confirmed balance missed | Verify actual receipt, send the agreed notice, allow the remedy period and record a cause-based decision under section 18 |
| Money arrives after closure | Record it and track return or an explicitly agreed new booking |
| Venue changes date or price | New terms and fresh affected organiser acceptance |
| Club withdraws after payment opens | Apply the accepted policy and reassess viability without automatic repricing |
| Venue cannot deliver for its own reasons | Record venue cause; refund each club's deposit and balance in full |
| Extra places requested | Check capacity and agree a priced amendment |
| Club member drops out | Organiser manages its agreed allocation; invoice does not silently change |

### Preserve the existing agreement

Retain enquiry edit history. Material changes after commitment need a new version and affected organiser acceptance; the original booking stays valid while an amendment is pending. Shared date or format changes need every affected organiser's approval. Practical directions can change without changing commercial terms. Keep private records separate and corrections linked to the original obligation.

Provide offline practical details and venue contact. Record both parties' delivery feedback, remaining work and willingness to repeat. Disputes stay in review.

### Leave time to remedy an unpaid balance

Proposed timetable: balance Friday 13 November noon; verification and any default notice Monday 16 noon; remedy payment Tuesday 17 noon; remedy verification Wednesday 18 noon; venue default decision at 12:15. Export final practical details by 12:30, over 24 hours before Thursday's workshop.

Venue and organisers approve this cash schedule before commitment, including a balance potentially due one day after the latest confirmation. Test it in the three organiser walkthroughs. Longer collection, remedy or supplier lead times require earlier dates before publication. A late notice cannot shorten the agreed remedy. Do not cancel automatically or defer the sequence to workshop day.

Plan another session creates a fresh plan. The chosen fee rule applies independently of its booking channel.

## 18 Money receipts and refunds

### Keep financial facts separate

The organiser pays the venue. Sila neither collects card details nor holds funds in this pilot. The club can forward the venue's payment instructions to its treasurer. Its organiser remains responsible for the agreed allocation; forwarding an invoice does not transfer the agreement.

| Record | Meaning | Authority |
|---|---|---|
| Payment opened | Minimum reached and exact deposit instructions available | Server event with a dated deadline |
| Organiser payment report | Someone says they paid an amount with a reference | Unverified until the venue checks |
| Verified receipt | Actual received_at and later verified_at against deposit or balance | Authorised venue finance role |
| Refund due | A failed or cancelled session requires return of money | Derived obligation with a named venue owner |
| Verified refund | Return of funds is supported by a venue record | Authorised venue finance role |

Use an append only ledger. Corrections reference the original entry. Require a receipt identifier distinct from the invoice reference and unique within the venue, so repeating a receipt cannot count the same money twice. Keep amount, currency, actor, evidence and date.

Classify each obligation as deposit or balance. Staff must check actual receipt before alleging default; their verification delay does not make a timely payment late. Confirmation remains in force until an authorised cancellation or amendment.

Calculate per person totals and percentage deposits on the server. Round a percentage deposit half up to the nearest penny once per group; the balance is the remaining exact amount. Partial payments and overpayments stay visible for reconciliation.

### Separate venue failure from club default

Before confirmation, session failure releases both clubs and refunds all payments. After confirmation, a venue-caused delivery failure refunds every club's deposit and balance in full. The person pressing Cancel does not determine the cause.

If a club remains in payment default after a valid notice and remedy period, apply its reviewed terms to that allocation. Record the lawful assessed charge and return payments above it; do not automatically forfeit the deposit or promise that club a full refund. Refund a nondefaulting club in full if its session is consequently cancelled. It never inherits the other club's debt or a higher price. Charges need a fair loss assessment, mitigation and no double recovery. Review the actual agreement before money; this is proposed pilot policy. [13]

Store cause, affected allocation, terms version, notice, remedy, decision, charge evidence and refund due per club. The venue returns money; target five business days from closure. Track completion separately. Sila earns no fee on cancellation charges.

## 19 Privacy permissions and direct access contact

### Keep personal access arrangements with the venue

The pilot has no member accounts, roster, personal access-note field, consent form or access-note storage. Remove those features from the schema, endpoints, screens and tickets. Publish factual venue access information and a direct venue phone or email. The person discusses individual arrangements with the venue outside Sila. Do not copy that conversation into the plan.

The venue confirms suitability directly with the organiser before approving places. Sila records approval and its time, without recording a diagnosis or the personal arrangement. An activity question must not ask for medical details. Booking must work without disclosing health information to Sila.

### Protect the booking records we do hold

Venue membership grants access only to that venue. Organisers see their own plan, obligation and messages plus the session aggregate. Other clubs cannot see invoices, contacts or messages. Operations access is scoped, audited and revocable; removed staff lose access on their next protected read or command.

Health or disability information can still arrive accidentally in ordinary messages. It may be special category data. Restrict access, stop onward copying into notifications or exports, and have the privacy owner resolve redaction, deletion or a documented lawful handling route. Intended processing needs both an Article 6 basis and Article 9 condition. Do not claim the absence of a form prevents all such disclosure. [5] [6]

Exclude sensitive accidental content from ordinary email, logs, search, public summaries and AI tools. Keep the original incident evidence only where justified under the agreed retention and incident process.

Any later personal access-note feature is a separate product and privacy decision. It would need a suitable person-facing consent and withdrawal route, authority checks and protected storage before implementation. None is part of this pilot backlog. [7]

## 20 Platform terms and legal responsibilities

### Make the operating entity and roles clear

Before live invitations, identify Sila's contracting legal entity and privacy contact in the platform terms and notice. Do not assume the brand name identifies the data controller. Document who determines each processing purpose; controller and processor status depends on the actual activity and decisions. [8]

| Activity | Proposed responsibility to confirm before launch |
|---|---|
| Sila accounts, introductions, security and service administration | Sila operating entity as controller for its own purposes |
| Venue delivery, its invoices and its customer records | Venue as controller for its own purposes |
| Any processing done solely on venue instructions | Assess processor role and put the appropriate contract in place |
| Shared decisions about processing | Assess whether a joint controller arrangement is required |

These are design assumptions to validate against the real service and contracts. Publish the resulting role allocation, recipients, lawful bases, retention periods and rights route. Record providers, storage locations and overseas support access for the corresponding assessment.

### Version Sila terms as well as venue terms

Record acceptance of the relevant Sila platform terms version. Those terms cover account authority, the conditional booking process, Sila's role, venue payment responsibility, support, complaints, cancellation handling and the limits of each party's authority. Venue terms govern the experience itself; they do not replace Sila's own agreement.

The separate venue agreement records trial dates, the chosen paid continuation, source exclusions and refunds. Compare the proposed 12 month repeat fee with a fee on the first delivered booking only and paid coordination in interviews; select one before paid use. If repeats are chosen, include the delivery-based clock and off platform reporting. No fees apply without a signed agreement. Keep its version and acceptance history.

### Complete the operational checks

Vas owns the ICO fee assessment and records payment or the applicable exemption. Organisations using personal information generally need to pay unless exempt; do not assume a free pilot is automatically exempt. [9]

Complete a privacy risk assessment, retention schedule, incidental sensitive-data procedure, data request and breach handling procedure before live data. Obtain appropriate review of the actual platform and venue agreements. Do not treat this product specification as the executed legal documents.

Marketing permission remains separate from accepting necessary service terms and must not be preselected. Personal access arrangements go directly to the venue; no health disclosure to Sila is a condition of booking.

## 21 What the pilot builds and handles manually

### Automate commitments rather than introductions

| Capability | Product responsibility | Manual responsibility |
|---|---|---|
| Venue preparation | Draft, validation, preview and publication gates | Vas prepares; venue approves |
| Dated session | Price, minimum, capacity, deadlines and current count | Venue chooses viable terms and diary hold |
| Club request | Retained draft, verification, plan and source | Organiser provides real numbers |
| Introduction | Record source, permission and outcome | Vas recruits and chooses a suitable session |
| Club approval | Approved quantity and current terms invitation | Venue decides suitability |
| Conditional commitment | Exact allocation, terms, capacity and count | Organiser commits for its club |
| Payment opening | Minimum trigger, full window and notification | Venue supplies actual payment route |
| Receipt and refund | Ledger, evidence, reminders and blockers | Venue receives, verifies and returns money |
| Confirmation | Enforce all prerequisites and preserve snapshot | Venue checks its external diary and confirms |
| Operations | Pause, audit, attention queue and exports | Vas handles customers; named engineer handles incidents |
| Trial evidence | Timestamps and source export | Vas records baseline, effort and counterfactuals |

The pilot includes ordinary messages, role isolation, platform terms acceptance, incidental sensitive-data handling and a direct venue access contact. Personal access-note storage and consent forms are excluded from the build.

### Defer the rest

Defer automated candidate search, slot intersection, ranking, three club support, flexible pricing, member RSVPs, individual payment collection, payment custody, live diary integration, multi currency support and generic private hire setup.

AI assistance is unnecessary to test the job. It cannot decide who is committed, how much is owed or whether a session is confirmed. If later used to extract a draft request, a person must approve the facts and the model must not receive private messages.

Manual work is counted openly as part of the service cost. A screen must not claim that venue approval, receipt verification or availability is automatic when a person performs it.

## 22 Architecture and operational foundations

### Keep one maintainable application

Inspect the hackathon build before estimating. A practical stack is the existing TypeScript and Next.js application with Supabase Auth, PostgreSQL, private storage, managed hosting and a durable worker, provided it passes the required checks. Reuse sound components and replace mocked booking logic.

The browser sends commands to server handlers. They check identity, record permission, current version and rules. Protect every server action and data access path. Row level security provides another boundary; privileged keys stay in narrowly scoped server code. Private downloads require their own authorisation. [1] [2]

### Use transactions for consequential decisions

Lock session, resource and affected plan records in a consistent order. Recheck database time, club limit, capacity, terms and minimum before committing. Combine transactions with unique live plan allocations, unique venue receipt identifiers and constraints preventing overlapping exclusive resource holds. [3]

Write the domain change and an outbox event in the same transaction. Workers send notifications with bounded retries and deduplication. Every reminder rechecks the current state, so a closed session does not keep requesting deposits.

Reaching the minimum schedules one earliest eligible 11:45 opening, using the same-day cutoff in section 12. At release, recheck the current set, deadline feasibility and pause status atomically. Preserve minimum_reached_at, payment_scheduled_for, actual payment_opened_at, pay_by and verify_by separately. A withdrawal does not reset them automatically. A valid receipt is retained even when a confirmation attempt returns blockers.

### Operate and recover the pilot

Keep staging and production separate. Use reviewed migrations, secure sessions, rate limits, protected caching and verified email sender configuration. Validate file type and size, restrict evidence access and keep tokens and personal notes out of logs.

Monitor failed commands, notification delay, unverified receipts and deadline failures. Vas's independent operations permission can pause new commercial actions; it cannot change agreed terms or verify a venue's funds. Resuming requires a recorded reason and the appropriate owner.

Target at most 15 minutes of database loss and restoration within four hours, using an actual service configuration that can meet those engineering targets. Back up file objects separately from the database. Supabase database backups do not include their stored file bytes. [4]

Rehearse restoration with a private file, current booking and processed job. Reconcile external payment evidence before replaying work. Keep an offline practical booking summary available for each imminent event.

## 23 Records and field validation

### Store only what this journey needs

Use server generated identifiers, timestamps and integer versions on mutable records. Validate every command on the server. Money uses GBP minor units; all times preserve the venue's IANA time zone and concrete UTC instants.

| Record | Essential fields and checks |
|---|---|
| Venue | Approved name 2 to 120 characters, address, time zone, coordinator and roles |
| Offering | Title 3 to 100, approved description and inclusions, duration 30 to 480 minutes |
| Session | Start and end, price_minor, minimum, capacity, fill_by, decision_by, calendar version, payment schedule and terms version |
| Session validation | Positive price; minimum at most capacity; at most two clubs; feasible release and verification; seven-day notice; venue approval for the hold and running at minimum without public top-ups |
| Resource hold | Resource and interval, checked_by, checked_at and hold expiry at least decision_by |
| Club plan | Club name, verified organiser, requested exact quantity, source and selected session |
| Venue approval | Authorised coordinator, approved quantity and terms version; no capacity reservation yet |
| Commitment | Exact allocation and money, organiser, terms versions, accepted decision_by, maximum wait 21 calendar days, time and withdrawal |
| Financial entry | Allocation, deposit or balance, amount, currency, received_at, verified_at, receipt ID, evidence, actor and correction link |
| Confirmation | Session and group snapshots, current resource check, venue actor and time |
| Operations and audit | Command, actor, affected version, reason, pause scope and outbox key |
| Payment and follow-up | Opening, pay and verify times; balance due, notice, remedy pay and verify times, default decision, cause, assessed charge and refund per allocation |

The pilot's reference payment window is five calendar days. A venue can choose a longer one before publication; validation moves the latest fill date earlier. Reject a shorter window in the pilot rather than quietly truncating it.

Commitment quantity must fit venue approved places and current capacity. A second club must bring the session to its minimum. Reject ambiguous or past time entry and preserve the user's draft after errors.

There is no personal access-note record. Public venue access facts are separate from private club plans. A public summary must not inherit private fields. Handle accidental sensitive messages through section 19.

Store a plan reference before confirmation. Create the booking reference only in the successful confirmation transaction. Keep both linked thereafter.

## 24 Application contracts

### A small explicit command surface

Every write carries an idempotency key and a verified actor or scoped draft token. Changes to existing records require expected_version. The server derives permission and financial calculations rather than trusting a client user_id or total.

| Command | Important request | Authoritative result |
|---|---|---|
| POST /sessions | Venue, slot, price, minimum, capacity, deadlines, terms and hold | Validated draft version |
| POST /sessions/{id}/publish | Expected version, approved gates and venue actor | Published session or named blockers |
| POST /plans | Session, club, quantity and contact | Saved draft and verification return |
| POST /plans/{id}/approve | Venue actor, quantity and current terms version | Commitment invitation; no held places |
| POST /plans/{id}/commit | Current versions and exact approved quantity | Conditional allocation and computed next action |
| POST /plans/{id}/withdraw | Current version and reason | Release or policy review; current count and finance retained |
| POST /allocations/{id}/receipts | Deposit or balance, amount, received_at, receipt ID, evidence and confirm_when_ready | Saved receipt, independent verified_at and confirmation or blockers |
| POST /sessions/{id}/confirm | Current version and external diary check | Immutable booking or unmet prerequisites |
| POST /operations/pause | Authorised operator, scope and reason | Commercial intake paused with audit |
| POST /bookings/{id}/amendments | Base version and proposed changes | Pending amendment; original stays valid |

The commitment transaction records minimum_reached_at and schedules one midday opening when the minimum is met. It returns payment_scheduled, not deposit_due. The authorised worker rechecks conditions at release and creates actual payment_opened_at, pay_by and verify_by once. Notification delivery cannot reset them.

Example: A commits seven at GBP 35, with total_minor 24500 and deposit_minor 6125. B commits nine on 4 November at 11:00. The result is payment_scheduled for the next business day at 11:45. After release, both read models show deposit_due, pay_by 10 November at 12:00 and verify_by 11 November at 12:00, with each club's own amount.

Use 422 for field errors, 409 for stale terms, closed intake or capacity conflict, and a neutral 404 for unauthorised records. Repeating a key with the same payload returns the original result; a different payload using that key is rejected. Refresh the current read model after a replay.

A valid receipt returns success with the receipt retained even when confirmation_blockers is nonempty. There is no endpoint allowing an organiser or operator to mark their own payment verified.

## 25 Developer backlog for one complete booking

### Build the same path from end to end

P0 tickets are required for the shared live pilot. Daksh estimates after inspecting the repository. Gate A in the product brief establishes demand first. Gate B proves an ordinary secure booking; Gate C adds two club commitments. Vas supplies approved facts and observes the real tasks.

| Ticket and dependency | Deliverable | Acceptance example |
|---|---|---|
| P0 01 Audit and identity | Hackathon audit, migration plan, auth, memberships, private storage and isolation | Venue B cannot fetch Venue A's plan; revoked staff lose access |
| P0 02 Dated sessions; 01 | Prepared draft, fixed price, deadlines, hold, coverage gate, preview and publish | Invalid fill and decision dates cannot publish; coordinator reviews one real draft |
| P0 03 Club request; 02 | Short request, saved draft, verification, source and venue conversation | Lost signal produces one retained request; another date remains on request |
| P0 04 Approval and commitment; 03 | Venue approved quantity, current session and platform terms, conditional copy and atomic allocation | Seven conditional places do not look confirmed; a stale invitation cannot overbook |
| P0 05 Minimum and payment; 04 | Threshold, same-day cutoff, staffed release, full window and separate verification | Monday 09:00 minimum opens Monday; Friday 11:00 waits until Monday; neither loses payment time |
| P0 06 Receipt and confirmation; 05 | Payment reports, verified ledger, receipt deduplication, blockers and venue confirmation | A duplicate receipt cannot double payment; last valid receipt can confirm after diary check |
| P0 07 Changes and closure; 06 | Withdrawal, cause-based refunds, balance notice and remedy, amendments and delivery | Defaulting and nondefaulting clubs receive distinct assessments; original terms survive a proposed change |

Produce an ordinary single club booking first, using a club large enough to meet the minimum. Extend that same session to two clubs. Do not build all dashboards before an organiser and coordinator can complete the journey.

Keep synthetic contacts and payment evidence in staging. No demo booking enters production counts. A ticket is complete when its permission, consequential failure and recovery behaviour work in the intended environment.

The club's member collection remains outside the pilot. Its measured delays belong in the acceptance review of ticket 05, so an apparent UI success cannot hide a failed payment workflow.

## 26 Backlog for operations privacy and release

### Finish the controls the manual service needs

| Ticket and dependency | Deliverable | Acceptance example |
|---|---|---|
| P0 08 Manual introductions; 03 and 04 | Operator session selection, source evidence, venue approval and optional contact introduction permission | Vas can prepare a second club invitation but cannot commit for it |
| P0 09 Privacy and terms; from 01 | Entity and role notices, platform terms, ordinary record isolation, retention and incidental sensitive-data handling | Other venues cannot read messages; booking works with direct venue access contact and no health-note form |
| P0 10 Jobs and operations; from 03 | Outbox, retries, deadlines, attention queue, Vas pause permission, scoped resume and incident audit | Vas pauses new commitments from her phone while existing booking details stay accessible |
| P0 11 Measurement and commercial records; 05, 08 and 10 | Introduction ledger, repeat scope, payment timings, reason codes, founder minutes and exports | Off platform reported repeats retain the original source window; payment delay includes unpaid plans |
| P0 12 Recovery and release; 07, 09 and 10 | Restore rehearsal, notification recovery, accessibility, concurrency and offline summaries | A restored booking retains terms and evidence; processed jobs are not blindly replayed |

Cut personal access notes and member consent forms from this pilot. The direct venue route is the only personal access route. Keep accidental sensitive-data handling in the ordinary message workflow.

### Defer automatic matching

There is no P0 search engine, slot grid, ranking or three club combination ticket. After the trial, consider automation only if manual introduction volume and observed repeated decisions justify it. Preserve the evidence needed to design that later feature.

Every ticket includes appropriate schema changes, server validation, role specific reads, accessible UI states and focused checks for consequential rules. Test security and agreement behaviour rather than mirroring harmless rendering code.

Vas owns venue discovery, recruitment, source evidence, commercial conversations, support and trial decisions. Daksh owns implementation correctness and recovery. Session coverage is a separate named rota agreed for actual dates, not an assumption attached to a job title.

No calendar estimate is credible until the existing build and first venue workflow have been inspected. Review a working slice with users, then estimate the remaining tickets and reserve time for the observed problems.

## 27 Checks before a live invitation

### Test correctness at the boundaries

| Scenario | Required outcome |
|---|---|
| Unrelated venue or group requests private data | Denied without revealing the record |
| Removed staff uses an open browser session | Next protected read or command denied |
| Old session invitation has a different price or date | Fresh review required; stale commitment blocked |
| Repeated request, commitment or receipt | One logical result; no duplicate allocation or money |
| Two clubs commit for remaining capacity concurrently | Capacity and two club maximum hold |
| Minimum is crossed by simultaneous commands | One scheduled release; one actual opening and pair of pay and verify deadlines |
| Minimum is reached exactly at fill_by | Inclusive commit accepted; next-day staffed release and complete window remain feasible |
| Minimum is reached after fill_by | Commitment rejected; no shortened payment window |
| First club waits two weeks for the second | Conditional allocation persists accurately to its disclosed deadline |
| A club withdraws after payment opens | No automatic clock reset or repricing |
| A payment report is submitted | It stays unverified |
| Final receipt arrives but resource check fails | Receipt retained; confirmation blocked |
| Vas pauses during an incident | New commercial actions stop; valid bookings remain readable |
| A health detail is entered in ordinary messages | Restrict and resolve it; no copying into emails, exports or AI |
| Deposit arrives by pay-by but staff verify later | Timely by received_at; verification remains a separate venue task |
| Deadline crosses a weekend, holiday or clock change | Approved calendar, local five-day rule and UTC conversion agree |
| Confirmed balance remains unpaid after remedy | Default cause and assessed charge recorded; other club receives full refund if its session is cancelled |
| Scheduled opening cannot proceed | Both clubs see no payment due, named owner, reason and next update |
| Session closes while a reminder retries | No misleading deposit request |
| Database and files are restored | Correct current agreement and evidence; controlled job replay |

Use domain checks for thresholds, money, deadlines and transitions, database checks for isolation and constraints, and browser journeys for ordinary and shared sessions. Include a failed session with a received deposit and tracked refund.

Keep the test with at least 100 simultaneous capacity commands. It checks correctness rather than market scale. Drop the speculative load target of 20 venues, 1000 plans and 25 users. Measure responsiveness on the actual pilot workflow and investigate slow saves.

Observe five new organisers and five coordinators where possible. Four of five per role should complete their main task without coaching. Any mistaken belief about confirmation, money, conditional withdrawal or privacy blocks launch. Verify the phone, keyboard, focus, labels and errors against WCAG 2.2 AA. [10]

## 28 Support hours and incident authority

### Staff the deadline moments

Each session needs a coverage record for scheduled payment opening, fill closure, club pay-by, venue verify-by, final decision and overdue balance review. Name the business owner, technical owner, backup, contact route and acknowledgement target. Both owners accept the actual dated shifts before publication.

The proposed window is 11:00 to 12:30 London on eligible release and deadline dates, with payment opening targeted at 11:45. Cover must already be approved before a minimum can qualify for same-day release. In November this is 16:30 to 18:00 in Delhi. It covers the jobs that can create an obligation, release places or close a session. Payment may not open outside an approved window. Routine commitments can arrive out of hours and queue the earliest eligible covered release.

The reference workshop stays at 18:00 to 20:00 on 19 November. Choose evening or weekend times according to club demand. Do not move adult club workshops into weekday afternoons to suit engineering cover. By the event the booking is confirmed and an offline practical summary is available. The venue supplies its on-site and day-of contact; Vas agrees customer cover separately. Evening technical cover is needed only where a specific live dependency requires it.

### Give Vas practical incident control

| Action | Authority and limits |
|---|---|
| Pause requests, invitations and commitments | Vas or authorised operator; reason and audit |
| Pause payment opening and further deposit requests | Operator; preserve and reconcile existing external money |
| Keep confirmed details available | Read access and exports remain available where safe |
| Correct code or restore service | Named technical owner and backup |
| Change dates, price or agreement | Normal venue and organiser acceptance rules |
| Resume after a serious incident | Recorded operator decision after technical resolution is verified |

Provide the pause control on a phone, independent of the ordinary session editor. Maintain a hosting or database fallback if the app is unavailable. Test Vas's access before invitations. During staffed windows, target acknowledgement within 15 minutes and a customer update within 30. Outside them, show the next window and venue operational contact.

Export practical booking details at least 24 hours before the workshop and name the copy holder. A service failure must not prevent the organiser finding the venue address or booking reference.

## 29 A complete worked session

### Seven places can wait for nine more

This example is hypothetical. Printmaking runs on Thursday 19 November 2026, 18:00 to 20:00 London, at GBP 35 per person. Minimum 16, capacity 20, maximum two clubs and 25 percent deposit. The venue accepts the conditional room and instructor hold and the unsold four places. Final decision is Thursday 12 November at 12:00. Section 12 makes fill_by Wednesday 4 November at 12:00.

Club A requests seven on 23 October and commits on 24 October. It explicitly accepts a final decision 19 calendar days later, within the 21-day pilot limit. Its plan shows seven committed, nine needed, no payment due, the next progress update and withdrawal before payment opening.

Club B commits nine on Wednesday 4 November at 11:00. The minimum freezes the contributing set. This 11:00 arrival is at the same-day cutoff, so payment is scheduled for the next business day. The worker rechecks conditions and opens at 11:45 on Thursday 5 November. Both clubs pay by Tuesday 10 November at 12:00. The venue verifies by Wednesday 11 November at 12:00, before the final decision.

| Club | Places | Total | Deposit | Balance |
|---|---|---|---|---|
| A | 7 | GBP 245.00 | GBP 61.25 | GBP 183.75 |
| B | 9 | GBP 315.00 | GBP 78.75 | GBP 236.25 |
| Session | 16 | GBP 560.00 | GBP 140.00 | GBP 420.00 |

A's deposit reaches the venue on Monday 9 November and B's on Tuesday 10 November at 11:00. Staff verify both on Wednesday 11 November and confirm after checking the diary. Their later verification does not make B late. Only now is booking SL1042 created; A previously used plan PL1042-A. Balances are due Friday 13 November at 12:00. The approved notice and remedy sequence in section 17 ends with a default decision on Wednesday 18 at 12:15, before final practical details are exported.

### Failures to rehearse

No B by fill_by: close on 4 November and release A without payment. A minimum-breaking withdrawal before release cancels the queued opening. A genuinely late deposit requires venue resolution under accepted terms. A balance default uses section 17's notice and remedy sequence. For a consequential cancellation, assess the defaulting allocation under section 18 and refund the other club fully. No automatic charge transfers to it.

If unresolved conditions prevent confirmation by 12 November, close and track full session deposits due back. The five-business-day refund target is Thursday 19 November at 12:00. Preserve any money arriving after closure.

If the proposed repeat model is selected, store the earliest eligible paid delivery with positive retained revenue as start_date. Its scope is delivery dates on or after start_date and before start_date plus 12 calendar months, using venue local dates and clamping a month-end anniversary. Confirmation alone, cancelled bookings and fully refunded bookings do not start it. If the starter is later fully refunded, recompute from the earliest remaining qualifying delivery and reconcile fee credits with an audit record. This free trial creates no fee or clock.

## 30 Design and usability

### Make the culture visible and the task obvious

Use real venue images and properly licensed artwork with an editorial character. Expressive typography can give discovery a sense of place. Keep the activity, date, price, minimum and conditional status visible before a long introduction. Avoid interchangeable luxury imagery or a generic social feed.

Working screens should be restrained: consistent session header, quantity and price summary, condition, next action, conversation and agreement history. Artwork should not compete with forms or obscure the difference between conditional and confirmed.

### Small continuities matter

A draft returns to the unfinished field. A verified email returns to the saved decision. A price change shows the previous value and the new total. An old notification opens the current plan. A failed payment report preserves its reference. A disabled confirmation explains the missing condition beside the action.

The commitment button must carry the condition. The organiser's own confirmed screen says You manage this club booking. A member update can instead say Your organiser manages the booking. Available dates follow published sessions; an extra requested date is explicitly on request.

### Test the costly misunderstandings

Ask new organisers whether the session is definitely going ahead, what they owe now, what they may owe later, how long they could wait and who collects member money. Ask coordinators to explain their fill date, deposit window, final decision, hold and responsibility for refunds.

Observe a first club waiting and a second arriving later. Build a clickable mobile prototype with the actual approved workshop and test three organiser payment walkthroughs, including a treasurer where relevant. Test waiting, commitment, payment, verification pending, failure and refund. Use actual venue imagery and a clear count of places still needed; reaching the minimum can be celebrated without saying confirmed. Observe a missed deposit and a missed balance. Track confusion and backtracking before adding more guidance. A person clicking the intended button while believing the event is confirmed is a failed test.

Use WCAG 2.2 AA as the target and test labels, errors, keyboard order, visible focus, contrast, text resizing and reduced motion. Aim for practical 44 by 44 CSS pixel touch controls as a product preference. [10]

The product should remove repeated coordination while leaving real decisions with the venue and organiser. Its value needs to survive the waiting period and payment step, not just a polished first enquiry.

## 31 Implementation and privacy references

Official sources support the technical, privacy and contract requirements. Pilot limits, fees, deadlines and thresholds are Sila policy. Checked 17 October 2026; recheck before implementation and live use.

1. Authentication and authorisation. Authorise all server commands and data reads. Read the Next.js authentication guide: https://nextjs.org/docs/app/guides/authentication
2. Database isolation. Scope row level policies and restrict bypass credentials. Read the Supabase row level security guide: https://supabase.com/docs/guides/database/postgres/row-level-security
3. Transactions and locking. Protect shared capacity with transactions, locks and constraints. Read the PostgreSQL locking documentation: https://www.postgresql.org/docs/current/explicit-locking.html
4. Recovery. Back up database records and stored file objects separately. Read the Supabase database backup guide: https://supabase.com/docs/guides/platform/backups
5. Health information. Access details can reveal health information even without a diagnosis. ICO guidance on special category data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
6. Conditions for processing. Special category processing needs an appropriate Article 9 condition alongside an Article 6 lawful basis. ICO rules on special category processing: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/
7. Explicit consent. Use an express, specific, informed statement and a demonstrable record; withdrawal must be supported. ICO guidance on valid and explicit consent: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/what-is-valid-consent/
8. Controller and processor roles. Assess who determines purposes and means for each activity rather than assigning roles by label. ICO guidance on controller and processor roles: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors/how-do-you-determine-whether-you-are-a-controller-or-processor/
9. ICO fee. Complete the fee or exemption assessment for the actual operating entity. ICO data protection fee guidance: https://ico.org.uk/for-organisations/data-protection-fee/
10. Accessibility. Verify WCAG requirements against the actual screens and user tasks. Read the W3C WCAG 2.2 reference: https://www.w3.org/WAI/WCAG22/quickref/
11. Business day calendar. Use the Scotland bank holiday calendar and record additional venue closure days as product policy. Read the GOV.UK Scotland bank holiday calendar: https://www.gov.uk/bank-holidays
12. Local time conversion. Use IANA zones and resolved UTC instants. Deadlines are Sila policy. Read the Python IANA time zone documentation: https://docs.python.org/3/library/zoneinfo.html
13. Contract fairness. Review cancellation and default charges against the actual parties, terms and losses. Read the CMA guide to fair customer contracts: https://www.gov.uk/guidance/writing-a-fair-contract-for-customers

---

# Repository status

*Not part of the guide. Updated 25 October 2026. No live pilot is released. Local demo and rehearsal records are synthetic; no actual payment or venue approval is represented.*

## Local hackathon discovery edition — 25 October 2026

The owner requested submission preparation for the Qloo hackathon and explicitly required local changes only. A separate `/discover` module now implements genuine Qloo interest search and place ranking, deterministic fictional-session eligibility, transparent result traces and private conditional sample requests. Five Edinburgh venue IDs were verified by name/address; two actual profiles returned different orders among four venues. A dedicated local PostgreSQL database on loopback port 57432 stores runs and requests under signed anonymous visitor ownership and RLS. It has no pilot credentials, session-write grants, payment path or notification delivery. Conditional requests reserve no places. An optional bounded Claude tool loop is implemented and mocked-tested; no live model run is verified without an Anthropic key.

This is an isolated hackathon experiment, not a change to the guide's live product policies (§07, §15–18, §22, §24, §27). Manual club introductions, venue approval, the two-club pilot limit and confirmation rules remain authoritative. The initial candidate was local only. The owner subsequently authorised a separate public repository and Vercel project; this fork records that deployment in `docs/submission/HOSTING.md`. No final hackathon submission was made. See `docs/submission/READINESS.md` for real evidence, checks and remaining external steps; DEC33 and RISK18 record the scope boundary. The hosted product interface described below predates this local discovery edition.

## Deployed today

The separate public Sila product interface at https://sila-demo-preview.vercel.app now has normal pages and organiser, venue, finance and operations dashboards with sample records. It replaces the primary guided tour. The account menu selects the supplied sample users; edits persist in that browser and synchronise between its tabs. A fixed 4 November sample snapshot supplies waiting, open-payment, confirmed and refund records without time-jump controls. The export has no booking API, Auth or database connection, and sends no email or money. New record URLs reload in the browser holding those records. See `docs/Sila_Customer_Demo_Walkthrough.md` for account roles, meeting scenarios and the persistence boundary.

The v5 reference from `Sila prototype launch.zip` supplies the hero, artwork composition, typography, paper palette and process section. `components/sila/application/` implements the experience index and detail, organiser plans/messages/agreement/payment history, venue overview/session editor/requests/finance/settings, operations introductions/intake/activity, and account/help pages. Sample commands in `lib/sila/sample-workspace.ts` reuse the pure publication, commitment, schedule, money and confirmation rules with stale-version/idempotency checks. They are a sample persistence adapter, not production authentication or a replacement for guarded database commands (§16, §19, §22, §24). Shared presentation primitives also style the authenticated venue, organiser and operations screens. The main home page opens this product interface, with sample routes under `/sample`; legacy hackathon demonstrations and the old tour are unlinked from it. The prototype's matching, public-participant, multi-date and payment assumptions were not adopted.

Landing-page completion follow-up: the v5 discovery composition now includes the process section immediately after the hero, a session index, two large alternating illustrated experience bands, a full organiser section, a venue section with current sample session/request counts, booking questions, a closing action and expanded footer. Audience actions open the corresponding sample workspace directly. The home page no longer gives account-switching instructions as its main venue content. Components are in `components/sila/application/landing.tsx` and `landing.module.css`, with navigation/footer integration in `application.tsx` and `application.css`. Headline wrapping is balanced in the shared hero stylesheet. Product rules and the sample persistence boundary are unchanged (§07, §13, §15–18, §24).

Prototype motion follow-up: the static customer export now loads the shared `Motion` and `SmoothScroll` runtime (`components/sila/motion.tsx` and `components/sila/smooth-scroll.tsx`). The shared hero and landing artwork use the supplied v5 prototype's wipe, fan and circular masks, staggered 1.05-second title reveals, pointer depth and differential scroll movement. Eased scrolling and artwork continuity into an experience page are active. `components/sila/application/art-navigation.ts` selects the largest visible copy of each plate and assigns unique native view-transition names; browsers without that API navigate normally. Repeated navigation clears transition names. Primary feature artwork links open the experience with the source plate still visible; destination masks are released before the shared-artwork snapshot, as in the prototype. If no source artwork is visible, navigation uses the normal page transition. `lib/ui/sila/motion-boot.ts` releases pre-paint masks if hydration fails. Reduced-motion changes stop the runtime, clear pending masks and timers, and leave all content readable; no-JavaScript rendering remains visible. The ZIP was checked against the extracted v5 source. This is presentation work; booking rules and the sample/browser persistence boundary remain unchanged (§16, §22, §27).

v5 layout follow-up: the home page now follows the `Sila prototype launch/Sila v5.dc.html` discovery screen section by section. The sequence is header; hero with featured card; How it works with a request/commit comparison; a filterable index (category, status, month) with per-session progress bars; one themed, layered artwork band per public session (art left, art right or full bleed); organiser and venue sections; and a footer with picture credits. The booking-questions and closing sections were removed to match v5. The prototype's proposal, affinity and confirm screens become `/s/:id`, `/s/:id/clubs` and `/s/:id/request`. The session page shows facts, deadlines, places by date, the venue's terms and commitment rules. The sharing page shows the session aggregate and the viewer's own club only, never another club's name or quantity (§931). The request page uses the existing `request` sample command and ends with the prototype's ticket print and stamp. Compositions and the session view model are in `components/sila/application/compositions.ts`; screens are in `landing.tsx`, `session-screens.tsx` and `plates.tsx` with `discover.module.css`. The customer export includes the new routes and the extra credited plates. Booking rules and the sample persistence boundary are unchanged (§07, §13, §15–18, §24).

The real pilot application and its new migrations have not been deployed to a hosted booking environment. The last recorded hosted booking app remains the **superseded Qloo hackathon build** at https://shared-cultural-bookings.vercel.app. Its sandbox routes remain alongside the new local pilot routes. Do not describe that sandbox as the Sila pilot.

## Implemented for the pilot

`lib/sila/` holds the pilot rules as pure, tested functions (`tests/unit/sila-schedule.test.ts`, `tests/unit/sila-rules.test.ts`):

- London time conversion and a versioned Scottish business calendar (§12, refs 11–12). Bank holiday dates must be rechecked against GOV.UK before live use.
- Payment clock: same-day cutoff, 11:45 opening on covered business days only, five local calendar days to pay, verify-by, latest feasible fill_by, seven-day final notice, 21-day maximum wait, balance remedy sequence (§12, §17).
- Money: per-group totals, deposit rounded half up once, exact balance (§18).
- Publication gates (§04, §23), commitment checks (§15, §23), withdrawal outcome (§15), receipt timeliness and confirmation blockers (§17, §18), plan status derivation (§16).

These reproduce the §29 worked session, the P0 05 acceptance example and the domain-level rows of §27. The Gate B implementation from `sila-gate-b` has now been integrated locally as uncommitted changes in the main checkout; the separate worktree is preserved.

The `sila` schema and guarded `sila_api` functions now connect the rules to verified Supabase Auth users, venue roles, private club plans, atomic allocations, payment scheduling/release, an append-only receipt ledger and checked confirmation. Organiser screens O1–O6 and venue/operator screens V1–V4 expose this path. Commercial writes and outbox events share database transactions. The worker supports scheduling, release, delay/reschedule, unfilled closure and final-decision closure; outbox delivery is not implemented.

Unconfirmed failure and venue-caused cancellation retain received deposits/balances and derive full refund obligations per allocation. Venue finance can record partial or full verified returns in an append-only refund ledger, with venue-unique references, idempotency and stale-version/over-refund checks. Late receipts remain recordable, including after an unfilled closure without payment opening. Unknown calendar versions do not stop safe closure: the target stays unresolved and an attention event is queued. Named person assignment, approved calendar administration, other cancellation causes and balance notice/remedy remain unfinished. Private practical downloads show confirmed amounts, current cancellation status and venue contact; organisers receive only their own club.

`npm run demo` starts a separate local Supabase project and a fictional workshop at http://localhost:3300/pilot-demo. Five demo identities use real local email verification. Synthetic venue terms and coverage are labelled; the venue role must review and publish the draft. Demo mode refuses hosted services, preserves existing records on rerun and never relaxes production payment timing.

## Ticket status

| Ticket | Status |
|---|---|
| P0 01 Audit and identity | Auth, venue roles, audited/revocable operator scopes and isolation implemented locally. Private evidence storage/downloads remain |
| P0 02 Dated sessions | Draft/review/publication, immutable published terms, versioned intake controls and V1/V2 implemented locally. Immutable calendar registry added for refund targets. Resource exclusion constraints, approved venue calendar administration and named coverage acceptance remain |
| P0 03 Club request | Retained draft, email verification/return, idempotent request, private plan/messages and O1 implemented locally |
| P0 04 Approval and commitment | V3/O3/O2 and locked allocation checks implemented locally; 100 competing commands tested. Full expected-version coverage across all mutable commands still needs review against §24 |
| P0 05 Minimum and payment | Stored threshold/scheduled/actual timestamps, worker release/reschedule/closure and O5 implemented locally. Durable notification delivery, progress reminders and attention queue remain |
| P0 06 Receipt and confirmation | Reports, venue receipt ledger/deduplication, preserved receipts on blockers, V4/O4 and immutable booking snapshot implemented locally. Private file evidence and receipt correction workflow remain; selected refunds are covered under P0 07 |
| P0 07 Changes and closure | Pre-opening withdrawal, unfilled/final-decision failure, venue-caused cancellation and per-allocation full-return refund tracking/verification implemented locally. Balance notice/default/remedy, cause-based club-default assessments, amendments, delivery feedback and named refund task ownership remain |
| P0 08 Manual introductions | Not implemented beyond request source and operator preparation |
| P0 09 Privacy and terms | Ordinary plan/message isolation and direct venue access contact implemented. Entity/notices, retention, sensitive-content incident handling and approved agreements remain |
| P0 10 Jobs and operations | Transactional outbox, payment worker and scoped audited intake pause/resume implemented. Delivery retries, reminder rechecks, attention queue and incident fallback remain |
| P0 11 Measurement and commercial records | Not implemented |
| P0 12 Recovery and release | Unit/DB/concurrency checks, browser rehearsal and private practical downloads added. Restore rehearsal, notification recovery, remaining failure journeys, manual usability/accessibility and live release approval remain |

Gate A: no real demand evidence. Gate B: automated synthetic local ordinary-booking and venue-failure/refund rehearsal only; see verification below. Gate C: two-club database/concurrency coverage and a synthetic 7 + 9 browser rehearsal; no real-club evidence or completed shared live release gate. None grants permission for live invitations.

## Local verification and remaining release work

- A fresh isolated local Supabase stack applies all migrations, including scoped operators, closure/refunds and private practical summaries. The latest unit suite has 214 passing tests, including 12 sample-workspace command tests. The earlier isolated database run has 164 passing tests, including 100 competing commitments, stale state, cross-tenant access, receipt/refund deduplication, partial/over-refunds, concurrent closure/receipts/refunds, late money after unfilled closure and final-decision failure.
- TypeScript, ESLint, production build and browser-secret bundle scan pass. Local SQL lint at error level reports no errors. Warning-level lint still flags implicit literal casts and volatility annotations in earlier pilot functions; these are not a clean warning-level result.
- Authenticated presentation follow-up: 14 browser tests pass (ordinary booking, tenant isolation, verified email access and shared 7 + 9 flow at desktop and 320px). The shared-flow fixture initially used the wrong local app DB setting; rerunning it with both app/admin connections on the verification stack passed. Earlier broader pilot evidence was 16 passed, with two local-demo-only cases intentionally skipped. It covers ordinary booking, retained invalid inputs, local Auth links, finance permission boundaries, receipt retention on a failed diary check, checked confirmation, venue-failure cancellation/full refund verification, private practical downloads and neutral page/API 404s. A separate shared journey exercises 7 + 9 commitments, distinct £61.25/£78.75 deposits, venue confirmation and organiser isolation. Both run on desktop and at 320px. Automated WCAG AA scans and no-horizontal-overflow checks pass on the checked sign-in, public session, organiser, venue and refund screens.
- Product UI with sample records: 14 browser checks pass locally (12 in the complete run plus the added two new-request checks in their targeted rerun), and all 14 pass in one complete anonymous run against the hosted alias, at desktop and 320px. They cover session search, account workspaces, venue approval followed by organiser commitment, persistence on reload, private plan visibility, actual-received receipt verification, separate diary confirmation, practical download, full refund verification, draft publication, a new record's refreshed URL, new organiser requests, private conversations, pre-opening withdrawal, introduction and intake pause. The new-request test edits draft deadlines within the 21-day maximum wait before publication; the rule stays enforced. Automated WCAG AA scans and no-horizontal-overflow checks pass on the checked pages. The browser adapter issues no booking network writes. That broader run was on preview deployment `dpl_BCNZxUxnXeRoWJVZuEme14uTcQs4`. The landing-completion check was on `dpl_Cr2GqRgekfG8D3oVswaBVwbAW1ny`; the alias now resolves to Ready motion-restoration preview deployment `dpl_Gyi62ERt3nbAh3yFG3XHWnbdtmZP` in the same separate sample project. A metrics definition-list issue and a hero button colour cascade were fixed during these checks; scans wait for entry animations to finish.
- Both production builds, TypeScript, ESLint and bundle scans are rerun for the product-interface change. The database policies and server command implementations are unchanged. Earlier database/worker/concurrency evidence above is retained rather than claimed as a new UI-only database run.
- Landing completion checks: six targeted production-export browser checks pass across desktop and 320px, covering the full composition, all landing images, experience links, both audience actions, existing search, and approval/commitment navigation. WCAG AA scans and no-horizontal-overflow checks pass. Two additional checks pass anonymously against the updated hosted alias, including audience actions and feature links on desktop and 320px. All 214 unit tests, TypeScript, ESLint, both production builds and both bundle scans pass again; database rules were not changed.
- Motion restoration checks: a full 22-check production-export browser run passes at desktop and 320px; eight targeted checks pass again after the shared-snapshot and artwork-link refinements. Six motion-specific checks verify changing reveal masks, pointer displacement, scroll displacement, native shared-artwork navigation and cleanup, live reduced-motion changes, no-JavaScript readability and no browser exceptions in the animation journey. The other 16 checks cover the landing and sample booking workspaces. Accessibility scans wait for animated panels and title lines to settle. All 214 unit tests, TypeScript, ESLint, both production builds and both bundle scans pass. The six motion cases and two landing cases also pass against the hosted alias. One mobile artwork fetch exceeded the original five-second test wait; the asset returned HTTP 200 and the mobile landing passed its targeted rerun with a 15-second image-load wait. The production files did not change for that test adjustment. The changes affect the shared presentation runtime; the database rules were not rerun or changed for this task.
- Separate local-demo browser runs: one passed and one environment-specific case skipped on each viewport. Synthetic labels, coordinator email sign-in, mobile overflow and automated WCAG AA scans pass. No production timing bypass was added: the booking rehearsal advances an isolated synthetic fixture and uses the internal clocked release; worker timing has separate database coverage.
- This is engineering evidence on synthetic fixtures. It does not replace actual approved terms, resource/coverage sign-off, payment walkthroughs, manual accessibility/usability tests or recovery evidence required by §27.

The next smallest engineering step is P0 10: deliver transactional outbox notifications with retry/idempotency, recheck current state before reminders and expose staffed attention tasks for missed verification/refunds. Then complete private evidence storage and the unfinished P0 07 flows. The customer demo is ready for product conversations; the live pilot remains unreleased until the other ticket rows and actual approvals are complete.

## P0 01 audit of the hackathon build

| Area | Current implementation | Verdict |
|---|---|---|
| Framework and hosting | Next.js 16, TypeScript, Vercel bom1, Supabase Postgres via pooler | Keep (§22) |
| Database access | `scb_app` login with no table privileges; guarded `scb_api` functions; RLS on every table | Keep the pattern for new tables |
| Idempotency and audit | `scb.idempotency_records`, `scb.audit_events` | Keep and extend to every write (§24) |
| Identity | Signed demo capability cookie over synthetic personas | Replace with Supabase Auth email verification (§05) |
| Tenancy | workspaces, organisations, memberships, operator_memberships | Adapt to venue coordinator/finance roles and a pause-only operator (§19, §28) |
| Matching | Qloo adapter, solver, agent, match_runs, evidence, anchors, qloo_cache | Remove (§14, §21) |
| Groups | groups, memberships, invites, briefs, references, consents | Remove; club plan with organiser contact only (§19) |
| Offer | experiences, quotes, slots | Replace with offering + versioned dated session, hold, coverage (§04, §23) |
| Booking | proposals, versions, decisions, per-participant reservations | Replace with plan → approval → allocation → ledger → confirmation (§16, §23) |
| Money | `NOT_COLLECTED` | Replace with deposit/balance ledger (§18) |
| Worker | match-run recovery tick | Replace with outbox worker for opening, closure, reminders (§22) |
| UI | sila v2 design (landing, showcase, demo) | Keep the design language; rebuild around V1–V5 and O1–O7 |

## Migration order

1. P0 01 identity — Supabase Auth email verification, venue membership roles, neutral-404 isolation tests.
2. P0 02 dated sessions — venues, offerings, sessions (versioned terms), resource holds, coverage dates; V1, V2.
3. P0 03 club request — plans with retained draft and email verification; O1.
4. P0 04 approval and commitment — approvals, allocations, `commit_allocation` locking session then plan; V3, O3, O2.
5. P0 05 minimum and payment — scheduled and actual opening written once by the worker; O5.
6. P0 06 receipts and confirmation — append-only financial entries with venue-unique receipt IDs, confirmation snapshot and outbox; V4, O4. **Gate B rehearsal.**
7. P0 07, then P0 08–P0 12; Gate C rehearsal. Hackathon tables are dropped in one reviewed migration once steps 2–6 replace them.

## Open decisions outside engineering

- Sila contracting entity, privacy contact and ICO fee assessment (§20) — Vas.
- Actual venue terms, cancellation policy, deposit percentage and balance schedule (§07, §17) — venue.
- Named coverage rota for real dates (§28) — Vas and Daksh.
