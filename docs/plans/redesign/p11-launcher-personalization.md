# P11 Launcher Personalization

## 1. Objective and user-visible outcome

Users can keep Classic, choose a stable palette icon or match the app atmosphere
when opening/resuming, without risking native alarm entry points. Closed-app matching
is a separately authorized optional extension, not part of the required core.

## 2. Current relevant repository state

No alias-switching or WorkManager implementation exists at tracked HEAD `9195784`.
Alarm-clock show handles currently
resolve the launcher; deployment launch targeting must also be inspected before
aliases. Inspect `AlarmScheduler.kt`, Android manifest/MainActivity/MainApplication,
recovery receivers, `scripts/lib/deployment.mjs` and native session guards. P03
provides reviewed variants; P04A will supply settings/descriptors and P09 the period
API. Starting/Active session state already exists in the native engine/operational
query, so the alias safety guard does not depend on P08's visual redesign.
See [baseline](../../evidence/2026-10-06-redesign-reassessment.md).

## 3. Scope

First move existing show-alarm/deploy launch targeting to stable explicit MainActivity.
Then introduce one enabled launcher alias and reviewed manual variants, with Match
app theme explicitly checking the atmosphere on opening/resuming. Implement atomic
alias application/recovery and Starting/Active deferral. Apply a deferred request
only at an eligible foreground reconciliation; do not add closed-app triggers.
Core adds no WorkManager dependency, initializer or worker and shows no background
update control promising an unavailable capability. P09 time-mode matching is a
separate integration gate, not a blocker for manual/fixed on-open switching.

Optional P11B preserves closed-app matching as future scope. It requires separate
authorization and mechanism/compatibility approval after core P11 and P09 accepted
outputs. WorkManager was named in the earlier specification and remains a candidate,
not a selected/pinned dependency. Retain its safety/late-work tests conditionally
if selected. Delayed execution is best effort, not an exact-boundary guarantee
([Android guidance](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work#delayed_work)).
P11B neither runs automatically after core nor blocks P12's first consolidated gate.

## 4. Explicit non-goals

No change to application/signing identity, alarm components/deadlines, individual-
reminder icon matching, exact cosmetic alarms, polling, foreground cosmetic service,
launcher-cache guarantees, network or credential access before unlock. Core excludes
background matching, boot/time/zone icon workers, WorkManager and Startup changes.

## 5. Prerequisites and dependencies

Hard prerequisites: P03, P04A.
Integration dependencies: P09.

Core requires accepted P03 variants and P04A settings/descriptor contract plus
verification of the existing native Starting/Active guard. P09 integrates time-mode
matching; P08 is not a hard prerequisite for native alias safety. P10 is not required
because matching follows atmosphere, not category identity. Optional P11B hard
prerequisites are P11 core and P09, with separate authorization/mechanism review.
Refine core alias/recovery design against actual API34+ official docs. Read
[architecture](../../architecture.md), [verification](../../verification.md),
[approvals](../../design/approvals.md) and dependency [handoffs](../../handoffs/README.md).

## 6. Relevant product requirements

Classic remains default. System-themed icons use system colors independently.
Aliases must never disable MainActivity or alarm components; exactly one launcher
alias remains enabled through atomic supported PackageManager batch changes and
recovery. Defer while session Starting/Active. Matching follows current atmosphere.
Core matches on opening/resuming, never through closed-app automation; launcher
caching may delay display. Existing opt-in/default and DP privacy remain unchanged.
Cosmetic work never uses exact alarms/FGS/polling or initializes React for native
alarm delivery.

If optional P11B later selects WorkManager, initialize only after unlock without
React, remove only its initializer metadata and preserve other Startup initializers.
Use unique delayed continuation, latest preferences/time, missed-boundary skipping,
superseded-work cancellation and safe successor append by a running worker.
Unlocked boot/upgrade/time/zone reconciliation and late-worker guards belong only
to that separately approved extension. These constraints are not dependency approval.

## 7. Approved visual references

Use accepted P03 source/adaptations/variant inventory and P02 catalog. The
[Classic board](../../design/references/supplied-classic-icon-board.png) anchors fidelity.
Actual launcher behavior is device evidence, not a reference-mask screenshot.

## 8. Required design decisions

Use accepted P01 [settings/selection language](../../design/ui-composition.md) for
named icon/palette choices, non-color selection and pending/failure feedback; preserve
the separate manual icon and matching concepts. The exact Classic identity remains A01.

**Approved:** stable MainActivity, atomic one-alias policy, independent icon controls,
on-open/resume atmosphere matching and session guard. The owner explicitly made
closed-app updates optional/nonblocking for P12; that is scope approval, not code approval.

**Proposed:** alias naming/migration recovery, durable desired/applied state and
retry limits, eligible foreground guard-release reconciliation and core controls/
cache-delay wording. Approve alias/recovery design before rollout. Optional P11B's
mechanism, version, stale-work epochs and chain semantics remain open until its own
planning/approval session; do not silently select WorkManager from this document.

**Agent choices:** minimal core alias application and deterministic PackageManager
tests within existing authority. Optional-extension mechanism selection is not an
implicit core agent choice. No new scheduler, background receiver or React startup.

## 9. Expected deliverables

Stable alarm/deployment entry points and regression tests; aliases/atomic application/
recovery; manual/on-open matching controls; existing-session guard tests; merged
manifest review proving no new worker/initializer; evidence limitations, contracts
and `docs/handoffs/redesign-p11.md`. Only a separately authorized P11B produces
background implementation/tests and `docs/handoffs/redesign-p11b.md`.

## 10. Functional acceptance criteria

- Alarm registrations/show handles and deployment launch target MainActivity before
  alias rollout, including before unlock. No activity is started while making a handle.
- Manual/theme/default switches preserve exactly one alias and enabled native alarm
  components; interruption/error/upgrade recovery cannot hide the app. Session
  Starting/Active defers changes until the next eligible foreground reconciliation,
  applying the latest desired state rather than an obsolete request.
- Match mode resolves the current atmosphere on opening/resuming; P09 time mode
  integrates when available. Manual selection opts out of matching. No core worker,
  closed-app boundary update, boot/time/zone automation or initializer is added.
- Matching uses atmosphere, never an individual reminder or frozen alarm canvas.
  Existing default remains Classic; system-themed resources remain separate.
- No exact/foreground/polling cosmetic scheduling and no changes to delivery targets,
  permissions, sound/deadlines or unrelated Startup metadata.
- Only for an authorized P11B: verify opt-out/cancellation, stale/running workers,
  latest preferences/time, unlock/privacy, safe successor append and delayed/upgrade
  recovery. Missing optional-extension evidence cannot fail core P11 or P12 scope.

## 11. Visual acceptance criteria

Manual variants render identically to P03 accepted masks and remain recognizable at
actual launcher sizes/system-themed mode. Controls clearly distinguish icon choice,
matching on open/resume, with honest cache-delay wording and no background promise.
Meet P02 accessibility
in light/dark/200% text. Device/launcher-specific visibility remains P12 observation.

## 12. Verification requirements

Run shared tooling tests for stable deploy launch and native unit/lint/assembly checks
serially. Test alias batches/rollback/recovery, active-session/deferred-request races,
on-open/manual controls and upgrade manifest behavior. Inspect component enablement
and unchanged Startup metadata. Optional P11B alone adds stale-worker/continuation/
cancel/locked-initialization checks. Host/emulator behavior
cannot pass physical launcher/Direct Boot acceptance; do not deploy without authorization.

## 13. Regression risks

Disabling the stable activity, multiple/no icons, cached launcher inconsistencies,
or icon mutation interfering with active alarms. Optional P11B additionally risks
pre-unlock initialization, stale workers and self-replacement cancelling successors.

## 14. User approval checkpoints

Authorize/refine core after hard prerequisites; approve stable-entry/alias recovery
and on-open/cache disclosure before rollout. Accept P09 time-mode integration when
present. Final launcher observations require P12 owner run. P11B requires a separate
scope/mechanism approval before adding any background dependency or implementation.

## 15. Completion and handoff requirements

Publish stable components, alias inventory, desired/applied/deferred-request semantics,
core physical matrix and P09 integration evidence for P12. Explicitly exclude P11B
from core completion/first acceptance. A future extension gets a separate mechanism/
initialization/recovery handoff and scoped device checks, never inferred core proof. Record
actual checks/approved controls, updated architecture/backlog and standard handoff.
Do not distribute or claim universal launcher responsiveness.

## 16. Fresh-chat execution prompt

```text
Execute P11 core only after explicit authorization. Read AGENTS.md, core docs,
docs/appearance-redesign.md, the redesign index, docs/plans/redesign/p11-launcher-personalization.md,
approval ledger and accepted P03/P04A capability handoffs. Verify hard prerequisites
against actual manifest/scheduler/deploy targeting and existing Starting/Active
session state; stop on missing approval. Obtain alias/recovery/control approval.
First use stable MainActivity show/deploy targets, then atomic guarded one-alias
manual switching and theme matching on open/resume. Defer during active sessions
until eligible foreground reconciliation; latest desired state wins. P09 time-mode
matching is an integration gate, not a start blocker; record missing integration.
Do not add WorkManager, workers, Startup changes or closed-app triggers/controls.
Preserve alarm components, targets, deadlines, signing and privacy. Verify core
controls/races/upgrades with relevant shared/native checks serially; obtain artifact
approval and record evidence, backlog and docs/handoffs/redesign-p11.md. Stop; no
automatic P11B continuation, deployment or claim of optional background acceptance.
```

Optional-extension prompt, usable only with a separate explicit P11B authorization:

```text
Plan/refine P11B only if I explicitly authorize that optional extension. Read AGENTS.md,
core docs, docs/appearance-redesign.md, the redesign index,
docs/plans/redesign/p11-launcher-personalization.md, approval ledger and accepted
P11 core/P09 handoffs. Verify hard prerequisites; stop if authorization is absent.
Evaluate and obtain my mechanism/compatibility/recovery approval before adding any
background dependency. WorkManager is a candidate, not a locked choice. Preserve
best-effort delay disclosure, unlocked/no-React/privacy/session guards and no exact
alarms/FGS/polling. If authorized to implement the approved mechanism, verify late/
cancelled/running work, opt-out, latest preferences/time, safe continuation and
upgrade recovery; record docs/handoffs/redesign-p11b.md and separately scoped device
evidence. Do not alter core P11/P12 acceptance or assume installation authorization.
```
