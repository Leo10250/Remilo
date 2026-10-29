# Visual direction

Remilo combines calm illustrated landscapes with clear, opaque reading surfaces.
Atmosphere gives the app character; reminder content, local alert timing and useful
actions remain dominant. Use the current production assets and shared components
as the implementation baseline. An incidental bug is not a new design rule.

## Sources of truth

- [Presentation configuration](../assets/atmospheres/presentation.json) owns exact
  semantic roles, typography, spacing, geometry and screen focal positions.
- [Shared components](../src/ui/components.tsx), [scroll chrome](../src/ui/scroll-chrome.tsx),
  [navigation](../src/ui/navigation.tsx) and [confirmations](../src/ui/confirmation-dialog.tsx)
  implement common behavior and anatomy.
- Current manifests beside [atmospheres](../assets/atmospheres/manifest.json),
  [Classic branding](../assets/brand/classic/manifest.json) and
  [exercise illustrations](../assets/exercises/manifest.json) own technical source/export facts.
- `npm run preview:ui` displays production components with isolated fixture state.
  Inspect relevant states on demand instead of maintaining another screenshot catalog.

[Product](product.md) owns interactions, [architecture](architecture.md) owns native
state/recovery, and [localization](../localization/README.md) owns language semantics.

## Atmosphere and identity

One global selection offers By time of day or Sunrise, Sky, Evening and Night.
Color mode is independently Match device, Light or Dark. The four atmospheres
share component structure across their eight light/dark combinations:

| Atmosphere | Visual character |
|---|---|
| Sunrise | Warm dawn, lake and sun; warm neutral surfaces and orange/apricot actions |
| Sky | Open daytime mountains/clouds; cool surfaces and blue actions |
| Evening | Rose/plum sunset; related warm surfaces and plum/rose actions |
| Night | Moon/stars and cool landscape; icy/navy surfaces and blue/periwinkle actions |

Use the configured role pairs rather than sampling pixels or inventing per-page
colors. Preserve recognizable scene details through the current focal settings.
Automatic selection follows local clock periods, not weather or location.

The static Classic ring/check/sun mark is the identity across launcher, splash and
configuration surfaces. Android adaptive/monochrome treatment follows its host.
There are no per-reminder themes, task-specific alarm scenes or automatic icon
switches. See [brand maintenance](../assets/brand/README.md) for faithful exports.

## Reading hierarchy and shared controls

Scenic browsing openings lead into solid content planes. Artwork stays fixed while
the shared toolbar cover blends continuously toward an opaque canvas. Toolbar
foreground stays readable throughout; use the existing reduced-motion behavior.
Sheets/dialogs restore ordinary surface roles rather than inherit scenic header ink.

Cards emphasize title and actual alert/No alert information, followed by supporting
timing, recurrence and status. Group related rows into connected items, with shared
corners/seams and space between independent groups. Long content wraps or stacks;
large text must not squeeze essential controls or obscure Save behind the keyboard.

Use neutral structural icons and supporting text. The atmosphere primary role is
for meaningful actions, focus and selection. Done/Save use the filled primary pair;
Postpone is secondary outlined; permanent deletion uses semantic error treatment.
Overdue, failure and scheduling status use text/icon as well as semantic color.
A confirmed scheduled result does not promise audibility.

Chevrons indicate navigation, picker arrows indicate choosing, disclosures indicate
expansion, and checks/radios/switches communicate selection. Ordinary menu commands
do not acquire generic navigation chevrons. Reuse the neutral reminder/list glyphs;
automatic category icons remain future scope.

Agenda, Lists, Completed and Trash share destination controls. Constrained widths
or large text may use the existing compact destination menu; preserve labels,
selected state and origin navigation. Creation, completion, selection and destructive
actions have distinct roles rather than interchangeable floating controls.

## Language, accessibility and platform boundaries

Use the platform sans-serif and configured English/Chinese metrics. Preserve natural
Chinese spacing, complete labels and quantity units. Components grow/scroll for
large text and retain their accessible names, focus, pressed/disabled and selected
states. Use shared target sizes and contrast roles from code/configuration.

Brief app-owned confirmations use the shared opaque dialog; richer reviews/forms
use the common sheet. Cancellation preserves the draft and captured choice; focus
returns only to a valid initiating control. Native alarms use captured appearance
and language with privacy-safe pre-unlock content.

Android owns permission/authentication, keyboard, system picker, notification,
share and launcher surfaces. Web fixtures cannot establish their behavior. Use
[change-based verification](verification.md) for affected layouts and native/device
observations; do not create a permanent acceptance matrix.

## Maintaining artwork

Use `$prepare-visual-assets` with the actual project profile. Preserve current
editable masters and necessary export settings; keep experimental candidates,
prompts and usage previews in ignored working storage. Review the proposed result
in its real placement before an authorized integration. Commit current assets,
technical metadata, required attribution and reusable direction. Git retains prior
versions; no approval dossier or generation-history tree is required.
