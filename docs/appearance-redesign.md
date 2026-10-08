# Remilo time-of-day redesign contract

The approved direction is [the current design](design/current/README.md), consolidated
8 October 2026 under [A36](design/approved-time-of-day-realignment.json).
All eight R3 atmosphere images govern the visual language; approved page contracts
and discrepancy corrections govern composition and the established UX.

One global Sunrise/Sky/Evening/Night atmosphere applies across all app-owned pages
and native full-screen alarms. [Appearance policy](design/current/appearance-policy.md)
provides Automatic or four manual choices, independent System/Light/Dark brightness,
06–10 / 10–17 / 17–21 / 21–06 local bands, Automatic defaults and session/lifecycle guards.

Use shared matching canvas, elevated surfaces, action/content/neutral roles and
component geometry. Preserve expressive artwork/category identity; do not simplify
the product into an unrelated plain reminder app. Dark planes are corresponding
charcoal/slate/plum/navy, without alarm-specific blacks. Final abstraction of artwork
remains a later review. Android notifications retain supported OS templates.

The exact Classic ring/check/sun mark is one static identity. The previous eight-
palette catalog, Smart Colors, per-reminder chooser and task-specific alarm scenes
are retired from the active scope. Optional dynamic icons do not gate delivery.

Native scheduling, Stop/Snooze, due/event independence, nominal recurrence identity,
privacy, whole-backup preservation and guarded retries remain product contracts.
This redesign changes presentation, not ownership or reliability guarantees.
The [six-unit roadmap](plans/redesign/README.md) owns execution boundaries;
[backlog](backlog.md) owns status; [verification](verification.md) and
[device acceptance](device-acceptance.md) distinguish real checks from synthetic images.

[Earlier living specification](design/history/pre-r3-realignment/docs/appearance-redesign.md)
and approval records retain historical meaning. P01 prototype acceptance does not
complete the new foundations. Production remains brightness-only with the geometric
R icon until separately implemented. This PR updates documentation/reference assets
only; it changes no runtime interfaces, persistence format, build or exported icon.
