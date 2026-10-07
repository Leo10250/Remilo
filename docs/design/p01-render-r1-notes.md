# P01-render-r1 composition notes

This is the concrete review composition derived from accepted P01-style-r2 and
the separately accepted S1/M1 sources. It is submitted with the two actual
screens, not accepted production tokens, navigation, UX or P02 foundations.
The accepted r2 six-artifact bundle remains byte-identical.

## Sunrise Agenda

- The cream Sunrise canvas uses opaque white reminder tiles; dark mode uses
  opaque warm dark tiles. The shared ReminderRow keeps its actual timing,
  completion and delivery-state controls. Only the review editorial option
  changes radius/line height; its default is the existing production style.
- A compact Remilo/action header is followed by the first event group's context,
  date and filter. Subsequent groups keep their labels and counts. Removing the
  separate date/filter band improves the useful list viewport without adding
  filter chips or changing production navigation.
- S1 fits the measured canvas width at its original 3:2 aspect ratio. The source
  focal y=0.64 sits 34 dp above navigation; lower foreground is cropped. This
  keeps the integrated sun visible in the existing action clearance at 360 dp.
  The decorative layer extends behind/around rows, never receives input or focus,
  and has no opacity fade. Source pixels remain unchanged.
- The art region height is min(canvas height × 0.50 at normal text / 0.32 at large
  text, canvas width × 1.2). The readable column is at most 560 dp; scenery stays
  full width. Dark treatment is brightness(0.4) / saturate(0.85), preserving shape.
- Add remains an actual 56 dp shared control, 12 dp above the navigation band.
  The list's lower clearance is 68 dp (56+12), with 16 dp end padding. At 200%,
  headings/rows grow and the last reminder can scroll fully above Add. No
  decorative spacer is inserted into the list to expose the scene.
- Existing glyphs and authored category descriptors remain fixtures. No classifier,
  appearance preference, persistence, production route or clock policy is added.
  The existing Agenda/Lists/Repeats review controls have explicit selected semantics
  and a non-color underline. They are preserved review navigation, not P05.

## Meadow alarm

- M1 forms one Meadow canvas. Its upper/side canopy replaces the corrected
  prototype's isolated glossy sprig and unrelated landscape footer. Actual Material
  Stop and Outlined Snooze controls come from AlarmControlsScreen's shared blocks.
- The optional internal single-member presentation slot receives information,
  actions and feedback, with a null default retaining production arrangement,
  typography and callbacks. It does not duplicate alarm actions or public bridge APIs.
- Information/actions use one scrolling column at most 480 dp wide. The standard
  sequence is title → current ringing delivery → 08:00 target → ringing state →
  Stop → Snooze · 10 min → Stop leaves the reminder unfinished. Consequential
  Event 10:00 / Due 09:00 metadata is debug fixture presentation only.
- Canopy height is min(canvas height × 0.68 at normal text / 0.40 at large text,
  canvas width × 1.5), aspect-preserving top-center crop. The decorative spacer is
  min(canvas height × 0.36 / 0.16, 340 dp). A 48 dp local transition reaches the
  Meadow canvas at the reading region; it fixes measured contrast beneath text
  without globally fading the scene. Large titles wrap rather than truncate.
- Dark adaptation scales source RGB by 0.24 / 0.40 / 0.30, preserving alpha and
  geometry. These two scene treatments are review proposals, not a theme catalog.
- Canvas initialization is remembered by debug session ID independently of member
  order. Water plants initializes Meadow; medicine joins, order changes and Water
  plants leaves while Meadow persists. A new medicine session initializes Sky
  identity with the existing neutral fallback, without generating a Sky scene.
  This is a memory-only demonstration, not P08 durable session policy.

## Reference interpretation and review limitations

The original reference images remain the visual quality targets. The actual
screens deliberately retain consequential timing and unfinished-work information,
48 dp action targets, truthful completion/delivery states, and accessible contrast.
They therefore contain more text than the illustrated mockups. Existing reference
filter chips, close/menu alarm controls and notification/form examples are not
invented as new P01 behaviors.

Reference/current/corrected sheets preserve aspect ratios and equal display widths.
References have different times/content and unknown dp density. The current native
baseline is preserved separately; all twelve default captures remain pixel-identical
after the optional-slot refactor. RN baseline typography differs from the current
host capture density, so no RN byte-equality claim is made.

RN evidence comes from actual shared components through the opt-in static web
preview; native evidence comes from actual Compose at API 35 / mdpi through
Robolectric native graphics. Neither is Android device acceptance. The host RN
screenshot backend paints at inverse display density inside a padded bitmap;
comparison derivatives crop the measured canvas and normalize its size. Unmodified
captures, crop records, bounds and paired background renders are retained.

The owner must accept the identified P01-render-r1 revision and any conditions
before an accepted handoff, P01 completion or wider theme implementation. Any
material change requires renewed rendered approval.
