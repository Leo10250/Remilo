# Remilo R10 — Data and Help UI review, revision 2

**R10 revision2 design direction and templates approved under A35.**

[Approval record](approval-record.json) preserves the exact owner response and submitted artifact hashes. Recorded implementation corrections remain applicable.

Open [gallery.html](gallery.html) for one readable screenshot at a time. Refresh an
already-open gallery to load the revisions. Choose a screen, use Previous/Next or
Left/Right arrows, and inspect at 360, 420, 540 px or original raster width.

## Restore agreement

The preview contains reminders or repeating families inside **one selected backup
file**. Restore applies that backup as a whole. All new reminders, repeating
families and lists—including empty lists and entries beyond the visible preview
page—are included automatically.

Existing reminders are matched by stored identity, not title. They remain unchanged
under either **Keep existing** or **Add a separate copy**. Keep existing is the
initial default. Adding a separate copy creates an additional version from the
backup; a repeating copy includes its whole family.

New rows say **New entry · Included automatically** and have no selection control.
Existing rows say **Already on this device** and offer two explicit, mutually
exclusive radio choices. Choosing an option edits the draft; import starts only
after Restore. During applying/unconfirmed states the choices become frozen,
readable labels and Retry same restore keeps the same captured job.

These examples do not introduce selective restore, overwrite or merge. Existing
list identity/name handling, timing qualifications, result counts and uncertainty
recovery remain as specified.

## Current sources and examples

[The frozen r2 specification](submission-specification-r2.md),
[the frozen r2 fixtures](submission-fixtures-r2.json) and
[the recorded agreement](restore-whole-backup-agreement.json) are the current
behavior and presentation references. The complete repository is at
`C:/Users/Leo/Documents/GitHub/Remilo`; frozen documents retain their original
repository-relative cross-references.

The gallery retains fourteen Data/Help states. Seven Restore screenshots were
revised: 03 idle, 04 existing-reminder choices, 05 applying, 06 unconfirmed,
09 invalid file, 11 receipt-only confirmation and 14 new-entry legacy preview.
The remaining seven screenshots carry forward unchanged.

[Current image records](images.json) identify each selected image, its matching R3
reference, original generated source and hash.
[Review notes](review-notes.md) and [their JSON](review-notes.json) document the
actual generated discrepancies and component corrections beside each image.
The HTML embeds that same JSON for portable local-file viewing.

The dentist copy shown in the preview is an explicitly chosen example, not the
default. That example adds 5 entries and preserves 1. Keeping both existing
identities by default adds 4 and preserves 2. Only a fresh native result supplies
those totals; receipt-only confirmation does not invent them.

## All eight R3 visual references

- Sunrise [Light](references/01-sunrise-light.png) and [Dark](references/02-sunrise-dark.png)
- Sky [Light](references/03-sky-light.png) and [Dark](references/04-sky-dark.png)
- Evening [Light](references/05-evening-light.png) and [Dark](references/06-evening-dark.png)
- Night [Light](references/07-night-light.png) and [Dark](references/08-night-dark.png)

Use the corresponding shared canvas, opaque raised surfaces, primary/action
content and semantic feedback roles. Ordinary glyphs and metadata are neutral.
Dark uses the atmosphere's soft charcoal/slate/plum/navy planes. Sky Dark retains
daytime artwork; Night Light retains a Light reading plane. Generated tints,
textures, gradients, oversized headers and approximate button geometry follow
the component corrections rather than defining new tokens.

The logical brief is 360 × 800 dp. Original generated PNG dimensions vary slightly
around 841 × 1870 and are preserved unchanged. Gallery scaling is an inspection
control, not a responsive-layout or accessibility test.

## History, prompts and checks

The [superseded r1 gallery](history/r1/gallery.html), frozen r1 specification/
fixtures, original twenty generation calls, candidate outputs and reviews are
preserved in `history/r1/`. The current r2 sources supersede ambiguous switches
and earlier labels; historical prompts are not current component instructions.

[Generation provenance](generation-provenance.json) and
[full submitted prompts](generation-prompts.md) preserve all successful built-in
ImageGen calls. Nine new edit calls produced seven selected revisions. Selected
PNG bytes match the returned outputs; no manual pixel repair or resampling was
used. [Documentation evidence](documentation-revision-evidence.md) records the
canonical docs-only revision.

[Validation](validation-report.json) checks selected/source and reference hashes,
historical inputs/candidates, current embedded index/notes, local links and gallery
navigation logic. Revised selected images were inspected locally. Browser
rendering was not verified because the inspection tool rejects local file URLs.
The saved gallery can be opened directly by the user.

Whole-backup behavior and the current design direction/templates are approved.
Image colors/geometry remain subject to the recorded component corrections.
This design acceptance does not establish production behavior, measured contrast,
target sizes, large text, TalkBack or physical alarm verification.

