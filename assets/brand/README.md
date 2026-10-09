# Shipped identity and approved replacement

The currently shipped assets and scripts/brand.mjs export the geometric R with
notification dot and blue #245CD6. This is an implementation baseline, not the
approved identity for the next redesign. The cleanup preserves these shipped exports.

[Current design](../../docs/design/current/README.md) and TD-05 use the supplied
Classic ring/check/sun mark from [the Classic crop](reference/icon-classic.png) and [original
source board](reference/source-icon-board.png). Preserve source geometry/finish; adapt isolation/padding/masks only.
One static identity ships; no theme variants, app-controlled aliases or matching
workers. Standard adaptive/monochrome exports may follow Android system treatment.

The existing exporter's central 66 dp adaptive safe area and ignored local mask/size
review describe the R implementation. TD-05 must validate Classic layer separation,
actual small sizes, splash and notification alpha against its own faithful exports.
Actual launcher/device observations remain part of the consolidated owner run.

The [production export workflow](../../docs/design/production-assets/classic-exports.md)
prepares faithful Classic candidates and records individual approvals before TD-05
integration. Its [registry](../../docs/design/production-assets/brand-manifest.json)
tracks export provenance; no unapproved candidate replaces the shipped R assets.
