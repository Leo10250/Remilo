# TD-05 — Static Classic branding handoff

Recorded 9 October 2026 from `theme-update`, based on
`1d62f6b1bba81241120c4f31e600a3d7bbce0ae3`. These changes were uncommitted at
this handoff snapshot. Live task status belongs only in [the backlog](../backlog.md).
Read [the current design](../design/current/README.md),
[implementation decisions](../design/current/implementation-decisions.md),
[TD-05](../plans/redesign/td-05-static-branding.md) and
[verification](../verification.md).

## Delivered identity and approvals

The active Classic family replaces the geometric R with one static
ring/check/sun identity. All six delivered exports use centering revision 2 and
source anchor **(233,243) px** in the authoritative **467 × 467**
[Classic crop](../../assets/brand/reference/icon-classic.png). A four-point fit
of the outer ring gives (233.0141,243.1279); the integer anchor centers the main
ring, while the check/disc keep their existing relative positions and the sun/rays
remain offset. No feature moves independently and no generative redraw was used.

The owner individually answered **“Approve artwork and integration”** for each
of the six revised deliverables. Every approval retains its exact individual
question, response reference, recording time, source/review hashes and every
published file hash. The family comparison was
`classic-centering/candidate-20261009-02/review/classic-centered-family-review-r3.png`
under ignored `verification/local/artwork`; its hash and the independent QA
record are bound in each durable candidate specification.

| Deliverable | Individually approved revision | Production outputs |
|---|---|---|
| Legacy and round launcher | [Legacy v2](../design/production-assets/approvals/classic-legacy-launcher-v2.json) | 1024 px configuration PNG; 48/72/96/144/192 px legacy and round lossless WebP. |
| Adaptive layers | [Adaptive v2](../design/production-assets/approvals/classic-adaptive-v2.json) | Separate foreground/background PNGs at 108/162/216/324/432 px. |
| Native monochrome | [Monochrome v2](../design/production-assets/approvals/classic-monochrome-v2.json) | White transparent silhouette PNGs at 108/162/216/324/432 px. |
| Static splash | [Splash v2](../design/production-assets/approvals/classic-splash-v2.json) | 288 px configuration PNG; 76/114/152/228/304 px native PNGs; static #F7F8FA surface. |
| Notification | [Notification v2](../design/production-assets/approvals/classic-notification-v2.json) | Native 24 dp Android vector, 24 × 24 viewport, five white transparent-alpha paths. |
| Favicon | [Favicon v2](../design/production-assets/approvals/classic-favicon-v2.json) | Faithful centered 48 px PNG. |

[The brand registry](../design/production-assets/brand-manifest.json) selects
these six v2 entries and preserves complete v1 approval/export history for
legacy, adaptive, monochrome and splash. Earlier notification candidates remain
unapproved private evidence. The notification and favicon received their first
production approval in revision 2. Earlier v1 approvals are preserved as
provenance and cannot authorize the revised family's activation.

## Preparation and integration

Legacy/favicon use the exact source crop **[9,19,457,467]**, yielding a **448 × 448**
image with the main ring at its exact canvas center (224,224). This adds no pixels
outside the supplied crop and preserves the original finish/glow. The decorative
flattened tile is trimmed asymmetrically, as explicitly shown and approved.

Adaptive/monochrome reuse the reviewed isolated masters with one uniform scale,
0.1322118045 dp/source-pixel, about the main-ring anchor. Their maximum measured
nonzero-alpha radius across all densities is **31.7968 dp**, inside the central
**66 dp** safe circle. Splash uses the same anchor with a 90 px critical-radius
target in its 288 px configuration; measured nonzero-alpha radius is at most
**90.9167 px**, inside the central **192 px** circle. Native notification geometry
uses a uniform scale with a **2 dp rectangular control-hull inset**. Its raised
disc is omitted so the check remains a separate white alpha shape.

[The manual publisher](../../scripts/promote-manual-brand.py) verifies explicit
artwork/integration decisions, exact specification and candidate bytes, source
transforms, output contracts, sequential predecessor versions and confined
publication paths. It appends prior approvals to immutable version history and
writes only approved brand exports/metadata. It never writes app/native resources.
Each asset retains immutable before/configured profile snapshots and its
transaction journal under `docs/design/production-assets/records/{asset}`.
Legacy's first preflight specification used Pillow's uppercase `WEBP` format
label; the preserved r2 specification corrects only the canonical metadata label
to `WebP`. Approved export bytes were unchanged.

[The gated copier](../../scripts/brand.mjs) requires all six individual
activation approvals, centering revision 2 and source anchor (233,243) before
resource writes. It copies **37 exact approved files** into seven configuration
assets, five-density launcher/layer/splash resources and the existing native
notification drawable target. It also writes the two deterministic adaptive
selectors and removes conflicting retired WebP layers. Root performed this
integration and its read-only `--check`; no Prebuild was run.

The [integration record](../design/production-assets/records/classic-integration/integration-v2.json)
and registry `nativeCopies` bind all 37 target paths to their approved source
hashes. Both selector XML hashes and resource references are recorded separately,
with immutable before/after registry snapshots. The recorder inspected those
resources and changed only provenance metadata.

[App configuration](../../app.json) and
[Android colors](../../android/app/src/main/res/values/colors.xml) use **#F7F0F8**
as the static adaptive fallback: the rounded area-average RGB [247,240,248] of
the approved reconstructed background. The gradient PNG remains authoritative;
the flat fallback does not reproduce it. Splash remains **#F7F8FA**, with nominal
`imageWidth:76`. Standard Android monochrome/system tinting adds no app-controlled
identity variants. App ID, stable activity/notification targets and build/signing
ownership remain unchanged.

## Actual host evidence

The delivered assets/copier were subsequently committed as `39212f8` on
`theme-update`; [TD-06](redesign-td-06.md#subsequent-source-commits) records the
integrated source sequence. Before that commit, a direct index/working-file
comparison checked **221** atmosphere, Classic and production-ledger artifacts
with **zero byte differences**. Scoped `.gitattributes` entries preserve exact
approved production-ledger and notification-vector bytes through Git, including
CRLF source bytes where a hash binds them. The remaining app-native derivatives
retain their registry equality checks. The approved bytes were not normalized
to satisfy the verifier.

- Independent private family QA passed all **34** candidate output hashes,
  dimensions, valid sRGB raster profiles, exact declared source transforms,
  lossless WebP containers, safe-circle measurements and white native vector
  structure. The exact 448 px crop matches supplied source pixels.
- The inspected family r3 comparison includes actual 48 px legacy/round,
  adaptive/monochrome/favicon diagnostics, actual 76 px splash, actual 24 px
  notification and circle/squircle/rounded-square adaptive masks. Those are
  synthetic review observations, not installed Android rendering.
- `node scripts/brand.mjs --check` passed **37** approved-copy checks and both
  deterministic selectors after integration.
- `node --test scripts/tests/classic-copier.test.node.mjs` passed **11/11**
  synthetic transaction/gate/check tests. Mixed centering versions, changed
  approved bytes, missing activation approval and stale resource collisions
  reject before active writes.
- Bundled Python ran `scripts/tests/test_manual_brand.py`: **10/10** passed,
  including preflight confinement, changed-source/transform rejection, native
  vector structure, next-version guards and complete prior-entry retention.
- Project visual-asset helper tests ran after the native-vector audit support:
  **52** tests executed, **51** passed and **1** skipped. They used an explicitly
  scoped ignored temporary directory; verification was rerun after fixture cleanup.
- The project visual-asset audit with `--local-provenance` passed **20** active
  and historical approved versions, **178** resources, **0** findings and **0**
  unavailable local evidence. It was repeated after integration with the same
  result; active target equality is checked by the design verifier and copier.
- Active production verification confirms **6** approved brand exports,
  **34** production files and **37** byte-identical target copies. The full
  `verify:design` run initially exposed its generic resolver treating tracked
  `android/app/...` paths as documentation-relative. The narrow resolver repair
  now passes with **0** findings and **90** correctly root-resolved resource
  references; missing-path and traversal rejection are retained. Its focused
  verifier suite passed **12/12** tests.

## Limits and consolidated acceptance

The original crop is flattened, untagged RGB interpreted as sRGB; it does not
contain editable alpha or the original hidden background. Reused isolation
retains the previously reviewed manual matte, reconstructed background and
omitted external glow; small pale source fringes remain visible on a dark
diagnostic. Native white silhouettes intentionally omit raster shading/color.
No claim of recovered original layers is made.

Legacy configuration 1024 px enlarges the actual 448 px crop and adds no source
detail. Lossless round WebP encoding optimizes RGB only under alpha 0; every
visible source color and alpha remains exact. The declared method-6 encode/decode
check reproduces the stored pixels without altering approved bytes.

Native vector XML dimensions, white paths, control hull and source hashes are
checked. PNG path diagnostics use a synthetic rasterizer and do not establish
Android VectorDrawable antialiasing or OEM tint/rendering. Actual launcher masks,
themed icon behavior, splash display size/startup transitions, notification small
icon visibility and physical accessibility remain observations for the owner's
consolidated signed-phone acceptance run. No installation, distribution or
physical branding acceptance was performed by this lane.
