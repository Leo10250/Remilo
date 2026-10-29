# Routine, photo, Trash and widget refinement

This record covers the owner's 16 October implementation instruction on branch
`event-routines`, starting at `177b513`. Current shared components, tokens and
installed artwork govern the result; frozen generated design examples were not
used as replacement UI specifications. Task status lives in the backlog.

## Implemented scope

- Shared rows declare navigation/action/picker intent. Context commands lose
  generic chevrons; settings hierarchy, weekday editors and genuine disclosures
  retain their respective affordances. Required labels are one localized phrase.
- The routine editor reuses date/time controls, keeps all three Alert options and
  supplies descriptive exercise fields, placeholders and persistent help. The
  standalone illustrated Focus card retains every ordered exercise beneath it,
  with a selected Viewing state, native-confirmed advance and named Undo.
- Routine menus open over Agenda/library/Focus/editor. Whole-family Trash is
  discoverable and reversible. CE16 journals revision-guarded family operations,
  retains child/history state and purge exclusions, and fences existing DP9
  deliveries before ownership changes. Family queries filter before pagination.
  Ownership transitions advance record/session revisions; restoring the same day
  cannot make an uncommitted pre-Trash app/widget command eligible again.
- Android Photo Picker selects one still image without broad media permission.
  Full-frame preview has no cropping tools. Private immutable hash-addressed WebP
  files preserve aspect ratio, orientation and alpha, remove source metadata,
  cap source/normalized sizes and retain historical references and draft leases.
- Portable format 7 streams a photo-inclusive `.remilo` ZIP through native
  prepared-file/import handles. Legacy JSON 1–6 remain readable; archive paths,
  entries, media hashes/dimensions and expanded size are checked before references
  commit. Receipt-first retries bind the original handle and copy choices.
- Glance uses one opaque reading surface, compact hierarchy, primary Resume plus
  separate Done/Refresh and eligible named Undo. Actual dimensions/font scale
  select summary/interactive/expanded layouts. Exact date/exercise links and
  native action ownership remain intact. Preferred placement is 4×2.

## Design evidence applied

[Google's widget sizing guidance](https://developer.android.com/design/ui/mobile/guides/widgets/sizing)
and [quality criteria](https://developer.android.com/docs/quality-guidelines/widget-quality)
support filling launcher bounds, actual-dimension breakpoints, readable content
and updates after actions. [Apple's widget guidance](https://developer.apple.com/design/human-interface-guidelines/widgets)
supports glanceability and contextual navigation. Android conventions govern.

[Hollman et al. (2025)](https://formative.jmir.org/2025/1/e59477/)
informs concise guidance, preserved progress and explicit correction;
[Berry et al. (2026)](https://aging.jmir.org/2026/1/e87332/)
informs readable navigation and understandable demonstrations. These small
population-specific studies do not establish adherence gains or prove this
layout outperforms a checklist. Chevron choices follow interaction semantics,
not a claimed experimental finding against every disclosure accessory.

## Observed component review

An isolated memory-only browser fixture demonstrated full sequence membership
through completion, native-shaped count changes, selecting a checked exercise
after final completion and named Undo. The follow-up Undo of DB bench changed
only that check and returned to it. Agenda More opened/closed over the same
Agenda URL and scrolled context, with the routine progress bar visible.
The new routine editor showed the shared timing structure and all three Alert
choices; exercise form examples/help and the top photo option were inspected.
These are browser observations, not Android engine, picker or phone acceptance.

The broader browser appearance sweep stalled on CDP navigation; only its completed
captures may be counted. Native RemoteViews captures and automated results are
reported below separately. No phone was installed, opened or modified.

Exact-exercise Resume uses a keyed dated destination and also consumes repeated
links on an already mounted screen through the documented
[React Native 0.86 Linking event](https://reactnative.dev/docs/0.86/linking#handling-deep-links).
Normal completion does not reconsume the original link. The key follows
[React's state-reset guidance](https://react.dev/learn/preserving-and-resetting-state#resetting-a-form-with-a-key).
The repeated Android-intent scenario remains part of launcher acceptance.

## Final host verification and signed artifact

`npm run release:prepare -- --json` completed successfully at
**2026-10-16 19:03:27.563 UTC**, using the repository release skill and existing
signing identity. Runtime sources were not changed after this final run.

| Check | Actual result |
|---|---|
| English/Simplified Chinese catalog generation/check | 2,118 message pairs, deterministic outputs verified |
| Current-design implementation/preserved-reference audit | Passed, no findings; existing approved scenery master-resolution limitation retained |
| TypeScript | Passed |
| ESLint | No errors; one existing unused-variable warning in frozen R8 gallery evidence |
| Shared/domain tests | 311 passed in 38 files |
| Controlled tooling fixtures | 97 passed |
| Android unit tests | 525 passed in 41 suites, zero failures/errors/skips |
| Owned module/app Android lint | No errors; 27 module and 20 app warnings remain |
| Signed bundled ARM64 release assembly/inspection | Passed |

Native coverage includes independent dated progress and receipt retries, the
Trash/Restore revision fence, family recovery checkpoints, prior child deletion,
old-backup purge exclusions, immutable photo/history references, alpha/orientation,
downsampling/oversize rejection, active leases/abandoned sources, archive integrity,
legacy import, migration and ordinary reminder/Calendar regressions.

The eight `WidgetRenderTest` cases use actual Glance RemoteViews, not a separate
mockup. They cover all eight atmosphere/brightness pairs in both languages at
expanded size, compact Focus, summary/200% text, 150% action bounds, named Undo,
Retry, Rest/Paused/Skipped/Completed/unavailable/locked states, and production vs
inert-preview label/Refresh parity. Full-resolution compact and large Chinese
captures were inspected; the 16-frame appearance/language contact sheet was also
reviewed. The full app/launcher Cartesian matrix remains a device/review gate,
not an inferred pass from shared tokens.

Earlier attempts caught an isolated preview dependency, a missing schema constant,
a new-test syntax error and React hook lint errors. These were corrected without
weakening checks. The final suite additionally verifies the pre-Trash uncommitted
widget/app command remains stale after Restore. The sandbox-only local Git clone
failures disappeared when tooling ran with normal process access.

Artifact identity:

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- Package/version: `com.remilo.app`, **0.4.0 (4)**; `arm64-v8a`, minimum SDK 34,
  target SDK 36;
  release, non-debuggable and bundled JavaScript.
- SHA-256: `aa5609f79e9baaa90368712ea9a93d800e8412609942b350a1438caa73b137bf`
- APK bytes: `95,655,879`.
- Signer certificate SHA-256:
  `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Private workflow summary: `verification/local/release-summary.json`.
- Private final log: `verification/local/routine-release-final.log`.
- Nonpersonal native captures: `modules/remilo-alarm/android/build/widget-captures/`;
  inspected compact example `routine-focus-compact.png`.
- Browser captures/contact sheet: `verification/local/routine-refinement-captures/`.

The artifact was built locally. It was not installed, distributed or published.

## Physical acceptance

The [consolidated checklist](../device-acceptance.md#routine-photos-and-compact-widget-refinement-16-october)
retains Photo Picker/provider cancellation, process interruption, low storage,
launcher placement/resizing/reconfiguration, native keyboard/Back/TalkBack,
full app appearance/accessibility matrix and end-to-end delivery/date/history
observations. Host checks and signed assembly do not close these gates.
