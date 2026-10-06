# P03 Branding

## 1. Objective and user-visible outcome

Replace the geometric R with the owner's exact Classic identity in production
launcher/splash/notification assets, with faithful, reviewed palette variants.

## 2. Current relevant repository state

`scripts/brand.mjs` still generates production R assets. The supplied board,
unchanged Classic crop and candidate hue variants/masks exist under
`assets/design-review`; coarse adaptive isolation/monochrome are not final approved
exports. Inspect Expo configuration, Android mipmaps/drawables and manifests rather
than regenerating the owned Android project. See [baseline](../../evidence/2026-10-06-redesign-reassessment.md).

## 3. Scope

Cleanly isolate the original bitmap, prepare adaptive foreground/background,
legacy/round fallbacks, splash and purpose-built monochrome/notification silhouettes.
Produce seven color-only variants from P02's approved palette identities with
constant geometry/shading. Make exports reproducible and update branding provenance.
Ship Classic as default; retain all variant exports for later P11 consumption.

## 4. Explicit non-goals

No symbol reinterpretation, generative redraw, app-ID/signing/version churn,
activity aliases, runtime switching, WorkManager or schedule/permission changes.
No Prebuild. Color variants are not a new illustration direction.

## 5. Prerequisites and dependencies

Dependencies: P02.

Require accepted P02 catalog and P01 style handoff, plus direct identity approval A01
in [the ledger](../../design/approvals.md). Refine export/layer strategy after
inspecting source resolution and Android requirements; final adaptations need approval.

## 6. Relevant product requirements

Preserve the blue/violet ring, white check medallion, orange sun and dimensional
finish. Adaptation is limited to clean isolation, layers, mask padding and sizing.
Essential geometry stays in Android safe areas. System-themed icons use system
colors, not Remilo theme. Standard notifications use a monochrome brand silhouette.
Classic remains default even when the app atmosphere later changes.

## 7. Approved visual references

The [supplied Classic board](../../design/references/supplied-classic-icon-board.png)
is exact identity input. Review production adaptations beside it and the existing
source crop. Candidate masks and smaller reference variants are not approved exports.

## 8. Required design decisions

**Approved:** original Classic identity, constant symbol for variants, bitmap
adaptive layers and default Classic.

**Proposed:** clean isolation boundary/background, safe-area scale, shadow/edge
treatment, splash framing, variant color mappings and monochrome silhouette.
Owner approves actual-size circle/squircle/rounded comparisons before replacement.

**Agent choices:** reproducible exporter and density outputs using pinned tooling;
verify version-matched official Android icon/splash docs. Do not invent unavailable
source detail through upscaling or overwrite original provenance.

## 9. Expected deliverables

Original/crop/adaptation comparison board; production adaptive/legacy/round/splash/
monochrome/notification exports and variants; reproducible exporter/manifest;
configuration/resource updates; `docs/design` branding decisions; evidence and
`docs/handoffs/redesign-p03.md` with accepted export hashes.

## 10. Functional acceptance criteria

- Release resources resolve correctly and preserve application ID/signing identity.
- Classic is the sole default launcher presentation; no aliases or switching yet.
- Notification silhouette renders on supported system backgrounds; splash and
  fallback resources are present without initializing React for native alarms.
- Reproduction retains source crop fidelity and does not mutate the supplied board.

## 11. Visual acceptance criteria

Compare actual 48 px and other launcher sizes under circle, squircle and rounded
masks, light/dark/system-themed examples. No cropped sun/ring, muddy check or
coarse matte edges. Color-only variants retain shape/finish. Clearly distinguish
host mask samples from launcher/device observations deferred to P12.

## 12. Verification requirements

Test exporter determinism, original decoded pixels, resource dimensions, safe-area
geometry and required outputs. Run shared checks and native lint/assembly serially;
inspect merged manifest/resources and actual exports. No installation is authorized.
Keep signed artifacts/private tooling out of Git.

## 13. Regression risks

Mask cropping, alpha fringes, losing the original icon through redraw, notification
silhouette illegibility, stale configuration pointing to R, or launcher identity
changes interfering with alarm show handles. Stable entry-point changes belong P11.

## 14. User approval checkpoints

Refine and authorize P03 after P02. Obtain explicit source/adaptation fidelity and
mask/silhouette/variant approval before final resource replacement; record accepted
hashes. Approval of the original icon is not approval of every derived export.

## 15. Completion and handoff requirements

Hand P11 an accepted variant inventory, resource names, hashes and reproduction
instructions; hand P08 the supported notification/splash identity. Record actual
checks and pending launcher/device evidence; update backlog only. Stop before aliases.

## 16. Fresh-chat execution prompt

```text
Verify all listed prerequisite completion, accepted handoffs and owner approvals.
Execute only P03 Branding after explicit authorization. Read AGENTS.md, core docs,
the redesign specification/index, docs/plans/redesign/p03-branding.md, approval ledger,
P01/P02 handoffs
and preserved Classic board/provenance. Inspect actual source; require accepted P02
catalog and stop on missing approvals. Refine adaptations and obtain my fidelity/
mask approval. Preserve exact Classic source identity; prepare reproducible bitmap
adaptive, legacy/round, splash, monochrome/notification and color-only variant assets.
Replace production R resources without Prebuild, ID/signing changes, aliases or
automation. Verify actual-size masks, determinism and shared/native checks. Record
approved hashes, evidence, backlog and P03 handoff. Do not install or start P11.
```
