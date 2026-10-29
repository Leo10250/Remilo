# Independent Calendar sync design audit — 29 October 2026

## Scope and method

The owner requested a separate final review against Google, Apple, Samsung and
modern UX research, while preserving Remilo's internal style. This audit was
performed by an agent separate from the implementation agents. It reviewed the
maintained design contracts, the production Calendar Settings page, its pure
presentation rules, shared status/disclosure controls, localized copy and native
freshness guards. It did not change implementation code, run a release build,
connect to Google, install an APK or interact with phone data.

Production fixture views were inspected independently for Up to date and expanded
controls in Sky Light/English, Syncing in Sunrise Light/English, Error in Evening
Dark/Chinese, and Paused at 320 dp/200% Chinese in Night Dark. These were the real
app components served by the isolated preview, not the earlier HTML mock.
The implementation's private render matrix was also inspected: 128 saved layout
records covered four states, eight appearance pairs, both languages and 100%/200%
text at 320 dp, with no recorded text overflow or targets below 48 dp. Final
post-refinement rendering and build results belong to the implementation evidence.

## Findings and corrections

Two actionable scope issues were identified during this independent review:

1. **Global work hidden by a selected-calendar setting.** The first reviewed
   presentation returned the managed calendar's Paused/Off state before examining
   a current global check. Other independently authorized calendars can still be
   syncing. The correction gives valid global work/results precedence, while the
   managed disclosure continues to display its saved Paused/Off value. The final
   helper and regression cases were reread to confirm this separation and exclusion
   of stale results.
2. **Global state attributed to the selected calendar.** The disclosure initially
   derived its supporting text from the global overview state. With an explicit
   selected-calendar scope label, this could attribute another calendar's error
   or work to the managed calendar. The final
   `calendarAutomaticSyncPresentation` accepts only `ManagedCalendarState` and
   reports the saved policy. It no longer receives the overview state. This
   correction was verified in the finalized source.

A lower-priority content refinement was also adopted: scope is now stated beside
the status and beside the managed control. The longer explanation is in Sync
details, rather than a permanent paragraph below account information. This is a
reasoned application of concise writing and proximity, not a claim that research
establishes this exact arrangement as universally best.

No further blocking design issue was identified in the reviewed scope after
these corrections. This is a bounded design/code review, not a usability or
accessibility certification.

## Guidance and research assessment

| Source | Relevant guidance or finding | Application and limits |
|---|---|---|
| [Google Material communication guidance](https://codelabs.developers.google.com/codelabs/material-communication-guidance) | Accurate, concise, direct text should communicate the essential details needed for a decision or action. | Separate permission from confirmed outcome; put short scope labels near their owners; use explicit action verbs. The guidance itself recommends testing whether people understand the wording. |
| [Google/Android progress indicators](https://developer.android.com/develop/ui/compose/components/progress) | Determinate indicators express measurable completion; indeterminate indicators express ongoing processing without a known fraction. | The native Checking state uses an ordinary activity indicator. Queued/offline work stays waiting. No invented percentage, completion time or decorative progress animation is introduced. This is platform guidance, not an experiment on Remilo. |
| [Apple HIG: Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback) | Status can be passive and integrated into its context; warnings and recovery should match their significance; feedback must be accessible. | The persistent card shows the latest known state, text and icon; action-specific recovery remains nearby. Routine status does not open a blocking modal. Apple guidance informs interaction principles, not Android visual styling. |
| [Apple HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Labels should clearly express purpose; prominence should follow action role; delayed actions need feedback. | Sync now remains secondary. Reconnect/Review/Resume are prominent when needed; Pause/Turn off are contextual. Native-reviewed Resume is retained, rather than copying the mock's simplified transition. |
| [Samsung One UI: Focused and purposeful](https://developer.samsung.com/one-ui/writing/focused-and-purposeful.html) | Settings should explain meaningful choices and tradeoffs, avoid competing choices and long distracting explanations, and offer useful actions. | On/Paused/Off is visible before expansion; less frequent controls stay inside the disclosure; local-reminder consequences remain explicit. The source supports clarity and hierarchy without mandating Remilo's exact grouping. |
| [Samsung One UI: Color and contrast](https://developer.samsung.com/one-ui/accessibility/color-contrast.html), [Layout and typography](https://developer.samsung.com/one-ui/accessibility/layout-and-typo.html), [Focus order](https://developer.samsung.com/one-ui/accessibility/focus-order.html) | Color needs additional markings; text should resize through 200%; touch targets and focus flow must remain usable. | Status text/icons supplement color. Existing large targets, wrapping text, focus rings and natural reading order are retained. Browser geometry does not establish phone TalkBack behavior. |
| [Bentley et al., CHI 2026: Usability Hasn't Peaked](https://research.google/pubs/usability-hasnt-peaked-exploring-how-expressive-design-overcomes-the-usability-plateau/) | A study of 48 participants and ten applications found faster target fixation/task completion with designs applying Material 3 Expressive principles. | Supports deliberate visual hierarchy and emphasis. It did not test this sync page, these labels, or this precise card/disclosure arrangement, and does not require replacing Remilo's style. |
| [Ge et al., IJHCS 2024: User perception of animation fluency](https://doi.org/10.1016/j.ijhcs.2024.103257), [institutional full text](https://ir.psych.ac.cn/bitstream/311026/47151/1/User%20perception%20of%20animation%20fluency_%20The%20effect%20of%20time%20duration%20in%20different%20phases%20of%20animated%20transitions%20during%20application%20usage.pdf) | CAS/Huawei researchers found response and loading-completion timing affected perceived smartphone fluency, with interactions among transition phases. | Supports immediate request feedback and clear completion feedback. The tasks concerned opening applications and switching pages; it does not supply a universal network-sync delay threshold or justify artificial waiting. |

These sources converge on truthful, contextual feedback, understandable actions,
clear hierarchy and accessible presentation. Vendor conventions differ; the audit
does not require copying iOS materials, Samsung corner radii, or another product's
button capitalization into Remilo. Primary research supports the direction, not
a guarantee that this exact layout is optimal.

## Internal style and accessibility checks

The finalized design reuses `CalendarStatusCard`, `ConnectedGroup`, `Disclosure`,
`Button`, `Copy`, native confirmation/recovery flows and the canonical atmosphere
resolver. It retains opaque surfaces, neutral Material structural icons, existing
scenic browsing chrome, 16 dp insets, 16/4 dp connected corners, 2 dp seams and the
existing body/supporting typography and Chinese metrics. A value beside the
disclosure label does not become a switch or a second action. Its summary remains
visible in both expanded and collapsed states. Busy feedback is separated from
merely disabling an action.

Independent calculations using the checked-in canonical color values found these
minimum nominal contrast ratios across all eight appearance pairs:

| Pairing used by the reviewed components | Lowest ratio |
|---|---:|
| Main text / opaque surface | 12.58:1 |
| Supporting text / opaque surface | 6.26:1 |
| Filled primary label / primary background | 6.21:1 |
| Secondary accent label / container | 5.24:1 |
| Structural icon / container | 5.28:1 |
| Success or error indicator / opaque surface | 7.19:1 |

The text pairings exceed the usual 4.5:1 threshold described by
[W3C's contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
These are calculations from exact role values, rounded here for reporting, not
claims about all disabled, native-system or screen-reader states. The interface
also communicates meaning with words and icon shapes.

## Final internal-style follow-up

After the last layout correction, the auditor reread the pending/held conditional
in `CalendarSettings` and `ConnectedGroup`'s direct-child enumeration. The page
now omits `ViewSummary` when both counts are zero. Previously, its mounted element
could return no content while still reserving a connected-group wrapper, seam
and final-row position. Omitting that element lets the actual last settings row
receive the required 16 dp outer corners; nonzero counts retain their summary.
This is consistent with the maintained connected-row geometry and changes no
synchronization state or command behavior.

The saved final production capture
`verification/local/calendar-sync-status/final-up-to-date-night-dark-en.png`
was inspected independently. Its visible status, separate scope labels, policy-only
On summary, opaque surfaces, neutral structural icons and connected seams retain
Remilo's current style. No additional design finding arose from this final source
and image check. This follow-up did not run a new render matrix or build; the
implementation evidence owns the actual render/check/build counts and limitations.

## Remaining acceptance boundaries

Phone TalkBack announcements, keyboard/focus behavior through actual Google
authorization and reviewed Resume, real network interruption/recovery, and
device text/layout behavior remain signed-phone acceptance cases. In particular,
the browser fixture cannot establish real Calendar freshness, Android background
execution reliability or authentication success. No observation of those cases
is claimed by this audit. Task/release status remains solely in the live backlog.
