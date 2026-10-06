# P04 Fixed Appearance

## 1. Objective and user-visible outcome

Users can select a fixed app palette independently of brightness and make durable
manual reminder/series choices, with safe recurrence inheritance and portable backups.

## 2. Current relevant repository state

Native settings support `theme` brightness only. Credential schema is 4, operational
schema 3, backup format 3; managed Lists and serialized/revision-guarded operations
already exist. Inspect `ContentDatabase.kt`, `BackupCodec.kt`, `AlarmEngine.kt`,
`SeriesCoordinator.kt`, bridge models and the existing preference controller.
The review catalog/resolver is not a durable production implementation. See
[baseline](../../evidence/2026-10-06-redesign-reassessment.md) and actual P02 handoff.

## 3. Scope

Keep P04 as one top-level plan, implemented in four separately authorized sessions.
Its original settings/policies/portability/chooser scope is retained, not reduced.
Design the manual-policy and backup semantics together before storage changes, but
deliver the code through these bounded units:

| Unit | Scope and deliverable | Required checks and exit gate |
|---|---|---|
| P04A | Approved native config/descriptor contract; fixed/global settings and Appearance page; legacy-install marker and credential upgrade; preserve existing `theme` | Preference revisions/rollback/retry, all legacy/missing-settings paths, fixed preview/fallback/contrast; accepted settings/descriptor capability handoff |
| P04B | Internal manual policies, cosmetic operation and occurrence/following/family inheritance through templates/materialization/archives/exceptions | Stale/retry/Auto/nominal-slot tests and unchanged segments/generations/targets; policy implementation accepted, mutations internal/test-only |
| P04C | Backup-v4 codecs, readers 1-3, restore preview and family-copy remapping of manual policies | Round trips, old readers, conflicts/copies/unknown IDs/privacy/retry; portability passes before manual mutations can be exposed |
| P04D | Optional reminder chooser, bounded native draft previews and production UI integration | Draft cancellation/stale/uncertain operations, scope selection, preference races, actual light/dark/200% renders; accepted chooser and aggregate handoff |

Use the hard sequence P04A -> P04B -> P04C -> P04D, with one integrator for shared
engine/schema/backup edits. P04B must not expose manual-policy mutations in production
UI or public bridge commands before P04C passes. P04A needs no backup-v4 export of
global settings; retain the existing backup format until P04C. No automation defaults
activate here. P04D can first integrate with existing editor/detail routes; later
P06/P07 layouts must carry that contract forward and close the integration gate.

## 4. Explicit non-goals

No time switching, classification, fresh dynamic defaults, launcher controls that
pretend switching exists, WorkManager, scheduling-segment replacement, new mutation
queue or operational schema change. No broad navigation/editor/detail redesign.
Native environmental rendering remains P08; publish consumable descriptors now.

## 5. Prerequisites and dependencies

Hard prerequisites: P02.
Integration dependencies: P06, P07.

P04A requires P02's approved catalog/export/fallback contract and the P01 style gate.
Unit hard prerequisites: P04A: P02; P04B: P04A; P04C: P04B; P04D: P04C.
P06/P07 chooser placement is an integration gate for their redesigned routes, not
a start blocker or a reason to invent new routes here. Read
[product](../../product.md), [architecture](../../architecture.md),
[appearance](../../appearance-redesign.md), [approval ledger](../../design/approvals.md)
and the [handoff protocol](../../handoffs/README.md). Obtain owner acceptance of
policy/inheritance/migration/backup semantics before schema edits. Refine concrete
field names and upgrade version against actual checkout, not a speculative schema.

## 6. Relevant product requirements

- Kotlin is saved appearance authority; RN renders versioned descriptors and requests
  draft previews. Existing `theme` stays System/Light/Dark, independent of color.
- Explicit occurrence choice beats following/family choice. Explicit Auto is distinct
  from no local policy and may override an inherited manual choice. In fixed-only
  mode Auto resolves globally; P09/P10 later extend the same precedence.
- Following boundaries use original nominal slots, not postponed targets. Preserve
  policies in templates, exceptions, archived segments, materialization and copied
  family identity mappings. Appearance choices never replace scheduling segments.
- Cosmetic commands have operation ID, expected revision, serialized execution and
  retry identity; they preserve generations, registrations and Snooze/Postpone targets.
- Content-derived choices/cache remain credential-only. Operational schema stays 3.
- Backups export manual policies, not global settings/cache/session/launcher state;
  restore preserves local settings and old-reader compatibility, recomputing future
  automatic suggestions after unlock. Unknown IDs fallback without erasing choices.
- Legacy upgrades, including absent settings rows, preserve brightness and Classic/
  fixed with automation off. Fresh installs also stay fixed until P09/P10 activation.

## 7. Approved visual references

Inherit accepted P01 composition and P02 catalog, with
[supplied Appearance references](../../design/references/time-of-day-and-alarms.png)
as inspiration. References showing Daily Mix/weather are not approved functionality.

## 8. Required design decisions

**Approved:** brightness/color separation, native authority, scopes/Auto/nominal
boundaries, cosmetic invariants, backup4/old readers and legacy opt-in requirements.

**Proposed:** exact descriptor/config versioning, policy representation and ordering,
revision effects, preview response, legacy detection for every old database/settings
state, unknown-ID handling, restore preview/copy mappings and chooser interactions.
Prepare a truth table for occurrence/following/family/Auto and its portable
representation together before owner approval. The four execution units are an
approved planning boundary, not approval of concrete schema or API details.

**Agent choices:** exact schema increment, entities/codecs and native/TS interfaces
following repository patterns. One integrator owns engine/schema/backup changes;
do not prematurely lock storage design in this planning document.

## 9. Expected deliverables

Approved durable contract/ADR; versioned native models and RN bridge rendering;
Appearance/chooser UI; cosmetic operation and all upgrade paths; backup4 exporter
and 1-3 readers; migration/portability/invariant fixtures; actual UI captures;
evidence and approval records. Each unit produces `docs/handoffs/redesign-p04a.md`,
`redesign-p04b.md`, `redesign-p04c.md` or `redesign-p04d.md`; the aggregate
`docs/handoffs/redesign-p04.md` links all four and outstanding route integrations.

## 10. Functional acceptance criteria

- Palette/brightness save automatically using existing serial optimistic controller,
  refreshed revisions, rollback, same-operation retry and race protection. Selecting
  a fixed palette explicitly selects Fixed mode; no unsupported dynamic control.
- Manual changes preserve event/due/alert definitions, family/segment IDs, protected
  generations, current targets, pause state and OS registrations. Rejected stale
  commands are atomic; retries neither duplicate policy nor undo a newer change.
- Test family -> following -> occurrence choices and explicit Auto, across old/new
  segments, single edits, postponed earlier items, pause/resume, duplicate and restore
  copies. A more specific policy cannot disappear on materialization or migration.
- CE upgrade paths from every supported version retain lists/timing/history; DP
  remains 3 and contains no category/content-derived appearance. Missing settings
  rows do not accidentally receive future fresh-install automation defaults.
- Read formats 1/2/3 and write/read4; retain existing whole-family conflicts, retry
  mappings, one-off Trash exclusion and recurring deletion exclusions. No cache,
  settings, active session or launcher transfer. Unknown identifiers are retained.
- Locked/unavailable credential storage and missing assets give generic usable
  fallback; no synchronous credential/classifier work on audio startup.
- P04B remains internal/test-only until P04C's portability gate passes. P04D requires
  that accepted gate before exposing choices. Unit acceptance does not imply that
  all P04 or its later P06/P07 route integrations are complete.

## 11. Visual acceptance criteria

Named checked swatches plus live preview clearly separate Brightness and Color.
Chooser explains explicit manual versus Auto without adding a required creation
step. P02 artwork/tokens remain coherent at 360x800, dark/light, long English/Chinese
and 200% text; all controls meet target/contrast requirements. Never represent an
unimplemented time/launcher behavior as enabled.

## 12. Verification requirements

Run `npm run verify` and `npm run verify:android` serially for changed behavior in
each selected unit, not all four units in one session. Add native migration,
cosmetic-operation, nominal inheritance, archived-template, restore-copy and retry
tests; compare operational snapshots before/after all cosmetic commands. Test
preference lost acknowledgements and late responses; fixture chooser/preview behavior.
Use section 3's unit-specific checks and record actual results in that unit's
handoff. P04C additionally verifies that no backup omits accessible manual policy;
P04D verifies it only consumes the accepted portable command. Update contracts/
evidence; phone migration/persistence remains P12 observation.

## 13. Regression risks

Accidental scheduling edits through generic EditSeries; target-derived boundaries;
Auto conflated with missing policy; migration treating legacy as fresh; corrupted
copy mappings; schema/privacy leakage; preference retries overwriting newer choices.

## 14. User approval checkpoints

Authorize/refine the selected unit only after its hard prerequisites. Approve the
joint policy/migration/backup contract and precedence examples before storage edits;
accept P04A settings/Appearance, P04B internal policy behavior, P04C portability,
then P04D chooser separately. No mutation exposure before the P04C gate. Document
exact accepted versions/conditions; authorization for one unit does not run the rest.

## 15. Completion and handoff requirements

Publish stable descriptor/preview/operation contracts for P05-P10, inheritance tables,
legacy marker/default gating, catalog version and backup portability rules. Identify
all schema paths and actual regression results. Keep unresolved phone tests pending,
record focused commits/evidence/approvals and status only in backlog, then stop at
the selected unit boundary. Partial capability handoffs identify accepted outputs
and remaining integration gates; they cannot mark the parent complete. Aggregate
P04 after all four units and close P06/P07 placement against actual redesigned routes.

## 16. Fresh-chat execution prompt

```text
Execute P04A only after my explicit authorization. Read AGENTS.md, core docs,
docs/appearance-redesign.md, the redesign index, docs/plans/redesign/p04-fixed-appearance.md,
approval ledger and accepted P01/P02 handoffs. Verify hard prerequisites and inspect
actual CE/DP/backup/preferences state; stop on missing approval. Obtain approval of
the joint policy/portability contract before storage changes, then implement only
global fixed settings/descriptors, legacy handling and Appearance page. Preserve
brightness, DP3, scheduling and legacy automation-off, including missing settings.
Do not implement/expose manual policies, bump backup to4 or add automation. Run P04A
checks and relevant shared/native verification serially. Record accepted capability,
evidence, approvals, backlog and docs/handoffs/redesign-p04a.md; stop before P04B.
```

```text
Execute P04B only after my explicit authorization. Read AGENTS.md, core docs,
docs/appearance-redesign.md, the redesign index, docs/plans/redesign/p04-fixed-appearance.md,
approval ledger and accepted P04A handoff/joint policy-portability contract. Verify
hard prerequisites against actual source; stop if missing. Implement only internal
native manual policies, revision/operation-safe cosmetic scopes and nominal
inheritance through templates, exceptions, archives and materialization. Keep
mutations internal/test-only: no public bridge dispatch or UI exposure before P04C
passes. Preserve segments, generations, registrations and Snooze/Postpone targets.
Run P04B migration/precedence/retry/invariant checks and shared/native verification
serially. Record exact accepted internal capability, evidence, approvals, backlog
and docs/handoffs/redesign-p04b.md; stop before P04C or chooser work.
```

```text
Execute P04C only after my explicit authorization. Read AGENTS.md, core docs,
docs/appearance-redesign.md, the redesign index, docs/plans/redesign/p04-fixed-appearance.md,
approval ledger and accepted P04A/P04B handoffs/joint contract. Verify prerequisites
and actual backup/restore/copy state; stop on missing approval. Implement backup4
manual-policy portability, readers1-3, previews, retry-stable copied-family mappings
and exclusions. Do not export global settings/cache/session/launcher state or alter
DP3, generations or targets. Keep manual mutations internal until portability tests
and owner acceptance pass; only then enable their portable native command contract.
Run P04C round-trip/old-reader/privacy/restore/retry checks plus shared/native checks
serially. Record evidence, approval gate, backlog and docs/handoffs/redesign-p04c.md.
Stop before P04D; no chooser, classifier or time mode.
```

```text
Execute P04D only after my explicit authorization. Read AGENTS.md, core docs,
docs/appearance-redesign.md, the redesign index, docs/plans/redesign/p04-fixed-appearance.md,
approval ledger and accepted P04A/P04B/P04C handoffs. Verify the portability/exposure
gate and actual UI/preview contract; stop if missing. Implement only optional
reminder/series chooser, bounded native draft previews and production UI wiring.
Reuse existing editor/detail routes or accepted redesigned routes; outstanding
P06/P07 placement is an integration gate, not permission to redesign those plans.
Preserve cancellation, stale/uncertain retries, manual/Auto scopes and scheduling.
Obtain chooser approval, verify actual large-text/light/dark flows and relevant
shared/native checks serially. Record evidence, approvals, backlog and
docs/handoffs/redesign-p04d.md; aggregate docs/handoffs/redesign-p04.md without
claiming unfinished route integrations complete. Stop; no automation or deployment.
```
