# TD-05 — Static Classic branding

## Contract and dependencies

Approved Classic source/A01; independent of atmosphere implementation.

Read [the current design](../../design/current/README.md), [appearance policy](../../design/current/appearance-policy.md),
[product](../../product.md), [architecture](../../architecture.md) and [backlog](../../backlog.md).
The documentation PR does not execute this future production unit.

## Outcome

Replace the shipped geometric R with faithful exports of the supplied Classic ring/check/sun mark. One static identity; standard Android adaptive/monochrome treatment does not add app-controlled theme switching.

## Implementation

- Use assets/design-review/icon-classic.png and its source board for fidelity. Preserve ring/check/sun proportions and finish; no generative redraw.
- Produce launcher/adaptive/monochrome/splash/notification exports with clean isolation, correct padding, masks and small-size readability.
- Keep app ID, signing, stable native notification/activity targets and build ownership unchanged. No palette variant catalog, launcher aliases or matching workers.

## Acceptance and handoff

Compare exports to the exact source, inspect circle/squircle/adaptive masks, notification alpha and actual small sizes, then verify signed-device launcher/splash/notification appearance. Do not confuse the existing coarse review masks with final export acceptance.

Record actual revision, delivered contracts, render/command evidence, unresolved
review conditions and pending physical observations using [the handoff protocol](../../handoffs/README.md).
Only backlog records live status. Historical P01/P02 approvals remain historical
and are not prerequisites for generating an unrelated eight-palette catalog.
