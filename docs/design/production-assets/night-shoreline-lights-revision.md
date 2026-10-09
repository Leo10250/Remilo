# Distant shore lights for both Night variants

The owner requested the distant warm light detail visible in both supplied Night
references, extending the [blue-moon exploration](night-dark-blue-moon-exploration.md).
This requests new candidates for individual review; it does not approve an unseen
revision or replace the saved Night Light/Dark v1 assets.

> I think what really stands out for both of these are the fact that there are lights in the distance shore. Can you add this detail in the night dark and night light?

## Scenic treatment and references

Use the [small attached Night example](references/owner-night-shoreline-lights-01.png)
and [larger attached Night example](references/owner-night-shoreline-lights-02.png)
with [R3 Night Dark](../remilo-r3-atmospheres/08-night-dark.png) and
[R3 Night Light](../remilo-r3-atmospheres/07-night-light.png). Their tiny amber/gold
lights are scenic references. UI, text, clocks, navigation, phone geometry and
reading-plane boundaries are not adopted.

Add two restrained, irregular groups of distant warm window-like pinpoints on
the far shoreline/low treeline flanking the central moonlit lake opening. Keep
the lights subordinate to the crescent, with faint short water reflections and
no detailed buildings, foreground houses, lamp posts or dense rows of lights.
Preserve the existing abstract mountain/lake/tree family and broad geometry.

Dark continues the requested icy-blue crescent and cool moon reflection. Light
retains its approved Night Light treatment and cream crescent; the new warm
shore detail should share the same location and scale across the pair. Each
variant still requires explicit artwork/crop approval before saving v2 assets.

## Framing and versioned preparation

The [candidate 03 prompt](prompts/night-dark/candidate-03.txt) introduces the lights.
The [candidate 04 prompt](prompts/night-dark/candidate-04.txt) refines their scale
and distant placement for the compact openings. Generation and review records
retain both iterations and their input/output hashes. The
[candidate 04 record](records/night-dark/candidate-04.json) contains the full
comparison, 360/412 broad/compact crop metadata and qualitative findings.

The [individual Dark v2 decision](approvals/night-dark-v2.json) preserves the
approved original, deterministic runtime/native export hashes and prior v1
files/decision. The matching [Night Light prompt](prompts/night-light/candidate-02.txt)
uses approved Dark v2 as the composition/light-position anchor and Night Light v1
as the illumination/cream-moon reference; its
[candidate record](records/night-light/candidate-02.json) retains comparison and
pair/crop evidence for a separate owner decision.

The [Light v2 decision](approvals/night-light-v2.json) records the later approval
and instruction to replace the old Night selection with the two new images.
The [v2 registry snapshot](scenery-manifest-v2.json) and
[selection/export validation](records/scenery-validation-v2.json) preserve the
resulting Light/Dark v2 mappings and their identical native/runtime exports.

At the current Night focal, the 412 dp compact crop retains only a thin lake
horizon. Place the warm cores just above that horizon so the crescent and both
groups remain visible; short reflections may fall below the crop. Do not stretch
the scene or reposition its landmarks to fit an entire landscape into 96 dp.
Wider openings, expanded toolbars and actual control contrast require later
component verification.

Review Dark first, save the selected candidate as `night-dark-v2` after explicit
approval, then use that approved light placement when preparing the matching
Night Light revision. Preserve v1 files, approvals, earlier candidates and the
original registry snapshot. The 2048 × 1152 master target and no-upscale rule
remain unchanged, separately from artwork approval. Task status belongs only
in [the backlog](../../backlog.md).
