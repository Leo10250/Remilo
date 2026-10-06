# P10 Smart Colors

## 1. Objective and user-visible outcome

Reviewed deterministic title rules suggest stable, explainable reminder identities
in English, emoji and Simplified Chinese, with durable manual control and safe defaults.

## 2. Current relevant repository state

Review fixtures author expected categories but no production classifier/cache exists.
P04 owns manual policies/native resolver/legacy markers and P09 owns time bands.
Inspect actual CE models, content-processing/restore hooks, descriptors and settings
controller; classification must not be added to audio/delivery startup. See
[baseline](../../evidence/2026-10-06-redesign-reassessment.md) and dependency handoffs.

## 3. Scope

Implement native normalization, reviewed bounded rules, conflict resolution,
versioned cached decisions, unlocked content processing/backfill and draft previews.
Add Smart Reminder Colors control and brief chooser explanations; integrate complete
precedence with manual policies and P09 time mode. Activate time+Smart defaults for
genuinely fresh installs only after combined approval; preserve legacy opt-in.
Recompute imported automatic decisions after unlock without exporting the cache.

## 4. Explicit non-goals

No learned/ML classifier, cloud inference, notes/list-name inference, translation
of the whole app, sentiment model, probabilistic intelligence claim, delivery-path
classification, extra palettes, Daily Mix or weather/location rules.

## 5. Prerequisites and dependencies

Hard prerequisites: P04A.
Integration dependencies: P04B, P04C, P04D, P09.

Require P04A's accepted appearance/descriptor/legacy contract for classifier core.
P04B manual precedence, P04C restore/cache exclusions, P04D chooser and P09 time/
combined defaults are integration gates, not a block on deterministic rules/cache
work. No mock production resolver or independent storage owner. Refine rules,
ambiguity/caching/edit semantics and any CE upgrade
against actual source before coding. Read [appearance](../../appearance-redesign.md),
[architecture](../../architecture.md), [approvals](../../design/approvals.md) and
dependency [handoffs](../../handoffs/README.md). P09 is required for final combined activation.

## 6. Relevant product requirements

Categories: Health, Nature, Fitness, Food, Celebration/Social, Focus, Rest,
Home/Errands, General. Distinct glyphs separate categories that share palettes.
Normalize case/punctuation/full-width text and emoji sequences. English rules use
word boundaries; Chinese rules use reviewed phrases, not isolated characters.
Strong conflicting signals/unsupported content become General. Title only: notes
and list renames cannot recolor. Explicit occurrence/following/family/Auto policy
resolves first, confident category second, authored event-band third, global last;
all-day bypasses event midnight. Manual survives edits, Snooze/Postpone never recolors.
Cache updates cannot silently recolor existing decisions when rule versions change.

## 7. Approved visual references

Inherit P01/P02 style/catalog and P04 chooser. The
[reference boards](../../design/references/README.md) inspire contextual identity,
not rule accuracy. Existing fixture category/palette mappings are candidates;
the category names and conservative behavior are approved requirements.

## 8. Required design decisions

Use accepted P01 [component/settings language](../../design/ui-composition.md) for
explanations, glyphs and selected/error states. Authored P01 fixture categories do not
constitute an approved production classifier or taxonomy.

**Approved:** deterministic title-only languages/categories, conservative conflicts,
manual precedence, CE-only cache, stable existing decisions and fresh/legacy policy.

**Proposed:** reviewed phrases/emoji table, category-to-palette/glyph mappings,
confidence/ambiguity truth table, title-edit versus classifier-version invalidation,
Auto reset behavior, opt-out/re-enable behavior and bounded backfill/retry limits.
Owner reviews positive/negative/mixed-language examples and default activation matrix.

**Agent choices:** pure Kotlin rule implementation, cache/version representation,
normalization tooling and bounded unlocked work using existing serialized engine.
Any storage change must use P04's integration/upgrade contract, never DP storage.

## 9. Expected deliverables

Reviewed rule/mapping specification and portable examples; pure native classifier,
versioned CE cache and unlocked backfill; preview/descriptors/settings/chooser
integration; fresh/legacy combined defaults; ambiguity/portability/race tests;
actual mixed-color renders; evidence and `docs/handoffs/redesign-p10.md`.

## 10. Functional acceptance criteria

- Test whole words versus substrings, Chinese phrases/full-width forms, punctuation,
  emoji modifiers/variation selectors/ZWJ, mixed languages, conflicts, unsupported
  titles and long bounded input. Strong conflicting evidence resolves General.
- Manual occurrence/following/family policies and explicit Auto obey P04 precedence;
  title/event edits affect only automatic identity. Notes/list rename/delivery target
  changes and classifier-version updates do not silently recolor cached decisions.
- Cache/classification never enters DP, exported backup, public notification or
  locked native presentation. Delivery/audio startup performs no classification.
- Restore recomputes auto after unlock; copied manual policy remains intact. Backfill
  is bounded/retry-safe and cannot starve serialized user/system actions.
- Fresh installation receives time+Smart only after integrated P09/P10 acceptance.
  Every legacy schema/missing-settings case preserves brightness, Classic/fixed and
  automation-off; toggles save with preference rollback/same-operation retry.
- All cosmetic suggestions preserve segments/generations/targets and frozen sessions;
  unknown rule/category/palette versions fallback without destroying saved policy.

## 11. Visual acceptance criteria

Mixed-category Agenda remains one coherent atmosphere. Category glyphs/accents
support scanning without replacing work/delivery labels. Chooser explanations are
brief and accurate, not intelligence marketing. Review English/Chinese, long titles,
light/dark, 200% text, grayscale and all categories using P02 contrast/target rules.

## 12. Verification requirements

Run shared verification and full relevant native checks serially. Add deterministic
rule fixtures, cache/version/manual precedence, fresh/legacy upgrades, backfill
interruption, restore/no-cache export and unchanged-generation tests. Measure
representative classification cost without claiming linguistic perfection. Physical
text rendering/settings persistence remains P12 evidence; no phone deployment now.

## 13. Regression risks

Substring false positives, cultural/linguistic ambiguity, emoji normalization gaps,
overconfident conflicts, cache invalidation silently recoloring, backfill blocking
actions, or new-install defaults applied to legacy rows without settings.

## 14. User approval checkpoints

Authorize/refine core after P04A hard contract. Approve reviewed rules/mappings and conflict/
edit/cache examples before broad backfill; approve explanations and combined fresh/
legacy defaults before activation. Accept manual/restore/chooser/time integrations
before whole combined acceptance. Record rule/catalog/settings versions and conditions.

## 15. Completion and handoff requirements

Publish versioned rules/cache/precedence/default matrices, bounded backfill behavior,
accepted mappings/explanations and actual migration/operational-invariant evidence.
Update contracts/backlog and standard handoff; keep physical checks pending. No ML
or additional automatic modes are implicitly authorized by completion. Accepted
classifier core can hand off independently; record section 5 gates and close them
before combined acceptance or fresh time-plus-Smart default activation.

## 16. Fresh-chat execution prompt

```text
Verify accepted hard prerequisite artifacts/owner approvals and record integration gates.
Execute P10 Smart Colors only after authorization. Read AGENTS.md, core docs,
redesign specification/index, docs/plans/redesign/p10-smart-colors.md, approval ledger and accepted
P04A capability and available P04B/P04C/P04D/P09 integration handoffs. Inspect actual
CE cache/resolver/settings/restore state; stop on missing hard approvals, record
outstanding integration gates and obtain my reviewed language/rule/mapping,
cache-invalidation and fresh/legacy default approvals. Implement pure native
title-only English/emoji/Simplified-Chinese conservative classification, versioned
stable CE cache, bounded unlocked processing and chooser explanation. Preserve
manual/Auto precedence, all-day/zone/time behavior, privacy and generations/targets.
Activate fresh time+Smart defaults only after combined P09/P10 acceptance; legacy
including missing settings remains opt-in. No ML/cloud/notes/list inference or
delivery-path classification. Verify rule ambiguity, migrations, restore, retries
and invariants with shared/native checks. Record approvals/evidence/backlog/P10
handoff; do not deploy or start the next plan.
```
