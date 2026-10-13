# Hackathon Submission and Demo Plan


D28 | Version 0.1 | 12 October 2026


Specify the proposed submission, judge experience and honest evidence.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Submission objective

Demonstrate how real cultural evidence helps separate communities discover a shared venue-approved experience, while deterministic rules and human approvals turn it into a reservation booking. The demo must show where Qloo changes a candidate or ranking, rather than attach it to a workflow that behaves identically without it.

## Official submission requirements

| Required item | Planned evidence |
| --- | --- |
| Externally hosted functional demo | Published HTTPS application usable without a private account; isolated judge sandbox. |
| Public code repository | Complete source, setup, migrations, synthetic seed instructions and environment template. |
| Project description | Problem, audience, coalition workflow, Qloo contribution, measured results and limitations. |
| Open-source licence | Visible source-code licence in repository About; proposed MIT after ownership review. |
| Working agentic integration | Real Qloo calls and bounded discovery-replanning workflow. |
| Video | Optional; judges must be able to try the product themselves. |

## Deadline

Official submission deadline: 30 October 2026 at 23:45 EDT, equivalent to 31 October at 03:45 Europe/London and 09:15 Asia/Kolkata. Target internal submission by 29 October at 18:00 UK time. Recheck the official schedule before submitting. The additional Jason Calacanis amount is described as an investment and is separate from the cash prizes.

## Judge walkthrough

| Step | What the judge does | What the demo proves |
| --- | --- | --- |
| 1 | Open a fresh sandbox with fictional venue and group records. | Public access and session isolation. |
| 2 | Review three group briefs and resolve genuine cultural references. | Real Qloo entity lookup; no invented IDs. |
| 3 | Run matching and inspect evidence plus quoted feasibility. | Qloo influences a shared option within delivery constraints. |
| 4 | Reject a slot or interpretation and request a new draft. | Replanning respects the objection and keeps uncertainty visible. |
| 5 | Publish as synthetic venue; accept as organisers; reserve individual seats. | Current-version agreement and real persisted reservation logic. |
| 6 | Confirm when readiness holds, then demonstrate withdrawal on a separate open offer. | Human authority, atomic state and recovery. |
| 7 | Inspect the comparison view and documented benchmark results. | Qloo contribution evaluated without invented outcome claims. |

## Fast reservation demonstration

Preload 23 explicitly synthetic reservations on the accepted fixture version, then let the judge reserve the final seat needed to reach 24. The sandbox identifies the seeded participants as fictional and never reports these actions as demand from real people. This avoids asking a judge to impersonate an entire audience.

## Demonstration data

Generate future slot and deadline values on sandbox reset so the demonstration remains usable throughout judging. All venue, community and booking records in the public sandbox are clearly illustrative. Cultural API responses can be genuine live or private cached evidence, with source and timestamp displayed. Public Git uses synthetic adapter fixtures only; it must not contain raw provider responses, keys, customer contact lists or unlicensed institution images.

## Claims and fallback

Report measured cases and limitations. Do not claim a paid booking, partnership, museum endorsement or improved attendance unless documented. A labelled synthetic fallback supports development but cannot replace the real Qloo integration in the final submission. If live access fails, use properly labelled permitted cache evidence and explain availability; fix a persistent integration failure before submission.

## Final checklist

- Open the hosted URL and repository in an external signed-out session.
- Confirm live provider calls, key environment, quota headroom and complete setup.
- Run release gates in D26 and verify isolation for concurrent judges.
- Ensure licence applies to team-owned code, not Qloo data or third-party assets.
- Submit the authorised final project and preserve support through judging.

## Related documents

D11, D22, D23, D24, D26

## Sources

- SRC07: Qloo official hackathon overview. https://qloo.devpost.com/
- SRC08: Qloo official competition rules. https://qloo.devpost.com/rules
