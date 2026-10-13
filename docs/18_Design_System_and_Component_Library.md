# Design System and Component Library


D18 | Version 0.1 | 12 October 2026


Specify shared interface tokens and component behaviour.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Design direction

The interface follows the **sila** design (`Design/Sila v2.dc.html`, layered over the Classical design-system base in `Design/_ds/`): an editorial, book-like look on a parchment ground with hairline ink rules, Cormorant Garamond display type over Schibsted Grotesk text, and layered, matted art plates. Each programme takes a composition and a ground colour from `lib/ui/sila/art.ts`; the implementation lives in `app/globals.css` and `components/sila/`.

Art plates are public-domain or openly licensed works (credited in the footer of every page and beside each composition). They are decorative editorial art, never presented as a venue's collection, partnership or branding. Fabricated institutional branding remains excluded.

| Token | Value | Usage |
| --- | --- | --- |
| colour.ink | oklch(0.22 0.02 50) | Text, rules and primary actions. |
| colour.parchment | oklch(0.95 0.025 85) | Page background. |
| colour.ivory | oklch(0.97 0.015 85) | Panels (proposal, ticket) and text on dark grounds. |
| colour.oxblood | oklch(0.38 0.12 25) | Links, emphasis, small accent text. |
| colour.cinnabar | oklch(0.58 0.17 35) | "You" marks, large numerals, hover on large text only (fails AA at body size). |
| colour.jade / ochre / olive / indigo / rose | see `specs/design_tokens.json` | Programme grounds and shared-interest tiles. |
| type.display | Cormorant Garamond 300–400 | Headings and numerals; the larger, the lighter. |
| type.body | Schibsted Grotesk, 15px / 1.55 | Text and controls. |
| type.arabic | Amiri | The ṣila gloss only. |
| layout.max | 1480px, gutter clamp(16px, 4vw, 64px) | Page width. |
| breakpoint | 900px | Two-column hero, bands and forms above; one column below. |

Illustrative content (shared-interest percentages, companion groups, running orders, interest counts and group portraits) is labelled on screen until Qloo taste data and venue programme notes exist. "Register interest" is stored only in the viewer's browser and never counts toward a minimum.

A **demo showcase** (`/showcase/[id]`, data in `lib/ui/sila/showcase.json`, taken verbatim from the v2 design) shows seven demonstration experiences on the landing page and after the sandbox's real proposals, each labelled "Demo data". Its commitments are browser-only demonstrations: nothing is stored, reserved or charged. Page scrolling is eased with Lenis, off under prefers-reduced-motion.

## Components

| Component | Variants or states | Behaviour |
| --- | --- | --- |
| Button | primary secondary destructive loading disabled | Accessible name; prevent duplicate action; preserve focus. |
| MoneyField | GBP pence value with formatted display | Parse whole pennies; reject invalid or negative values. |
| DateTimeField | venue timezone and exact slot | Resolve DST ambiguity before submission. |
| ReferencePicker | searching choices selected unresolved failed | Selection stores actual provider ID and disambiguation. |
| ConsentChoice | purpose text version accepted revoked | Separate purposes; no preselected acceptance. |
| ExperienceCard | approved programme and quote | No invented image, affiliation or availability. |
| CoalitionSummary | included group summaries and coverage | No private identities or averaged-away rejection. |
| EvidenceDisclosure | live cached synthetic unavailable | Always show original timestamp where relevant. |
| ReadinessPanel | OPEN READY CONFIRMED EXPIRED CANCELLED | Reserved count, threshold and payment meaning. |
| RevisionNotice | previous and new version | Require explicit renewed action. |
| ErrorSummary | field errors and recoverable system failure | Focus first error; link to field; retain entered content. |
| EmptyState | none feasible or provider unavailable | Explain a supported next action. |
| DemoRoleSwitcher | venue organiser participant | Available only with scoped synthetic sandbox capability. |

## Implementation contract

Implement components in React and TypeScript, using semantic HTML as the default. Keep domain status enums shared with the API. Separate visual variants from authorisation; a hidden button is not a permission check. Each interactive component must expose accessible labels, focus states and error relationships.

## Responsive layouts

Use one content column on mobile and a maximum two-column decision layout on desktop. Avoid compressing comparison tables into unreadable columns; offer stacked comparisons with the same labels. Keep primary actions close to their relevant terms and visible status.

## Motion and colour

Motion follows sila v2: plates unfold, title lines rise, art drifts with scroll and pointer, and the reservation ticket prints (`components/sila/motion.tsx`). All of it is disabled under prefers-reduced-motion. Never indicate acceptance, errors or provenance by colour alone. Contrast values in specs/design_tokens.json are proposed tokens and require measured verification.

## Component acceptance

The library is a specification, not an implemented Storybook. D21 defines tests for keyboard behaviour, screen-reader announcements, mobile layout and displayed money. Implement a minimal component showcase before the final demo review.

## Related documents

D17, D21
