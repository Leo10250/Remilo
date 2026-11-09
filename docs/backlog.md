# Open work

This is the live task source. Actionable work uses **Ready**, **In progress** or
**Blocked**. Completed work leaves this list; Git and normal change descriptions
retain history. Missing historical test paperwork is not an open defect.

## Actionable

| ID | Status | Work |
|---|---|---|
| QA-IOS-SMOKE | Ready | Sign and exercise the bundled app on iPhone/iPad. Verify the optional signed WidgetKit build separately. Use the [iOS build and physical checks](verification.md#ios-build). |
| QA-IOS-CALENDAR | Ready | Exercise signed iOS Google consent, one-off and recurring import, one-time publication, manual conflict review, and exact recovery with a tester account. Use the [Calendar sideloading checks](verification.md#google-calendar-on-a-sideloaded-iphone-or-ipad). |

## Later

These capabilities need bounded implementation decisions. Listing them does not
authorize scaffolding or change current behavior.

| ID | Capability | Dependencies and boundary |
|---|---|---|
| AI-01 | Android assistant/intent research | Establish current official support and limitations for intents, Gemini/AppFunctions and Samsung/Bixby before choosing integrations. |
| AI-02 | External create-reminder/alarm actions | After AI-01: supported entry points create a draft, obtain explicit confirmation and save once through the native engine. |
| AI-03 | Assistant-specific discovery/registration | After AI-01/02, where supported; test relevant providers and handle unsupported assistants honestly. |
| AI-04 | Optional local natural-language drafting | After AI-02. Offline deterministic parsing remains usable; AI is opt-in, capability-gated and cannot bypass confirmation. |
| FUT-ICON | Optional dynamic/themed launcher icons | Separate scope decision; current production has one static Classic identity. |
| FUT-TASK-ICON | Optional local task categories/icons | Low priority after Calendar and Android daily-workflow/assistant foundations. Suggestions allow preset correction, preserve explicit choices and retain a neutral fallback. Independent of save/scheduling/delivery; no per-reminder themes or alarm scenes. |
| QA-ANDROID-SMOKE | Android emulator smoke test for offline reminder persistence | Start with a manual run on a clean API 34 emulator using the bundled APK. Go offline, save a uniquely titled future **No alert** reminder, restart the app process without clearing its data, then verify the title, date, time, and alert mode. Keep alarm delivery and physical-device checks separate. |
| P5 | Optional Android cloud/primary-device coordination | After local Android/Calendar foundations. Define foreground/manual sync and honest device handoff; preserve offline authority. |

Category icons should match the shared family and remain distinct from selection,
overdue, failure and successful scheduling. Meaning cannot depend on color alone.
Choose the category catalog/classifier during that feature's work; the current
neutral glyph remains until then. Optional enhancements introduce no release gate
for existing behavior.
