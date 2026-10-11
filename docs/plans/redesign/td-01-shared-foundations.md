# TD-01 — Shared foundations

## Contract and dependencies

None; approved R3 direction and existing implementation baseline.

Read [the current design](../../design/current/README.md), [appearance policy](../../design/current/appearance-policy.md),
[product](../../product.md), [architecture](../../architecture.md) and [backlog](../../backlog.md).
The owner authorized production implementation on 9 October 2026; current corrections are recorded in [implementation decisions](../../design/current/implementation-decisions.md).

## Outcome

Create one RN/native role and component system from all eight R3 references. Reuse matching scene assets/crops, opaque reading planes, shared primary/onPrimary and neutral structural roles. Category badges remain stable identity, not a page resolver.

## Implementation

- Apply the [10 October UX refinement](../../design/current/ux-refinement.md): owned
  input refs/compact title sizing, date-group context, semantic timing helpers,
  transactional foreground filters and synchronized scroll-reset token. Preserve
  canonical tokens/geometry and avoid global IME dismissal on viewport unmount.

- Define shared canvas/elevated/action/content/semantic roles for all eight pairs; validate actual contrast rather than sample isolated PNG pixels.
- Implement shared geometry, typography, wrapping, target sizes and scene cropping; use 56dp app prominent actions and the explicit larger R6 alarm minima.
- Keep production/readiness/native command callbacks and web fixture-preview isolation intact. Missing artwork must leave usable controls.
- Provide actual RN/Compose small-screen and 200% text examples, icon-role consistency and reduced-motion evidence. Consume individually approved assets from the [owner's production-art abstraction review](../../design/production-assets/style-decision.md); a style correction alone does not approve a final image.

## Acceptance and handoff

Validate all eight role pairs, actual 4.5:1 normal-text / 3:1 qualifying large-text and required control contrast, target geometry, long English/Chinese, large text and render isolation. Keep the exact Classic source separate from atmosphere palettes.

Record actual revision, delivered contracts, render/command evidence, unresolved
review conditions and pending physical observations using [the handoff protocol](../../handoffs/README.md).
Only backlog records live status. Template approval does not establish production
implementation or actual accessibility/device acceptance.
