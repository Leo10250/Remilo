# Implementation decisions — 9 October 2026

The subsequent [alert experience implementation](alert-experience.md) changes
visible Stop to Done, uses original-alert/No alert overdue boundaries, adds captured
group Snooze, exposes Alert modes inline and normalizes terminal cards/More. It
retains prior navigation, scenery, privacy and selected-occurrence decisions.

The owner's implementation instruction fixes the following corrections. It does
not modify accepted PNGs, frozen submissions or historical approval records.
The [beta corrections](beta-fixes.md) supersede earlier Stop/navigation/timing
requirements. The subsequent owner clarification fixes browsing artwork in place
while opaque content covers it; [header research](header-scroll-research.md)
defines the shared layer and restoration behavior.

- Lists omit decorative icons. No list and named lists use text, explicit overdue
  occurrence counts and accessible browsing/management actions.
- Reminder rows and details use one neutral `event` glyph. Semantic categories,
  category classification and per-reminder appearance remain deferred.
- Reopen clears both completed and skipped state for the occurrence, preserving
  revision/generation guards and recurrence exception identity. Elapsed alerts
  remain silent. Restore still preserves the skipped state.
- TD-05 includes faithful adaptive foreground/background, monochrome, padded
  splash, notification vector and preview favicon exports in addition to the
  approved legacy launcher. Each new export requires review of its actual pixels.
- Completed, Trash and Activity use shared components to form R9 candidates;
  required composition review was completed with the owner's
  [composition 05 approval](../r9-runtime-composition-approval-v5.json). Actual
  Android acceptance remains separate and pending.

Implementation consumes Sunrise, Sky and Evening v1 and Night Light/Dark v2 from
the [active registry](../production-assets/manifest.json). Their RN/native files
are identical 1440 × 810 derivatives. The masters remain 1672 × 941 against the
recorded 2048 × 1152 source target; no extra source detail is claimed.

The [canonical presentation contract](../../../assets/atmospheres/presentation.json)
generates TypeScript/Kotlin roles, asset identities, crop profiles and geometry.
Run `node scripts/presentation.mjs --check` to verify its generated representations.

The owner rejected the first actual R9 composition candidate on 9 October:
opaque header controls/text and the old switch treatment did not match the
approved images. The owner also rejected composition 02: the stacked inline
Reopen action was awkward, the leading control in Trash was too small/misaligned,
and the neutral title glyph did not align with the title. The owner rejected
composition 03 because the icons did not visibly read as buttons, then rejected
candidate 04's repeated inline Reopen/Restore actions. All four rejections remain
recorded. The latest owner instruction removes those collection-row actions in
favor of each row's three-dot menu and authorizes bulk selection: Completed
Reopen/Move to Trash and Trash Restore. This instruction overrides the earlier
no-bulk restriction. The owner approved composition 05 for implementation in
`call_18cfacbd51c84ac7833eaa194408738c`, item 0, with **Approve composition for
implementation**; its [durable record](../r9-runtime-composition-approval-v5.json)
closes the layout checkpoint without accepting physical Android behavior.
Headers place text and controls directly on the scene, with transparent control
backgrounds and a shared fading contrast scrim. Reading cards and footers stay
opaque. Switches follow the reference's rounded accent track and larger thumb;
cards, section hierarchy and root selection follow the accepted R3/R7/R8 images.

The [R9 action research](r9-action-research.md) separates documented task-app
interactions and Material guidance from Remilo-specific design inference.
Candidate 05 keeps normal terminal rows free of inline Reopen/Restore and leading
completion/status controls. Labeled single-item actions live in the row's neutral
48 dp three-dot More menu; terminal details retains its established footer.
Toolbar More → Select reminders reveals 48 dp selection checkboxes and a selected
count, with contextual actions in a measured footer of at least 56 dp. A checked
selection box means selected, never completed or restored. Select all loaded
affects only matching records already loaded; Load more never selects added rows.
Scope/query/Include skipped cannot change during selection. Back/Done selecting
clears selection before origin navigation unless an operation is pending/unknown.
More and the informational neutral title glyph anchor to the first title line
using rendered font size. Activity retains 24 dp informational event glyphs;
its composition is included in the same explicit owner approval.

Batching captures selected occurrence IDs/revisions and a distinct native
operation UUID per item. It uses existing guarded commands sequentially through
the serialized worker. Report confirmed partial results; do not promise atomic
commit, rollback or an atomic Undo. Stop at an unknown reply, freeze the captured
set/remaining queue and navigation, and retry that exact unresolved command
before continuing. Applied items are not submitted again as new work. After all
definitive replies, keep selection mode with the truthful summary, clear IDs and
refresh; rejected items require a fresh deliberate selection. There is no
permanent Trash deletion. Reopen/Restore retain their existing silent elapsed
target and previous-state rules.

The [maintained R9 contract](screens/completed-trash-activity.md) replaces prior
inline and completion-shortcut proposals with this owner-directed candidate.
The research retains candidates 03/04 as rejected comparisons and separates
official guidance from product decisions.
Secondary origins and captured-command guards are implemented and must survive
the approved composition; source checks are distinct from the owner approval.

The same review corrects every Classic export's anchor: the main ring/check
defines the canvas center, with the sun/rays offset. Revised v2 deliverables
received individual artwork-and-integration approval. The source ring anchor is
`[233,243]` in the 467 px source; centering revision 2 is required for the entire
active family. Preserve original v1 bytes/approvals as history. Crop/reconstruction
and resolution limitations remain in each hash-bound approval.

Task status belongs only in [backlog](../../backlog.md). Host checks and fixture
renders do not establish the consolidated signed-phone acceptance or distribution
authorization.
