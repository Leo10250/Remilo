# Continuous browsing header — 11 October 2026

The owner chose a soft surface blend, stable title/icon colors and direct scroll
blending with Remove animations enabled. The maintained
[header contract](../design/current/header-scroll-research.md) records the exact
geometry and roles; live task status belongs only to UX-30 in the backlog.

## Behavior and boundaries

One Animated scroll value drives the existing reading-plane translation and a
canvas-colored gradient's native opacity. The final 64 dp blends 66% to opaque
through smoothstep, with stable onSurface foreground, measured subtitle protection
and a 40 dp feather. Restoration, overscroll, compact layouts and gesture reversal
use the same value. No threshold React state, duplicate controls, timer or spring
is introduced. Expo SDK 57 LinearGradient replaces the experimental gradient view.

Approved artwork/crops, native alarm presentation, native commands/storage,
Calendar publishing and completion actions remain unchanged. Sheets retain their
surface/control boundary. Existing scene-specific presentation tokens are retained.

## Verification

- `npm run verify` passed: design audit, TypeScript, lint, **223 source tests in
  28 files** and **84 tooling tests**. The existing unused-variable warning in
  the frozen R8 gallery remains. A final tooling run also passed all 84 tests
  after strengthening the controller's normative intermediate/end-point checks.
- Final design audit reports **zero findings**; protected references, approved
  assets/crops and generated presentation mirrors remain intact.
- `npm run verify:android` passed module/app lint and signed bundled ARM64 release
  assembly: **BUILD SUCCESSFUL in 4m 5s**, 103 tasks executed and 929 up-to-date.
  `:remilo-alarm:testDebugUnitTest` was **UP-TO-DATE**. Retained reports contain
  **222 tests in 22 suites**, zero failures/errors; this is cached engine coverage,
  not a new execution of unchanged native tests.

An initial controller-test assertion used strict equality for a floating-point
midpoint; it was corrected to a 1e-12 tolerance. The source's native arithmetic
and endpoints were unchanged. Installation used the SDK-matched gradient version;
its npm command emitted host-Node engine warnings. Repository checks/builds used
the repository-selected tooling. No audit-fix or unrelated dependency update ran.

## Application source and artifact

- Application source: **088511c62c01a0c2aad9e8971f8afb90d3d6ef7d**. Assembly ran
  before that commit with the same application files. The later evidence/backlog
  update does not change the APK's application source.
- Artifact: `android/app/build/outputs/apk/release/app-release.apk`, signed release,
  bundled JavaScript, ARM64; **com.remilo.app 0.4.0 / code 4**.
- Artifact timestamp: **2026-10-12T02:09:40.5279377Z** (11 October local).
- APK SHA-256:
  `356ccc20f0efc8b45613bbae7006dd20b1e2c25c8d7dbece8a3a46a2ff912979`.

## Production-component fixture observations

The isolated web preview at 360 × 800 exercised Agenda's SectionList and Settings'
FormViewport in **all eight atmosphere/brightness pairs**. Rendered opacity was
0.66 at offset 0 and 0.892422 at offset 120 dp. Title colors/positions, artwork
bounds/identity transform and action targets remained stable between those states.
Settings' gradient was 96 dp high; Agenda's measured date protection produced a
126 dp gradient. Ordinary Back/Search/More targets measured 48 × 48 CSS pixels.

Night Light Settings reached opacity 1 at 160 dp and returned to 0.892422 at
120 dp on reverse scrolling. Agenda → More → Settings → Back restored Agenda's
120 dp offset and intermediate opacity. Search entry used opaque compact chrome;
exit restored the same cover/opacity. More and collection Filters opened with
ordinary sheet surface/foreground treatment. Unchanged Apply retained 120 dp.

Night Light smoke checks covered Lists, Repeats, a named Work list, Appearance,
Reminder Details, Repeat details and Activity; Night Dark covered short Completed
and Trash pages. These retained cover extent and the continuous blend. Hidden
retained routes can have zero-size DOM nodes; measurements concern visible pages.
Collection navigation briefly scrolled the outer browser document by 14.4 CSS
pixels; unchanged Apply returned it to zero while preserving content offset. This
web observation is not evidence about Android window/gesture behavior.

Sky Dark with reduced motion retained the same direct 120 dp blend. A 320 px
Agenda view preserved visible title and action spacing. Night Dark at 200% text
used an opaque toolbar with separated actions, no artwork/gradient; Night Light
Settings at 640 × 360 also used compact opaque chrome. Wrapped-subtitle geometry
and shorter decoration are covered by host tests; a full localized/physical
wrapping, timing/performance and TalkBack matrix remains unobserved.

Initial preview navigation/debugger synchronization timed out while its first web
bundle took approximately 263 seconds alongside Android assembly. Restarting the
owned preview after assembly recovered hydration and the recorded checks. The
server was stopped, viewport override reset and owned tabs closed. Logs, rendered
measurements and fixture screenshots remain under ignored `verification/local`.

No APK installation or physical observations have occurred for this change. U36 is
reserved in the consolidated signed-device acceptance checklist; host and fixture
results do not pass that observation gate.
