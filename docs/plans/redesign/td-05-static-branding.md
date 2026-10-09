# TD-05 — Static Classic branding

## Contract and dependencies

Approved Classic source/A01; independent of atmosphere implementation.

Read [the current design](../../design/current/README.md), [appearance policy](../../design/current/appearance-policy.md),
[product](../../product.md), [architecture](../../architecture.md) and [backlog](../../backlog.md).
The owner authorized production implementation on 9 October 2026; current corrections are recorded in [implementation decisions](../../design/current/implementation-decisions.md).

## Outcome

Replace the shipped geometric R with faithful exports of the supplied Classic ring/check/sun mark. One static identity; standard Android adaptive/monochrome treatment does not add app-controlled theme switching.

## Implementation

- Use [the Classic crop](../../../assets/brand/reference/icon-classic.png) and [original source board](../../../assets/brand/reference/source-icon-board.png) for fidelity. Preserve ring/check/sun proportions and finish; no generative redraw.
- Produce launcher/adaptive/monochrome/splash/notification exports with clean isolation, correct padding, masks and small-size readability.
- Keep app ID, signing, stable native notification/activity targets and build ownership unchanged. No palette variant catalog, launcher aliases or matching workers.

## Acceptance and handoff

Compare exports to the exact source, inspect circle/squircle/adaptive masks, notification alpha and actual small sizes, then verify signed-device launcher/splash/notification appearance. Export acceptance requires the faithful Classic production outputs.

Record actual revision, delivered contracts, render/command evidence, unresolved
review conditions and pending physical observations using [the handoff protocol](../../handoffs/README.md).
Only backlog records live status. Template approval does not establish production
implementation or actual accessibility/device acceptance.
