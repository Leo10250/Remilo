# Shipped identity and approved replacement

The currently shipped assets and scripts/brand.mjs export the geometric R with
notification dot and blue #245CD6. This is an implementation baseline, not the
approved identity for the next redesign. No exports change in the docs-only PR.

[Current design](../../docs/design/current/README.md) and TD-05 use the supplied
Classic ring/check/sun mark from assets/design-review/icon-classic.png and its
source board. Preserve source geometry/finish; adapt isolation/padding/masks only.
One static identity ships; no theme variants, app-controlled aliases or matching
workers. Standard adaptive/monochrome exports may follow Android system treatment.

The existing exporter's central 66 dp adaptive safe area and ignored local mask/size
review describe the R implementation. TD-05 must validate Classic layer separation,
actual small sizes, splash and notification alpha against its own faithful exports.
Actual launcher/device observations remain part of the consolidated owner run.
