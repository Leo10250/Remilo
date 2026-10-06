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

Design and approve a versioned appearance configuration/descriptor contract, then
implement native settings, fixed/global resolution, bounded draft preview and manual
occurrence/following/family policies. Add a dedicated Appearance page near Settings'
top and an optional reminder chooser. Own the identified cosmetic command, credential
migration, recurrence metadata portability and backup-v4 changes as one integration
boundary. Refresh presentation without scheduling changes. Add a legacy-install
marker usable by P09/P10 without enabling automation in this milestone.

## 4. Explicit non-goals

No time switching, classification, fresh dynamic defaults, launcher controls that
pretend switching exists, WorkManager, scheduling-segment replacement, new mutation
queue or operational schema change. No broad navigation/editor/detail redesign.
Native environmental rendering remains P08; publish consumable descriptors now.

## 5. Prerequisites and dependencies

Dependencies: P02.

Require approved P02 catalog/export/fallback contract and P01 style handoff. Read
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
Prepare a truth table for occurrence/following/family/Auto before owner approval.

**Agent choices:** exact schema increment, entities/codecs and native/TS interfaces
following repository patterns. One integrator owns engine/schema/backup changes;
do not prematurely lock storage design in this planning document.

## 9. Expected deliverables

Approved durable contract/ADR; versioned native models and RN bridge rendering;
Appearance/chooser UI; cosmetic operation and all upgrade paths; backup4 exporter
and 1-3 readers; migration/portability/invariant fixtures; actual UI captures;
evidence, approval records and `docs/handoffs/redesign-p04.md`.

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

## 11. Visual acceptance criteria

Named checked swatches plus live preview clearly separate Brightness and Color.
Chooser explains explicit manual versus Auto without adding a required creation
step. P02 artwork/tokens remain coherent at 360x800, dark/light, long English/Chinese
and 200% text; all controls meet target/contrast requirements. Never represent an
unimplemented time/launcher behavior as enabled.

## 12. Verification requirements

Run `npm run verify` and `npm run verify:android` serially. Add native migration,
cosmetic-operation, nominal inheritance, archived-template, restore-copy and retry
tests; compare operational snapshots before/after all cosmetic commands. Test
preference lost acknowledgements and late responses; fixture chooser/preview behavior.
Update contracts/evidence; phone migration/persistence remains P12 observation.

## 13. Regression risks

Accidental scheduling edits through generic EditSeries; target-derived boundaries;
Auto conflated with missing policy; migration treating legacy as fresh; corrupted
copy mappings; schema/privacy leakage; preference retries overwriting newer choices.

## 14. User approval checkpoints

Authorize/refine P04 after P02. Approve the durable policy/migration/backup contract
and precedence examples before persistence implementation; approve resulting
Appearance/chooser renders and semantics before handoff. Document exact accepted
versions and conditions, not assumed architecture approval from the broad plan.

## 15. Completion and handoff requirements

Publish stable descriptor/preview/operation contracts for P05-P10, inheritance tables,
legacy marker/default gating, catalog version and backup portability rules. Identify
all schema paths and actual regression results. Keep unresolved phone tests pending,
record focused commits/evidence/approvals and backlog status, then stop at this boundary.

## 16. Fresh-chat execution prompt

```text
Verify all listed prerequisite completion, accepted handoffs and owner approvals.
Work only on P04 Fixed Appearance after my authorization. Read AGENTS.md, core docs,
redesign specification/index, docs/plans/redesign/p04-fixed-appearance.md, approval ledger and P01/P02
handoffs. Inspect actual CE/DP schemas, backup readers, engine, preference controller
and dirty work. Require accepted P02 catalog; stop on missing approvals. Refine and
obtain my policy/Auto/inheritance/migration/backup contract approval before schema
changes. Implement native fixed settings/descriptors, bounded previews, optional
chooser and identified revision-safe cosmetic scopes, plus credential upgrades and
backup4 with readers1-3. Never alter segments, generations or delivery targets; keep
DP3/private data boundary. Preserve legacy brightness/Classic/fixed automation-off,
including missing settings rows. Do not add time, classifier, launcher or navigation.
Verify migrations, retry races, recurrence portability and unchanged operational
snapshots with shared/native checks. Record evidence, owner approvals, backlog and
P04 handoff, preserving deferred physical observations. Stop before other plans.
```
