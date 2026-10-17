# Routine tile alignment and progress spacing

The owner supplied two current-app captures and a preferred compact mockup.
Source baseline: `951fb5d`. The captures establish the reported appearance, not
the installed APK's source identity. Task status belongs in the backlog.

The routine row had no leading completion-control column, so its event glyph and
title started 56 dp before an ordinary active reminder. Its stacked progress
block was between timing and repeat metadata with the ordinary 4 dp stacked gap.

## Implemented anatomy

The current shared ReminderRow remains the implementation authority. Active
routine rows now place a 24 dp informational ring in a 48 dp leading slot with
the same 8 dp normal gap as an ordinary completion control. Both use the same
first-title-line optical center calculation. With normal 12 dp card padding,
the event glyph starts 68 dp from the card edge and title text at 94 dp for both
types. More remains its fixed, borderless 48 dp target. Compact rows retain the
existing compact spacing variant.

The ring is inside the existing open-details Pressable. Its area opens the dated
routine, never whole-routine Done. It is decorative to TalkBack because the row
already speaks the native numeric progress. Selection uses the actual selection
checkbox; terminal rows retain the ordinary no-leading-placeholder rule.

Timing and applicable repeat/status metadata stay together. Progress follows as
a footer with 12 dp clearance (4 dp group gap plus 8 dp inset), aligned with title
text. It uses a 48 dp bar, 4 dp thickness, 8 dp count gap and existing 14 sp count.
Narrow content, longer counts and text scaling switch to count above a full-width
bar with an 8 dp gap. Text wraps instead of shrinking or clipping. The layout
uses the actual content width and inherited/system scale.

The ring and bar consume the existing clamped native-count model. Two clipped
half-arcs draw the ring with React Native Views; there are no raster assets,
new rendering dependencies, animations or duplicate progress records. Focus keeps
its existing stacked count/state and 6 dp bar. All surfaces, neutral glyphs,
accent/soft/outline roles, corners, padding and actions come from current tokens.
No authored content, scheduling, recurrence or whole-day lifecycle changed.

The mockup supplies hierarchy/alignment rather than literal colors or radii.
The [Material list anatomy](https://github.com/material-components/material-components-android/blob/master/docs/components/List.md)
and [Apple list guidance](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
inform primary/supporting content and hierarchy; the exact geometry is Remilo's
current contract. No claim is made that research establishes this particular
ring/footer arrangement as universally superior.

## Verification and limits

Focused TypeScript and lint passed. `npm run verify` passed 2,126 English/Chinese
messages, design/preserved-reference checks, TypeScript, ESLint, 313 shared tests
and 97 tooling tests. The existing frozen R8 unused-variable warning and approved
scene master-resolution limitations remain. The local log is
`verification/local/routine-tile-verify.log`.

The isolated fixture server was started for actual-component review. The browser
policy rejected acquiring the existing local preview tab, so no page observation,
screenshot or visual matrix was completed. No alternate browser or policy bypass
was attempted; the preview process was stopped. Source geometry and host checks
do not establish native pixel/layout acceptance.

`npm run release:prepare -- --json` passed. It repeated the shared checks and ran
the full 534-test native task (41 suites, zero failures/errors/skips), module/app
lint (zero errors; 27/20 existing warnings) and signed bundled release assembly.
Gradle completed in 4m 4s (57 executed tasks, 975 up-to-date). The log is
`verification/local/routine-tile-release.log`; the retained combined summary is
`verification/local/routine-tile-summary.json`.

Final local artifact, built at `2026-10-17T01:37:57.456Z` (16 October locally):

- `com.remilo.app` 0.4.0 (4), ARM64; min SDK 34, target SDK 36.
- Bundled JavaScript, not debuggable, signed with the existing beta identity.
- APK: `android/app/build/outputs/apk/release/app-release.apk`, 95,665,995 bytes.
- SHA-256: `11490b53260f6591eaa1dfde152e8a011c6ffee70f6b0b09512ea0a5b316547d`.
- Signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

No runtime source changed after assembly. This APK also includes the preceding
Agenda refresh-indicator repair. Post-documentation design verification and
`git diff --check` pass. No installation/distribution accompanies this repair.
The [UX-31 phone checklist](../device-acceptance.md#routine-agenda-tile-alignment-ux-31)
retains actual eight-pair EN/ZH, narrow/large-text, ring fractions, selection,
terminal rows, More and TalkBack observations.
