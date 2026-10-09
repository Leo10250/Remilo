# Faithful Classic export preparation

The [Classic source crop](../../../assets/brand/reference/icon-classic.png) and
[original board](../../../assets/brand/reference/source-icon-board.png) supply the
ring/check/sun identity required by [TD-05](../../plans/redesign/td-05-static-branding.md).
Use deterministic isolation, padding, alpha masks and manual vector construction
where needed. Preserve proportions and finish. No ImageGen redraw or new palette
variants enter these exports.

The crop is a flattened **467 × 467 RGB PNG**, with no alpha or layered/vector
master. Larger configuration images interpolate that source; they do not create
additional detail. Resize smaller raster exports directly from the source or
reviewed isolated source, rather than from an enlarged configuration export.

## Individual export queue

| ID | Output contract | Preparation and review |
|---|---|---|
| `classic-legacy-launcher` | 1024 px configuration PNG; Android 48/72/96/144/192 px | Preserve the full Classic tile and source finish. Inspect actual sizes plus circle/squircle masks. Include corresponding round alpha exports. |
| `classic-adaptive` | Separate foreground/background; Android 108/162/216/324/432 px | Isolate the colored ring, raised check disc, sun and rays from the flattened tile; preserve finish. Fit critical geometry inside the central 66 dp safe circle of the 108 dp layer and inspect masks. |
| `classic-monochrome` | Transparent silhouette; matching adaptive sizes | Construct a faithful simplified ring/check/sun alpha shape; the full disc must not obscure the check. Review monochrome masks and small-size recognition. |
| `classic-splash` | 288 px configuration PNG; native 76/114/152/228/304 px | Reuse approved isolation, source proportions and reviewed padding. Inspect alpha and small sizes on the intended splash background. |
| `classic-notification` | 24 dp vector alpha silhouette | Manually construct the simplified ring/check/sun mark for the Android small icon. Review at 24 px on contrasting surfaces. |
| `classic-favicon` | 48 px raster derivative | Use the faithful Classic tile for the existing preview configuration. |

The [brand registry](brand-manifest.json) records the exact source hashes, output
requirements, candidate records and explicit owner decisions. Each candidate
record preserves export settings, file hashes, actual dimensions, mask treatment
and the ignored comparison preview. Review and approve each queue entry before
promoting its outputs and proceeding to the next. Artwork approval does not
establish installed launcher, splash or notification appearance.

## Storage and handoff

Candidates and reviews remain under
`verification/local/artwork/{export-id}/`; tracked records live under
`docs/design/production-assets/records/{export-id}/`. Approved exports use versioned
names under `assets/brand/classic/{role}/`, with Android density copies staged in
that asset tree for subsequent TD-05 integration. Revisions retain earlier files
and approval records.

Existing `assets/images`, Android launcher/splash resources, notification vectors,
`app.json` and the geometric R exporter remain the implementation baseline during
this preparation phase. TD-05 consumes individually approved Classic exports and
validates the installed result. Task status stays in [the backlog](../../backlog.md).
