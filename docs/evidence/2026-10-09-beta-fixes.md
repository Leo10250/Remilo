# Beta behavior and fixed-artwork headers

9 October 2026 · branch `beta-fixes` · implementation revision
`38d9365593dd3dabb51f6f96ab6cda0b84310429`.

## Implemented behavior

- Alarm Stop/StopAll complete only captured occurrences through the serialized
  worker. Operational schema 5 stores durable, command-bound receipts and pending
  completion records without private content. Credential schema 5 and backup
  format 3 are unchanged. Projection records one Done at the original Stop time;
  a lost acknowledgement cannot complete an occurrence again after Reopen.
  Historical Stopped, timeout and interruption retain unfinished semantics.
- Four roots expose Agenda, Lists, Completed and Trash. Lists separates built-in
  Repeats from memberships; scoped history and legacy Repeats origins retain Back
  and independent query/scroll state. Selection keeps the contextual footer.
- Active cards lead with alert time/No alert, delivery consequences and readable
  recurrence. Native alert anchors determine date membership, ordering and full
  counts before pagination; Due still determines unfinished Overdue priority.
- Browsing artwork stays fixed at its expanded hero crop. Only the opaque body
  plane moves, covering decoration until it reaches the pinned toolbar. Both
  ordinary scroll pages and Agenda share this behavior, including restoration,
  compact fallbacks and footer/inset ownership. Lists' primary target contains the
  chevron; More remains independent. The [research](../design/current/header-scroll-research.md)
  distinguishes official patterns from the owner's exact layer decision.
- Captured session appearance supplies native loading and notification accents.
  [Approved Classic splash v3](../design/production-assets/approvals/classic-splash-v3.json)
  is active at 288/432/576/864/1152 px. Mark size and original thin pale edge are
  retained; the two highest densities have the disclosed source interpolation.

## Host and fixture evidence

`npm run verify` passed during implementation. Final
`npm run release:prepare` completed successfully at
**2026-10-09 20:19:05.680 UTC**, after the final scoped-navigation correction.
It reran shared/tooling checks, native unit tests and lint, and signed assembly.

| Check | Actual result |
|---|---|
| Design/asset/reference audit and TypeScript | Passed; no audit findings |
| ESLint | Zero errors; existing unused-variable warning in frozen R8 gallery |
| Shared tests | 51 files, 349 tests passed |
| Controlled Node tooling tests | 77 passed |
| Native unit tests | 15 suites, 134 tests, zero failures/errors |
| Native module lint and app release lint | Passed |
| Signed bundled ARM64 release assembly and APK inspection | Passed |

Focused native tests exercise Direct Boot Stop, missing finite recurring content,
both database crash boundaries, acknowledgement loss followed by Reopen, old
generation/session rejection, Stop/Done races, session arrivals and receipt binding.
Agenda tests exercise more than 50 equal-time records, full counts, alert-versus-Due,
No alert, terminal/intended delivery, midnight/DST and device-zone changes.
Synthetic storage tests are not physical crash observations.

The isolated browser fixture confirmed four visible root labels, global history
roots, selection footer, built-in Repeats, list-chevron navigation and independent
More, and Lists → Repeats → family → occurrence → Back restoration. At **360×800
CSS px**, the Lists image rectangle remained identical at offsets 0, 90 and 144.
The opaque plane's leading edge was respectively **200, 110 and 56 px**; the
144 px state survived a root switch, and Home restored offset zero with the same
artwork. The browser later stalled with debugger/navigation timeouts, including
a fresh-tab recovery attempt; the final scoped-page and 200% long English/Chinese
fixture follow-ups were not observed. Temporary-tab/viewport cleanup was attempted
but could not be confirmed through the unresponsive browser. Eight atmosphere/brightness scenes were reviewed in the shared browsing
header. Fixture captures are private under `verification/local/beta-fixes/ui`.
Web geometry and fixture actions do not prove native gestures, performance,
TalkBack, Android font scaling, IME or lifecycle behavior.

## Signed artifact identity

- Package/version: `com.remilo.app`, `0.4.0`, versionCode `4`.
- Variant/ABI: release, `arm64-v8a`; minSdk `34`, targetSdk `36`.
- Bundled JavaScript: yes. Debuggable: no. Signed: yes.
- APK SHA-256: `f8f07454eebcd9c98215966a452e93db10af5acacb23a299708eeaeda563a1f9`.
- Retained signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- APK: `android/app/build/outputs/apk/release/app-release.apk`.
- Private preparation summary: `verification/local/release-summary.json`.

The build ran after the five focused implementation commits. Tracked production
inputs matched the stated revision and remained unchanged during preparation.
Unrelated local skill/documentation changes were preserved and excluded from the
implementation commits. This records the observed source/build relationship;
version 0.4.0 alone cannot identify this APK. Subsequent evidence/checklist edits
do not change bundled inputs. Preparation installed and published nothing.

## Remaining observations

Read-only repository device discovery returned **no connected Android targets**.
Consequently there is no affected launcher/build reproduction or trace for the
Recents afterimage. No speculative lifecycle fix or system workaround was applied.
The scoped investigation must identify the affected signed artifact and separate
app/RenderThread work from launcher, SystemUI and SurfaceFlinger, then repeat the
same dismissal and check independent native alarm eligibility.

Use the [consolidated owner checklist](../device-acceptance.md) for actual Android
interaction, pre-unlock native loading/notification appearance, OEM accents,
cold/warm splash, Recents and reliability observations. These remain unobserved
on this artifact under the owner's deferred acceptance arrangement. Host success
and splash artwork approval do not pass those gates or authorize distribution.
Task status is maintained only in [the backlog](../backlog.md).
