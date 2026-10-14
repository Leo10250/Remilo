# Managed Calendar production-component fixture observations

Observed 14 October 2026 in the Codex in-app browser, using the repository's
memory-only UI preview adapter. The checkout was `calendar-automatic-sync`, based
on `aa145558a5f70cc3848507da6616f2642255e59f`, with uncommitted P4-E changes.
These observations describe that working tree, not the earlier committed APK.

## Method and retained evidence

The repository preview interface ran at `http://127.0.0.1:8093`, through
`node scripts/preview-ui.mjs --port 8093`. The Windows npm shim stripped the port
option, so the same repository entry point was called directly. A sandboxed
listener was unreachable; the same memory-only command then ran outside sandbox
network isolation. No Google authorization, Google request, native storage,
Android scheduler, installation or phone interaction was performed.

CUA controlled the browser and captured production React Native Web components.
The eight R3 references and current Calendar management contract were read first.
Screenshots remain private under
`verification/local/p4e-visual-2026-10-14/`; no private captures are committed.
The `reviewScale=2` and `reviewMotion=reduced` parameters use the isolated
presentation adapter, not Android's system font or motion settings.

## Observed matrix

The recognized-calendar setup fixture was viewed at 360×800 in all eight pairs:

| Atmosphere | Light | Dark |
|---|---|---|
| Sunrise | `sunrise-light-setup.png` | `sunrise-dark-setup.png` |
| Sky | `sky-light-setup.png` | `sky-dark-setup.png` |
| Evening | `evening-light-setup.png` | `evening-dark-setup.png` |
| Night | `night-light-setup.png` | `night-dark-setup.png` |

These views retained the shared connected geometry, distinct atmosphere colors,
readable labels and selected controls. They show the compact setup surface; they
do not establish every possible screen/state in every appearance. The ordinary
primary confirmation target measured 56 CSS px high. The Night Dark lower setup
view was also scrolled and captured, including ready, excluded and adoption rows.

| Fixture and size | Actual observation |
|---|---|
| Multiple matches, 360×800 | Neither calendar was selected initially; confirmation was disabled. Selecting a named candidate changed the radio state and enabled confirmation. Bilingual names wrapped. |
| Creation and saved renamed source, 360×800 | Creation disclosed a new owned calendar and exposed a reviewed named zone. The renamed source stayed a selectable existing identity. No confirmation was submitted. |
| Fresh recovery, 360×800, 200%, reduced motion, bilingual text | Recovery explicitly stated No alert. Initial candidate rows showed No alert while the normal subsequent-import preference remained Alarm. Adoption was unselected. |
| Paused Resume, 800×360, long English/Chinese | Queued publication and a conflicting transfer were distinct; the conflict was excluded and had its own review action. The primary Resume action and Cancel remained available while content scrolled. Past-publication consequences were visible. |
| Paused Resume, 360×800, 200%, reduced motion | The corrected Resume action wrapped onto two lines within x=16 to x=344, measured 328×116.8 CSS px, and kept Cancel visible. A memory-only capture locked the selections and explicitly said that captured work does not mean every transfer has finished. |
| Saved unknown creation, access, ownership and initial-import states, 360×800 | Settings displayed distinct phase labels. The accessibility tree exposed result inspection, access recovery and source recovery actions in their corresponding phases. These were synthetic projections, not observations of Google failures. |
| Mixed review queue, 360×800, 200%, reduced motion | One reminder and one incoming-event issue were counted separately. The incoming row said No Remilo alert yet and wrapped English/Chinese content. Its measured row was 312.8×436.8 CSS px. |
| Unsupported incoming review, same presentation | Queue navigation carried the candidate revision. The source remained uncreated, displayed the unsupported explanation and exposed Ignore. Browser Back returned to the review queue. |
| New editor, paused scope, 360×800, 200%, reduced motion | The Calendar choice followed core alert/repeat/list controls. Switching it off displayed Local only; the toggle row wrapped and measured 312.8×158.4 CSS px. A long bilingual title was accepted. |
| Memory-only Local only save | Save returned to Agenda with the new local alarm row. Opening it showed the title, Alarm and Scheduled before the compact Google Calendar / Local only row. That row opened Local only management with an explicit reviewed adoption action. This does not verify native scheduling. |
| Recovered-alert review, 360×800 | A future Alarm selection and an excluded elapsed recovery were separate. The elapsed row said the reminder still has No alert; it did not promise an existing alarm was preserved. |

## Found defect and recheck

The first 360×800 / 200% fresh-recovery check found a clipped primary action:
`Enable Remilo calendar sync` measured x=16, width=445.8125, right=461.8125 and
height=72 CSS px. The visible label extended past the viewport. The failing
captures are `fresh-200-360x800-top.png` and
`fresh-200-360x800-bottom.png`.

After the shared production Button constraint/shrink correction, the same
fixture was rechecked at the exact viewport. The target measured x=16, width=328,
right=344 and height=116.8 CSS px. Its full label wrapped onto two lines and Cancel
remained visible. `fresh-200-360x800-fixed.png` records the corrected result.
The separate long Resume label was also rechecked in
`resume-200-360x800-fixed.png`; `resume-captured-200-360x800.png` records its saved
capture wording.

The initial incoming elapsed candidate also reused the association explanation
that the current local target was kept. That wording was reported for correction:
an incoming candidate has no local reminder yet. The recovered-alert wording was
observed corrected. The final incoming review also displayed
`No Remilo alert yet. Choose a future alert or No alert before importing.` in its
accessibility projection; `incoming-elapsed-200-fixed.png` retains the lower
review capture after that correction.

## Limits and remaining acceptance

Cold Metro bundling and browser navigation/focus repeatedly timed out. The server
was restarted once after a stalled rebundle. Only successfully rendered states
above are evidence; a timeout is not a passing observation.
The fixture server was stopped after review and the viewport override reset.
The two loaded fixture tabs were closed. Browser policy prevented explicitly
closing four earlier connection-error pages whose URLs became `data:` documents;
those agent-created tabs were left for normal automatic turn cleanup.

Clicking Ignore reached no browser-visible confirmation or JavaScript dialog.
The production native confirmation cannot be accepted as verified by this web
adapter. Ignore persistence, Android Back/IME ordering, TalkBack, actual Android
touch targets, system text scaling and native modal behavior require the signed
device run. Reduced-motion fixture presentation was inspected; Android animation
and accessibility announcements were not measured.

This is a representative production-component review, not the complete Cartesian
matrix of every state, appearance, size and accessibility mode. It establishes no
Google discovery/ownership, lost-write recovery, background execution, alarm
audibility, notification delivery or signed-device acceptance. P4-D/P4-E physical
gates and G4 remain pending in the backlog and consolidated owner checklist.
