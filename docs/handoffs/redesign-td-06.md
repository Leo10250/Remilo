# TD-06 evidence — integrated host checks and signed preparation

Recorded 9 October 2026 from the integrated, uncommitted workspace on
`theme-update`, based on HEAD `1d62f6b1bba81241120c4f31e600a3d7bbce0ae3`.
That HEAD identifies the base, not a committed redesign or the source of an
installed APK. The integrator finished runtime edits before the successful
sequential release workflow below. This record captures that checked/built working
tree; later edits are not covered automatically. Live task status belongs only
in [backlog](../backlog.md).

## Subsequent source commits

After the final successful 17:18 UTC workflow and the owner's composition 05
approval, the same runtime changes were recorded on `theme-update` in focused
commits:

| Commit | Delivered source |
|---|---|
| `39212f8` | Approved atmosphere assets, circle-centered Classic integration and deterministic export tooling |
| `d704c34` | Native appearance persistence, migrations, frozen alarm presentation and guarded API corrections |
| `9d73dd8` | Shared atmosphere roles/crops/components, appearance transitions, geometry and implementation verification |
| `1cca40d` | Navigation, Agenda, editors, Lists, Repeats, Settings and utility workflows |
| `ef698f7` | Approved collection menus, display-only Activity icons and captured bulk operations |

No runtime changes followed the final preparation. The APK was built from the
working tree before these commits; its measured hash remains the artifact
identity. Committing checked source does not establish installation, CI results
or physical acceptance. The final documentation records the approval and these
observations separately. A direct comparison before asset staging found all
**221** checked hash-bound artifacts byte-identical between the index and working
tree, including exact-byte production ledgers and the native notification
vector. [TD-05](redesign-td-05.md#actual-host-evidence) records that portability
check.

A fresh export containing only indexed source and documentation subsequently
passed `scripts/verify-design.mjs` with **zero findings**, **zero untracked
files** and all **245** protected reference/decision files intact. This included
**1,257** local Markdown references, the active asset approvals/hashes and all
eight atmosphere/native derivative equality checks. Four handoff links to
ignored build logs were corrected to explicitly private evidence paths; actual
results and artifact identities remain recorded here. No verifier rule was
relaxed to make a fresh checkout pass.

## Scope and retained authority

The [TD-06 plan](../plans/redesign/td-06-consolidated-acceptance.md),
[current design](../design/current/README.md),
[implementation decisions](../design/current/implementation-decisions.md),
[product](../product.md), [architecture](../architecture.md) and
[verification contract](../verification.md) govern this integration.

The five implementation handoffs record delivered interfaces and their focused
evidence: [TD-01](redesign-td-01.md) shared roles/crops/components/verifier;
[TD-02](redesign-td-02.md) appearance and native-safe persistence;
[TD-03](redesign-td-03.md) screens, roots/origins and guarded workflows;
[TD-04](redesign-td-04.md) native sessions/privacy/controls;
[TD-05](redesign-td-05.md) individually approved circle-centered Classic v2.
All eight R3 references remain the shared visual authority; maintained page
contracts/corrections govern structure. Historical accepted PNGs, submissions and
decision identities remain unchanged.

Runtime R9 compositions **01–04 were rejected**. The latest owner instruction
authorizes candidate **05**: single collection-row Reopen/Restore in three-dot
menus, explicit selected-occurrence Completed Reopen/Move to Trash and Trash
Restore. Selection uses loaded-only IDs, separate selection semantics and
per-item guarded sequential operations with truthful partial/unknown recovery.
It overrides the previous no-bulk restriction. The
[maintained R9 contract](../design/current/screens/completed-trash-activity.md)
and [research](../design/current/r9-action-research.md) record these requirements.
Composition 05's actual browser fixture composition/interaction captures were
observed by the integrator and shown to the owner. The owner subsequently
[approved composition 05 for implementation](../design/r9-runtime-composition-approval-v5.json)
through `call_18cfacbd51c84ac7833eaa194408738c`, item 0, answering **Approve composition
for implementation**. That explicit decision closes the R9 composition
checkpoint for Completed, Trash, Activity and selection; it is separate from
passing tests or the APK. Activity's trash/history glyph remains informational.

## Actual sequential workflow

The integrator used the repository
[remilo-release skill](../../.agents/skills/remilo-release/SKILL.md) and command
`npm.cmd run release:prepare -- --json`. Only one release-producing workflow ran
at a time. The final run exited **0**, with `ok: true` and preparation timestamp
**2026-10-09T17:18:00.718Z**, after the final bulk feedback/footer, shorter-label
and grammar corrections. Its private records are
`verification/local/release-summary.json` and
`verification/local/ui-redesign/release-prepare-final05.log`.

| Completed check | Actual result | Completion UTC |
|---|---|---|
| Design implementation and preserved evidence | Passed, zero findings; 245 protected reference/decision files, 8 scene pairs/8 native-equal copies, 6 approved Classic exports/37 native-equal copies, 16 approved crop bindings and 2 generated representations. Eight master-resolution limitations remain reported. | 17:16:46.472 |
| TypeScript typecheck | Passed. | 17:16:48.794 |
| ESLint | Passed with zero errors; one unused-variable warning in the protected R8 reference gallery. | 17:16:56.377 |
| Shared tests | **17 files, 115/115 tests passed**; reported duration 1.06 seconds. | 17:16:57.840 |
| Controlled tooling tests | **75/75 passed**, zero failures/skips; reported duration 1801.0688 ms. | 17:16:59.698 |
| Android tests, owned module/app lint and release assembly/inspection | Passed; Gradle `BUILD SUCCESSFUL in 1m`, 1032 actionable tasks: 31 executed, 1001 up-to-date. | 17:18:00.718 |

The latest log invokes `:remilo-alarm:testDebugUnitTest`, owned module debug lint,
app release lint and release assembly. The unchanged native test/lint tasks are
reported **UP-TO-DATE**, rather than claimed as freshly executed tests. Reading
the retained native test XML under
`modules/remilo-alarm/android/build/test-results/testDebugUnitTest` confirms
**13 suites, 120 tests, zero failures/errors/skips**. XML suite timestamps span
**2026-10-09T16:59:28.397Z–16:59:39.602Z**. These were actually executed by the
earlier successful 17:01:30.626Z full workflow and accepted as unchanged by Gradle
in the latest pass; they are not inferred from focused test counts or retimestamped.

| Native suite | Tests |
|---|---:|
| AlarmEngineTest | 72 |
| MigrationTest | 7 |
| SoundPreviewControllerTest | 7 |
| AppearancePolicyTest | 6 |
| RecurrenceTest | 5 |
| AlarmPolicyTest | 4 |
| CivilTimeTest | 4 |
| BackupCodecTest | 4 |
| AgendaTest | 3 |
| SessionPresentationTest | 3 |
| FormGeometryPolicyTest | 3 |
| AtmosphereAssetsTest | 1 |
| TimeZoneCatalogTest | 1 |

The final native lint XML records **0 errors/8 warnings** for the owned module
and **0 errors/20 warnings** for the app release. Passing lint does not mean
warning-free source. The earlier full native compilation reported existing
unchecked Kotlin map casts; the latest pass reports Gradle deprecations. These
did not fail either successful run.

Relevant regression coverage includes automatic boundaries/DST/manual choices,
CE/DP migrations and mirror repair, cosmetic scheduling immutability, frozen
session styling/Direct Boot privacy/stale actions/deadlines, query intersections
and ordering/pagination, skipped Reopen and elapsed silence, captured operation
retries, drafts/recurrence previews, whole-backup conflict/receipt recovery and
isolated fixture/native-bridge behavior. New collection batching is covered by
shared captured-job tests; no atomic native batch or changed scheduling authority
is claimed. Each unit handoff gives the behavior-specific scope and limits.

## Failures corrected before the final pass

Earlier attempts did not count as successful preparation. The integrator fixed
a Node `Buffer` import and updated the preview source-anchor assertion to check
the explicit selection checkbox/open-target anatomy rather than weakening the
isolation guarantee. The initial full native attempt then failed owned Compose
lint: an outer `BoxWithConstraints` did not use its scope. Its recorded failure
is retained privately in `verification/local/ui-redesign/release-prepare.log`.
The unused outer scope was replaced with `Box`; no lint baseline/suppression was
added to hide the error. The successful 17:01:30.626Z command reran the full
workflow after that correction. Subsequent presentation/wording changes then
required and received the latest full sequential pass above. The current artifact
below comes from the 17:18:00.718Z run; native test reuse is explicitly recorded.

### Earlier successful integration pass retained as history

The earlier successful pass completed **2026-10-09T17:01:30.626Z**, with 115
shared, 75 tooling and 120 freshly executed native tests, owned lint and signed
assembly; Gradle reported 2m 34s and 1032 tasks (103 executed/929 up-to-date).
Its log remains `verification/local/ui-redesign/release-prepare-final.log`.
The then-measured APK was 83,895,347 bytes, last-write UTC 17:01:28, SHA-256
`8b92576fdc7cf8b7269a8b5bd65205ea5394feeecc911577348d5316517cef93`.
That pass was valid evidence for its earlier working tree, but its artifact is
superseded by the latest build after final presentation/wording changes. The
shared summary path now contains the latest result; no earlier APK installation
or physical observation is inferred.

## Signed local artifact identity

The final workflow assembled and inspected the existing release output:
`android/app/build/outputs/apk/release/app-release.apk`.
A read-only SHA-256 measurement after preparation identifies those bytes:

`927482ad16efe01290fcc63057cffac137185db4074bf8bc6a800050834669d3`

| Field | Inspected value |
|---|---|
| Package / native entry | `com.remilo.app` / `com.remilo.app.MainActivity` |
| Version | `0.4.0`, versionCode `4` |
| Variant / ABI | Release, `arm64-v8a` only |
| Android bounds | minSdk 34, targetSdk 36 |
| Runtime bundle | JavaScript bundled; `debuggable: false` |
| Signing | Signed with the existing identity; signer SHA-256 `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556` |
| Measured file | 83,895,691 bytes; last-write UTC 2026-10-09 17:17:59 |

The version/application/signing identities were retained deliberately. Version
0.4.0 alone cannot distinguish this artifact from prior 0.4.0 builds; use its hash
and this observed working-tree/build relationship. A later commit identifier
must be appended only when its source relationship is established. The summary
records **installed: false**, **published: false**, and
**physicalObservations: pending**. No phone update, launch, device observation or
distribution was performed by preparation. No signing keys or private device
diagnostics are included here.

## Render evidence and unresolved acceptance

The inspected ordinary fixture review includes all eight Appearance pairs at
360×800 and canonical contrast minima, recorded in
[TD-01](redesign-td-01.md#actual-focused-host-and-fixture-evidence).
TD-03 records focused page/workflow evidence. The integrator subsequently
observed candidate 05 normal Completed, Trash, Activity and selection states in
the actual browser export on localhost:8094. A captured two-item commit-once
lost-reply path retained its job, blocked Back while unconfirmed and completed
through exact same-item Retry with **2 of 2 confirmed**, without resubmitting
applied work as new operations. At 200% fixture text in Night Dark with long
English/Chinese, the Retry target measured **328×72 px**, top 712/bottom 784 in
the 360×800 viewport; scrollable captured-title content remained reachable.
All eight 200% Appearance fixture captures at 360×800 were also observed. Exact
capture identities and the interaction narrative are appended by the integrator
to [TD-03](redesign-td-03.md); rejected candidate 03/04 captures are not substituted
for this evidence.

These browser fixtures are memory-only: they cannot schedule native delivery or
access durable reminder data. The observations are host render/fixture behavior,
not native IME/composition/TalkBack or physical acceptance. Composition 05's
acceptance comes from the explicit owner decision and hash-bound review record
above; fixture checks alone do not create that approval.

All eight approved masters remain **1672×941**, below the recorded
**2048×1152** source target. Existing **1440×810** runtime/native derivatives are
byte-identical and approved; preserving/using them does not add source detail or
erase that limitation. Six circle-centered Classic v2 approvals authorize their
artwork/integration; OEM masks, actual splash and notification rendering are
still physical acceptance cases.

The consolidated [owner checklist](../device-acceptance.md) remains a future run
against an explicitly identified signed build, retaining G1/G2/G3 and the
engineering matrix in [verification](../verification.md). Observe all eight
scene/brightness pairs, Automatic/System/clock/zone changes and workflow holds;
360×800 and 200% English/Chinese; lower Notes/caret/composition, emoji/taller IME,
first-tap guarded Save, Back/rotation/lifecycle, TalkBack/reduced motion and system
picker/share flows. Native checks retain generic Direct Boot, frozen sessions,
artwork failure, initial/re-triggered notification actions, collisions,
first-member sound, original five-minute deadline and stale-action guards.
Also observe selected collection menu/checkbox/contextual actions, partial/unknown
recovery where a controlled QA setup is available, recurrence exceptions,
whole-backup Restore and static-branding/system presentation.

The owner's deferred physical run permits continued offline implementation;
host preparation does not verify the beta or authorize
distribution. Optional dynamic icons, Calendar/cloud and iOS remain outside
this integration. The owner has closed the R9 composition checkpoint; the later
consolidated phone run records actual pass/fail/unavailable results and conditions.
