# Shared visual language

All eight R3 references govern color relationships, atmosphere and artwork treatment.
[The current index](README.md) defines precedence; [appearance policy](appearance-policy.md)
defines Automatic/manual resolution. Implement one component anatomy in RN and native
UI, not independent designs for each theme. Use opaque reading surfaces and protect
text/controls from busy artwork. Exact colors are implementation tokens to validate,
not arbitrary sampled pixels. The owner's [production-art abstraction review](../production-assets/style-decision.md)
is now active; final scene assets still require individual approval and actual
runtime acceptance remains separate.

## Atmosphere roles

| Atmosphere | Light | Dark |
|---|---|---|
| Sunrise | Warm off-white canvas, white surfaces, burnt-orange actions | Soft charcoal/raised charcoal, pale-apricot actions with dark content |
| Sky | Cool-blue canvas, white surfaces, saturated-blue actions | Blue-slate/raised slate, pale-sky-blue actions with dark content; daytime clouds |
| Evening | Pale-rose canvas, white surfaces, muted-plum actions | Plum-charcoal/raised plum, pale-rose actions with dark content; sunset sun |
| Night | Icy-blue canvas, white surfaces, deep-blue actions; moon/stars | Navy-slate/raised navy, pale-periwinkle actions with dark content |

Canvas and elevated surface roles are shared across every page, including native
alarms. No per-page black or independent accent. Standard Android keyboard/permission/
notification surfaces remain platform-owned. The explicit R6 alarm action minimum
is 64 dp for prominent single/Done-all/Snooze-all controls and 56 dp for member actions;
ordinary app prominent actions use the 56 dp minimum below.

App sheets are surface boundaries even when opened from scenic toolbar actions.
Restore the current foundation's surface, on-surface and on-surface-variant colors
and ordinary control/focus treatment at that boundary. Header foreground overrides
must not enter the sheet through React context. Retain text scaling, reduced motion,
appearance holds and modal accessibility behavior.

## Color roles shared by every screen

Use one shared role mapping in RN and native components. Appearance changes the
role values and artwork, not which role an otherwise identical icon receives.

| Element | Required role and reason |
|---|---|
| Ordinary information/form icons: When, Date, Time, Due, Repeat, Alarm mode, Alert time, List, Notes and schedule disclosure; their chevrons | Neutral `onSurfaceVariant`. Being tappable or depicting an alarm does not make a row selected, urgent or a primary action. Optional icon-tile surfaces use one neutral container role. |
| Back, More and ordinary toolbar glyphs | Canonical `headerInk` directly on atmospheric art, with transparent control backgrounds and a shared fading scrim; `onSurface` on the opaque constrained-height fallback. Night details and Night edit use the same mapping. |
| Main field values and titles | `onSurface`; supporting labels, descriptions and ordinary timing summaries use `onSurfaceVariant`. Do not make every label blue in Night. |
| Filled Done/Save | Atmosphere `primary` with its paired `onPrimary`. Same component geometry in Light/Dark. |
| Filled Delete permanently | Semantic `error` with paired `onError` for label/icon, including a contrasting pressed state. Keep the error fill visible in every atmosphere. |
| Postpone alert action | Secondary outlined action using the same atmosphere `primary` for label/outline. It is intentionally distinct from completion but not an error/destructive action. |
| Focused input outline/caret and explicitly selected controls | Atmosphere `primary`. Selected states also need a visible/accessible state indicator. |
| Reminder glyph | One neutral `event` glyph on rows/details. Semantic category badges and classification are deferred by the [implementation decision](implementation-decisions.md). |
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
Remilo's expressive identity remains in its atmosphere, artwork
and intentional actions.

This is Remilo's chosen role policy, informed by
[Material's color-role system](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md).
Material guidance does not mandate coloring every form icon alike in every app;
our neutral structural mapping resolves this set's inconsistent hierarchy.
Use Android/Material interaction conventions for this Android-first product;
do not mix in iOS Liquid Glass keyboard or control behavior.

## Shared geometry and accessibility corrections

Use the [beta browsing cover](beta-fixes.md): expanded atmospheric opening, solid
reading surfaces, clear alert/delivery hierarchy and persistent actions. Use one
component definition rather than theme-specific copies of its structure.

The owner's 9 October actual-render correction rejects opaque header title/button
boxes. Use transparent controls/text over the scene, protected by the canonical
fading scrim through the measured label/control region. Its 54% plateau and ink
pair guarantee normal text 4.5:1 over the RGB extremes; actual image/UI framing
still requires review. Drop decoration before compromising large text or controls.
Use a 52 × 32 dp switch track with a 24 dp selected thumb and an accessible whole
row target. Independent cards use 12 dp separation and neutral icon containers;
root selection uses a glyph capsule and selected label, as in R3/R7/R8.

### Connected items (owner correction, 9 October 2026)

Related editor units, list-library entries and Settings controls use connected
items: **2 dp seams**, **16 dp outside corners**, **4 dp inside corners** and
**12 dp between independent groups**. Each item paints the current theme surface;
the enclosing list stays transparent so the seam reveals the page background.
A singleton has four 16 dp corners. Conditional hidden items do not participate
in corner calculation, and stable item keys preserve retained forms and pickers.

Navigation rows and switches follow the same container rules; the control type
does not decide whether a row receives a surface. Press, selection, disabled and
focus cues stay inside the item's corners. Sheet contents retain their own
presentation rather than inheriting the row's treatment. Supporting text, errors,
passive statuses and recovery actions belong to their item or group footer, with
16 dp horizontal insets; they are not extra tiles. Composite Date/Time and Alert
units keep their existing internal controls. Existing continuous Group panels
outside this correction remain valid and unchanged.

This follows the Expressive segmented-list anatomy in the official
[ListItem defaults](https://developer.android.com/reference/kotlin/androidx/compose/material3/ListItemDefaults)
and [list tokens](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ListTokens.kt).
The owner's selected scope is the reminder editor, Lists library/management and
the entire Settings page. Shared/native constants come from the canonical
presentation manifest; this correction changes no stored values or actions.

- Browsing opening: 200 dp below the status inset, including a nominal 56 dp
  toolbar. Scrolling consumes the 144 dp decoration into an opaque toolbar; the
  artwork expands again as content returns to the top. Keep the expanded hero
  composition fixed in position and crop; native Animated scrolling moves only
  the opaque reading plane over it. Keep the toolbar pinned and make it opaque
  once the decorative opening is covered.
  Restore content and cover offsets together. Editing, management, backup,
  Diagnostics and sheets use compact toolbars. Usable height below 480 dp or font
  scale at least 1.6 also uses compact chrome; the toolbar grows with text.
- Use 16 dp gutters, 16 dp card/field corners, and a shared 16 dp radius for the
  filled primary button. Primary Done/Save height is at least 56 dp; Postpone and
  other interactive targets are at least 48 dp and do not overlap.
- Baseline body/value text is 16 sp and supporting text 14 sp; details title is
  approximately 24 sp. Text wraps/grows with system scaling. A bigger title, long
  notes or keyboard can require scrolling. Do not copy tiny raster labels or fixed
  pixel card heights.
- The owner's 9 October permanent-delete correction uses a Material 3 Expressive
  round filled destructive button, at least 56 dp high, with the leading icon and
  an 8 dp label gap. Its paired Cancel is neutral outlined with the same round
  geometry. Pressing these buttons changes the corners to the shared 16 dp radius
  and shows a state fill without animation; focus has a contrasting outline.
  This scoped action treatment follows [Material's Expressive button guidance](https://github.com/material-components/material-components-android/blob/master/docs/components/CommonButton.md).
- Preserve the same icon-column and label/value alignment in Light/Dark. Add or
  remove a consequential Due row based on state/linkage, not appearance.
- Reminder rows share a 20 dp informational icon column and 6 dp text gap, 12 dp
  standard padding/separation, 8 dp outer gaps and 4 dp stacked gaps. Borderless More
  uses a 24 dp glyph in a nonshrinking 48 dp target. Align real controls to the first
  title line; terminal rows reserve no completion-control placeholder. See the
  [alert experience](alert-experience.md) for state-specific metadata and relative overdue.
- Do not copy component omissions from a sample (e.g. missing navigation chevron)
  or infer action availability from icon tint.
- Measure contrast on actual surfaces: normal text at least 4.5:1, qualifying
  large text at least 3:1, and required control/state graphics at least 3:1.
  Labels, state, focus, selection and errors also have non-color cues and TalkBack
  semantics. Capture actual large-text renders, not rescaled PNGs.

These values are implementation targets carried from the draft; actual components
must demonstrate them. Raster approval is not a measured accessibility pass.

## Required keyboard and focused-input behavior (TD-03)

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

[The editor](../../../src/app/edit.tsx) uses one persistent footer outside
[FormViewport](../../../src/ui/form-viewport.tsx). The presentation-only
[native geometry observer](../../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/presentation/FormGeometryModule.kt)
observes each mounted form's own window, residual IME overlap and native caret/
viewport rectangles. It emits geometry and opaque field identities, never text
or composition. MainActivity and RN Modal retain Android `adjustResize`; the
observer does not consume insets or replace RN selection handling. Actual
keyboard/selection/composition behavior still requires the observations below.

## Implementation acceptance and evidence

TD-01/TD-03 actual components must resolve the listed discrepancies and demonstrate
consistent role tokens and geometry. TD-03/TD-06 must additionally cover:

| Case | Required observation |
|---|---|
| 360 x 800, Title creation, keyboard open | Save is above the IME; focused text/caret is visible; lower fields are scrollable. |
| Focus Notes near the bottom; grow, select and move the caret through many lines | Insertion point/selection stays visible above footer and IME; draft/composition survives. |
| 200% English/Chinese text, taller keyboard and emoji panel | No blocked input, overlapping targets, double inset gap or forced font shrink; scrolling remains usable. |
| Validation on a lower/advanced field | Error and its editable control can be reached while keyboard remains open. |
| Show/hide IME repeatedly; switch Title/Notes; open/close picker; Android Back | Footer, focus and scroll remain stable; existing draft/uncertain guards apply. |
| Save once while IME is open; saving/retry cases | First tap starts one guarded operation; uncertain retries reuse the captured command. |
| Light/Dark and all four atmospheres | Same component anatomy/role assignment; differences carry documented meaning. |
| Overdue plus postponed alert | Original alert remains the overdue reference while the next alert stays future; Done and Postpone remain distinct. |

Host layout/state checks and synthetic captures are useful evidence, but actual
Android keyboard, TalkBack and inset behavior remain observations in the existing
consolidated owner acceptance run. Do not mark them passed from these images.
