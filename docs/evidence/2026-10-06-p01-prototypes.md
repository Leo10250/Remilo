# P01 actual prototype evidence — 6 October 2026

P01-render-r1 contains exactly the Sunrise Agenda and Meadow alarm review
prototypes. [Review board](../design/p01-render-review-r1.html),
[revision and source hashes](../design/p01-render-r1.json),
[composition constraints](../design/p01-render-r1-notes.md).
It is submitted for the mandatory owner rendered UI checkpoint; no final screen
acceptance or completed P01 handoff is inferred from these checks.

## Authorization and reconciliation

A14, “I approve. Proceed”, answers the explicit S1/M1 integration approval question.
The [separate acceptance](../design/p01-artwork-r1-acceptance.json) preserves the
identified source hashes and scope. A12's accepted r2 bundle and A13's comparative
preference record remain intact. M2/S2 and original references are preserved.

Execution began on theme-update at locally recorded tracking/HEAD
10cb67c8e5cd251bb071a5b020b659e870a0eed7. Existing dirty documentation, generated
artwork and prior evidence were preserved. No fetch, branch switch, reset, push,
installation or distribution occurred. The manifest records dirty runtime hashes;
the documented original 20ea024 intake baseline remains immutable. Production
appearance is still brightness-only and content/operational/backup versions remain
4/3/3.

## Implementation and isolation

Static accepted PNGs are bounded exports with identical RN/debug-native bytes:
S1 1440×960 and M1 1024×1536. Only these two exports and their light/dark presentation
were prepared; no broad icon exporter or theme catalog generation was run.

RN reuses shared ReminderRow, buttons, icons, status and memory-only fixture actions.
The corrected selection is opt-in; old review approaches remain. Compose uses
AlarmControlsScreen's actual information/actions/feedback through one optional
internal presentation slot; production calls retain its null default. Real native
Button/OutlinedButton callbacks capture the selected AlertRecord. Review callbacks
record identity and fixture feedback only, with no engine/database/service/audio
controller acquisition. No schema, bridge API, engine, receiver, scheduler,
notification, audio, preference, launcher or production navigation behavior changes.

Twelve rebuilt native default captures match the preserved intake baseline byte
for byte. Existing resolver/review isolation tests verify normal Android bridge
resolution, opt-in web fixtures, absent release review routes and the non-exported
debug activity. The assembled release manifest excludes the debug review activity.

## Render coverage and attribution

Clock: 6 October 2026 at 08:00, America/Los_Angeles, en-US. English/Chinese titles
are authored synthetic content. All viewports: 360×800, 412×915, 800×1024; both
brightnesses, 100%/200% text, standard/long English/long Simplified Chinese.

- RN: 97 current/corrected captures, including 18 large-text scrolled-control
  views and focused overdue, independent/changed delivery, missing art, invalid
  token and reduced-motion cases. Corrected views have paired text-free backgrounds.
- Compose: 100 top/scrolled captures with paired backgrounds, including consequential
  timing, action errors, generic/private-content exclusion, missing-art and invalid
  token cases. Five additional captures demonstrate same-session membership changes
  and new-session initialization.
- Pixel comparison sheets retain reference/current/corrected labels outside screens,
  matching display widths and original aspect ratios. Unmodified originals remain
  linked. The owner-supplied rejected screenshot stays a historical negative
  reference of unknown source revision, not a newly attributed current render.

Each index records fixture/scenario, canvas and viewport, brightness, font scale,
scroll state and text bounds; RN additionally records density, roles, selected
states and action bounds. The package manifest binds these indexes and all source,
fixture, asset and render hashes. Native density is 1; synthetic system insets are
zero. RN host density is approximately 1.2 and screenshot pixel scale is its inverse.
RN paired action geometry permits at most one CSS pixel of host rounding; scroll
offsets must agree. Cropping/resizing derivatives are comparison aids, not new art.

## Accessibility and interaction findings

The executable [composite check](../../scripts/verify-p01-renders.mjs) measures
actual paired background pixels beneath visible glyph differences, using the full
authored foreground ink. It maps RN CSS bounds to screenshot paint density and
respects the pixel centres of ancestor clips. JPEG artifacts/antialiasing are
excluded below a 25-level RGB difference. Native PNG sampling uses identical
foreground/background text geometry. This is host evidence, not a screen-reader
or physical-display certification.

The complete results contain 3,190 passing visible text/indicator measurements:
normal text ≥4.5:1, large text ≥3:1 and essential indicators ≥3:1. Actual native
control fill/outline centreline contrast against adjacent composited canvas passes
3:1. Results and individual thresholds are retained in
[contrast.json](redesign-p01/render-r1/contrast.json) and
[semantics-and-controls.json](redesign-p01/render-r1/semantics-and-controls.json).

All 38 current/corrected Agenda comparisons retain identical reminder action
semantics, including event intervals, independent due/alert relationships, work
and delivery states. RN targets measure at least 48 dp. All 18 corrected large-text
end views show the last reminder action fully within the scroll clip and above
Add. Native test controls are displayed/clickable and at least 48 dp; text-layout
line extents fit within one raster pixel without height clipping.

Browser keyboard inspection exposes labelled roles and selected Agenda state,
visible focus, decorative exclusion and non-color state labels. The More button's
focus outline uses the accent against the cream canvas; the recorded computed
stroke is 2.667 CSS px due to host rounding of the authored 3 px outline. Grayscale
views retain stopped/missed/postponed/error meaning in text/glyphs. Reduced-motion
inspection has no decorative animation or appearance transition. Missing-art and
invalid-token views keep readable surfaces and reachable actions.

Memory-only Done removes Water plants; Undo restores its event interval through
the existing reopen policy. Because its target is already elapsed, it correctly
reports “Alarm missed / No next alert scheduled”, rather than replaying it.
Native Stop and Snooze target medicine after Water plants leaves the fixture;
the native Stop action leaves work unfinished. Generic fixtures show “Reminder”
and no private title or contextual artwork. Tests confirm no Remilo databases
exist in either credential or device-protected fixture contexts.

## Actual verification

- Complete shared verification: pinned Node 22.23.3, TypeScript, lint, 127 tests
  in 14 files and 43 controlled tooling cases passed. No dependency versions or
  behavioral assertions were weakened.
- Existing read-only asset verification passed, including exact Classic crop
  pixels, existing icon dimensions/alpha and native parity. P01-specific export
  parity/source acceptance/dimensions checks passed. These checks generate no catalog.
- Focused native P01 graphics/semantics tests: 5 passed. Full native unit suite:
  105 tests in 13 suites, no failures/errors. Module/app lint and serial release
  assembly passed with existing dependency/deprecation warnings, no lint errors.
- Release assembly produced the existing signed ARM64 com.remilo.app 0.4.0 (4)
  verification artifact. APK hash and redacted report summaries are in the manifest.
  It was not installed, launched or distributed.
- Git whitespace, accepted input hashes, baseline capture parity, protected-source
  scope and local review links were checked before submission.
- The rendered HTML board loaded both comparison sheets and 159 corrected-view
  gallery entries. Filtering to native/dark/200% returned the expected 24 views
  with no mismatched entries; 512 local image/document links were checked.

## Tooling failures and corrections

The earlier sandbox-temp SSR ENOENT is preserved in intake evidence. Verification
uses process-local TEMP/TMP under ignored .tooling/p01-temp. The dynamic preview
also encountered loopback restrictions and SSR/hydration timeouts; redirecting temp
alone did not solve those. An authorized local opt-in static Expo web export
provided a reproducible actual-component host renderer. It uses the existing
preview-only resolver; the release environment remains isolated.

Gradle cache access required approved sandbox escalation; one automatic review
timed out, and the retry succeeded. No unsafe rejection was bypassed. Initial
native text-layout inspection identified Skia fractional intrinsic extents; actual
line bounds are checked with one raster pixel tolerance. Measured contrast failures
were fixed with a local Meadow reading transition and usable RN Add clearance.
Final visual inspection repositioned S1's sun into that same clearance, followed
by complete affected RN recapture and contrast verification.

Host screenshot density caused padding and incorrect initial sampling. Those
trial captures are excluded from the submitted manifest. Final captures use a
fixed measured review frame, stable painted state, recorded host density and
matched scroll offsets. Original final captures are retained unchanged; display
derivatives and their crop records are explicitly identified.

## Remaining gates and risks

Explicit owner approval of both P01-render-r1 screen compositions remains required.
Exact palette/UX/production foundation values are not accepted by A14. On acceptance,
record the identified revision/conditions, create the accepted P01 handoff, update
the backlog and prepare a focused P01 commit. P02 remains unauthorized.

TalkBack, Android keyboard/Back behavior, real system insets and notification UI,
physical alarm/audio/recovery reliability, memory/performance and manufacturer
coverage remain the existing consolidated P12/device gates. Browser typography
and scrollbar appearance differ from Android; mdpi Robolectric is not a phone.
Dense or expanded content changes how much scenery is exposed around opaque
surfaces; the matrix makes that tradeoff reviewable. Dark filters retain geometry
but require owner visual acceptance as part of this revision. The production
single-presentation default was verified; durable session freezing remains P08 work.
