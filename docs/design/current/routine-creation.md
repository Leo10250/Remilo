# Separate creation and general routines — 18 October 2026

This owner-approved correction supersedes the unified editor/type selector,
seven-day-first builder and workout-only setup in weekly-routines.md. Native
immediate edits, dated progress, midnight closure, frozen history, photos, Trash
and widget actions continue to apply. It adds no habit scoring or automation.

## Entry and style

Agenda/list-content + and empty Agenda Create open the themed Create sheet:
New reminder first, New routine second. Explain one task/event versus a sequence
with fresh scheduled-day progress. Connected command rows use neutral event/checklist
icons, no chevrons and at least 64 dp height. Close before navigating; fence duplicate
selection and return focus/scroll on dismissal. List-management creation is unchanged.
The routine library retains direct New routine. /edit owns reminders; /routine-edit
owns routine create/edit/duplicate. Legacy routine parameters redirect with identity,
list and origin intact. Missing saved routines show recovery, never blank creation.

Use current four atmospheres/independent brightness, opaque surfaces, Classic identity,
neutral icons, compact editor chrome, 16 dp gutters, 12 dp groups, 16/4 dp corners,
2 dp seams, 16/14 sp typography/Chinese metrics and 56/48 dp action targets.

## Builder

Order: Title, Preset, Steps, Schedule, Alert, List, optional Notes and applicable
sound/vibration/access controls. One persistent parent Save commits; nested Add/Done
updates only its owning draft. Themed dirty cancellation protects text and photos.
New routines are General/Shared, empty, no weekdays selected, start today and default
Notification. No sample content is saved. Explain fresh daily progress once.

General/Exercise is an optional picker, changing field vocabulary/examples and image
library disclosure without changing content, identities, timing or checks. General
fields: Step name (required), Amount or duration, Instructions, Step image. Examples:
Read; 10 minutes or 1 chapter; Read one chapter, then write three notes. Exercise
retains name, sets/reps/time, How to do it and Exercise image. Limits remain
200/1000/10000; prescriptions are free text. Photo is first; Exercise illustrations
is initially collapsed for General/open for Exercise. Full-frame/private media stays.

Shared steps are edited once and materialized to selected days. Days opens seven
full-name Monday-first checkbox rows with Done/Cancel. Starts on/time reuse ordinary
responsive date/time controls and native pickers. No alert hides time but keeps draft
minutes. Existing start restrictions, shared clock and Alert modes remain. Require
at least one scheduled day with named steps; avoid initial validation errors.

Different steps by day switches the entire routine to independent selected weekdays,
preserving current IDs/content. Selected-day rows open scoped drafts; newly selected
days are empty with Add step/Copy steps from. Days is the only scheduling control;
there is no Workout/Rest selector in child editors.
The weekday-grouped content heading is Weekly plan / 每周安排; its rows show
step counts (e.g. 4 个步骤) for both presets, never 动作. The lower timing settings
heading is Date and time / 日期与时间. These labels distinguish content arrangement
from timing without changing existing connected surfaces, spacing or themes.
Unsaved off/on caches content/IDs;
saved unscheduled days remain empty Rest data. If authored content exists only in
an unscheduled draft, require selecting
a source day before changing arrangement; never silently erase that cached content.
The weekday chooser previews cached names to make that source discoverable.
Returning to shared chooses a nonempty
source, previews replaced days, preserves source IDs and allocates other copies.
Do not infer matches by name/position. Review any checked steps removed today on Save.

## Editing and presentation

One-tap row Edit stays separate from selection/scroll/completion. Shared editing
resolves exact day-specific ID to sharedStepId, then edits all linked weekdays.
Independent mode edits one day. Explain scope in the form. Use loaded revisions,
captured exact retry, retained conflict drafts, explicit reload and image leases.
Ended rows retain historical check correction only. Ended content stays frozen.

General uses Step/Steps, Current/Completed step, Complete step, View previous step,
Not scheduled and No routine scheduled today across app/native/widgets/accessibility.
Exercise may retain exercise/rest vocabulary; navigation always says Routine.
The routine library uses neutral checklist icons. Chinese uses 日常计划 and 步骤;
authored content is unchanged. Widget layout, Done feedback, repeated Undo, Next
and bottom alignment remain. Generic previews use inert Morning routine content.

CE17/versioned authoring metadata and format8 are defined in architecture. Existing
routines migrate to ByWeekday/Exercise without content inference or snapshot edits.
Native validation owns shared consistency; DP remains content-free schema9.
