# Approved Remilo UI direction and R4 implementation corrections

Recorded 7 October 2026. Read this before changing visual foundations, Agenda,
Reminder details, the editor or native presentation. This is a dated amendment to
[appearance-redesign.md](../appearance-redesign.md), with human decisions recorded
as A18/A19 in the [approval ledger](approvals.md). Live task status remains solely
in [backlog.md](../backlog.md).

## Authority and scope

The owner accepts the R3 homepage direction and the overall R4 Details/Editor
template, with the corrections below. Generated images communicate composition,
identity and information hierarchy; arbitrary tint, spacing and shape differences
are not requirements. Use this text to resolve those discrepancies during actual
component work. Do not copy individual image pixels into unrelated components.

- [R3 homepage gallery](remilo-r3-atmospheres/gallery.html): Sunrise, Sky, Evening
  and Night, each in Light and Dark. This supersedes the old homepage visual
  direction. Final scenery should become somewhat more abstract later; the current
  images remain layout/identity references rather than final artwork exports.
- [R4 annotated gallery](remilo-r4-details-editor/gallery.html): ordinary details,
  overdue details with a postponed alert, creation with the keyboard open, and
  editing with notes and independent timing. The owner accepts this template
  while requiring explicit discrepancy and keyboard guidance.
- One global atmosphere, combined with independent System/Light/Dark appearance,
  should apply across app pages, details/editor/settings and unlocked native alarm
  presentation. Task-specific alarm environments and per-reminder appearance
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
- [Acceptance scope](approved-ui-r3-r4-acceptance.json) records the owner statements
  and the exact preserved screenshot identities.
- [Per-image review data](remilo-r4-details-editor/review-notes.json) mirrors the
  corrections shown next to the images. This document owns the implementation
  rules; gallery notes must remain consistent with it.

These are synthetic raster previews, not actual RN/Compose render evidence.

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

Sunrise and Night use different action accents deliberately. Within one atmosphere
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
