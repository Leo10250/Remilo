# Language and Simplified Chinese

Owner-authorized implementation plan, 15 October 2026. Status belongs only in
the backlog. Language is presentation; it never changes reminder timing or work.

Settings places Language immediately after Appearance. Choices are System default
(跟随系统), English and 简体中文. Selection saves automatically through the serialized
native preference controller. A confirmed native snapshot changes the interface;
uncertain replies retain the original retry. Preserve drafts, selection, focus,
navigation, captured alarm actions and playback deadlines.

Fresh installations follow the first supported language in the phone's ordered
list; unsupported lists fall back to English. Existing installations retain English
on upgrade until changed. Manual selections remain fixed. Simplified Chinese
recognizes Hans, CN and SG; Hant/TW/HK/MO do not imply Simplified Chinese. Explicit
Hans takes precedence over region. Android's per-app selector and Remilo's selector
stay synchronized. An explicit pre-launch Android selection is respected. Missing
settings are not evidence of a new installation.

All app-owned presentation uses the shared offline catalog, including native alarms,
notifications, errors, actions and accessibility announcements before unlock. Authored
titles/notes, list names, imported content and Calendar names are never automatically
translated. New test-alarm titles use the selected language; existing saved titles
are preserved. Remilo and external brand names retain their identities. Android-owned
external interfaces choose their own language. Calendar protocol descriptions and
immutable identifiers are not UI copy.

Dates, weekdays and quantities use the selected interface language. Device-owned
12/24-hour preferences remain independent, as do time zones and Gregorian recurrence.
Selecting Chinese does not select a lunar calendar. Language is outside backups.

## Shared visual language

Keep all eight atmosphere/brightness pairs, artwork, geometry, contrast and target
requirements. Use the system sans-serif with Simplified Chinese locale selection;
do not download or bundle another font. The canonical presentation manifest generates
matching native/React Native Chinese metrics:

| Role | Size / line height (sp) | Weight |
|---|---|---|
| Body/value | 16 / 24 | Regular |
| Supporting/label | 14 / 22 | Regular |
| Heading | 18 / 26 | Medium |
| App bar | 22 / 30 | Medium |
| Title | 24 / 34 | Semibold |
| Display | 32 / 42 | Semibold |

Use natural character spacing, Chinese punctuation and left-aligned paragraphs.
Rows and actions grow/wrap; essential actions are never squeezed to fit. Verify
100–200% text, IME composition, mixed scripts, TalkBack and native controls. Research
informs these starting metrics; it does not prove a universal best font.

The [Simplified Chinese smartphone readability study](https://academic.oup.com/iwc/article/33/2/177/6354130)
evaluates size and line spacing together. Its tested device, population and point
sizes do not establish Remilo's exact Android sp values. [Apple's UI typography
guidance](https://developer.apple.com/videos/play/wwdc2020/10175/) supports a shared
hierarchy of size, weight and leading with user-controlled scaling. These are
design inputs, followed by production-component and device validation.

Android's [per-app language guidance](https://developer.android.com/guide/topics/resources/app-languages)
documents the public synchronization APIs and explicit locale configuration.
Remilo declares its reviewed languages explicitly, because automatic discovery
also includes dependency resources.

Terminology: 日程, 清单, 已完成, 回收站, 操作记录, 标记为完成, 稍后提醒,
推迟提醒, 停止试听, 闹钟, 通知 and 无提醒. Completion, postponement and stopping
preview remain distinct. Translate messages, never commands or stored state enums.

Catalog parity, host tests and fixture renders do not establish physical alarm,
TalkBack, OEM font or pre-unlock acceptance. Signed-phone cases remain in the
consolidated owner checklist. Implementation does not install/distribute a build.
