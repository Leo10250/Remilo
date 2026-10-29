# Classic identity assets

`classic/manifest.json` lists the current editable sources, faithful export recipes and configuration/native copies. The isolated foreground and silhouette sources preserve the Classic ring/check/sun geometry; use deterministic transforms for exports. Existing filenames are retained, and Git history preserves retired artwork.

Run `node scripts/brand.mjs --check` to compare every active copy and the adaptive selectors. Without `--check`, the copier validates all current sources before copying their exact bytes. It does not redraw or re-encode the identity.

For changed exports, `scripts/export-brand.py prepare` stages the existing crop/affine/density transformations in ignored working storage. Use its operation help and the shared visual skill. Source/output hashes and recipes belong in the current manifest; review panels, prompts and recovery state stay local.

The 288dp splash composition uses 288/432/576/864/1152px density canvases rendered directly from the 467px isolation. Its explicit bounded interpolation at the largest densities adds no original source detail. The current output geometry and filenames are configuration, not a historical approval ledger.
