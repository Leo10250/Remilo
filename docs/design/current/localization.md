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

## Simplified Chinese wording review — owner correction, 18 October 2026

Use Chinese product vocabulary by meaning and context, not a single dictionary
translation for every English word. The owner requested an app-wide review after
the exercise builder displayed 练习. That noun is inappropriate for a list of
fitness movements; changing every occurrence to 锻炼 would also confuse an
individual movement with the whole activity.

| Meaning | Chinese presentation |
|---|---|
| Routine, including generic widget/setup destinations | 日常计划 |
| General routine item | 步骤; e.g. 4 个步骤 |
| Exercise preset | 锻炼; Preset picker label 用途 |
| One fitness exercise | 动作; e.g. 4 个动作, 动作名称, 添加动作 |
| Whole exercise activity | 锻炼 or 训练 according to the sentence |
| Weekday scope | 星期 / 每周这一天; 工作日 only for the explicit Monday–Friday preset |
| Routine Focus widget mode | 计划进度 |
| Calendar event | 日程, while the destination/source calendar stays 日历 |
| Calendar copy creation/publication | 添加到日历; ongoing synchronization remains a separate behavior |
| Reopen completed work | 标记为未完成, distinct from navigation 打开 and Trash 恢复 |
| Trash | 回收站, consistently across app/native/widget feedback |
| Sound preview | 试听 / 停止试听, distinct from stopping a ringing alarm |
| Exact-alarm permission | 精确闹钟, with plain help about on-time ringing |
| Database schema diagnostics | 内容数据库版本 / 提醒数据库版本 |

The owner's subsequent weekday-builder correction takes precedence for that
group: use 每周安排 as its heading and 步骤 in every weekday count, including the
Exercise preset. Do not use 动作 for this group or its counts. The lower timing
section is 日期与时间. Individual exercise-form vocabulary has a different scope
from this weekday arrangement.

Prefer clear scope and outcomes over 原生验证, 终态, 钟面时间, 训练焦点 or
“写入” in user-facing recovery. Retry wording refers to the captured request
(此次操作), never a replacement operation. Use one consistent neutral/direct
voice (你 where a pronoun is useful), Chinese punctuation and complete count/unit
labels. Do not concatenate an English closing parenthesis onto a translated
opening fragment. Preserve argument bindings, identities, timestamps, existing
action behavior and historically recognized English Calendar status templates.

The vocabulary was compared with actual first-party Chinese product documentation:
[Huawei Health](https://consumer.huawei.com/cn/support/content/zh-cn01057377/)
uses training/course language for the whole activity and 动作 for its components;
[Huawei Calendar](https://consumer.huawei.com/cn/support/content/zh-cn16093658/)
uses 日程; [Dida/TickTick](https://help.dida365.com/start/6194405595563425792)
uses tasks, reminders, completion and clear creation controls; and
[Apple Reminders](https://support.apple.com/zh-cn/guide/iphone/iph88463e18/ios)
distinguishes reminders, lists and completion. These are usage references, not
proof of one universally best translation or a requirement to copy another app.
[Google Calendar](https://support.google.com/calendar/answer/72143?hl=zh-Hans)
calls events 活动 in its Chinese help; Remilo uses the familiar 日程 consistently
within its own interface.

Authored titles, exercise names, descriptions, imported content and Calendar names
remain untouched. An English Weekly workout or Bird-dog supplied by a user/fixture
is not missing interface localization. Bundled illustration labels and inert
sample content are localized. The catalog and generated Android resources remain
the authority; platform-controlled screens follow the platform's own wording.

Catalog parity, host tests and fixture renders do not establish physical alarm,
TalkBack, OEM font or pre-unlock acceptance. Signed-phone cases remain in the
consolidated owner checklist. Implementation does not install/distribute a build.
