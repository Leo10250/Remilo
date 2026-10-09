# Visual asset preparation skill evidence

Recorded on 8 October 2026 local time (9 October UTC), on `theme-update`.
Task status remains in [the backlog](../backlog.md).

## Scope and maintained files

The canonical [prepare-visual-assets skill](../../.agents/skills/prepare-visual-assets/SKILL.md)
contains activation instructions, interface metadata, workflow/review/data references,
three Python modules and two focused test modules. The
[project profile](../../.agents/visual-assets.json) keeps Remilo's current authorities,
14 queued asset briefs, crop/density requirements, destinations and verification
commands outside the shared helpers. [AGENTS.md](../../AGENTS.md) points to this workflow.

The CLI implements `inspect`, `prepare`, `review`, `promote` and `audit`. Every
operation takes an explicit project root and profile, independently of the skill's
installation directory. Creative raster changes use the existing `imagegen` skill
and built-in tool. Faithful branding exports use deterministic preparation;
adaptive/vector work that cannot safely use these raster helpers is identified
explicitly in the profile.

Source bytes and original metadata precede preview conversion. Reviews preserve
aspect ratio and separate native-size panels from combined sheets. Normalized
focal/landmark calculations cover trimming, downsampling and contain padding.
Crop feasibility is measured separately from visual toolbar/cue inspection.
Lossless checks compare every decoded RGBA channel, including RGB under zero alpha.

Individual artwork and activation approval is the default. Decisions bind the
candidate, review configuration, staged exports and presented preview hashes.
Unknown visual findings remain pending. Technical exceptions require an explicit
human statement; artwork approval does not silently amend size requirements.
Promotion preserves immutable versions, uses an exclusive lock and expected
registry hash, stages complete files, publishes the active registry atomically,
and records recovery evidence for interrupted operations and identical retries.
The Remilo adapters preserve existing scenery/Classic selection conventions and
historical decisions. Portable audits distinguish missing ignored review evidence
from missing durable production files; local provenance mode checks both.

## Executed checks

| Check | Observed result and scope |
|---|---|
| Skill-creator `quick_validate.py` against the canonical package | Passed. Validates skill structure/frontmatter; does not establish workflow correctness. |
| Canonical `python -B -m unittest discover -s .agents/skills/prepare-visual-assets/tests -v` | All 52 tests passed, with no skips in the final run. The Windows link-escape fixture falls back to a directory junction when symlink privilege is unavailable. |
| Helper `audit` with the Remilo profile | 11 approved versions, including two historical Night versions, and 60 resources checked; no file/registry findings or unavailable local evidence. Known master-resolution limitations remain reported separately. |
| Artwork preservation snapshot | All 328 captured reference, scene, brand, provenance/approval and native-resource files retained their hashes. The snapshot was captured during skill preparation; existing frozen-reference protection is independently checked by `verify:design`. |
| Canonical/personal package identity | Ten package files compared byte for byte; both directories resolve to the same canonical directory. |
| Actual Codex skill discovery | `skills/list` with forced reload returned enabled `prepare-visual-assets` entries and no skill errors from Remilo and an unrelated fixture project. Both entries resolve to the canonical `SKILL.md`; display name/default prompt match `agents/openai.yaml`. |
| `npm run verify:design` | Passed. Checks maintained design-document links and protected reference bundles; does not validate generated pixels. |
| `git diff --check` | Passed for tracked changes. |

The test suite exercises metadata/EXIF/color handling, opaque/transparent and
portrait/square inputs, cover/contain geometry, impossible cue unions, crop-only
revision identity, forbidden enlargement, all-channel lossless comparisons,
resource copies, stale/tampered evidence, UTC decision timestamps, explicit
exceptions, path escape protection, historical preservation, concurrent changes,
partial-file/JSON interruption, atomic-registry failure and idempotent recovery.
It also checks production audits after ignored review files are removed. Synthetic
approval fixtures test binding mechanics; they do not authorize production assets.

The personal Windows junction is `C:/Users/Leo/.agents/skills/prepare-visual-assets`
and targets Remilo's canonical folder. Discovery was queried through a temporary
local Codex app-server process; no new agent task or generation call was created.
The sandboxed run initially skipped link creation because Windows denied it.
The final run was permitted to create/remove isolated temporary links under
ignored test storage and exercised the junction escape check successfully.

## Independent workflow evaluations

Two agents received only the skill, project instructions/profile and raw fixtures.
They forward-tested four requests without using ImageGen or creating human
approvals:

- New landscape: prepared a supplied hero source, deterministic runtime export,
  comparison and usage crops, then an individual review presentation.
- Targeted revision: retained the source bytes while adjusting a shallow Night
  crop. The moon fit mathematically but conflicted with the toolbar and reduced
  landscape context. Visual checks stayed failed/pending and nothing was activated.
- Transparent asset: measured original alpha, exported lossless WebP, inspected
  light/dark/checker surfaces and magnified edges, and retained review-only state.
- Faithful logo export: preserved the Classic reference, prepared 48px and
  explicitly interpolated 1024px exports, inspected small-size/mask previews,
  disclosed source-detail limits and requested individual review.

These evaluations identified combined-sheet scaling, supplemental preview binding
and unknown upstream-generation provenance as improvements. The final package
adds separate panels, hash-bound supplemental previews and explicit
`--prompt-kind preparation|generation` records. Targeted regression tests cover
changed panel/supplement hashes. A final root-run smoke used the installed helpers
in another project: the source hash stayed unchanged, seven separate panels and
their hashes matched, native 512px light/dark/checker panels were actually viewed,
unknown upstream generation remained labeled, and no production files or active
registry were created. The independent evaluations preceded these final helper
improvements; their coverage and the final smoke are distinct evidence.

Raw logs, hash snapshots and discovery outputs remain under ignored
`verification/local/visual-skill-build/` and `verification/local/artwork/`.
Isolated workflow fixtures remain in the task's local visualization workspace.

## Limits and subsequent work

This change adds preparation tooling and instructions. It preserves existing
artwork and human decisions, and changes no app, engine, database, backup or
scheduling behavior. Current scenic sources remain 1672 × 941, below the declared
2048 × 1152 master contract; this skill does not waive or repair that limitation.
Remaining Classic exports and production integration retain their existing gates.

No ImageGen calls were spent on package validation. Android builds, native
packaging, measured component contrast, accessibility and physical-device/alarm
acceptance were not run or claimed for this skill-only change. Synthetic masks
do not establish adaptive-launcher behavior on Android.
