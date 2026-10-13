# Design System and Component Library


D18 | Version 0.1 | 12 October 2026


Specify shared interface tokens and component behaviour.


Status: proposed implementation specification. Application acceptance tests remain pending.


## Design direction

Use a restrained institutional feel with warm neutral surfaces and deep green actions. Typography and spacing should make terms easy to read. Cultural imagery may be used only with a verified licence and an accurate relationship to the venue; fabricated institutional branding is excluded.

| Token | Proposed value | Usage |
| --- | --- | --- |
| colour.text | #1C2421 | Primary text; readable against the canvas. |
| colour.canvas | #FAF9F6 | Page background. |
| colour.surface | #FFFFFF | Forms and content surfaces. |
| colour.primary | #245A45 | Primary actions; contrast must be checked in implementation. |
| colour.muted | #58635D | Secondary text. |
| colour.border | #D5DBD6 | Subtle boundaries; not relied on alone for meaning. |
| colour.danger | #A52424 | Blocking errors with text and icon. |
| colour.warning | #7A4A00 | Warnings and revision notices. |
| type.body | 16px / 1.5 | System sans-serif stack; no remote font required. |
| type.heading | 24 to 36px / 1.2 | Clear hierarchy without decorative slogans. |
| space.scale | 4 8 12 16 24 32 48px | Consistent responsive spacing. |
| radius | 8px | Controls and surfaces. |
| target | 44 by 44px preferred | Comfortable touch target; evaluate accessibility exceptions. |

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

Use short transition feedback only when it clarifies state. Respect prefers-reduced-motion. Never indicate acceptance, errors or provenance by colour alone. Contrast values in specs/design_tokens.json are proposed tokens and require measured verification.

## Component acceptance

The library is a specification, not an implemented Storybook. D21 defines tests for keyboard behaviour, screen-reader announcements, mobile layout and displayed money. Implement a minimal component showcase before the final demo review.

## Related documents

D17, D21
