---
name: remilo-localize
description: Localize new or changed Remilo interface copy into natural Simplified Chinese using the shared catalog, contextual terminology, Chinese product references and independent review. Use for user-facing feature work or localization review; preserve authored content.
---

# Localize Remilo

Use the [localization contract and glossary](../../../localization/README.md) and
the actual feature behavior to produce English and natural Simplified Chinese
copy. Keep work within the request: a review-only request does not authorize edits,
and a refactor with unchanged presentation does not need translation work.

## Write in context

Identify changed owned copy and its call sites, including applicable errors,
empty/loading/recovery states, accessibility labels, native alarms/notifications
and widgets. Inspect what the actions do and the surrounding screen; an English
word alone does not identify its Chinese meaning.

Reuse the glossary's scoped terms. Research new or ambiguous concepts in relevant
first-party Simplified Chinese app interfaces or help pages. Prefer comparable
product usage; consult platform documentation for system terms and dictionaries
for remaining language questions. Open the relevant source rather than relying on
search snippets. There is no source-count quota or need to research a settled
ordinary label again. Do not copy a competitor's term when its behavior differs.

Edit the canonical `localization/catalog.json`, preserving stable keys, typed
arguments and machine identities. Use complete messages, Chinese punctuation and
quantity labels. Add useful translator context for new or ambiguous messages:
where they appear, intended meaning, consequential action and relevant constraints.
Do not translate authored names, notes, imported/Calendar content or arbitrary text.
Preserve historical Calendar template recognition and captured retry identities.

Generate outputs with `npm run localization:generate` after catalog edits. Integrate
through the existing translator/typed-descriptor paths rather than a new translation
layer. Do not broaden a feature task into a catalog-wide rewrite.

## Review independently

Give a separate reviewer the changed English/Chinese messages, relevant call sites,
glossary entries, research links and actual screen context or renders. Give raw
context, not an expected verdict or an instruction to endorse the writer's choice.
Use an independent agent when available; if separate review is unavailable, state
that limitation instead of describing self-review as independent.

The reviewer checks meaning and action consequence, natural Simplified Chinese,
scope and glossary consistency, complete punctuation/count/unit labels, placeholder
preservation and untouched authored content. Include affected feedback, accessible
labels and native/widget surfaces. Check changed layouts in context at relevant
narrow widths and larger text; a catalog list or back-translation alone cannot
establish natural wording or usable presentation.

Resolve substantive findings and rerun `npm run verify:localization` after final
catalog changes. Run other shared/native/layout checks relevant to the actual
change; structural parity alone does not establish linguistic quality, device
behavior or audibility. Do not install or publish as part of localization work.

## Keep the durable result small

Record a new reusable term decision in the existing glossary with its precise scope
and a compact source reference when useful. Keep message-specific context in the
catalog. Do not duplicate the glossary in this skill or create per-feature reports,
research dossiers, screenshot manifests or permanent pending-check records.
Summarize changed copy, independent review, actual checks and material limitations
in the normal handoff.
