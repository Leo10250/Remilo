# Reminder details and editor

R4/R5 accept twelve representatives of ordinary details, overdue details with
a postponed alert, creation with Title keyboard focus and independent-timing editing.
Use [shared visual/IME rules](../visual-language.md) and [global appearance](../appearance-policy.md).
[The combined gallery](../../remilo-r4-details-editor/gallery.html) preserves their
reference identities and per-image corrections.

Details keeps work completion separate from alert controls: Done completes work;
Postpone changes only the next alert. Event, Due and Next alert remain independent;
a future postponed alert does not clear overdue work. Native Stop/Snooze belong to
the ringing surface. Family/occurrence edit scope and existing retry semantics remain
unchanged. Individual editing adds no Repeat/per-reminder appearance chooser.

Creation and editing use one persistent Save above the IME, outside form scrolling.
Reserve footer clearance and retain focused Title/Notes/caret/error context, draft
and composing text. Shared geometry is independent of atmosphere. Terminal details,
schedule options, pickers, stale/replaced series, discard and unconfirmed Save still
need bounded Android interaction observations. The owner
[approved R9 runtime composition 05 for implementation](../../r9-runtime-composition-approval-v5.json);
that composition decision does not pass the terminal-details, keyboard or
recovery checks on an actual device.

The [latest beta correction](../beta-fixes.md) governs Stop completion, alert-first Agenda, four roots, shared collapsing
covers and the approved direct-source Classic splash density exports.

## Per-image discrepancies and resolutions

### 01 — Ordinary details, Sunrise Light

[Reference PNG](../../remilo-r4-details-editor/01-details-ordinary-light.png)

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

[Reference PNG](../../remilo-r4-details-editor/02-details-overdue-dark.png)

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

[Reference PNG](../../remilo-r4-details-editor/03-create-keyboard-light.png)

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

[Reference PNG](../../remilo-r4-details-editor/04-edit-independent-dark.png)

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

The owner approved these eight variants on 7 October 2026 and requested discrepancy documentation like R4. They extend the same four-state template, rather than introduce a new redesign. [Approval and exact image identities](../../approved-ui-r5-acceptance.json); [combined twelve-screen gallery](../../remilo-r4-details-editor/gallery.html); [Sky/Evening comparison with per-image notes](../../remilo-r5-sky-evening-details-editor/gallery.html).

Generic icon coloring is already corrected in R5. The remaining variations below are incidental generation drift. Keep the shared roles, timing and keyboard requirements in this contract. Sky Dark retains daytime clouds/lake; Evening Dark retains sunset/sun. Light/Dark is independent of atmosphere. Fixture clocks stay constant for comparison and do not define automatic switching boundaries. Ordinary details and creation are Light; overdue details and editing are Dark. These representatives do not claim every state in both appearances.

### 01 — Sky Light · Ordinary details

[Reference PNG](../../remilo-r5-sky-evening-details-editor/01-sky-ordinary-details.png)

- **Observed:** The ordinary-details scenic opening is taller than the other secondary samples; crop, toolbar spacing and title weight also vary.
  **Resolution:** Use the shared 200 dp collapsing browsing cover for Details and a compact measured toolbar for editing. Retain hero focal metadata and constrained-height/large-text fallback.
- **Observed:** Ordinary Light details uses neutral icon tiles and stacked label/value rows; Dark overdue details uses mostly untiled icons and side-by-side columns.
  **Resolution:** Use shared details-card/icon-column/container/label-value anatomy in Light and Dark. Add the consequential independent Due row because of state, not appearance; grow/wrap and scroll instead of making a Dark-only layout.
- **Observed:** Postpone blue appears brighter than the filled Done blue.
  **Resolution:** Resolve both through the same Sky Light primary token, with outlined/filled styles and paired onPrimary. Do not sample separate per-screen PNG hex values.
- **Intentional:** Neutral structural icons are already corrected from R4; green plant category and labeled confirmed Scheduled state remain distinct intentional roles.
- **Intentional:** Linked Due remains concise: Due at event start. Done completes work; Postpone alert changes only the next alert.
- **Intentional:** List has a navigation chevron. Read-only Schedule details uses circled information; editable Schedule options may use a gear.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Preserve Water plants, Home, full Event range and existing Notes; Scheduled represents confirmed scheduling, not guaranteed sound.

### 02 — Sky Dark · Overdue + postponed alert

[Reference PNG](../../remilo-r5-sky-evening-details-editor/02-sky-overdue-details.png)

- **Observed:** Ordinary Light details uses neutral icon tiles and stacked label/value rows; Dark overdue details uses mostly untiled icons and side-by-side columns.
  **Resolution:** Use shared details-card/icon-column/container/label-value anatomy in Light and Dark. Add the consequential independent Due row because of state, not appearance; grow/wrap and scroll instead of making a Dark-only layout.
- **Observed:** Done is rounder than Light Done/Edit Save, and its fill appears more periwinkle than Sky Dark Edit Save.
  **Resolution:** Use shared 16 dp primary-button corners and one Sky Dark primary/onPrimary pair across Done, Save and Postpone; do not create per-page theme accents.
- **Intentional:** Amber Overdue and Due refer to unfinished work; neutral Alarm identifies the mode. Future postponement does not clear overdue.
- **Intentional:** Event Today 4:00–4:30 PM, independent Due Today 5:00 PM, and postponed Next alert Tomorrow 9:00 AM remain separate; Event and Due are unchanged.
- **Intentional:** Category document badge is indigo; actual actions use the atmosphere accent. This is not active ringing: Stop/Snooze do not replace Done/Postpone.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Preserve the overdue Due despite a future next alert. Next alert Tomorrow 9 AM is an edited postponement, not a new default shortcut.

### 03 — Sky Light · Creation + keyboard

[Reference PNG](../../remilo-r5-sky-evening-details-editor/03-sky-create-keyboard.png)

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

[Reference PNG](../../remilo-r5-sky-evening-details-editor/04-sky-edit-independent.png)

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

[Reference PNG](../../remilo-r5-sky-evening-details-editor/05-evening-ordinary-details.png)

- **Observed:** Postpone outline/label is brighter magenta than muted-plum Done.
  **Resolution:** Use one Evening Light primary token for Postpone and Done. It is not error red or a separate urgency accent.
- **Observed:** The ordinary-details scenic opening is taller than the other secondary samples; crop, toolbar spacing and title weight also vary.
  **Resolution:** Use the shared 200 dp collapsing browsing cover for Details and a compact measured toolbar for editing. Retain hero focal metadata and constrained-height/large-text fallback.
- **Observed:** Ordinary Light details uses neutral icon tiles and stacked label/value rows; Dark overdue details uses mostly untiled icons and side-by-side columns.
  **Resolution:** Use shared details-card/icon-column/container/label-value anatomy in Light and Dark. Add the consequential independent Due row because of state, not appearance; grow/wrap and scroll instead of making a Dark-only layout.
- **Intentional:** Neutral structural icons are already corrected from R4; green plant category and labeled confirmed Scheduled state remain distinct intentional roles.
- **Intentional:** Linked Due remains concise: Due at event start. Done completes work; Postpone alert changes only the next alert.
- **Intentional:** List has a navigation chevron. Read-only Schedule details uses circled information; editable Schedule options may use a gear.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Preserve linked Due, green category/Scheduled roles and muted-plum actual actions. Final artwork refinement remains separate.

### 06 — Evening Dark · Overdue + postponed alert

[Reference PNG](../../remilo-r5-sky-evening-details-editor/06-evening-overdue-details.png)

- **Observed:** Ordinary Light details uses neutral icon tiles and stacked label/value rows; Dark overdue details uses mostly untiled icons and side-by-side columns.
  **Resolution:** Use shared details-card/icon-column/container/label-value anatomy in Light and Dark. Add the consequential independent Due row because of state, not appearance; grow/wrap and scroll instead of making a Dark-only layout.
- **Observed:** Done corners are visibly rounder than ordinary Done and Edit Save.
  **Resolution:** Use the same 16 dp primary-button radius and shared footer geometry in every appearance. Light plum versus Dark pink action role values are intentional; pill-versus-rounded-rectangle geometry is not.
- **Intentional:** Amber Overdue and Due refer to unfinished work; neutral Alarm identifies the mode. Future postponement does not clear overdue.
- **Intentional:** Event Today 4:00–4:30 PM, independent Due Today 5:00 PM, and postponed Next alert Tomorrow 9:00 AM remain separate; Event and Due are unchanged.
- **Intentional:** Category document badge is indigo; actual actions use the atmosphere accent. This is not active ringing: Stop/Snooze do not replace Done/Postpone.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Keep amber unfinished Due independent of pink actions and future postponement; no theme-driven timing or completion changes.

### 07 — Evening Light · Creation + keyboard

[Reference PNG](../../remilo-r5-sky-evening-details-editor/07-evening-create-keyboard.png)

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

[Reference PNG](../../remilo-r5-sky-evening-details-editor/08-evening-edit-independent.png)

- **Observed:** List uses a briefcase while details uses a bulleted-list glyph.
  **Resolution:** Use the shared generic List glyph; Work is its value, not a reason for a different form-control icon.
- **Observed:** The sun shifts farther right than other Evening samples; header and field sizing also differ.
  **Resolution:** Use one selected Evening source asset and a shared crop/header policy. Do not author page-specific scenery or form geometry to reproduce incidental generated composition.
- **Intentional:** Neutral structural icons and Independent relationship badges are intentional; the badges do not imply selected controls.
- **Intentional:** Event Tomorrow 9:00–9:30 AM, independent Due 11:00 AM and independent alert 8:45 AM remain visible separately. Existing Notes remain expanded.
- **Intentional:** No editable Repeat or per-reminder appearance chooser belongs to this individual-reminder edit. Save is the single persistent primary action.
- **Intentional:** Editable Schedule options uses a gear; read-only Schedule details uses circled information. This difference communicates different destinations.

Implementation checks: Verify shared 16 dp gutters/corners, 56 dp primary buttons, >=48 dp other targets, 16 sp values/14 sp support, actual contrast and TalkBack. Raster sizing is approximate, not measured component evidence. Keep opaque raised reading surfaces; raster glow/shading is not a new translucency or Liquid Glass requirement. Keep one Save footer above the actual IME, outside the form scroll; reserve its measured height and apply keyboard/navigation/safe-area insets once. Focus lower Notes and validation fields, grow text, move/select the caret, and change keyboard height without covering the insertion point, helper or error. Verify first-tap guarded Save, draft/composition preservation, 200% text, emoji panels and Android Back; the static raster does not demonstrate these behaviors.
