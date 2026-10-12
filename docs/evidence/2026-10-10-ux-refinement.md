# UX refinement evidence — 10 October 2026

The owner approved the full [UX refinement](../design/current/ux-refinement.md)
for the existing `UX-Improvement` branch. This records implementation, actual
host checks, fixture observations and the remaining acceptance limits. Task
status is maintained only in [backlog](../backlog.md).

## Implementation and scope

- Editor: owned-input keyboard handoff, one-time blank-title focus, explicit
  search focus, measured three-line Title, one native-preview alert control,
  schedule-only preview identity, and transactional All day conversions with
  an editor-only timed snapshot.
- Details/cards: alert-first hierarchy, conditional Event/Due, original/current/
  intended/previous timing, matching-date-section omission, complete spoken dates,
  and accessible row Open plus independent Done/More without redundant View.
- Collections: retained applied filters with temporary sheet drafts, atomic Apply,
  Cancel, unchanged-Apply identity, optional counts/chips, explicit reset, guarded
  criteria changes, covered-art scroll reset, Show skipped and concise Trash copy.
- Settings: reordered groups, secondary Permissions & alarm check, captured Test
  and preference recovery, truthful observed-access summaries, Tomorrow clocks,
  independent Color mode/Atmosphere, canonical swatches and local Daily schedule.
- Current contracts, relevant TD plans, product/lifecycle descriptions and
  [U27–U31](../device-acceptance.md#ux-refinement-additions--u27u31-pending) were
  amended alongside the implementation. Frozen submissions, approval records,
  accepted artwork and historical passing evidence were preserved.

Native commands, bridge types, databases, scheduling eligibility, overdue policy,
backup formats, Calendar queries and publication behavior are unchanged by this
UX diff. No dependency, migration, artwork, navigation root or iOS work was added.
The existing Calendar “Could not load this view” issue remains deferred.

## Actual automated checks

Checks used project-local Node 22.23.3 and the repository scripts behind the npm
commands. Release-producing commands ran sequentially.

| Check | Actual result |
|---|---|
| `npm run verify` | Passed at **2026-10-10 23:49:24.561 UTC**: design/evidence audit, TypeScript, ESLint, **184 active source tests in 22 files**, **82 controlled tooling tests**. |
| `npm run verify:design` | Passed. Protected reference hashes and current design checks remain intact. The previously recorded 1672×941 reference-master resolution limitation is unchanged. |
| `npm run verify:android` | Passed at **2026-10-10 23:50:50.329 UTC**: native unit-test task, module lint, app release lint and signed release assembly; Gradle reported **BUILD SUCCESSFUL**, 1m 5s, 31 executed/1001 up-to-date tasks. |

The native unit-test task was **UP-TO-DATE**, with unchanged native source.
Its current XML reports contain **216 tests in 21 suites, zero failures/errors**;
these are reused host results, not newly observed physical behavior. Lint retains
one existing unused-variable warning in the frozen R8 reference-gallery generator;
there are no lint errors. Gradle retains its existing deprecation warning.

New domain cases cover All day linked/independent combinations, selected date/zone,
elapsed duration and civil offsets, relinking, initial-all-day fallback, failed
conversion, stale-review snapshot reset, gap/fold and short/long dates; schedule-only
preview; timing authority, terminal/unconfirmed delivery and safe/full dates;
filter draft/equality/reset/scope/guards; permission blockers/stale reads and
clock-only shortcuts across DST/zone boundaries.

Test discovery and type checking now exclude ignored historical source snapshots
under `verification/local`. Earlier 374/378-test reports remain historical evidence;
they must not be interpreted as the count of current active tests or rewritten.

## Signed artifact identity

The final application content was committed as
`e6c75557c8b6d894be985b92c074268d96e258df`. Shared checks ran on that content;
the checkout was clean at this revision throughout final Android assembly.
Subsequent evidence/backlog edits do not change the built application.

- File: `android/app/build/outputs/apk/release/app-release.apk`.
- Build time: **2026-10-10T23:50:50.329Z**; release, ARM64, bundled JavaScript,
  signed, non-debuggable.
- Package: **com.remilo.app**, version **0.4.0**, code **4**, minimum SDK **34**,
  target SDK **36**.
- APK SHA-256:
  `c45e6e5a45e5ece151f4176c557aeca0cb3ac9b34bc2b14ab56044786ba5802b`.
- Existing signer SHA-256:
  `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

No installation, launch, distribution or publication was performed.

## Isolated production-component fixture review

The repository preview adapter runs in memory, with synthetic reminders/settings;
it does not exercise the native engine, Android permissions, IME or delivery.
The following were observed at 360×800 browser viewport dimensions:

- Atmosphere choice sheets rendered in all eight atmosphere/color-mode pairs.
  Canonical surface/accent swatches, outlined two-tone samples, full labels and
  separate selection marks remained readable. The final conditional automatic
  Now label and explicit radio checked attribute were source-reviewed after
  these color captures; the captures are not post-correction accessibility evidence.
- Settings retained its atmospheric opening and reorganized connected groups.
  Filter-sheet Status preceded List, with reachable Apply/Cancel footer. Cancel
  left applied results unchanged; Apply Overdue produced its count/chip and native
  fixture-filtered results. Completed default excluded skipped; applying Show
  skipped displayed Skipped included and explicitly labeled skipped rows.
- A Reminder-channel blocker remained distinct from Alarm access and expanded
  channel information. A lost Test reply froze competing actions and offered
  Retry same test; retry produced the captured test's Scheduled result and
  View test reminder without creating a new test operation.
- A lost preference reply after closing Snooze left recovery beside Snooze &
  postpone. Retry confirmed the captured preference and refreshed its summary.

The browser automation surface stopped responding during subsequent editor
large-text review and also timed out on a fresh Settings tab. The partial
`editor-200-text.jpg` capture showed an unhydrated preview and is **excluded from
passing render evidence**. Full component coverage in landscape, long English/
Chinese, 200% text and reduced motion was not completed in this session. No
Android accessibility or keyboard result is inferred from browser DOM or images.
The temporary viewport override was reset; attempted stalled-tab cleanup could
not complete through the unresponsive browser surface.

Private check logs and fixture captures remain under ignored
`verification/local/ux-refinement-2026-10-10/`, including final shared/Android logs.

## Remaining acceptance

Use the consolidated owner checklist on an identified signed build for U27–U31:
creation/edit/duplicate focus and first-tap Save; long Title/Notes and composition;
retained search and keyboard Back; native picker Cancel/All day; filter Apply/
Cancel/Back and selection guards; TalkBack Open/Done/More and menu return; permission
handoff, Test recovery and sound preview; automatic atmosphere boundaries and
clock preferences. Complete the unfinished render matrix as well.

These observations remain pending under the owner's deferred-testing arrangement.
The implementation and host build do not declare a newly verified beta or alarm
reliability. Calendar troubleshooting and distribution remain outside this task.
