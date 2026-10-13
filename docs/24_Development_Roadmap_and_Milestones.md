# Development Roadmap and Milestones


D24 | Version 0.1 | 12 October 2026


Provide a proposed build sequence with dependencies and release gates.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Planning basis

This is a proposed two-person build plan starting after 12 October 2026. Dates are targets, not commitments. The product owner owns discovery, catalogue review, UX and claims; the engineer owns contracts, solver, data integrity and deployment. Confirm actual availability before turning this into a team schedule.

| Date | Milestone | Owner role | Deliverable | Gate |
| --- | --- | --- | --- | --- |
| 13 to 14 Oct | Product and API feasibility | Product owner and engineer | Venue and organiser discovery; request key; live search and fixed-universe query pass. | Do not build a cultural claim around an untested API mapping. |
| 15 to 17 Oct | Vertical slice | Engineer with product review | Auth, catalogue, group brief, Qloo adapter and synthetic sandbox work. | One real provider response reaches a labelled proposal. |
| 18 to 20 Oct | Coalitions and explanations | Engineer with product review | Deterministic predicates, ordinal utility, ranked alternatives and grounded reasons. | T04 to T08 pass. |
| 21 to 23 Oct | Booking lifecycle | Engineer | Versions, decisions, seats, readiness, confirmation, expiry and cancellation. | T09 to T14 pass with concurrency evidence. |
| 24 to 26 Oct | Usability and validation | Product owner and engineer | Accessible screens; paired benchmarks; proposed pilot tested if venue agrees. | Record findings honestly, including rejection. |
| 27 to 28 Oct | Release hardening | Engineer | Permissions, job limits, deletion, restore drill, clean setup and public demo. | All P0 release blockers closed. |
| 29 Oct by 18:00 UK | Internal submission target | Team representative | Public repo, licence, description, published URL and final walkthrough. | Submit early enough to recover from upload or hosting faults. |
| 30 Oct | Buffer and final check | Team | Recheck official deadline, links, deployment and provider key. | No scope expansion. |
| 31 Oct 03:45 UK | Official deadline | Team representative | Submission completed before this time. | Equivalent to 30 Oct 23:45 EDT and 31 Oct 09:15 India. |
| 2 Nov to 17 Nov 04:45 UK | Judging support | Engineer and representative | Keep demo and live integration available. | Monitor errors and maintain stable submitted behaviour. |

## Critical path

API access and valid catalogue mapping precede cultural-ranking claims. Identity precedes shared-group data. Quote logic and slot ownership precede reservations. Reservation integrity precedes venue confirmation. Public deployment and reproducible setup precede submission.

## Parallel work within the team

The product owner can conduct discovery and review programme mappings while the engineer builds the protected vertical slice. Both review errors and microcopy together. The schedule does not assume additional staff, venue partnership or access to production credentials.

## Contingencies

If live Qloo coverage is inadequate, narrow the catalogue and output domain while retaining explicit evidence. If API access is absent, a synthetic prototype can support development but is not a compliant Qloo-powered final submission. If payment implementation is proposed, keep it outside this release unless a complete separately reviewed design and validation fits the schedule.

## Related documents

D08, D23, D26, D28

## Sources

- SRC08: Qloo official competition rules. https://qloo.devpost.com/rules
