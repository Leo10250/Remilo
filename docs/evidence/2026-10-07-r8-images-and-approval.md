# R8 image generation, preservation and approval

Recorded 7 October 2026 against starting commit
`6fb60ace03f51a2d2e344f59f610d4f2cdcf8797`.
This is synthetic reference/document evidence, not a running app or device report.

## Outputs and owner response

[A29](../design/r8-settings-appearance-image-intake.json) authorizes thirteen
R8 UI images from the established brief and R3 style. The
[readable gallery](../design/remilo-r8-settings-appearance/gallery.html) preserves
all thirteen selected PNGs with per-image discrepancy notes and workflow intent.
It shows Settings, independent Brightness/Atmosphere, sound fallback/failure,
mixed/retained permissions, three acknowledged Test outcomes, invalid Snooze with
IME, and an uncommitted native time-picker draft. The first eight cover all eight
R3 atmosphere/appearance references; additional states reuse their shared style.

The owner said “Approved” before R8-08 was completed, then instructed continue.
[A30](../design/approved-ui-r8-outline-acceptance.json) records approval of the
R8 direction/templates shown so far and identifies the final associated bundle.
R8-08 is a subsequent supplement under the accepted direction. No separate owner
review or immutable-pixel approval of every raster is claimed.

## Actual generation and review

- Used the ImageGen skill's built-in tool, one portrait screenshot per selected
  asset. There are **25 successful recorded calls**, including targeted repairs;
  [full prompt provenance](../design/remilo-r8-settings-appearance/generation-provenance.json)
  preserves each call's inputs, output identity/hash and selection. No CLI/API
  fallback or manual bitmap editing was used.
- Inspected all eight R3 sources and each final selected screenshot. Root generated
  01–04/08/13; two delegates generated 05–07 and 09–12. A gallery delegate prepared
  one-screen/notes controls and independently audited the integrated data.
- Corrected material generated errors in static icon roles, compact opening,
  Dark toolbar readability, sound/background selection, mixed permission data,
  contextual Test feedback, invalid-input geometry and time-picker context.
  Residual crop/semantic tint/glyph/row/target/inset differences have explicit
  resolutions beside their images and in the current specification.
- Selected PNGs were copied unchanged to the local candidate workspace and
  durable repository bundle. Frozen R8 r1 submission source/fixture bytes retain
  the exact original brief; previous accepted R3–R7 sources and records remain.

## Static verification

- Local Node checks passed for thirteen unique selected images, actual PNG
  dimensions/aspect, unchanged original-to-workspace-to-repository hashes, notes/
  manifest/approval identities, 25 recorded calls and all eight R3 style mappings.
  Verified 22 portable source-image references and both frozen submission hashes.
- All **43 earlier R3–R7 reference PNGs** and five historical acceptance JSONs
  remained byte-identical to starting HEAD. Current source/fixture acceptance
  flags distinguish visual outline approval from actual runtime verification.
- Validated **323 current local Markdown links** and **18 gallery links** across
  the repository/local copies. Both gallery scripts passed syntax checks.
  Controlled DOM logic exercised **26 selections** and **104 width checks**,
  including per-screen notes, original width, hash updates and bad-hash fallback.
- An independent read-only gallery audit found no actionable metadata/scale/scope
  defects. It confirmed that R8-08 is recorded as a post-response supplement.
- `git diff --check` passed. Changes are documentation/reference assets only;
  app/native/module source and `docs/backlog.md` are unchanged. Local packing/
  check tooling stays outside Git.

These checks establish synthetic identities/document logic, not browser rendering
or running native behavior.

## Limits

No app/native code, live backlog status, scheduling/storage/API contract, automatic
appearance policy, build, install or phone state changed. No browser rendering
was performed: the local gallery was validated through static syntax/data and
controlled DOM logic only. Actual contrast, 200% text, keyboard/TalkBack, native
permission-return, sound playback, safe Test retries and physical audibility
remain implementation/consolidated acceptance observations. The approved visual
direction does not settle those technical or physical questions.
