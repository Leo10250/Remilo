# Open work

This is the live task source. Actionable work uses **Ready**, **In progress** or
**Blocked**. Completed work leaves this list; Git and normal change descriptions
retain history. Missing historical test paperwork is not an open defect.

## Actionable

| ID | Task | Status | Next action |
|---|---|---|---|
| BETA-04 | Investigate Recents afterimage | Ready | Reproduce the previously reported afterimage on the current build and isolate its lifecycle/window cause. Current reproducibility and root cause are unestablished. |
| L10N-01 | Align individual Exercise form labels with the scoped Chinese glossary | Ready | Exercise-specific name/add/edit keys currently use 步骤名称/添加步骤/编辑步骤 despite fitness-item call sites. Review those labels in context against 动作 terminology; keep shared weekday counts as 步骤. |

## Later

These capabilities need bounded implementation decisions. Listing them does not
authorize scaffolding or change current behavior.

| ID | Capability | Dependencies and boundary |
|---|---|---|
| RW-04 | Optional Today/agenda digest | Builds on dated routines/Today. Opt-in local time, quiet dismissal, no duplicate notification or alarm-channel behavior. |
| AI-01 | Android assistant/intent research | Establish current official support and limitations for intents, Gemini/AppFunctions and Samsung/Bixby before choosing integrations. |
| AI-02 | External create-reminder/alarm actions | After AI-01: supported entry points create a draft, obtain explicit confirmation and save once through the native engine. |
| AI-03 | Assistant-specific discovery/registration | After AI-01/02, where supported; test relevant providers and handle unsupported assistants honestly. |
| AI-04 | Optional local natural-language drafting | After AI-02. Offline deterministic parsing remains usable; AI is opt-in, capability-gated and cannot bypass confirmation. |
| FUT-ICON | Optional dynamic/themed launcher icons | Separate scope decision; current production has one static Classic identity. |
| FUT-TASK-ICON | Optional local task categories/icons | Low priority after Calendar and Android daily-workflow/assistant foundations. Suggestions allow preset correction, preserve explicit choices and retain a neutral fallback. Independent of save/scheduling/delivery; no per-reminder themes or alarm scenes. |
| P5 | Optional Android cloud/primary-device coordination | After local Android/Calendar foundations. Define foreground/manual sync and honest device handoff; preserve offline authority. |
| P6 | Optional iOS feasibility/port | Final phase after Android expansion and cloud/coordination decisions. Establish real iPhone capabilities before implementation. |

Category icons should match the shared family and remain distinct from selection,
overdue, failure and successful scheduling. Meaning cannot depend on color alone.
Choose the category catalog/classifier during that feature's work; the current
neutral glyph remains until then. Optional enhancements introduce no release gate
for existing behavior.
