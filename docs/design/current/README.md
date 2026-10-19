# Current Remilo design

Updated 8 October 2026 under [A36](../approved-time-of-day-realignment.json), with
repository cleanup authorized by [A37](../approved-design-cleanup.json), and
[implementation decisions](implementation-decisions.md) fixed on 9 October 2026.
This is the entry point for the four-atmosphere redesign. Implementation status
belongs only in [the backlog](../../backlog.md).

The owner's [12 October Calendar management correction](calendar-management.md)
keeps reminder information first, moves Calendar administration to a separate page
and explains independent deletion with Agenda/Details cancellation notices.

The owner's later 12 October [P4-D target contract](../../calendar-sync.md)
assigns automatic synchronization, clearer relationship/action wording, review
notices, compact external navigation and Activity history to that later phase.
Historical manual links retain explicit checks until confirmed activation.
The owner's next [P4-E managed-calendar contract](../../calendar-managed-sync.md)
adds confirmed calendar-level setup, automatic incoming/outgoing eligibility and
saved removal decisions while preserving reminder-first presentation.

The owner's 14 October [Calendar UX correction](calendar-management.md#calendar-setup-and-feedback--14-october-2026)
uses one compact setup page, contextual status/actions, explicit authorization and
operation outcomes, surfaced alert controls and checkbox bulk selection. It
supersedes earlier Calendar setup copy and layout while preserving native safety.
The subsequent [attention and sync-details refinement](calendar-management.md#calendar-attention-and-sync-details--14-october-2026)
keeps local reminder timing prominent, makes review actionable and moves optional
timestamps, per-reminder checks and history into collapsed details.

The owner's [11 October browsing-header correction](header-scroll-research.md)
replaces the abrupt toolbar surface switch with a continuous scroll blend and
stable foreground colors, including reduced-motion mode. Artwork remains fixed.

The owner's [10 October UX refinement](ux-refinement.md) governs the latest
editor focus/timing, alert-first Details/cards, transactional filters and
Settings/Appearance/permission presentation. It supersedes conflicting earlier
page copy/structure while preserving artwork, native authority and physical gates.

The owner's [alert experience and card correction](alert-experience.md) governs
Done actions, original-alert overdue, inline Alert choices and shared terminal
cards. It supersedes action/timing treatment in the earlier [beta corrections](beta-fixes.md),
which retain navigation, browsing-cover and splash requirements.

## Authority

1. Current owner decisions and recorded implementation corrections govern requirements.
2. **All eight [R3 images](../remilo-r3-atmospheres/gallery.html)** govern visual
   atmosphere, artwork treatment, color relationships and shared design language.
3. Approved page contracts and their annotated references govern page structure
   and workflows. Native/product contracts govern timing, actions and privacy.
4. An incidental generated tint, icon, omission, spacing or shape never creates a
   new design rule. Resolve it through the shared language and recorded correction.

The [visual language](visual-language.md) owns shared component rules.
The [appearance policy](appearance-policy.md) owns global selection and automatic
time periods. [Coverage](coverage.md) distinguishes accepted templates, drafts and
remaining review work. [The roadmap](../../plans/redesign/README.md) defines bounded
implementation units; approval of a synthetic image does not complete one.

## Page contracts

The owner's [18 October generic-routine contract](routine-creation.md) supersedes
unified creation: Create offers reminder/routine destinations, new routines are
General/ByWeekday, with Day tabs and optional Exercise fields that insert no sample
content. The later owner-approved correction replaces the arrangement switch/Days
picker, adds structured sets/reps/time, compact empty states and independent copying.
Legacy Shared conversion occurs only on Save, preserving IDs/progress/frozen history.
The owner's 19 October polish centers weekday labels independently of scheduling
dots, exposes a dedicated connected Alert row, and aligns outlined unit pickers
with guarded numeric inputs in the shared routine step form. Theme roles, dated
ownership and stored formats remain unchanged.

The owner's [15 October weekly routine contract](weekly-routines.md) adds optional
weekly plans and date-scoped exercise progress within the existing reminder model.
The subsequent owner-approved correction unifies the editor, exposes all three
Alert modes and adds illustrated Focus plus visible Agenda/widget progress.
Use current shared components/tokens and active assets for this work; historical
mockup pixels do not authorize a different page style.

The owner's [15 October widget contract](home-screen-widget.md) adds configurable
Routine Focus/Today home-screen presentation using the same native authority.
The owner's 16 October refinement keeps the complete selected exercise sequence,
shared date/time controls, contextual routine menus and whole-family Trash, adds
full-frame custom photos with portable backup, and gives the widget compact
Resume + Done presentation. Shared row chevrons now follow interaction semantics.
The later 16 October widget correction adds always-visible example/loading/error
previews, draft-only first-routine defaults, explicit empty/rest states and bounded
compact content with quieter secondary actions. See the maintained widget contract.
The 17 October correction supersedes Resume-only navigation: the sole primary
widget action completes the displayed exercise in place, with conditional Undo/
Retry. Setup/picker use curated examples in the current
theme. Saved plan edits take effect immediately in today's open session while
closed history remains frozen; History moves outside routine overflow menus.
The later 17 October progress/action correction matches widget fill/track to app
roles, renders every segment, adds guarded Saving/confirmation feedback and puts
compact unfilled Undo to the left of trailing Done. Direct pencil + Edit on
today/future exercise rows uses the shared form and immediate native edit path.
See the maintained widget and weekly-routine contracts for responsive/ownership
details; these changes preserve the current visual language.
The next 17 October phone correction makes Today reminder height account for
both text lines/vendor font metrics and gives both Undo states identical graphic
geometry, with clearly dimmed disabled ink. Setup and production share the sizing.
The subsequent owner correction allows repeated widget Undo, newest completion
first, throughout the current dated session. Each instance retains only its own
still-valid completion identities; the compact control and native guards stay the same.
The next reference refinement removes the visible exercise ordinal, shows the
localized full weekday at top right, and adds quiet bottom-left Next context in
compact Focus. Full date/position remain accessible and native action identities
stay dated. The existing theme, Done/Undo and scaled-text fallbacks remain.
The owner's subsequent comparison selects **Bottom of Next line** for compact
Focus: current text and Next form the left column, and the action group aligns
to that column's bottom. Preserve prescriptions, complete targets and stable
positions when Next disappears. Expanded and recovery layouts retain their anatomy.

The owner's [15 October language contract](localization.md) adds English/Simplified
Chinese selection and Chinese typography across app and native presentation.
The [18 October wording review](localization.md#simplified-chinese-wording-review--owner-correction-18-october-2026)
requires context-sensitive Chinese: fitness items are 动作, general items 步骤,
routine destinations 日常计划 and private calendar publication 添加到日历.
The later weekday-builder correction uses 每周安排, neutral 步骤 counts in both
presets, and 日期与时间 for the lower settings group.
Preserve authored content, native behavior and current visual style.

The owner's 18 October confirmation approval replaces app-owned native alerts
with the [shared themed confirmation](visual-language.md#app-owned-confirmations--owner-approval-18-october-2026).
Short decisions use centered opaque dialogs with production Buttons; richer
destructive reviews and existing forms/menus retain their themed sheets. Android
system surfaces and native date/time interaction remain governed by their current
contracts. Captured decisions, cancellation, accessibility and pending-save guards
are preserved.

| Contract | Reference / review status |
|---|---|
| [Agenda and navigation](screens/agenda.md) | R3 homepage accepted; exceptional states still need review. |
| [Details and editor](screens/details-editor.md) | R4/R5 twelve representatives accepted with icon, geometry and IME corrections. |
| [Native alarm and Postpone](screens/alarm-postpone.md) | R6 accepted templates; original plain pre-unlock image rejected; four themed replacements accepted with color corrections. |
| [Lists and Repeats](screens/lists-repeats.md) | R7 outline accepted; connected lists use the shared neutral checklist glyph. |
| [Settings and Appearance](screens/settings.md) | R8 direction accepted; A36 adds Automatic policy/dropdown; R8-08 is a later supplement. |
| [Completed, Trash and Activity](screens/completed-trash-activity.md) | [Runtime composition 05 approved for implementation](../r9-runtime-composition-approval-v5.json) on 9 October after four rejected compositions. Row menus and selected-occurrence actions follow the latest owner direction; actual Android acceptance remains pending. |
| [Data and Help](screens/data-help.md) | R10 r2 fourteen templates accepted, including whole-backup Restore. |

## Current scope and implementation baseline

One global Sunrise, Sky, Evening or Night atmosphere applies across app-owned
pages and native full-screen alarms. System/Light/Dark brightness is independent.
Android owns notification, permission, keyboard, document-picker and share-sheet
layout. Use supported notification branding; no scenic popup replacement is promised.

The ring/check/sun **Classic** mark is the single static app identity.
Smart Colors, per-reminder appearance, task-specific alarm scenes and the old
eight-palette catalog are retired from the active implementation sequence.
Dynamic launcher icons are optional future backlog work. The owner's
[production-art abstraction review](../production-assets/style-decision.md) is now
active; current R3 scene and palette identities remain the reference, and final
assets require separate individual approval.

A37 removes superseded specifications, review demos and prototype evidence from
the checkout. The seven accepted R3–R10 reference bundles and associated current
records remain intact. Frozen submissions inside those bundles are provenance;
use these current contracts and correction notes for implementation. Git history
preserves removed material without a second design archive in the checkout.

Production uses the shared four-atmosphere resolver and separate brightness
preferences; [architecture](../../architecture.md) records the native-safe mirror,
session capture and schema/API changes. Static Classic integration consumes only
individually approved exports. Cleanup removed obsolete review tooling while
preserving accepted reference bundles and historical decisions. Runtime/physical
acceptance remains distinct from artwork approval and host verification.
