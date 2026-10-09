# R9 completed-task and recovery action research

9 October 2026. This records primary-source research and a proposed implementation
revision after the owner rejected composition 02, with candidate 04 reasoning
after composition 03 and a candidate 05 update after composition 04 was rejected.
All four earlier runtime compositions remain rejected. Research findings do not
create approval; the owner subsequently
[approved composition 05 for implementation](../r9-runtime-composition-approval-v5.json)
in `call_18cfacbd51c84ac7833eaa194408738c`, item 0, with **Approve composition for
implementation**. The current composition checkpoint is closed while physical
acceptance remains pending. Read the [R9 contract](screens/completed-trash-activity.md) and
[implementation decisions](implementation-decisions.md); status belongs only in
[the backlog](../../backlog.md).

## Evidence from established task apps

These are documented interactions, not claims that their current installed apps
were tested or that their visual layouts should replace Remilo's approved style.

| App and source | Documented interaction | Limit on applying it to Remilo |
|---|---|---|
| [Todoist task instructions](https://www.todoist.com/help/todoist/features/introduction-to-tasks-080OAXric) | Show completed tasks, then tap the completed checkmark to uncomplete. | Historical recurring occurrences cannot generally be uncompleted after the immediate Undo window. Remilo's guarded occurrence Reopen remains available; do not import Todoist's restriction. |
| [Google Tasks Android completion](https://support.google.com/tasks/answer/7675838?co=GENIE.Platform%3DAndroid&hl=en), [completed section](https://support.google.com/tasks/answer/7675629?co=GENIE.Platform%3DAndroid&hl=en), [shared-task reversal](https://support.google.com/tasks/answer/9920628?co=GENIE.Platform%3DDesktop&hl=en) | Android documents a leading completion control and expandable Completed section. Shared tasks document reversal through the completed control. | The explicit reversal instructions apply to Google's shared-task surface; they do not independently prove every Android Tasks layout. |
| [Microsoft To Do accessibility](https://support.microsoft.com/en-us/accessibility/todo/use-a-screen-reader-to-work-with-tasks-in-to-do) | Its checked completion control marks a task incomplete again. Android documents a separate Completed task control followed by activation. | Completion and opening details are separate targets. This is stronger interaction/semantics evidence than an incidental promotional screenshot. |
| [Apple Reminders on Mac](https://support.apple.com/en-ca/guide/reminders/remndbeda47c/mac), [iPhone recovery](https://support.apple.com/en-sa/guide/iphone/iph51b488c05/ios) | Mac deselects the filled completion control to mark incomplete. iPhone opens a deleted item, then offers Recover. | Platform and recurrence behavior differ. Remilo retains its existing schedules, exceptions and indefinite recoverable Trash. Apple's 30-day deletion policy is not adopted. |
| [TickTick task details](https://help.ticktick.com/articles/7055782408586526720) | Abandoned work is distinct from completed work and has a Restart operation. | A separate abandoned state supports keeping Remilo's Skipped neutral; it is not evidence that Remilo should rename Skip or copy its controls. |
| [Things FAQ](https://culturedcode.com/things/support/articles/2967034/) | Mac has recoverable Trash; iOS documents immediate deletion Undo without a Trash view. | Recovery patterns depend on the product/platform. This source is not sufficient to prescribe Things' completed-row anatomy. |

The consistent evidence supports a compact completion-state control as one
documented shortcut. It does not establish a universal rule to hide Reopen
entirely, or to put an icon-plus-label action on every completed row. Remilo's
later owner instruction chooses row menus and explicit bulk selection instead;
the external examples remain evidence, not authority over that product decision.

## Material 3 Expressive findings

[Button guidance](https://m3.material.io/components/buttons/guidelines) explicitly
discourages stacking an icon above a text label. An optional icon belongs beside
the label. It also recommends moving low-priority actions into icon controls or
overflow rather than cluttering a page with buttons. Composition 02's vertically
stacked undo/Reopen control was a mistake.

[Icon-button guidance](https://m3.material.io/components/icon-buttons/guidelines)
offers five sizes for hierarchy: 32, 40 (default), 56, 96 and 136 dp. Bigger is an option
for emphasis, not a requirement for every repeated row. Equal-priority controls
should share size. Standard/tonal/outlined/filled styling communicates priority.

| Geometry | Primary source | Consequence |
|---|---|---|
| Small icon visual container 40 dp, glyph 24 dp | [Official AndroidX tokens](https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/SmallIconButtonTokens.kt) | 24 dp icons remain appropriate for repeated actions. Visible glyph size and touch target are different measurements. |
| Medium icon container 56 dp, glyph 24 dp | [Official AndroidX tokens](https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/MediumIconButtonTokens.kt) | Enlarging a target need not enlarge its glyph. |
| Icon-button interaction target at least 48 × 48 dp, even inside another component | [Material accessibility](https://m3.material.io/components/icon-buttons/accessibility), [Android defaults](https://developer.android.com/develop/ui/compose/accessibility/api-defaults) | Reserve real, separate target space. Avoid overlapping invisible target expansion. |
| One consistent leading/content/trailing alignment and stable content anchors | [List guidance](https://m3.material.io/components/lists/guidelines), [list specs](https://m3.material.io/components/lists/specs) | Metadata growth must not independently move controls or the title glyph. Keep text the widest slot. |

The current Expressive lists offer flexible slots; baseline specs and current
AndroidX defaults distinguish centered short rows from top-aligned taller rows.
They do not require centering a glyph against every line of a long metadata stack.
The neutral calendar glyph needs an explicit first-line box, not incidental font
baselines. Android system font scaling and fixture scaling must both influence
that box, while the icon itself retains its intended visual size.

[Google's research](https://design.google/library/expressive-material-design-google-research)
emphasizes deliberate hierarchy and familiar interaction patterns. It also
reports reduced usability when labels were removed from email actions. This
supports retaining a visible Restore label where a recovery icon could be
ambiguous. It does not justify making every archive action a large filled button.
Current guidelines are design evidence; no unpinned Compose Expressive API or
dependency upgrade is implied.

## Proposed Remilo revision 03

This was a design inference informed by the sources above. The owner subsequently
rejected candidate 03 because its icons did not visibly read as buttons. Preserve
this comparison; it is not the current proposal. Candidate 05 below follows the
latest owner direction. R9 review remained open at the candidate 03 stage.

- **Completed:** replace the stacked Reopen action with a 24 dp checked completion
  symbol in a 48 × 48 dp checkbox target. Tapping it executes the existing captured
  Reopen command. Keep visible Completed text, full-contrast content and separate
  row-open/More targets. More and details retain explicitly labeled Reopen.
- **Skipped:** use a neutral noninteractive skipped indicator and explicit
  Skipped text. Reopen remains in More/details and the row's accessibility action.
  It must not masquerade as checked completion.
- **Trash:** remove the stacked undo/Restore control. Use one text-only Restore
  action at the trailing bottom edge of the card, with a 56 dp minimum target that
  grows with text. Keep More and row-open separate. A completion checkbox never
  means Restore. 56 dp follows Remilo's generous action geometry; Material does not
  require it for every list action.
- **Alignment:** Completed controls and More anchor to the first title line.
  The neutral 20 dp event glyph centers within that line's measured type geometry.
  Activity's trash/history symbol is informational, not an action button: increase
  it to 24 dp and align it with the event label. Details uses the same first-line
  principle. Large text may grow the card without shrinking targets.

Reopen still clears completed/skipped state, retains occurrence/exception identity,
uses revision/generation guards and never replays an elapsed alert. Restore still
retains previous completed/skipped state. Candidate 03 introduced no bulk
selection; that historical proposal is superseded by the owner-directed candidate
05 below. No permanent deletion, automatic navigation or scheduling policy is
introduced. Pending/unconfirmed
operations freeze controls and navigation; Retry keeps the captured operation.

The next review must inspect actual Completed/Skipped, Trash and Activity renders,
long English/Chinese, 200% text, focus/pressed/disabled states and unconfirmed
operations. Host renders cannot establish native TalkBack, IME or phone acceptance.

## Candidate 04 after the third composition rejection

Task-app completion shortcuts establish supported interactions, not sufficient
visual affordance for Remilo's terminal collections. Candidate 03's checked
control was a defensible inference from those products; its rejection means it
cannot remain the maintained row requirement. Completed/Skipped state is already
explicit text, and Reopen is an intentional native command with guarded retries.

The rendered [Material button guidance](https://m3.material.io/components/buttons/guidelines)
puts the action label first in importance. Outlined buttons express medium
emphasis; tonal provides stronger secondary emphasis. It also cautions that an
outlined treatment can resemble chips. Official [Material Web icon-button guidance](https://github.com/material-components/material-web/blob/main/docs/components/icon-button.md)
describes standard icon buttons as low emphasis without a background or outline;
[Android icon-button guidance](https://github.com/material-components/material-components-android/blob/master/docs/components/IconButton.md)
distinguishes filled, tonal, outlined and standard emphasis and separates visual
geometry from the accessible interaction target. These are source findings, not
evidence that Material prescribes Remilo's exact row composition.

The implementation agent proposed candidate 04 as a design inference pending
composition review: no leading interactive/status circles on Completed, Skipped
or Trash rows. The owner rejected candidate 03 and requested research; no owner
selection or approval of candidate 04 is recorded. Completed and Skipped show a
text-only outlined **Reopen** button; Trash shows a matching outlined **Restore** button.
Both sit at the trailing bottom edge with at least a 56 dp target that grows with
text. Keep a separate neutral outlined 48 dp More circle at the first title line.
The neutral event glyph remains informational; Activity retains its 24 dp
informational glyph. Labels are not stacked beneath icons. State text, row-open
and action targets remain separate.

Choosing outlined rather than tonal for these repeated card actions is the
implementation agent's hierarchy proposal: visible boundaries should communicate
a button without giving every recovery command filled-primary emphasis. The review must
check that the stroke reads clearly against each opaque atmosphere card and does
not resemble a filter chip. The official label priority supports this choice;
the minimum 56 dp action/48 dp More geometry remains Remilo's explicit requirement.
Growing labels/targets must remain usable with long English/Chinese and 200% text.

No behavior changes follow from the treatment. Reopen still clears both terminal
work states without replaying elapsed alerts; Restore retains the previous state.
Use the same occurrence, revision and captured operation; pending or unknown
results still freeze controls/navigation and Retry keeps the exact command.
Candidate 04 was subsequently rejected and has no acceptance. All four
rejections and the candidate 03 comparison remain recorded; source checks and
host captures do not establish TalkBack, IME or signed-phone acceptance.

## Candidate 05 after the fourth composition rejection

The latest owner instruction changes the product contract, rather than selecting
one of the earlier researched shortcuts. Normal Completed/Skipped and Trash rows
must place single-item Reopen/Restore in their three-dot menus. Remove the
repeated inline buttons and leading completion/status controls. Keep explicit
state text, a separate row-open target, the neutral event glyph and a neutral
More target of at least 48 dp. Existing terminal-details action footers remain
separate from this collection-row requirement.

The owner also authorizes bulk selection: **Reopen** and **Move to Trash** in
Completed; **Restore** in Trash. This explicit instruction supersedes the prior
no-bulk restriction in the draft and earlier candidates. Toolbar More →
**Select reminders** enters selection mode while preserving the query and closing
transient search/sheets. Show a 48 dp checkbox only in selection mode, with
checked state meaning selected, not completed/restored. Keep row-open independent
and suppress row More/swipe/action shortcuts during selection. Show the selected
count and contextual actions in a measured persistent footer with at least 56 dp
targets. Activity remains read-only: its 24 dp trash/history glyph is informational
in principle; its composition is included in the subsequent owner approval.

**Select all loaded** names its actual scope. It includes only currently loaded
matching IDs, deduplicated; explicit Load more never selects new rows. Selection
mode/IDs remain within the same fixed/global collection key during scroll and
ordinary details return. Disable query, membership and Include skipped edits
while selecting. Back or **Done selecting** clears selection before origin
navigation, except when submission or an unknown reply requires recovery.

Batching is a UI workflow over existing guarded native commands. Capture the
selected occurrence IDs and expected revisions, command kind and a distinct
native operation UUID per item before submission. Apply commands sequentially
through the existing serialized worker. Keep honest per-item confirmed outcomes;
there is no atomic batch, rollback or invented batch Undo. Stop at an unknown
reply, freeze the selected snapshot/remaining queue/navigation and retry that
exact unresolved operation first. Continue only after a definitive acknowledgement
or rejection; do not reissue applied or unresolved items under new identities.
After all replies are definitive, keep selection mode with a truthful summary,
clear IDs and refresh. Rejected items require a fresh deliberate selection/action.
No permanent Trash deletion is introduced. Reopen still clears completed/skipped
with elapsed-alert silence; Restore still preserves the prior work state.

Material's guidance supports reducing repeated low-priority controls and keeping
actions labeled in menus/contextual controls. The exact selected-occurrence
scope, persistence and retry semantics above are Remilo's owner/product decisions,
not rules claimed from Material or copied task apps. The owner approved the shown
composition 05 ordinary/selection layouts after actual fixture review. Preserve
the four rejected comparisons as historical research, not active requirements.
Exceptional/partial/unknown, long English/Chinese and 200% runtime observations
remain distinct from the composition decision; host checks and approval do not
establish physical acceptance.
