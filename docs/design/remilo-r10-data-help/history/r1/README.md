# Remilo R10 — Data and Help UI review

**Synthetic reference images — awaiting owner review.** This batch visualizes the
fourteen states in the frozen R10 brief. A generation request does not accept the
resulting layouts or pixels. It changes no Remilo app, native implementation or
repository contracts.

Open [gallery.html](gallery.html) to inspect one readable screenshot at a time.
Choose a screen in the menu or selector, use Previous/Next or Left/Right arrows,
and select 360, 420, 540 px or Original. Raster aspect ratio is preserved; larger
widths can be scrolled horizontally on small windows. Width selection is an
inspection control, not a responsive-layout test. Hashes such as
[\#R10-06](gallery.html#R10-06) identify individual captures. The sidebar becomes a
collapsible menu on small windows.

## Scope and source

The source specification is from the external Remilo checkout at
`C:/Users/Leo/Documents/GitHub/Remilo`. This output folder contains
[the frozen specification](submission-specification-r1.md),
[the frozen fixtures](submission-fixtures-r1.json),
[the capture index](capture-index.json) and [the generation intake](generation-intake.json).
The frozen text and its component/behavior rules are the authority when a
synthetic image drifts. Frozen documents preserve their original cross-references;
the complete source repository is not copied into this portable gallery.

The batch covers Settings Data/Help, Export preparation and sharing feedback,
Restore selection/preview/conflicts/applying/unconfirmed/confirmed outcomes,
and Diagnostics snapshots, refresh failure and sharing errors. Export remains an
inline Settings action; Restore and Diagnostics are secondary pages. There is no
new Data/Help navigation root or separate Export screen.

## All eight R3 style references

- Sunrise [Light](references/01-sunrise-light.png) and [Dark](references/02-sunrise-dark.png)
- Sky [Light](references/03-sky-light.png) and [Dark](references/04-sky-dark.png)
- Evening [Light](references/05-evening-light.png) and [Dark](references/06-evening-dark.png)
- Night [Light](references/07-night-light.png) and [Dark](references/08-night-dark.png)

These are matching global atmosphere and independent Light/Dark pairs, not
per-backup or per-reminder themes. Use the existing shared canvas, opaque raised
surface, primary and paired-content roles. Dark surfaces are soft charcoal,
blue-slate, plum-charcoal or navy-slate for their atmosphere, not utility-specific
black. Sky Dark still depicts daytime; Night Light still has a Light reading
plane. Ordinary structural icons and metadata are neutral; actions, selected
copy controls and focus use primary. Warnings/errors keep their semantic roles
and explicit labels. Detailed art is the current reference; later abstraction
remains a separate decision.

## Review corrections and implementation

[review-notes.json](review-notes.json) records per-image observations and
implementation corrections. The gallery renders these beside each selected
image, separately from the frozen capture expectations. A mirrored JSON block
in gallery.html makes those notes available when opened directly through
`file://`; a served copy can refresh the same-directory JSON. Packaging must
keep the embedded notes synchronized with review-notes.json.

Treat image-generation discrepancies as visible review issues, not a component
contract: inconsistent accent/icon colors, near-black Dark backgrounds, oversized
art, invented metadata/counts or delivery claims, inappropriate conflict controls,
and clipped feedback/footer content must follow the specification's resolution.
The PNGs are synthetic references. They do not verify contrast ratios, touch
targets, large text, TalkBack, lifecycle/IME handling, native behavior or audible
alarms. The gallery itself has not been claimed to pass browser-render testing.

## Workflow meanings preserved in these states

- Backups contain titles, notes, lists and reminder data; one-off Trash is
  excluded while recurring deletion exclusions remain. They are not encrypted
  backups and do not restore global appearance preferences.
- Android owns document choosers and share sheets. App UI before or after those
  handoffs cannot confirm that a provider saved or sent anything.
- New entries import automatically. Conflict switches request a separate copy;
  they do not overwrite local identities or select individual family occurrences.
  Preview timing is informational, not confirmation of future delivery.
- Applying or unconfirmed Restore freezes the reviewed backup, copy selection and
  operation identity. Retry same restore reuses that job. Confirmation with
  blocked alerts is different from an unconfirmed import; receipt-only confirmation
  provides no fabricated restore totals.
- Diagnostics is a timestamped snapshot of retained operational rows, capabilities
  and metadata. It excludes titles/notes and does not prove an alarm was heard.
  A refresh error retains the previous report and its original observed time.

## Output and provenance boundary

[images.json](images.json) identifies the selected PNGs and source references.
[generation-provenance.json](generation-provenance.json) preserves built-in
ImageGen calls and prompts. Candidate attempts and generation metadata are local
artifacts rather than app assets. Selected generated PNGs are copied as outputs;
gallery CSS only scales their display and does not repair their pixels.

All fourteen selected images are present. [Full submitted prompts](generation-prompts.md)
record twenty successful built-in ImageGen calls, including six candidate repair
attempts. [Readable review notes](review-notes.md) mirror the per-screen JSON.
Original native rasters are 841×1870, 840×1871 or 841×1871; all remain unchanged
near-9:20 portraits. Use the real 360×800 dp component metrics during implementation.

[Packaging checks](validation-report.json) verify source-copy hashes, all eight R3
reference hashes, portable input/candidate files, embedded notes, local links and
gallery navigation logic. All fourteen selected images were inspected locally.
Browser rendering was not verified: the inspection tool rejected local file URLs
under its browser URL policy. The saved gallery can be opened directly by the user.

No approval, implementation milestone, physical evidence or source-commit result
is implied by completing generation or by opening this gallery. Any later owner
acceptance and implementation decisions must be recorded separately.
