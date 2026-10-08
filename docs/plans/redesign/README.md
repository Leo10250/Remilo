# Time-of-day redesign roadmap

The [current design](../../design/current/README.md), approved under A36, is the
only current visual/workflow direction. All eight R3 images govern style; approved
page contracts and corrections govern page UX. [Backlog](../../backlog.md) alone
owns status. These future implementation units replace the old P01–P12 sequence.

## Current units

| Unit | Dependencies |
|---|---|
| [TD-01 Shared foundations](td-01-shared-foundations.md) | None; approved R3 direction and existing implementation baseline. |
| [TD-02 Global Appearance](td-02-global-appearance.md) | TD-01 shared roles/assets; existing native settings/controller baseline. |
| [TD-03 App screens and remaining review](td-03-app-screens.md) | TD-01 and TD-02; established native product/query/action contracts. |
| [TD-04 Native presentation](td-04-native-presentation.md) | TD-01 and TD-02; existing native session/delivery authority. |
| [TD-05 Static Classic branding](td-05-static-branding.md) | Approved Classic source/A01; independent of atmosphere implementation. |
| [TD-06 Consolidated acceptance](td-06-consolidated-acceptance.md) | Integrated TD-03, TD-04 and TD-05; TD-01/TD-02 contracts and evidence included transitively. |

TD-05 is independent; TD-03 and TD-04 may proceed in parallel after TD-01/TD-02.
TD-06 integrates their actual outputs and preserves consolidated physical acceptance.
The owner authorized this documentation/reference PR; runtime execution occurs
when requested. No cancelled classifier, per-reminder chooser, backup-v4 or dynamic
launcher gate is part of the current dependency graph.

## Historical plan map

| Earlier planning | Current disposition |
|---|---|
| P01 accepted non-shipping prototypes | Historical acceptance; TD-01 targets R3, not Meadow. |
| P02 old eight-environment sample/catalog | Superseded active scope; reusable isolation/role boundaries inform TD-01. |
| P03 branding | TD-05 Classic-only. |
| P04A global appearance and P09 periods | TD-02, with approved four periods/defaults. |
| P04B/C/D per-reminder policy/portability/chooser | Retired; no new manual-theme backup gate. |
| P05/P06/P07 pages/workflows | TD-03. |
| P08 native presentation | TD-04. |
| P10 Smart Colors/task-derived scenes | Retired from active scope. |
| P11/P11B launcher variants/matching | Optional future backlog idea, outside TD acceptance. |
| P12 acceptance | TD-06 plus retained G1/G2/G3 observations. |

[Pre-realignment plan snapshots](../../design/history/pre-r3-realignment/README.md)
retain original prose. P01's plan is also an unchanged hashed submission at its
original path; it is historical, not a current entry point. Other old plan paths
redirect here and to their archive. R9 remains a draft and the decorative list-icon
choice is still to be raised during implementation. Exact storage field/export
design is implementation work; this roadmap introduces no deployed interface/schema.
