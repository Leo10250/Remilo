# Current manifests and local helpers

Use Python 3.10+ with Pillow from the actual host; do not install dependencies just to change an output path. Resolve every project resource against `--project-root`, never against the skill installation.

A schema-2 profile contains `localRoot`, `allowedOutputRoots`, `authorityFiles` and named `manifests`. A manifest contains `schemaVersion: 2` and `assets` keyed by stable asset ID. Each asset has `sources` and `outputs`. Sources record current path/hash, format, dimensions, alpha and relevant color interpretation. Outputs add a source-role key, deterministic `transform`, and byte-identical `copies`. Keep current selection and recipe facts in the manifest rather than repeating them in the profile.

Run operation help when first using a helper. `SCRIPT` below is the loaded skill's `scripts/asset_workflow.py`:

```text
python SCRIPT inspect --project-root ROOT --profile PROFILE --source image.png
python SCRIPT prepare --project-root ROOT --profile PROFILE --manifest NAME --asset ID --run RUN_ID --source image.png
python SCRIPT review --project-root ROOT --profile PROFILE --record LOCAL_PREPARED --review-id REVIEW_ID
python SCRIPT review --project-root ROOT --profile PROFILE --record LOCAL_PREPARED --review-id NEXT_ID --inspection LOCAL_FINDINGS
python SCRIPT promote --project-root ROOT --profile PROFILE --record LOCAL_PREPARED --review LOCAL_REVIEW
python SCRIPT audit --project-root ROOT --profile PROFILE
```

`--manifest` is explicit and must select a configured name/path. `--source-role` defaults to `master`. Existing current recipes are reused; new assets or changed recipes use `--spec` with a proposed asset entry in working storage. The helper stages original source bytes and computed outputs without changing production. Project-native exporters can stage the same local record contract for specialized transformations. No `--approval` or `--version` governance is required.

Run IDs and review IDs identify local working files. Each review ID is unique so presented previews are not overwritten. Inspection input is `{"checks":[{"name":"identity","status":"pass","observation":"actual finding"}]}`; replace example text with observations from inspecting the staged output. No timestamp, owner transcript or permanent approval file is needed. The helper checks identities, not whether a person approved the work; the agent is responsible for authorization.

`promote` checks candidate/review hashes, current destinations and the expected current-manifest hash before writing. An exclusive project lock, atomic file replacement and a local journal/backups make exact interrupted retries recoverable. The manifest publishes last. Conflicting bytes, stale reviewed work or another lock fail clearly; never delete an unknown lock to force a retry. Completed publication removes the recovery journal/backups. Local prepared records and previews can be discarded when the task is finished.

`inspect` and `audit` are read-only by default. An explicitly requested `audit --report` must target working storage. Audit verifies current file facts and byte-identical copies; no Git history, network, old candidate or approval records are required. Generic raster preparation uses the existing `render_export` primitives; project-specific affine/layer/vector exporters remain outside the generic helper.
