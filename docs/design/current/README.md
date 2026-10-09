# Current Remilo design

Updated 8 October 2026 under [A36](../approved-time-of-day-realignment.json), with
repository cleanup authorized by [A37](../approved-design-cleanup.json), and
[implementation decisions](implementation-decisions.md) fixed on 9 October 2026.
This is the entry point for the four-atmosphere redesign. Implementation status
belongs only in [the backlog](../../backlog.md).

The owner's [9 October beta corrections](beta-fixes.md) supersede the earlier
Stop, navigation, Agenda timing and fixed secondary-cover requirements.

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

| Contract | Reference / review status |
|---|---|
| [Agenda and navigation](screens/agenda.md) | R3 homepage accepted; exceptional states still need review. |
| [Details and editor](screens/details-editor.md) | R4/R5 twelve representatives accepted with icon, geometry and IME corrections. |
| [Native alarm and Postpone](screens/alarm-postpone.md) | R6 accepted templates; original plain pre-unlock image rejected; four themed replacements accepted with color corrections. |
| [Lists and Repeats](screens/lists-repeats.md) | R7 outline accepted; lists omit decorative icons. |
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
