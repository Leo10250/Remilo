# Remilo localization

Every new or changed app-owned feature includes English and natural Simplified
Chinese presentation. Use [$remilo-localize](../.agents/skills/remilo-localize/SKILL.md)
for changed copy and localization reviews. Language is presentation: it does not
change reminder timing, completion, Calendar operations or stored identities.

## Language behavior

Settings places Language after Appearance, with System default (跟随系统), English
and 简体中文. Choices save through the serialized native preference controller.
Only a confirmed native snapshot changes the interface; uncertain replies retain
the same captured retry. Language changes preserve drafts, selection, focus,
navigation, captured alarm actions and playback deadlines.

Fresh installations follow the first supported language in the phone's ordered
list, falling back to English. Existing installations retain English on upgrade
until changed. Missing settings alone do not establish a fresh installation.
Manual selections remain fixed. Simplified Chinese recognizes Hans, CN and SG;
Hant/TW/HK/MO do not imply Simplified Chinese. Explicit script takes precedence over
region, so zh-Hans-HK is supported and zh-Hant-CN does not select Simplified Chinese.
Remilo and Android's per-app selector stay synchronized, respecting an explicit
Android selection made before first launch. Declare supported app languages
explicitly rather than deriving them from dependency resources. See Android's
[per-app language guidance](https://developer.android.com/guide/topics/resources/app-languages).

All owned text uses the shared offline catalog, including native alarms,
notifications, errors, actions and accessibility announcements before unlock.
New test-alarm titles and bundled illustration labels/sample content are localized.
Existing saved titles, notes, list names, exercise names, descriptions, imported
content and Calendar names remain untouched. An authored English name is not a
missing translation. Remilo and external brand names retain their identities.
Android-owned external interfaces choose their own language; Calendar protocol
descriptions and immutable identifiers are not interface copy.

Dates, weekdays and quantities follow the interface language. Device-owned
12/24-hour settings, time zones and Gregorian recurrence remain independent.
Selecting Chinese does not select a lunar calendar. Language is outside backups.

## Catalog and integration

[`catalog.json`](catalog.json) is the canonical UTF-8 source. Use stable keys,
complete messages, named typed arguments, and English `one`/`other` plus Chinese
`other` when quantity changes wording. Keep punctuation and count/unit labels in
the complete message; do not pass English plural suffixes or assemble translated
fragments with English punctuation. Explain a new or ambiguous message's meaning,
location, action consequence and relevant constraints in its `context` field.

Run `npm run localization:generate` after catalog edits. Commit the generated
TypeScript catalog, Android default/Hans resources, native catalog and typed
`NativeMessages` constructors. `npm run verify:localization` checks bilingual
parity, arguments, escaping and deterministic output without writing files; it
also runs within `npm run verify`. These checks do not assess natural Chinese.

React render boundaries use `useTranslation`; standalone presentation functions
accept explicit formatting/translator context when needed. `useLocalizedState`
retains feedback descriptors, including notices and confirmations, so confirmed
language changes update copy without remounting editors or navigation. The
compatibility lookup applies only to app-owned feedback, never arbitrary text.

Native presentation uses generated typed descriptors. `L10n.calendarDescriptor`
recognizes only allowlisted historical Calendar status templates. Preserve their
original prose and machine outcomes; unknown historical details use a neutral
localized fallback. Translate messages, never commands, stored enums, captured
action identities or placeholder values supplied by the user.

## Contextual Chinese terminology

Translate the concept in its actual context, not every occurrence of an English
word the same way. The catalog supplies current interface text; these distinctions
guide new copy and prevent terms from leaking into unrelated scopes.

| Meaning and scope | Chinese presentation | Distinction |
|---|---|---|
| Agenda / reminder list | 日程 / 清单 | Keep Calendar destinations distinct from reminder lists |
| Routine, including generic setup/widget destinations | 日常计划 | A routine is not necessarily fitness training or a Calendar event |
| General routine item | 步骤 | For example, 4 个步骤 |
| Weekday arrangement heading and counts, for both presets | 每周安排 / 步骤 | Use 步骤 even for Exercise here; lower timing section is 日期与时间 |
| Exercise preset / preset picker | 锻炼 / 用途 | The whole activity can be 锻炼 or 训练 according to the sentence |
| Individual fitness exercise in its own form/view | 动作 | For example, 动作名称 or 添加动作; avoid 练习 for a fitness movement |
| Weekday scope | 星期 / 每周这一天 | 工作日 is only the explicit Monday–Friday preset |
| Routine Focus widget mode | 计划进度 | Keep generic routine destinations independent of fitness terminology |
| Calendar event / source or destination calendar | 日程 / 日历 | Remilo consistently uses 日程 for an event |
| Create a Calendar copy / ongoing synchronization | 添加到日历 / 同步 | Creating a copy does not promise continuing synchronization |
| Completed / complete work | 已完成 / 标记为完成 | Work completion is distinct from ending sound preview |
| Reopen completed work | 标记为未完成 | Navigation uses 打开; Trash uses 恢复 |
| Trash / Activity | 回收站 / 操作记录 | Keep these consistent across app, native controls and widgets |
| Snooze / Postpone | 稍后提醒 / 推迟提醒 | Preserve the actual action and scope; neither completes work |
| Sound preview / stop preview | 试听 / 停止试听 | Do not imply stopping or completing a ringing reminder |
| Alert modes | 闹钟 / 通知 / 无提醒 | Preserve the selected mode and its delivery semantics |
| Exact-alarm permission | 精确闹钟 | Explain on-time ringing in plain help text |
| Database diagnostics | 内容数据库版本 / 提醒数据库版本 | Keep technical diagnostics separate from ordinary recovery wording |

Use a neutral, direct voice, with 你 where useful, Chinese punctuation and natural
character spacing. Explain scope, outcomes and the next action. Avoid recovery
jargon such as 原生验证, 终态, 钟面时间, 训练焦点 or “写入”. A retry refers to the
captured 此次操作 rather than suggesting a new operation. Preserve historically
recognized English Calendar templates and their typed argument bindings.

## Research and review

Reuse settled scoped terms. For new or ambiguous vocabulary, inspect relevant
first-party Simplified Chinese app interfaces or help pages and compare the
meaning with Remilo's behavior. Platform documentation supplies system terms;
dictionaries can resolve remaining language questions. Search snippets and raw
machine translations do not establish product usage. A competitor's vocabulary
does not automatically override Remilo's accepted distinction.

Useful starting references are [Huawei Health](https://consumer.huawei.com/cn/support/content/zh-cn01057377/)
for whole training versus individual 动作, [Huawei Calendar](https://consumer.huawei.com/cn/support/content/zh-cn16093658/)
for 日程, [Dida/TickTick](https://help.dida365.com/start/6194405595563425792) for tasks,
reminders and completion, and [Apple Reminders](https://support.apple.com/zh-cn/guide/iphone/iph88463e18/ios)
for lists and reminder actions. [Google Calendar](https://support.google.com/calendar/answer/72143?hl=zh-Hans)
uses 活动 for events; Remilo retains 日程 consistently. Android's
[localization guidance](https://developer.android.com/guide/topics/resources/localization)
explains translator context and resource handling. Inspect the relevant source
when using it for a new decision; these links are starting points, not permanent
proof of every future choice.

Record only reusable terminology decisions in this guide, scoped to the concept
and supported by a compact reference when research informs the choice. Keep
message-specific context in the catalog. Use a separate reviewer for changed copy,
with the strings, call sites and actual UI context. Review meaning, naturalness,
consequences, scope, consistency, punctuation, quantities and authored-content
preservation. Resolve substantive findings before handoff. Report checks and any
limitations briefly; do not create per-feature research or evidence dossiers.

## Presentation and verification

[`assets/atmospheres/presentation.json`](../assets/atmospheres/presentation.json)
owns typography metrics shared by React Native and native presentation. Keep the
platform sans-serif with Simplified Chinese locale selection; do not download or
bundle another font. Preserve the eight atmosphere/brightness pairs, artwork,
geometry, contrast and interaction targets. Paragraphs are left-aligned; rows and
actions grow or wrap rather than squeezing essential copy.

The [Simplified Chinese smartphone readability study](https://academic.oup.com/iwc/article/33/2/177/6354130)
considers size and line spacing together; [Apple's typography guidance](https://developer.apple.com/videos/play/wwdc2020/10175/)
supports hierarchy and user scaling. These inform review, not a universal font or
proof of the manifest's exact Android metrics.

Inspect changed surfaces at relevant narrow widths and 100–200% text, including
mixed scripts and accessible labels. Check IME composition, TalkBack, native
controls and OEM fonts when affected. Host/fixture renders establish their actual
layout observations, not phone behavior or audibility. Use the relevant checks in
the [verification guide](../docs/verification.md); localization work does not
authorize installing or distributing a build.
