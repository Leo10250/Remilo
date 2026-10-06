# P11 Launcher Personalization

## 1. Objective and user-visible outcome

Users can keep Classic, choose a stable palette icon or optionally match the app
atmosphere, with honest best-effort updates and no risk to native alarm entry points.

## 2. Current relevant repository state

No aliases or WorkManager exist in the baseline. Alarm-clock show handles currently
resolve the launcher; deployment launch targeting must also be inspected before
aliases. Inspect `AlarmScheduler.kt`, Android manifest/MainActivity/MainApplication,
recovery receivers, `scripts/lib/deployment.mjs` and native session guards. P03
provides reviewed variants, P04 settings, P08 session boundaries and P09 period API.
See [baseline](../../evidence/2026-10-06-redesign-reassessment.md).

## 3. Scope

First move existing show-alarm/deploy launch targeting to stable explicit MainActivity.
Then introduce one enabled launcher alias and reviewed manual variants, optional
Match app theme plus open/resume-only or best-effort closed-app update controls.
Implement atomic alias application/recovery and Starting/Active deferral. Add pinned
WorkManager lazily after unlock without React and reconcile unique delayed boundary
continuations with current preferences/time/session state on run.

## 4. Explicit non-goals

No change to application/signing identity, alarm components/deadlines, individual-
reminder icon matching, exact cosmetic alarms, polling, foreground cosmetic service,
launcher-cache guarantees, network or credential access before unlock.

## 5. Prerequisites and dependencies

Dependencies: P03, P04, P08, P09.

Require accepted variants/settings/Starting-Active guard/period interfaces and
frozen native session behavior. P10 is not required because matching follows app
atmosphere, never category identity. Refine alias/worker/recovery design with actual
API34+ and pinned WorkManager official documentation before implementation. Read
[architecture](../../architecture.md), [verification](../../verification.md),
[approvals](../../design/approvals.md) and dependency [handoffs](../../handoffs/README.md).

## 6. Relevant product requirements

Classic remains default. System-themed icons use system colors independently.
Aliases must never disable MainActivity or alarm components; exactly one launcher
alias remains enabled through atomic supported PackageManager batch changes and
recovery. Defer while session Starting/Active. Matching follows current atmosphere.
Closed-app behavior is best effort and launcher caching may delay display.
Initialize WorkManager only after unlock without React, remove only its initializer
metadata and preserve other Startup initializers. Use unique delayed continuation;
execute current state, skip missed boundaries, cancel superseded work; running
worker appends successor instead of replacing itself. Reconcile on open/resume and
unlocked boot/upgrade/time/zone changes. Cosmetic work never uses exact alarms/FGS.

## 7. Approved visual references

Use accepted P03 source/adaptations/variant inventory and P02 catalog. The
[Classic board](../../design/references/supplied-classic-icon-board.png) anchors fidelity.
Actual launcher behavior is device evidence, not a reference-mask screenshot.

## 8. Required design decisions

**Approved:** stable MainActivity, atomic one-alias policy, independent icon controls,
optional atmosphere matching, session guard and lazy best-effort worker constraints.

**Proposed:** alias naming/migration recovery, durable desired/applied state and
stale-work epoch checks, retry limits, guard-release reconciliation, user controls/
cache-delay wording and unique-chain semantics. Approve design before introducing
aliases/dependency; do not lock a WorkManager version without current compatibility checks.

**Agent choices:** pinned library version, minimal worker/configuration implementation,
receiver integration and deterministic PackageManager tests within existing authority.
Do not initialize React or create a competing scheduling engine.

## 9. Expected deliverables

Stable alarm/deployment entry points and regression tests; aliases/atomic application/
recovery; manual/matching controls; lazy WorkManager delayed continuation and stale
guard tests; merged manifest review; launcher evidence limitations, contracts and
`docs/handoffs/redesign-p11.md`.

## 10. Functional acceptance criteria

- Alarm registrations/show handles and deployment launch target MainActivity before
  alias rollout, including before unlock. No activity is started while making a handle.
- Manual/theme/default switches preserve exactly one alias and enabled native alarm
  components; interruption/error/upgrade recovery cannot hide the app. Session
  Starting/Active defers changes and applies latest desired state after safe release.
- Opt-out/open-resume-only/manual mode cancels superseded work. Late/cancelled/running
  stale workers re-read preferences/epoch/time and cannot restore a superseded icon.
- Worker runs after unlock without React, skips missed bands, appends next unique
  continuation safely and tolerates execution delay. Boot/time/zone/upgrade reconcile
  idempotently; DP contains no private appearance inference.
- Matching uses atmosphere, never an individual reminder or frozen alarm canvas.
  Existing default remains Classic; system-themed resources remain separate.
- No exact/foreground/polling cosmetic scheduling and no changes to delivery targets,
  permissions, sound/deadlines or unrelated Startup metadata.

## 11. Visual acceptance criteria

Manual variants render identically to P03 accepted masks and remain recognizable at
actual launcher sizes/system-themed mode. Controls clearly distinguish icon choice,
matching and update timing, with honest cache-delay wording. Meet P02 accessibility
in light/dark/200% text. Device/launcher-specific visibility remains P12 observation.

## 12. Verification requirements

Run shared tooling tests for stable deploy launch and native unit/lint/assembly checks
serially. Test alias batches/rollback/recovery, active-session races, stale epochs,
worker continuation/cancel/locked initialization and upgrade manifest behavior.
Inspect merged startup metadata and component enablement. Host/emulator behavior
cannot pass physical launcher/Direct Boot acceptance; do not deploy without authorization.

## 13. Regression risks

Disabling the stable activity, multiple/no icons, cached launcher inconsistencies,
pre-unlock WorkManager initialization, stale worker restoring old preferences,
self-replacement cancelling successor, or icon mutation interfering with active alarms.

## 14. User approval checkpoints

Authorize/refine after dependencies; approve stable-entry/alias/worker recovery
contract and control/cache disclosure before rollout. Approve actual host behavior
with honest device limitations; final launcher observations require P12 owner run.

## 15. Completion and handoff requirements

Publish stable component names, alias inventory, desired/applied/epoch semantics,
worker initialization/chain/recovery contract and physical matrix for P12. Record
actual checks/approved controls, updated architecture/backlog and standard handoff.
Do not distribute or claim universal launcher responsiveness.

## 16. Fresh-chat execution prompt

```text
Verify all listed prerequisite completion, accepted handoffs and owner approvals.
Work only on P11 Launcher Personalization after authorization. Read AGENTS.md,
core docs, redesign specification/index, docs/plans/redesign/p11-launcher-personalization.md,
approval
ledger and accepted P03/P04/P08/P09 handoffs. Inspect actual manifest, scheduler,
deployment targeting, native sessions and lifecycle; stop on missing approvals.
Refine with official version-matched Android/WorkManager docs and obtain my recovery/
controls approval. First use stable MainActivity show/deploy targets, then guarded
atomic one-alias switching and independent manual/match/update-timing controls.
Implement lazy-after-unlock no-React WorkManager unique delayed continuation with
stale preference/epoch checks, cancellation and safe successor append. Preserve
MainActivity/alarm components, sessions, DP privacy and all scheduling semantics.
No exact cosmetic alarms, FGS, polling, individual-reminder matching or deployment.
Verify races/upgrade/opt-out with shared/native checks serially and inspect merged
manifest. Record approvals/evidence/backlog/P11 handoff and deferred launcher proof.
```
