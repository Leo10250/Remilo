# Routine creation and Day tabs — owner correction, 18 October 2026

Approved Day tabs and all-fields-visible forms supersede Shared-by-default creation,
the arrangement switch, separate Days picker and earlier workout-only/unified editor.
Native immediate edits, dated checks, midnight closure, frozen history, photos, Trash
and widget actions retain their existing ownership.

## Entry and shared style

Agenda/list-content + and empty Agenda Create open the themed two-choice sheet:
New reminder first, New routine second. Explain one task/event versus a sequence
with fresh daily progress. Neutral event/checklist icons, connected command rows,
64 dp minimum and no chevrons. Close before navigating, fence duplicate selection,
restore focus/scroll on dismissal. List-management creation is unchanged. The routine
library retains direct New routine. /edit owns reminders; /routine-edit owns routine
create/edit/duplicate. Legacy parameters redirect with IDs/list/origin retained.
Missing saved routines show recovery rather than a blank form.

Keep four atmospheres, independent brightness, opaque surfaces, Classic identity,
neutral Material icons, compact editing chrome, 16 dp gutters, 12 dp groups,
16/4 dp connected corners, 2 dp seams, existing 16/14 sp typography/Chinese metrics,
56 dp primary and 48 dp other targets. Mock frames/backgrounds/heights are not app UI.

## Parent draft and days

Order: required Title, Purpose (General/Exercise), Weekly plan tabs, selected-day
content, Date and time summary, collapsed More settings (List/Notes), Save routine.
Urgent delivery warnings stay visible. New drafts are blank General/ByWeekday, start
today, default Notification and retain current clock/sound preferences. No examples
are saved. New drafts show Monday; existing drafts show today if populated, otherwise
the first populated weekday; duplicates show the first populated weekday. Keep title
focus/IME behavior. Purpose changes alone never alter content or IDs.

Monday-first tabs select editing context, not scheduled-day checkboxes. Adding the
first step schedules a day; removing its last step unschedules it. Empty arrays
serialize as Rest, populated arrays as Exercises. No separate Days/Workout/Rest
controls. Seven equal controls with 2 dp gaps require 48 dp each; otherwise use
four/three controls with 4 dp gaps. Also wrap above 120% text. Use short labels,
selected outline/soft surface and populated dots; accessibility names the full
weekday, selected state and count/not scheduled. Switching preserves drafts and IDs.

Selected-day headers are at least 48 dp high with a 12 dp following gap. Populated
days show Copy to…, connected ordinal/name/target/pencil rows and Add exercise/step.
Each builder row is one editor-opening control, at least 64 dp high with 14 dp padding.
Viewing-screen Select/Edit remain siblings. Empty routine/day use only the weekday,
quiet Not scheduled and Add. An empty day additionally offers Copy from another day
when a populated source exists. No decorative icon, empty-state headline/card or
artificial gap. Save needs a title and at least one valid populated day; selection
may be empty. Keep removal Undo when all days become empty.

Date and time opens a themed draft-only sheet with Starts on/current restrictions,
shared Alert/time, sound/vibration and delivery controls. Reuse native pickers and
responsive shared fields. No alert hides time without erasing it. Sheet Done updates
the parent, Cancel changes nothing. Only Save routine persists.

## Step form

Add/row editing opens the full-height themed editor directly within the route,
without an intermediate day overview/Done. Context names the weekday and Weekly
plan. Back protects the child draft; persistent Done applies to the parent only.
Return to the same day/scroll and initiating/new row. More contains Move up/down and
Remove. Named weekday-aware removal Undo survives tab switches; reserve its capacity
within the existing 100-step limit.

Exercise fields: name (required, 200 characters), optional Sets, Reps per set,
Time per set plus seconds/minutes/hours, More target options, live summary,
Description (10,000 characters), and Image with a neutral image glyph. Numeric
fields use two columns when readable and otherwise stack. Blank values stay blank;
unit defaults seconds/kg do not create targets. More offers range, each side,
weight, additional target text and custom target. Counts are positive safe integers;
time/weight positive finite safe decimals. Validate range endpoints/each-side
prerequisites, preserve partial input strings, omit unused fields and focus errors.

RN/Kotlin share localized formatting fixtures: 3 sets × 10 reps; 3 sets × 40 sec;
3 sets · 10 reps per set · 40 sec per set. Never invent zero/one defaults. Existing
custom text stays editable without parsing/translating. Explicitly confirm replacing
nonempty targets, retaining both representations locally until Done. General keeps
Amount or duration; unrelated edits preserve existing numeric structure, while an
explicit target-text edit replaces it. Use Description and Image for both purposes.

Use the real offline photo/illustration chooser, full-frame/enlarged previews,
current image/Remove and private media leases. Hold leases for parent/child drafts,
pending removals, copy reviews and uncertain Save recovery.

## Copy and compatibility

Copy to… lists the other six full-name weekdays with checkboxes/counts, initially
unselected. Continue captures source/destinations. Empty destinations apply directly;
populated ones require a review naming old/incoming content and Replace steps.
Cancel changes nothing. Replace, never append. Allocate fresh materialized IDs once
on application, copying all targets/notes/images and sharing immutable files.
Preserve source IDs/content; copies are independent. Clear removal Undo only for
replaced destinations and announce the copied days. Copy from… lists populated
sources and fills the selected empty day. All copies remain draft-only until Save.

Existing Shared definitions remain readable. The editor prepares independent drafts
without changing saved data or treating opening alone as dirty. Explain that Save
makes weekdays independent. Preserve materialized IDs/order/content and strip linkage
only in the new revision. Direct viewing-row Save follows the same conversion while
editing only the captured weekday/ID. Cancel leaves saved data unchanged. Retain
revision guards, captured exact retry, conflict drafts/reload, image leases and
explicit review when replacing/removing today's checked IDs. Closed history stays.

Chinese builder uses 每周安排, 步骤 counts, 日期与时间, 用途, 组数, 每组次数,
每组时长, 描述 and 图片; do not introduce 动作 into this builder. Global destinations
remain 日常计划. Authored content is unchanged.

CE17/DP9 remain. Optional exerciseTarget is credential-protected version/session
JSON, exclusive with nonempty custom target text. Format9 includes it; formats1–8
retain text/metadata without inference. Validate atomically before mutation and
preserve historical Shared versions, receipts, photos and family Trash.
