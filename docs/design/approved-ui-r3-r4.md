# Approved Remilo UI direction and R4/R5/R6 implementation corrections

Recorded 7 October 2026. Read this before changing visual foundations, Agenda,
Reminder details, the editor or native presentation. This is a dated amendment to
[appearance-redesign.md](../appearance-redesign.md), with human decisions recorded
as A18-A31 in the [approval ledger](approvals.md). Live task status remains solely
in [backlog.md](../backlog.md).

## Authority and scope

The owner accepts the R3 homepage direction and the overall R4 Details/Editor
template plus the approved R5 Sky/Evening variants, with the corrections below.
Generated images communicate composition,
identity and information hierarchy; arbitrary tint, spacing and shape differences
are not requirements. Use this text to resolve those discrepancies during actual
component work. Do not copy individual image pixels into unrelated components.

- [R3 homepage gallery](remilo-r3-atmospheres/gallery.html): Sunrise, Sky, Evening
  and Night, each in Light and Dark. This supersedes the old homepage visual
  direction. Final scenery should become somewhat more abstract later; the current
  images remain layout/identity references rather than final artwork exports.
- [Combined R4/R5 annotated gallery](remilo-r4-details-editor/gallery.html): ordinary details,
  overdue details with a postponed alert, creation with the keyboard open, and
  editing with notes and independent timing. The owner accepts this template
  while requiring explicit discrepancy and keyboard guidance.
- [R5 Sky/Evening variants](remilo-r5-sky-evening-details-editor/gallery.html): eight approved extensions
  of the same four Details/Editor states, with per-image discrepancy notes. The
  [combined gallery](remilo-r4-details-editor/gallery.html) contains all twelve
  R4/R5 representatives. Approval is recorded separately as A20.
- One global atmosphere, combined with independent System/Light/Dark appearance,
  should apply across app pages, details/editor/settings and all native full-screen
  alarm states, including privacy-safe pre-first-unlock presentation. Task-specific
  alarm environments and per-reminder appearance
  selection are deferred. Do not add a theme chooser to these forms.
- Android owns notification layout, expansion and many colors. Use supported
  branding/accent/content treatment where possible; do not promise the illustrated
  scene or custom bubble can replace an OS notification. Pre-unlock privacy and
  native Stop/Snooze ownership remain unchanged.
- Four named scene previews do not specify new automatic period boundaries,
  upgrade behavior or preference migration. Reconcile the older five-period/eight-
  environment planning before implementing that policy. Category glyphs/colors
  may remain distinct; they must not choose a different whole-screen atmosphere.

This amendment overrides conflicting old visual/task-specific appearance
instructions in P01-P10. Historical P01 approvals, source hashes, handoffs and host
evidence remain intact. P02 and affected production plans require focused intake
against the new direction; the screenshots do not complete those milestones.
Current scope is documentation and review annotations. No app behavior, native
migration, build, installation or physical acceptance has been performed here.

## Durable reference identities

The repository preserves the selected PNGs unchanged, along with portable prompt
provenance and image hashes:

- [R3 image hashes](remilo-r3-atmospheres/images.json) and
  [provenance](remilo-r3-atmospheres/manifest.json).
- [R4 image hashes](remilo-r4-details-editor/images.json) and
  [provenance](remilo-r4-details-editor/manifest.json).
- [R5 image hashes](remilo-r5-sky-evening-details-editor/images.json),
  [generation provenance](remilo-r5-sky-evening-details-editor/manifest.json),
  [per-image corrections](remilo-r5-sky-evening-details-editor/review-notes.json) and
  [A20 acceptance](approved-ui-r5-acceptance.json). A18/A19 evidence stays unchanged.
- [Acceptance scope](approved-ui-r3-r4-acceptance.json) records the owner statements
  and the exact preserved screenshot identities.
- [Per-image review data](remilo-r4-details-editor/review-notes.json) mirrors the
  corrections shown next to the images. This document owns the implementation
  rules; gallery notes must remain consistent with it.

These are synthetic raster previews, not actual RN/Compose render evidence.

For subsequent screen refinement, A25 explicitly makes **all eight R3 images**
the color/style reference set while retaining the established UX. The
[remaining-screen map](screen-refinement-map.md) and
[R7 Lists/Repeats specification](r7-lists-repeats-specification.md) apply this accepted
style to the next layouts. A26 authorizes their generation and
[A27](approved-ui-r7-outline-acceptance.json) accepts the overall UI/UX outline,
with decorative list icons provisional. The owner favors omission and requests
raising the choice during implementation; no custom list-icon authoring feature
is included. Associated raster hashes identify references, not immutable tokens
or separately reviewed pixels for every screen. Missing Night/state permutations
inherit the existing theme. Apply [the per-image corrections](remilo-r7-lists-repeats/review-notes.json).
Preserve this document's role/geometry/keyboard corrections and A24's matching
canvas/elevated-surface condition rather than reproducing incidental raster drift.

[A28](r8-settings-appearance-intake.json) continues refinement into
[R8 Settings/Appearance/permissions/Test alarm](r8-settings-appearance-specification.md),
with every R3 image as style authority and the established UX. A29 authorizes
generation; [A30](approved-ui-r8-outline-acceptance.json) accepts the direction/
templates shown before its response, with R8-08 a later supplement. Apply the
[thirteen-reference gallery's corrections](remilo-r8-settings-appearance/gallery.html)
and this shared contract. Exact pixels, actual implementation/accessibility,
storage/automatic policy and retry-safe Test commands remain separate.

[A31](r9-completed-trash-activity-intake.json) now continues with the proposed
[R9 Completed/Trash/Activity specification](r9-completed-trash-activity-specification.md)
and [fourteen review states](r9-completed-trash-activity-fixtures.json), using
every R3 pair and established history/recovery UX. Retain readable terminal text,
neutral structural glyphs, distinct Reopen/Restore and secondary origin returns.
Collection rows show status without invented action dates; details/Activity use
actual recorded events. Skipped Reopen and unconfirmed collection retry remain
documented implementation gaps. No new R9 images or template acceptance are claimed.

The [R6 visual specification](r6-alarm-postpone-specification.md) and
[eleven-screen annotated gallery](remilo-r6-alarm-postpone/gallery.html) extend this
direction to native alarms and app Postpone. [A22](approved-ui-r6-acceptance.json)
accepts R6-01/02/03/05/06/07/08 with the documented corrections, while rejecting
the plain R6-04. Generic reminder text before first unlock remains required;
the visual canvas still uses the global theme through a reviewed non-private,
native-safe appearance source. [A24](approved-ui-r6-themed-alarm-acceptance.json)
now accepts the four corrected R6-04 Dark atmosphere variants as starting templates,
with a background/color condition and later visual-polish flexibility.

A23 requires softer Dark surfaces matching the existing themes: charcoal,
slate, plum and navy, rather than a harsher near-black alarm palette. The same
scene assets and role tokens apply across pages. Single/multiple/loading/error/
privacy-safe native alarm anatomy and action semantics stay shared while the
global atmosphere changes. Components support all four atmospheres in Light and
Dark; every variation need not receive its own synthetic preview.

**A24 background condition:** the full-page canvas and elevated reading surfaces
must use the corresponding existing atmosphere/appearance's semantic color roles.
Reuse shared background/surface/container values and intentional elevation levels;
do not introduce an alarm-specific black or treat sampled generated shades as
production tokens. The owner remains unconvinced by the exact illustrated black
shades. Approval accepts the approach, with detailed coloring and overall visual
polish open to later refinement. Apply this condition beside each accepted
[themed alarm reference](remilo-r6-alarm-postpone/themed-alarms/gallery.html).

[R6 per-image corrections](remilo-r6-alarm-postpone/review-notes.json) resolve
remaining raster differences, including smaller-looking urgent controls,
incidental metadata tint, clipped scrolling cards and inconsistent modal
backdrops. Enforce the R6 measured footer/target rules and this document's shared
color roles instead of copying those differences. P07/P08 implementation,
technical capture/storage decisions and actual component acceptance remain separate.

## Color roles shared by every screen

Use one shared role mapping in RN and native components. Appearance changes the
role values and artwork, not which role an otherwise identical icon receives.

| Element | Required role and reason |
|---|---|
| Ordinary information/form icons: When, Date, Time, Due, Repeat, Alarm mode, Alert time, List, Notes and schedule disclosure; their chevrons | Neutral `onSurfaceVariant`. Being tappable or depicting an alarm does not make a row selected, urgent or a primary action. Optional icon-tile surfaces use one neutral container role. |
| Back, More and ordinary toolbar glyphs | Shared toolbar content role, neutral `onSurface`/`onSurfaceVariant` on a contrast-protected toolbar. Night details and Night edit must use the same mapping. |
| Main field values and titles | `onSurface`; supporting labels, descriptions and ordinary timing summaries use `onSurfaceVariant`. Do not make every label blue in Night. |
| Filled Done/Save | Atmosphere `primary` with its paired `onPrimary`. Same component geometry in Light/Dark. |
| Postpone alert action | Secondary outlined action using the same atmosphere `primary` for label/outline. It is intentionally distinct from completion but not an error/destructive action. |
| Focused input outline/caret and explicitly selected controls | Atmosphere `primary`. Selected states also need a visible/accessible state indicator. |
| Reminder category badge | Stable category role, independent of atmosphere. The green plant badge is intentional identity. Category color belongs to the category, not generic editor controls. |
| Explicit scheduling state | Documented semantic role with text/icon. A green Scheduled chip is permissible only for confirmed scheduling; it does not mean guaranteed audibility and does not color the static Alarm-mode icon. |
| Overdue / delivery warning / error | Stable semantic roles with explicit labels/icons. R4's amber overdue cue is deliberate; genuine failures/errors/destructive actions use their documented error role. The future postponed alert never clears overdue work. |
| Independent timing badge | Neutral relationship text/container/outline. It communicates a relationship, not a selected chip, warning or primary action. |

Sunrise, Sky, Evening and Night use different action accents deliberately.
Sky uses blue in Light and a pale blue paired with dark content in Dark; Evening
uses muted plum in Light and pale rose paired with dark content in Dark. These
are role directions, not sampled final production hex values. Within one atmosphere
and appearance, the same role comes from the same token on all pages. Do not sample
slightly different orange/blue values from individual PNGs or hardcode per-screen
hex overrides. Keep icon family, stroke, size and container treatment consistent.
Remilo's expressive identity remains in its atmosphere, artwork, category badges
and intentional actions.

This is Remilo's chosen role policy, informed by
[Material's color-role system](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md).
Material guidance does not mandate coloring every form icon alike in every app;
our neutral structural mapping resolves this set's inconsistent hierarchy.
Use Android/Material interaction conventions for this Android-first product;
do not mix in iOS Liquid Glass keyboard or control behavior.

## Per-image discrepancies and resolutions

### 01 — Ordinary details, Sunrise Light

[Reference PNG](remilo-r4-details-editor/01-details-ordinary-light.png)

- **Observed:** Alarm is orange while When/List/Notes are gray.
  **Resolution:** all structural information icons, including Alarm, use the
  neutral role. Keep the green plant category badge separate.
- **Observed:** Postpone alert is unusually bright red while Done is burnt orange.
  **Resolution:** both use the Sunrise primary role according to their outlined/
  filled action styles. Postpone does not receive error red.
- **Observed:** the header is taller than the other secondary screenshots, and
  Schedule details uses a list glyph.
  **Resolution:** use the shared compact secondary header/crop and the same
  Schedule details disclosure glyph as the Dark details screen.
- **Intentional:** the labeled Scheduled chip may use the success role; linked Due
  remains concise (`Due at event start`). Avoid recreating redundant Due/time rows.

### 02 — Overdue details with a postponed alert, Night Dark

[Reference PNG](remilo-r4-details-editor/02-details-overdue-dark.png)

- **Observed:** Alarm is blue while other structural icons are muted.
  **Resolution:** Alarm becomes neutral. Postpone and Done retain the Night action
  accent because they are actual actions.
- **Observed:** List lacks the chevron found in ordinary details, and Done is more
  pill-shaped. Label alignment/icon tiles and Schedule details glyph also differ.
  **Resolution:** share the same List row, primary button shape and details-card
  anatomy across Light/Dark. A chevron means navigation and appears whenever List
  opens a destination. Use one read-only Schedule details disclosure component.
- **Intentional:** original Event Today 4:00–4:30 PM, independent Due Today 5:00 PM
  with Overdue, and postponed Next alert Tomorrow 9:00 AM stay distinct. Event and
  Due are unchanged. This is not a ringing, stopped or completed reminder.

### 03 — New reminder with keyboard, Sunrise Light

[Reference PNG](remilo-r4-details-editor/03-create-keyboard-light.png)

- **Observed:** Date/Time/Alarm are orange but Repeat is gray.
  **Resolution:** all ordinary form icons/chevrons are neutral. Keep the focused
  Title outline/caret and Save in the Sunrise action accent.
- **Intentional:** Save is above the keyboard; List/Notes can be below the current
  scroll viewport. Do not shrink controls to fit the entire form at once.
- **Incomplete evidence:** this image shows only Title focus.
  **Resolution:** apply the keyboard requirements below to every input, especially
  Notes and fields revealed by validation. A visible Title alone is insufficient.
- **Intentional platform difference:** keyboard layout, suggestions and blue Enter
  belong to Android/the user's IME, not Remilo's theme.
- Preserve the creation fixture/defaults: now 7:30, Event 7:40–8:10 AM, Due linked
  to Event start and Alarm following Due. No new timing policy is implied.

### 04 — Editing with notes and independent timing, Night Dark

[Reference PNG](remilo-r4-details-editor/04-edit-independent-dark.png)

- **Observed:** nearly all icons, chevrons, labels and timing summaries are blue;
  Back differs from Night details.
  **Resolution:** use neutral structural/navigation roles and primary/supporting
  text roles. Reserve blue for intentional focus/selection/actions.
- **Observed:** Independent badges resemble accent selection pills.
  **Resolution:** use the shared neutral relationship badge. Keep its wording; do
  not suggest that merely displaying an independent value is a selected control.
- **Intentional:** existing Notes stay expanded. Event Tomorrow 9:00–9:30 AM,
  independent Due 11:00 AM, and independent alert 8:45 AM remain separately visible.
  Common-form Alert time must not disappear into advanced options. Due may be
  edited in Schedule options but its consequential summary remains visible.
- Use the same keyboard behavior when Title or Notes gains focus. Omit editable
  Repeat for an individual reminder; create/family editing follows actual scope.

## R5 — approved Sky and Evening extensions (A20)

The owner approved these eight variants on 7 October 2026 and requested discrepancy documentation like R4. They extend the same four-state template, rather than introduce a new redesign. [Approval and exact image identities](approved-ui-r5-acceptance.json); [combined twelve-screen gallery](remilo-r4-details-editor/gallery.html); [Sky/Evening comparison with per-image notes](remilo-r5-sky-evening-details-editor/gallery.html).

Generic icon coloring is already corrected in R5. The remaining variations below are incidental generation drift. Keep the shared roles, timing and keyboard requirements in this contract. Sky Dark retains daytime clouds/lake; Evening Dark retains sunset/sun. Light/Dark is independent of atmosphere. Fixture clocks stay constant for comparison and do not define automatic switching boundaries. Ordinary details and creation are Light; overdue details and editing are Dark. These representatives do not claim every state in both appearances.

### 01 — Sky Light · Ordinary details

[Reference PNG](remilo-r5-sky-evening-details-editor/01-sky-ordinary-details.png)

- **Observed:** The ordinary-details scenic opening is taller than the other secondary samples; crop, toolbar spacing and title weight also vary.
  **Resolution:** Use one compact secondary opening, about 96 dp below the status inset including a 56 dp toolbar. Crop the shared atmosphere asset; reduce decoration first when height is constrained, preserving readable navigation and focused content.
- **Observed:** Ordinary Light details uses neutral icon tiles and stacked label/value rows; Dark overdue details uses mostly untiled icons and side-by-side columns.
  **Resolution:** Use shared details-card/icon-column/container/label-value anatomy in Light and Dark. Add the consequential independent Due row because of state, not appearance; grow/wrap and scroll instead of making a Dark-only layout.
- **Observed:** Postpone blue appears brighter than the filled Done blue.
  **Resolution:** Resolve both through the same Sky Light primary token, with outlined/filled styles and paired onPrimary. Do not sample separate per-screen PNG hex values.
- **Intentional:** Neutral structural icons are already corrected from R4; green plant category and labeled confirmed Scheduled state remain distinct intentional roles.
- **Intentional:** Linked Due remains concise: Due at event start. Done completes work; Postpone alert changes only the next alert.
- **Intentional:** List has a navigation chevron. Read-only Schedule details uses circled information; editable Schedule options may use a gear.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Preserve Water plants, Home, full Event range and existing Notes; Scheduled represents confirmed scheduling, not guaranteed sound.

### 02 — Sky Dark · Overdue + postponed alert

[Reference PNG](remilo-r5-sky-evening-details-editor/02-sky-overdue-details.png)

- **Observed:** Ordinary Light details uses neutral icon tiles and stacked label/value rows; Dark overdue details uses mostly untiled icons and side-by-side columns.
  **Resolution:** Use shared details-card/icon-column/container/label-value anatomy in Light and Dark. Add the consequential independent Due row because of state, not appearance; grow/wrap and scroll instead of making a Dark-only layout.
- **Observed:** Done is rounder than Light Done/Edit Save, and its fill appears more periwinkle than Sky Dark Edit Save.
  **Resolution:** Use shared 16 dp primary-button corners and one Sky Dark primary/onPrimary pair across Done, Save and Postpone; do not create per-page theme accents.
- **Intentional:** Amber Overdue and Due refer to unfinished work; neutral Alarm identifies the mode. Future postponement does not clear overdue.
- **Intentional:** Event Today 4:00–4:30 PM, independent Due Today 5:00 PM, and postponed Next alert Tomorrow 9:00 AM remain separate; Event and Due are unchanged.
- **Intentional:** Category document badge is indigo; actual actions use the atmosphere accent. This is not active ringing: Stop/Snooze do not replace Done/Postpone.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Preserve the overdue Due despite a future next alert. Next alert Tomorrow 9 AM is an edited postponement, not a new default shortcut.

### 03 — Sky Light · Creation + keyboard

[Reference PNG](remilo-r5-sky-evening-details-editor/03-sky-create-keyboard.png)

- **Observed:** Calendar glyph/date mark and scenic crop/row padding differ from other Sky pages.
  **Resolution:** Use the shared calendar glyph family, compact header and form row geometry; no theme-specific date icons or fixed pixel heights.
- **Observed:** The raster demonstrates Title focus only; it cannot show lower Notes, caret tracking or changing keyboard heights.
  **Resolution:** Implement the canonical IME-aware Save/footer and focus/caret contract for every input. Keep the scroll viewport above the footer; do not hardcode this keyboard height.
- **Intentional:** Date, Time, Repeat and Alarm icons are neutral. Focused Title outline/caret and Save use the atmosphere primary role.
- **Intentional:** One Save is above the keyboard. Wrapped Title is visible; lower List/Notes can require scrolling rather than smaller controls.
- **Intentional:** Keyboard suggestions, layout, blue Enter and navigation controls belong to Android/the selected IME, including in Evening.
- **Intentional:** At fixture clock 7:30, Event defaults to 7:40–8:10 AM; Due follows Event start and Alarm follows Due. Repeat belongs to creation.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Keep one Save footer above the actual IME, outside the form scroll; reserve its measured height and apply keyboard/navigation/safe-area insets once. Focus lower Notes and validation fields, grow text, move/select the caret, and change keyboard height without covering the insertion point, helper or error. Verify first-tap guarded Save, draft/composition preservation, 200% text, emoji panels and Android Back; the static raster does not demonstrate these behaviors.

### 04 — Sky Dark · Editing + independent timing

[Reference PNG](remilo-r5-sky-evening-details-editor/04-sky-edit-independent.png)

- **Observed:** List uses a briefcase instead of the generic list glyph in details; the calendar inner date mark also changes.
  **Resolution:** Use one generic List glyph and shared calendar icon family. Work membership does not turn the List control into a work-category icon; category imagery remains separate.
- **Observed:** Save hue/corners differ from Sky Dark overdue Done.
  **Resolution:** Use the same Sky Dark primary/onPrimary tokens and 16 dp button radius. Appearance changes role values, not component anatomy.
- **Intentional:** Neutral structural icons and Independent relationship badges are intentional; the badges do not imply selected controls.
- **Intentional:** Event Tomorrow 9:00–9:30 AM, independent Due 11:00 AM and independent alert 8:45 AM remain visible separately. Existing Notes remain expanded.
- **Intentional:** No editable Repeat or per-reminder appearance chooser belongs to this individual-reminder edit. Save is the single persistent primary action.
- **Intentional:** Editable Schedule options uses a gear; read-only Schedule details uses circled information. This difference communicates different destinations.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Keep the independent alert in the common Alert area, and the consequential Due summary visible even when Due editing lives in Schedule options. Keep one Save footer above the actual IME, outside the form scroll; reserve its measured height and apply keyboard/navigation/safe-area insets once. Focus lower Notes and validation fields, grow text, move/select the caret, and change keyboard height without covering the insertion point, helper or error. Verify first-tap guarded Save, draft/composition preservation, 200% text, emoji panels and Android Back; the static raster does not demonstrate these behaviors.

### 05 — Evening Light · Ordinary details

[Reference PNG](remilo-r5-sky-evening-details-editor/05-evening-ordinary-details.png)

- **Observed:** Postpone outline/label is brighter magenta than muted-plum Done.
  **Resolution:** Use one Evening Light primary token for Postpone and Done. It is not error red or a separate urgency accent.
- **Observed:** The ordinary-details scenic opening is taller than the other secondary samples; crop, toolbar spacing and title weight also vary.
  **Resolution:** Use one compact secondary opening, about 96 dp below the status inset including a 56 dp toolbar. Crop the shared atmosphere asset; reduce decoration first when height is constrained, preserving readable navigation and focused content.
- **Observed:** Ordinary Light details uses neutral icon tiles and stacked label/value rows; Dark overdue details uses mostly untiled icons and side-by-side columns.
  **Resolution:** Use shared details-card/icon-column/container/label-value anatomy in Light and Dark. Add the consequential independent Due row because of state, not appearance; grow/wrap and scroll instead of making a Dark-only layout.
- **Intentional:** Neutral structural icons are already corrected from R4; green plant category and labeled confirmed Scheduled state remain distinct intentional roles.
- **Intentional:** Linked Due remains concise: Due at event start. Done completes work; Postpone alert changes only the next alert.
- **Intentional:** List has a navigation chevron. Read-only Schedule details uses circled information; editable Schedule options may use a gear.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Preserve linked Due, green category/Scheduled roles and muted-plum actual actions. Final artwork refinement remains separate.

### 06 — Evening Dark · Overdue + postponed alert

[Reference PNG](remilo-r5-sky-evening-details-editor/06-evening-overdue-details.png)

- **Observed:** Ordinary Light details uses neutral icon tiles and stacked label/value rows; Dark overdue details uses mostly untiled icons and side-by-side columns.
  **Resolution:** Use shared details-card/icon-column/container/label-value anatomy in Light and Dark. Add the consequential independent Due row because of state, not appearance; grow/wrap and scroll instead of making a Dark-only layout.
- **Observed:** Done corners are visibly rounder than ordinary Done and Edit Save.
  **Resolution:** Use the same 16 dp primary-button radius and shared footer geometry in every appearance. Light plum versus Dark pink action role values are intentional; pill-versus-rounded-rectangle geometry is not.
- **Intentional:** Amber Overdue and Due refer to unfinished work; neutral Alarm identifies the mode. Future postponement does not clear overdue.
- **Intentional:** Event Today 4:00–4:30 PM, independent Due Today 5:00 PM, and postponed Next alert Tomorrow 9:00 AM remain separate; Event and Due are unchanged.
- **Intentional:** Category document badge is indigo; actual actions use the atmosphere accent. This is not active ringing: Stop/Snooze do not replace Done/Postpone.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Keep amber unfinished Due independent of pink actions and future postponement; no theme-driven timing or completion changes.

### 07 — Evening Light · Creation + keyboard

[Reference PNG](remilo-r5-sky-evening-details-editor/07-evening-create-keyboard.png)

- **Observed:** Focused Title outline/caret appears brighter magenta than muted-plum Save.
  **Resolution:** Use the same Evening Light primary token for focus and Save; use appropriate outline/fill styles rather than independent per-control sampled hues.
- **Observed:** Header/crop differs from ordinary details; only Title focus is demonstrated.
  **Resolution:** Use the shared compact secondary opening and reduce decoration when constrained. Apply the keyboard/caret contract to lower Notes and validation too; one visible Title is insufficient evidence.
- **Intentional:** Date, Time, Repeat and Alarm icons are neutral. Focused Title outline/caret and Save use the atmosphere primary role.
- **Intentional:** One Save is above the keyboard. Wrapped Title is visible; lower List/Notes can require scrolling rather than smaller controls.
- **Intentional:** Keyboard suggestions, layout, blue Enter and navigation controls belong to Android/the selected IME, including in Evening.
- **Intentional:** At fixture clock 7:30, Event defaults to 7:40–8:10 AM; Due follows Event start and Alarm follows Due. Repeat belongs to creation.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Keep one Save footer above the actual IME, outside the form scroll; reserve its measured height and apply keyboard/navigation/safe-area insets once. Focus lower Notes and validation fields, grow text, move/select the caret, and change keyboard height without covering the insertion point, helper or error. Verify first-tap guarded Save, draft/composition preservation, 200% text, emoji panels and Android Back; the static raster does not demonstrate these behaviors.

### 08 — Evening Dark · Editing + independent timing

[Reference PNG](remilo-r5-sky-evening-details-editor/08-evening-edit-independent.png)

- **Observed:** List uses a briefcase while details uses a bulleted-list glyph.
  **Resolution:** Use the shared generic List glyph; Work is its value, not a reason for a different form-control icon.
- **Observed:** The sun shifts farther right than other Evening samples; header and field sizing also differ.
  **Resolution:** Use one selected Evening source asset and a shared crop/header policy. Do not author page-specific scenery or form geometry to reproduce incidental generated composition.
- **Intentional:** Neutral structural icons and Independent relationship badges are intentional; the badges do not imply selected controls.
- **Intentional:** Event Tomorrow 9:00–9:30 AM, independent Due 11:00 AM and independent alert 8:45 AM remain visible separately. Existing Notes remain expanded.
- **Intentional:** No editable Repeat or per-reminder appearance chooser belongs to this individual-reminder edit. Save is the single persistent primary action.
- **Intentional:** Editable Schedule options uses a gear; read-only Schedule details uses circled information. This difference communicates different destinations.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Keep opaque raised reading surfaces; raster glow/shading is not a new translucency or Liquid Glass requirement. Keep one Save footer above the actual IME, outside the form scroll; reserve its measured height and apply keyboard/navigation/safe-area insets once. Focus lower Notes and validation fields, grow text, move/select the caret, and change keyboard height without covering the insertion point, helper or error. Verify first-tap guarded Save, draft/composition preservation, 200% text, emoji panels and Android Back; the static raster does not demonstrate these behaviors.

## Shared geometry and accessibility corrections

Retain the approved secondary template: compact atmospheric opening, solid reading
surfaces, clear title/timing/delivery hierarchy and persistent action. Use one
component definition rather than theme-specific copies of its structure.

- Secondary opening target: approximately 96 dp below the status inset, including
  the toolbar (56 dp) and short art crop. When usable height is constrained, reduce/
  scroll the decorative crop first; keep navigation and focused content usable.
- Use 16 dp gutters, 16 dp card/field corners, and a shared 16 dp radius for the
  filled primary button. Primary Done/Save height is at least 56 dp; Postpone and
  other interactive targets are at least 48 dp and do not overlap.
- Baseline body/value text is 16 sp and supporting text 14 sp; details title is
  approximately 24 sp. Text wraps/grows with system scaling. A bigger title, long
  notes or keyboard can require scrolling. Do not copy tiny raster labels or fixed
  pixel card heights.
- Preserve the same icon-column and label/value alignment in Light/Dark. Add or
  remove a consequential Due row based on state/linkage, not appearance.
- Do not copy component omissions from a sample (e.g. missing navigation chevron)
  or infer action availability from icon tint.
- Measure contrast on actual surfaces: normal text at least 4.5:1, qualifying
  large text at least 3:1, and required control/state graphics at least 3:1.
  Labels, state, focus, selection and errors also have non-color cues and TalkBack
  semantics. Capture actual large-text renders, not rescaled PNGs.

These values are implementation targets carried from the draft; actual components
must demonstrate them. Raster approval is not a measured accessibility pass.

## Required keyboard and focused-input behavior (P06)

These are requirements for creation, editing, expanded Notes, sheets with text
input, and lower fields revealed by validation.

1. **One persistent Save:** put the action footer outside the form's scroll content
   but inside the same IME-resized/inset-aware usable region. With the keyboard
   open, Save sits immediately above it, with its normal footer padding. With the
   keyboard closed, it returns above the bottom safe area. Remove duplicate
   toolbar Save when adopting this template.
2. **No form overlap:** the scroll viewport ends above the measured footer. A
   floating footer must reserve equivalent clearance; it cannot cover an input,
   helper/error or final row. Lower fields remain reachable by scrolling.
3. **One inset owner:** coordinate Android IME, navigation/system-bar and safe-area
   insets once. Do not add a full keyboard offset on top of native resize, or
   duplicate keyboard/nav padding. Handle actual inset/keyboard height changes,
   including keyboard suggestions and emoji panels, without hardcoded heights.
4. **Follow focus and caret:** after focus, keyboard/layout changes, multiline
   growth, caret/selection movement or validation, ensure the active insertion
   point and useful editing context are visible above both footer and IME. Bring
   the relevant label/helper/error into view when feasible. Do not merely scroll
   the top edge of a growing Notes field into view.
5. **Long Notes:** the entire field need not fit at once. Its text remains editable
   and scrollable, preserving draft, selection and composing text. Long Title and
   Notes must not lose content or reset when the keyboard/appearance changes.
6. **Usable Save:** the first deliberate tap with keyboard open activates the
   existing guarded Save operation, rather than just dismissing the keyboard.
   Retain busy/disabled/validation and exact same-operation retry behavior.
7. **Back and reduced space:** Android Back dismisses the IME first; navigation
   Back then follows the existing dirty/stale/uncertain guards. A smaller viewport
   and large text use scrolling and less decoration, not smaller controls or a
   second Save.
8. **Platform scope:** use the actual Android keyboard and SDK 57/RN 0.86 APIs.
   No iOS implementation, custom keyboard or overlay permission is introduced.

[Android keyboard visibility guidance](https://developer.android.com/develop/ui/views/touch-and-input/keyboard-input/visibility)
supports resizing available space and retaining an action bar above the IME.
[Android IME/insets guidance](https://developer.android.com/develop/ui/views/layout/sw-keyboard)
covers actual visibility/height and transition handling.
[RN 0.86 KeyboardAvoidingView](https://reactnative.dev/docs/0.86/keyboardavoidingview)
provides layout adjustments but does not by itself prove footer-aware caret or
validation visibility. Choose one version-matched layout strategy after inspecting
the actual edge-to-edge setup; do not blindly stack avoidance wrappers.

### Current code versus the requirement

At this documentation review, [the editor](../../src/app/edit.tsx) still places Save
in the toolbar. [Page/Field](../../src/ui/components.tsx) provide basic scrolling,
footer/focus and multiline sizing, but no demonstrated editor-wide caret/error
coordination for this template. MainActivity already declares `adjustResize` in
[AndroidManifest.xml](../../android/app/src/main/AndroidManifest.xml); that alone
does not establish correctness under edge-to-edge, a persistent footer, growing
Notes or changing keyboard height. This is a future component requirement, not a
claim that the current implementation was fixed in this documentation task.

## Implementation acceptance and evidence

P02/P06/P07 actual components must resolve the listed discrepancies and demonstrate
consistent role tokens and geometry. P06/P12 must additionally cover:

| Case | Required observation |
|---|---|
| 360 x 800, Title creation, keyboard open | Save is above the IME; focused text/caret is visible; lower fields are scrollable. |
| Focus Notes near the bottom; grow, select and move the caret through many lines | Insertion point/selection stays visible above footer and IME; draft/composition survives. |
| 200% English/Chinese text, taller keyboard and emoji panel | No blocked input, overlapping targets, double inset gap or forced font shrink; scrolling remains usable. |
| Validation on a lower/advanced field | Error and its editable control can be reached while keyboard remains open. |
| Show/hide IME repeatedly; switch Title/Notes; open/close picker; Android Back | Footer, focus and scroll remain stable; existing draft/uncertain guards apply. |
| Save once while IME is open; saving/retry cases | First tap starts one guarded operation; uncertain retries reuse the captured command. |
| Light/Dark and all four atmospheres | Same component anatomy/role assignment; differences carry documented meaning. |
| Overdue plus postponed alert | Due stays overdue while the next alert stays future; Done and Postpone remain distinct. |

Host layout/state checks and synthetic captures are useful evidence, but actual
Android keyboard, TalkBack and inset behavior remain observations in the existing
consolidated owner acceptance run. Do not mark them passed from these images.
