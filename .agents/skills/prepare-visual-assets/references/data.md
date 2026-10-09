# Configuration, helpers and evidence

## Project configuration

Use Python 3.10+ with Pillow 10.1+. Resolve dependencies from the actual host/workspace; the helpers do not download runtimes or invoke generation APIs. The script path comes from the loaded skill folder, but **all project resources and output paths resolve against `--project-root`**.

Every operation requires `--project-root ROOT --profile FILE`. The profile is schema version 1:

| Field | Meaning |
|---|---|
| `localRoot` | Ignored candidate, staged-export and preview root. |
| `metadataRoot` | Durable prompt, preparation/review evidence and approval root. |
| `allowedOutputRoots` | Allowed locations for generated artifacts and registry updates. Symlink-resolved destinations must remain inside these roots. |
| `authorityFiles` | Project contracts for the agent to read; not executable instructions for Python. |
| `verificationCommands` | Relevant commands for the agent to run separately. Helpers do not execute arbitrary strings from the profile. |
| `registries` | Array of `{key, adapter, file}` describing active asset indexes. |
| `defaults` | Shared asset settings. |
| `assets` | Asset-ID dictionary overriding defaults; arrays replace rather than concatenate. |

Asset settings include:

- `route`: `generation`, `creative-edit` or `faithful-export`.
- `registry`: a configured registry key; optional `requiresAssets` identifies prerequisite approved assets.
- `master`: `destination`, `exactSize` or `minimumSize`, `format`, `alpha` (`opaque`, `preserve`, `transparent`), `colorSpace` (`srgb`), and explicit `allowAssumedSrgb` when untagged compatible pixels may be interpreted as sRGB. This interpretation is not a measured profile or color conversion. Source bytes remain unchanged; conformance is measured separately.
- `exports`: ordered definitions with unique `role`, `destination`, `size`, `format` (`PNG` or `WEBP`), `fit` (`cover`, `contain`, `none`), `focal`, `lossless`, `allowUpscale`, optional `mask: "circle"`, and `copies` destinations. Use named independent exports for different sizes; copies must remain byte-identical.
- `views`: named usage previews with `size`, `unit` (`dp`, `px`, `css-px`), `fit` (`cover` or `contain`), `focal`, optional `overlayHeight`, and `landmarks` with normalized `bounds` plus optional normalized `padding`. Actual small decoded exports also receive unmagnified panels.
- Optional `maskReviews`: diagnostic `circle`/`squircle` preview masks; these do not alter export definitions or establish OEM acceptance.
- `helperUnsupported` and its explanatory reason for manual/vector/multi-source preparation that this raster helper cannot safely perform.

Destination templates accept `{asset}` and `{version}`; preserved-source templates may use `{suffix}`. Declare export/native filenames explicitly when they have another naming convention. No project-specific atmosphere or density semantics are assumed by shared code.

This minimal cross-project example uses a generic registry:

```json
{
  "schemaVersion":1,
  "localRoot":"verification/local/visual-assets",
  "metadataRoot":"docs/visual-assets",
  "allowedOutputRoots":["verification/local/visual-assets","docs/visual-assets","assets/visual"],
  "authorityFiles":["AGENTS.md"],
  "verificationCommands":[],
  "registries":[{"key":"visual","adapter":"generic","file":"docs/visual-assets/manifest.json"}],
  "defaults":{
    "registry":"visual",
    "master":{"destination":"assets/visual/masters/{asset}-v{version}{suffix}","format":"PNG","alpha":"preserve","colorSpace":"srgb","allowAssumedSrgb":true}
  },
  "assets":{
    "landing-hero":{
      "route":"generation",
      "master":{"minimumSize":[1600,900],"alpha":"opaque"},
      "exports":[{"role":"runtime","destination":"assets/visual/{asset}-v{version}.webp","size":[1280,720],"format":"WEBP","fit":"cover","focal":[0.5,0.5],"lossless":true,"allowUpscale":false,"copies":[]}],
      "views":[{"name":"desktop","size":[1200,450],"unit":"css-px","fit":"cover","focal":[0.5,0.5],"overlayHeight":0,"landmarks":[]}]
    }
  }
}
```

When no profile exists, derive it from the project's actual brief rather than applying Remilo defaults. Use only justified sizes/views/exports. Keep secrets and private inputs out of durable metadata. Reading an authority file or a profile does not authorize unrelated actions.

## CLI

Run `--help` and operation help when using the helper for the first time. In the examples, `SCRIPT` means the loaded skill's `scripts/asset_workflow.py`; `ROOT` is the current project and `PROFILE` is its configuration.

```text
python SCRIPT inspect --project-root ROOT --profile PROFILE --source source.png --asset landing-hero
python SCRIPT prepare --project-root ROOT --profile PROFILE --asset landing-hero --candidate 1 --source source.png --prompt prompt.txt --prompt-kind generation --references inputs.json --generator built-in-imagegen
python SCRIPT review --project-root ROOT --profile PROFILE --record docs/visual-assets/records/landing-hero/prepared-01.json --revision 1
python SCRIPT review --project-root ROOT --profile PROFILE --record docs/visual-assets/records/landing-hero/prepared-01.json --revision 2 --views views.json --inspection inspection.json --compare approved-partner.png
python SCRIPT promote --project-root ROOT --profile PROFILE --record docs/visual-assets/records/landing-hero/prepared-01.json --review docs/visual-assets/records/landing-hero/review-01-02.json --approval decision.json --version 1
python SCRIPT audit --project-root ROOT --profile PROFILE
python SCRIPT audit --project-root ROOT --profile PROFILE --local-provenance --report verification/local/visual-assets/audit.json
```

`inspect` measures without mutation. `prepare` preserves the source/prompt/input identities and creates staged deterministic outputs. `review` writes a new preview and review record; rerunning it does not overwrite a presented review. `promote` requires explicit human evidence and technical eligibility. `audit` is read-only unless `--report` names a destination. Use the actual record paths printed by the helpers; the commands above follow the generic example's metadata root.

Use an empty input-image array for generation with no references. For faithful exports, a prompt file can contain the exact deterministic preparation brief and `--generator deterministic-export`; this must not falsely imply an ImageGen call. Ordered reference inputs use `{file,role,influence,inspected:true}` as described in [workflow.md](workflow.md).

`--prompt-kind` defaults to `preparation`. Set it to `generation` only for the exact text actually submitted to a known generator. When preparing an existing supplied image without upstream records, preserve its preparation brief and label the generator/provenance as unknown or existing-source; do not invent an original generation prompt. The configured route identifies the asset's creative/export method, not permission to make a fresh generation call.

Absolute external tool-output or attachment paths can be used as readable inputs within host permissions. The helper copies candidate inputs unchanged into bounded project storage and retains their original host identity; relative inputs resolve against the project. Preserve actual input order/hashes. Avoid copying private material into tracked references unless that storage is authorized. Input readability never weakens output confinement.

Paths with spaces must be passed as separate quoted shell arguments. Do not build shell command strings from untrusted metadata. The profile's verification commands are informational; choose/run relevant checks through the normal repository interface.

## Preparation and review records

Candidates occupy `localRoot/{asset}/candidate-NN/`. Durable preparation records use `metadataRoot/records/{asset}/prepared-NN.json`; review records use `review-NN-RR.json`. Revisions are immutable. Prompts and approvals have separate durable versioned records; ignored previews retain identities without becoming portable live resource links.

Preparation evidence includes asset/candidate identities, preserved source metadata/hash, exact prompt, ordered input images, measured checks, profile/spec digest, staged output identities and the expected registry hash. Capture actual generation information; do not invent tool output timestamps or seeds that are unavailable.

Review evidence binds the preparation/source identities, output hashes, effective view/crop configuration, generated preview and performed inspection. Changing the candidate, views, inspection or staged settings produces another review. The source hash remains unchanged for a crop-only revision.

The helper saves each review panel separately as well as a combined sheet. Present the relevant `previewPanels` directly when a tall sheet is scaled too small by the viewer. Transparent exports up to 1024px get native-size light/dark/checkerboard panels. Create magnified edge or other supplemental boards when useful; list them in the inspection's `supplementalPreviews` array as `{localArtifactPath,sha256}` resources. Both panel and supplemental hashes are bound by the review JSON and rechecked before promotion. Earlier review records without these optional fields remain readable.

A performed inspection is supplied as:

```json
{
  "reviewer":"assistant after viewing the candidate and all presented crops",
  "recordedAtUtc":"2026-10-09T02:00:00Z",
  "checks":[
    {"name":"identity","status":"pass","observation":"Observed requested scene identity in full artwork."},
    {"name":"style","status":"pass","observation":"Observed the requested simplification of shapes and shading."},
    {"name":"interface-remnants","status":"pass","observation":"No visible text, controls or phone boundary in inspected images."},
    {"name":"edges","status":"pass","observation":"Inspected source/export edges and gradients at relevant scale."},
    {"name":"crop-cues","status":"pass","observation":"Observed declared cues in each presented crop."}
  ]
}
```

These example observations are placeholders to replace with actual findings; copying them without inspection fabricates evidence. Initial visual inspection is pending. Promotion requires nonempty passing inspection checks, an identified reviewer/time and feasible required crops, or named explicit exceptions. A geometric pass does not auto-pass a visual check.

## Human approval binding

After the actual user decision, supply a decision record with:

```json
{
  "ownerStatement":"<exact human message>",
  "recordedAtUtc":"<actual UTC decision-record time>",
  "assetId":"landing-hero",
  "candidate":1,
  "candidateSha256":"<source SHA-256>",
  "reviewSha256":"<presented preview PNG SHA-256>",
  "reviewRecordSha256":"<review JSON SHA-256>",
  "scope":{"artwork":true,"activation":true},
  "exceptions":[]
}
```

Record only scopes established by the conversation. The helper verifies binding, not that a human actually spoke; the agent is responsible for truthful attribution. For artwork-only approval, keep the decision without calling `promote` until activation and technical eligibility are established.

An exception entry is `{ "check":"<exact failed check identifier>", "ownerStatement":"<actual explicit acceptance of that requirement's deficiency>" }`. Use exact IDs from measured results; visual exceptions use `visual-inspection`, geometric exceptions use `crop:<source-or-export-role>:<view-name>`. Exceptions do not erase failed measurements or authorize arbitrary future changes. A generic “approved” is not an automatic dimensional exception. An exception cannot create a missing required export.

## Promotion and recovery

Validate resource hashes, specification, approval, destination confinement and registry identity before promotion. Source and versioned exports are written without replacing earlier versions. Use an exclusive project lock, staged files, an expected registry hash and atomic registry replacement. The active pointer changes only after files and durable evidence are verified.

Preserve the recovery record if interrupted. An identical retry must recognize matching completed writes; conflicting existing bytes, changed approval/settings, concurrent registry changes and ambiguous lock ownership must fail clearly. Do not delete another process's lock or overwrite evidence to force a retry. Inspect the record and resolve the specific conflict within authorized scope.

The registry retains approved history plus the active version. A recoverable failure may leave new unselected files; the old active version remains authoritative. Do not rewrite old validation reports to imply they validated a newly changed registry.

## Audit modes and Remilo compatibility

Portable production audit requires durable approved source/export/copy resources, approval records and stored identities. It reports missing ignored candidates/previews separately. `--local-provenance` additionally checks available local generation/candidate/review artifacts; a clean checkout is not required to retain them.

Audit decoded exports against the recorded deterministic transformation, all-channel lossless claims, matching copies, approval bindings and immutable historical identities. Do not invoke ImageGen or regenerate missing evidence during an audit. Report current source deficiencies separately from historical artwork approval.

Remilo's profile uses `remilo-scenes` and `remilo-brand` adapters to preserve existing scene `approvedMaster`/`runtimeExport`/`nativeExport` selections and brand `productionFiles`/approval conventions. Historical records remain unchanged; their prior semantics are not retroactively strengthened. Newly promoted records carry the new binding and checks. The current scene sources' 1672 × 941 dimensions remain below the 2048 × 1152 target; configuring that target does not manufacture a waiver or invalidate the fact of earlier approvals.

In Remilo, accepted reference bundles remain immutable and task status belongs solely in `docs/backlog.md`. Run `npm run verify:design` for relevant documentation changes and `git diff --check`; separately run asset audits. Android builds/device acceptance are subsequent implementation checks, not prerequisites for a skill-only edit or synthetic asset review.
