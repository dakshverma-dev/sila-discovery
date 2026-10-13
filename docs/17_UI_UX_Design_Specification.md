# UI UX Design Specification


D17 | Version 0.1 | 12 October 2026


Define accessible screens and interactions for the proposed reservation workflow.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Interaction approach

The interface should make a complex shared booking understandable without requiring users to understand APIs or optimisation. Start with the experience and its terms, then let people inspect the cultural reasoning. Use a calm editorial layout, clear labels and visible decisions. Keep practical requirements in structured fields.

| Screen | Content | Actions | Essential safeguard |
| --- | --- | --- | --- |
| Venue workspace | Programmes, quotes, slots, open proposals and reservation counts. | Create offer, approve anchors, publish, confirm or cancel. | Price, current version and NOT_COLLECTED always visible. |
| Group brief | References and declared meanings; cost, dates, expected size, access support and sharing. | Save draft, resolve reference, correct extraction, request suggestions. | External-query consent independent of sharing consent. |
| Proposal comparison | Up to three feasible alternatives with evidence and blockers. | Inspect rationale; choose an option for venue review. | No false probability badge or unsupported cultural connection. |
| Group decision | Exact published terms and approved summaries of partner groups. | Accept or decline current version; explain optional reason. | No participant commitment is created by organiser acceptance. |
| Participant invitation | Programme, venue, time, price, sharing and deadline. | Authenticate, accept conditions, reserve one seat. | No card entry; explicit reservation meaning. |
| Reservation status | Active seat, current terms, readiness and support route. | Withdraw before confirmation; contact venue after confirmation. | Never imply guaranteed delivery or payment. |
| Operator console | Job failures, catalogue approval and audit trails. | Support scoped exceptions; retry a failed run. | Privileged actions require reason and are logged. |
| Judge sandbox | Synthetic roles and reset control. | Try organiser, participant and venue actions in same isolated session. | Persistent demo banner and synthetic venue labels. |

## Form behaviour

- Save drafts without demanding every field at once; show required fields when requesting suggestions.
- Use explicit local date and time selection; display timezone next to the slot.
- Present entity disambiguation as selectable names, categories and context.
- Allow organisers to review and correct any LLM-extracted meaning or constraint before it becomes structured input.
- Use a distinct sharing choice: willing to share, private only, or ask us first. Only willing to share is solver-eligible.

## Proposal information hierarchy

Show programme and venue first, followed by date, all-in quoted price, shared-session description and reservation action. Secondary details explain required attendance, remaining capacity and evidence. Display a revision warning before accepting changed terms. Participant identity stays private across groups.

## Required microcopy

| Situation | Suggested copy |
| --- | --- |
| Reservation action | Reserve one seat |
| Payment boundary | No payment is collected here. Your reservation records your intention to attend at the displayed price. |
| READY state | Enough seats are reserved. The venue still needs to confirm. |
| CONFIRMED state | The venue has approved this reservation booking. Payment has not been collected. |
| Qloo outage | Cultural suggestions are unavailable. You can review the venue catalogue or try again later. |
| Unknown access support | The venue needs to confirm this requirement before we can suggest the session. |
| Demo banner | Judge sandbox. Venues, groups and bookings are illustrative. |

## Accessibility acceptance

Meet the N04 target on all core screens: visible focus, semantic headings, descriptive error links, status announcements, sufficient contrast, keyboard operation and reduced-motion support. Test at 320-pixel width and 200 percent text zoom. Voice must never become the sole input route.

## Research

Observe organisers completing a brief, participants interpreting reservation status and managers deciding whether to confirm. Measure comprehension errors, task completion and coordination time. Test with people who reject shared sessions as well as enthusiastic participants.

## Related documents

D06, D18, D21
