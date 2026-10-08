# Current Remilo design

Updated 8 October 2026 under [A36](../approved-time-of-day-realignment.json).
This is the entry point for the four-atmosphere redesign. Implementation status
belongs only in [the backlog](../../backlog.md).

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
| [Lists and Repeats](screens/lists-repeats.md) | R7 outline accepted; decorative list icons remain provisional. |
| [Settings and Appearance](screens/settings.md) | R8 direction accepted; A36 adds Automatic policy/dropdown; R8-08 is a later supplement. |
| [Completed, Trash and Activity](screens/completed-trash-activity.md) | R9 draft only: no generated images or template approval. |
| [Data and Help](screens/data-help.md) | R10 r2 fourteen templates accepted, including whole-backup Restore. |

## Current scope and history

One global Sunrise, Sky, Evening or Night atmosphere applies across app-owned
pages and native full-screen alarms. System/Light/Dark brightness is independent.
Android owns notification, permission, keyboard, document-picker and share-sheet
layout. Use supported notification branding; no scenic popup replacement is promised.

The ring/check/sun **Classic** mark is the single static app identity.
Smart Colors, per-reminder appearance, task-specific alarm scenes and the old
eight-palette catalog are retired from the active implementation sequence.
Dynamic launcher icons are optional future backlog work. Final art abstraction
is deferred; current R3 scene identity remains the reference.

The [historical archive](../history/pre-r3-realignment/README.md) preserves earlier
living prose. Original submissions, approvals, evidence and reference PNGs retain
their identities. Historical acceptance remains valid for its recorded scope;
it does not make the superseded P01/P02 design the current implementation target.

Production currently has brightness preferences and the geometric R icon; the
four-atmosphere resolver and static Classic export are planned implementation.
This documentation realignment changes no runtime API, database, backup format,
alarm authority, build configuration or shipped image asset.
