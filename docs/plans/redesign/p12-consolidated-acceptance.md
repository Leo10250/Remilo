# P12 Consolidated Acceptance

**8 October refinement inputs:** [R10 Data/Help](../../design/r10-data-help-specification.md)
and [fourteen prospective captures](../../design/r10-data-help-fixtures.json)
under [A32](../../design/r10-data-help-intake.json) are proposed documentation,
not new implementation dependencies or accepted renders. During the integrated
acceptance, verify the actual backup/share/restore and diagnostic workflow against
all four global themes in Light/Dark, including frozen retry, real bridge rejection,
retained report errors, native OS handoffs and readable footer/accessibility.
Use [the canonical corrections](../../design/approved-ui-r3-r4.md) over conflicting
historical visual assumptions. Keep pending phone/file observations separate from
[draft evidence](../../evidence/2026-10-08-r10-data-help-refinement.md).

## 1. Objective and user-visible outcome

Verify the integrated redesign on an identified signed bundled artifact with host
evidence and one consolidated owner-operated phone run, fixing failures before any
claim of verified beta. Distribution is not authorized by this milestone.

## 2. Current relevant repository state

Earlier host/signed-build evidence exists, but the redesigned product is not
implemented/accepted. Last recorded shared verification failed; existing native review
captures are host fixtures, not verification of HEAD `9195784`. G1/G2/G3 physical
gates and UI refinements still have
pending observations. Read [reassessment](../../evidence/2026-10-06-redesign-reassessment.md),
[verification](../../verification.md), [owner checklist](../../device-acceptance.md)
and all actual milestone handoffs; never attribute old APK evidence to new source.

## 3. Scope

Reconcile all P02-P11 contracts/tests/approvals, consolidate physical scenarios into
the existing owner checklist, run host verification and prepare one signed bundled
build serially. Confirm separate installation authorization/target before deployment.
Record owner UX/accessibility/migration/notification/alarm/launcher observations
against that exact artifact. Fix failures in their owning scope and reverify changed
coverage; a changed build requires updated artifact identity and impacted observations.

## 4. Explicit non-goals

No publishing/distribution, universal OEM claims, invented human observations,
uninstall/data-clear/permission-grant workarounds, force-stop-as-cold-process proof,
new integrations, or relaxing product/tests to pass acceptance. Do not add repeated
uncoordinated phone requests outside the consolidated owner run.

## 5. Prerequisites and dependencies

Hard prerequisites: P02, P03, P04, P05, P06, P07, P08, P09, P10, P11.
Integration dependencies: None.

Here hard prerequisites mean all mandatory accepted deliverables, not merely early
capability handoffs: P04 includes A-D, P11 means manual/on-open core, and every
applicable cross-plan integration gate must be closed. Optional P11B background
matching is excluded unless separately authorized into a later acceptance scope.

Require integrated accepted handoffs, P01 approval still valid, no unresolved known
failures hidden by status, available original signing identity and explicit owner
authorization for the consolidated session. Refine matrix against actual artifact/
OS/launcher and unmet G1-G3/U checks. Read [approval ledger](../../design/approvals.md)
and [handoff protocol](../../handoffs/README.md). Physical gates may be pending at
intake; they are the purpose of P12, not prerequisites to invent as passed.

## 6. Relevant product requirements

Offline native delivery without JS/network; independent registrations, stale
generation/session actions rejected, Stop != Done, five-minute first-start deadline,
no replay on restore/recovery, generic Direct Boot/privacy. All recurrence/timing/
Trash/migration/backup contracts remain intact. Appearance defaults/Auto/cache/zone/
frozen canvas/alias guards must match approved plans. Accessibility includes >=48 dp,
composite 4.5:1 normal/3:1 large/control contrast, 200% text, TalkBack, keyboard,
reduced motion and grayscale. Chinese means classification/rendering, not localization.

## 7. Approved visual references

Use exact accepted P01-P11 artifacts and ledger IDs; compare final actual RN/native
screens to them and [original references](../../design/references/README.md).
New source cannot inherit visual approval automatically when a composition changed.

## 8. Required design decisions

**Approved:** one consolidated owner-operated run, actual artifact attribution,
host/device distinction, preserve data/signing and separate distribution permission.

**Proposed:** final run order, controlled probe data, device/OS/launcher coverage,
safe recovery/cleanup and impacted retest policy. Owner agrees the checklist and
installation/launch scope before device actions. Another OEM remains necessary
before broad manufacturer claims; unavailable scenarios remain explicitly unverified.

**Agent choices:** efficient scenario batching and redacted evidence format using
repository scripts/skills; no substitute tooling that bypasses deployment safety.

## 9. Expected deliverables

Integrated contracts/approval reconciliation, extended single owner checklist,
passing shared/native host evidence, inspected signed artifact identity/source
relationship, authorized installation outcome separately from launch, redacted
owner observation report/failure fixes and `docs/handoffs/redesign-p12.md`.

## 10. Functional acceptance criteria

- Shared/native suites pass without weakened tests; all CE upgrades/backup1-4,
  recurring policy copies, cosmetic unchanged-target/generation and locked fallback
  cases have recorded coverage. No unresolved known failure is silently deferred.
- Signed bundled build uses original identity; record source relationship, APK
  hash/signer/variant/version/ABI. No Metro dependence and no signature/data bypass.
- Owner observes cold ordinary process/offline, locked/pre-unlock, first/re-triggered
  notification actions, collisions/independent controls, stale actions, interruption,
  permissions and five-minute cutoff. Distinguish force-stop/Active Apps Stop.
- Owner observes navigation/origin/filters/scroll, simple creation, keyboard/native
  pickers/Back, stale/uncertain drafts, event/Due/alert and Stop/Done comprehension,
  recurring scopes/old unfinished work, recoverable Trash and sound-preview ownership.
- Owner observes legacy/fresh defaults/migration, old backup readers, manual/Auto/
  Smart/Chinese/emoji, boundary/zone deferral, frozen multiple alarms, launcher opt-
  out/on-open matching/session deferral and upgrade recovery. Closed-app workers/
  background delay are optional P11B checks only when separately authorized, not
  requirements for this first consolidated run.
- Missing observation is pending, not pass. Fix failures and identify re-tested build;
  complete only the bounded verified claim supported by evidence.

## 11. Visual acceptance criteria

Review final actual layouts across all eight light/dark themes and controlled
English/Chinese/long/all-day/independent/paused/ended/overdue/stopped/postponed/
manual/empty/loading/error/multiple-alarm states. Use 360x800/larger/expanded host
captures plus physical 200% text/TalkBack/keyboard/reduced-motion observations.
Measure composite contrast and non-color comprehension. An attractive screenshot
does not establish usability; accepted P01/P02 style must remain visible in final app.

## 12. Verification requirements

Run `npm run verify` and `npm run verify:android`; signed preparation/build commands
remain serial. Use repository `$remilo-release` for requested release preparation,
`$remilo-deploy` only after installation authorization, and `$remilo-device-debug`
for scoped evidence. Optional `verify:device` is read-only identity diagnostics,
not a proof of source or audibility. Preserve raw logs/captures/serials under ignored
`verification/local`; commit only redacted evidence with timestamp, observer, device/
OS/permissions, scenario, result and measured duration. No sources edited mid-build.

## 13. Regression risks

Old artifact/source misattribution, testing debug instead of bundled signed release,
unrecorded build changes after observations, lost private data during deployment,
automated logs mistaken for audibility, scope claims broader than device coverage,
or physical failures masked by host success.

## 14. User approval checkpoints

Authorize/refine P12 after integrated handoffs; agree consolidated checklist and
device/install/launch scope. Owner records actual observations and accepts resulting
evidence/remaining limitations. No distribution approval is implied; obtain it separately.

## 15. Completion and handoff requirements

Record final artifact/commit(s), approval coverage, every actual command/observation,
fixed failures and residual unverified OS/OEM cases. Update live backlog gates only
with matching evidence; do not declare full beta verified while required physical
checks remain missing. Hand off verified bounded scope and remaining release decisions.
Stop without publication or optional integrations.

## 16. Fresh-chat execution prompt

```text
Verify all listed prerequisite completion, accepted handoffs and owner approvals.
Execute only P12 Consolidated Acceptance after explicit authorization. Read AGENTS.md,
core docs, redesign specification/index, docs/plans/redesign/p12-consolidated-acceptance.md,
approval
ledger, every mandatory accepted P02-P11 handoff (P04A-D, P11 core) and the single
owner phone checklist. Require all applicable integration gates closed; optional
P11B background work cannot block this run and must not be claimed tested.
Inspect actual integrated source; verify P01 approval still applies and stop on
missing implementation/approvals or known unresolved failures. Refine the consolidated
matrix with me. Run shared/native verification and signed preparation serially using
the repo release skill; record actual artifact/source identity. Confirm separate
device installation/launch authorization and target before using deploy skill.
Preserve data/signing; never uninstall, clear data, grant permissions or bypass failure.
Coordinate one owner-operated run covering UX/accessibility/migration/backup/native
alarms/Direct Boot/collisions/stale actions/cutoff/time/Smart/launcher behavior.
Keep host/emulator/log evidence distinct from human observations and private captures
ignored. Fix failures, reverify impacted scope against identified builds, and record
redacted evidence, approvals, backlog and P12 handoff. Missing checks remain pending.
Do not distribute, publish or start optional integrations.
```
