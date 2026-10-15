# P4-D: automatic Calendar synchronization

The owner's 12 October 2026 decision moves the discussed synchronization and
Calendar-management refinements into P4-D, after P4-C recurrence mapping. The
owner selected automatic application of ordinary edits, with manual review for
conflicts or uncertain outcomes. Task status and the P4-C approval record belong
only in [the backlog](backlog.md).

This contract governs the native P4-D implementation. Historical P4-B links
retain manual permission until an individual or bulk activation is confirmed.
Signed-device/live Google acceptance is tracked separately in the backlog.
The separate [P4-E managed-calendar contract](calendar-managed-sync.md) extends
this baseline only after calendar-level setup confirmation; it does not grant
automatic discovery/import/publication permissions to historical P4-D links.

## Relationship, activation and scope

Automatic synchronization applies only to deliberately linked, supported events
on owned calendars. Enabling it explains the behavior once; ordinary subsequent
updates do not require individual confirmation. Existing manual links require
deliberate activation rather than acquiring background write permission through
migration. Published-but-unlinked copies remain independent. Connecting an
account, changing the publishing destination or discovering a new Google event
does not automatically import or link reminders.

Transfer only compatible Title, Notes and Schedule. Schedule remains one group
containing start, end, all-day state and named zone. Include only recurrence
rules, exceptions and splits supported by P4-C; this contract does not expand
support to meetings or otherwise unsupported event types.

Completion, Skip, Trash, list membership, alert mode, sound, vibration,
independent Due/Alarm and Snooze/Postpone remain local. Google reminder settings
remain governed by separately captured consent, not ordinary synchronization.
There is no remote deletion, automatic restoration, cloud coordination or iOS
work in this phase.

## Baseline comparison and automatic updates

Native state retains the last values confirmed common to both copies. Compare
each current field group with that baseline:

| Remilo versus baseline | Google versus baseline | Result |
|---|---|---|
| Unchanged | Unchanged | No compatible-field write |
| Changed | Unchanged | Transfer the Remilo value automatically |
| Unchanged | Changed | Transfer the Google value automatically |
| Changed | Changed to the same value | Acknowledge the shared value |
| Changed | Changed differently | Preserve both values and require manual review |

Changes to different groups can merge automatically. A Google time-only edit
does not require review when the corresponding Remilo schedule is unchanged
and the new timing is valid. A temporary difference waiting to be transferred
is an Update pending state, not a conflict.

Advance each common field baseline only after the relevant local and Google
outcomes establish agreement. Failed, partial or unknown outcomes must not
invent agreement. Pause automatic writes for an association requiring review;
other eligible associations may continue. A fresh manual resolution compares
current values and requires confirmation, then establishes a new common baseline.
Never invent a baseline when adopting an old published copy with differences.

An intervening local revision or Google version invalidates the captured attempt.
Re-read and compare again; a changed etag alone does not prove that both sides
changed a compatible field. HTTP 412 stops the stale write. A subsequent true
conflict requires review; an unrelated Google edit must remain intact.

## Edit timestamps

Capture Google's `updated` timestamp for review context where available. Label
it **Google event updated [time]**, not as a particular field's edit time.
Google documents it as the modification time of the main event data, excluding
Google reminder-setting changes. It does not provide independent Title, Notes
and Schedule edit timestamps.

Do not use whole-event latest-edit-wins to resolve conflicts. A later Google
title edit can make older Google notes appear newer than a Remilo notes edit.
Device-clock differences and timestamps changed by our own synchronization
writes also prevent treating these times as a reliable ordering of user intent.
Local edit context must distinguish authored compatible-field edits from
synchronization commits and local-only actions such as Snooze or completion.
Baseline values, local revisions and remote etags remain authoritative guards.

## Alarm timing and lifecycle

Valid inbound schedule changes recalculate linked Due and authored Alarm using
the existing timing rules. Independent timing and an existing future
Snooze/Postpone delivery target survive. Validate native readiness and report
Blocked/Pending truthfully; never substitute another alert mode.

A newly proposed elapsed alert, a ringing occurrence or another unsafe timing
transition requires appropriate local recovery or review. Do not replay an
elapsed alert, silently move it to tomorrow or interrupt ringing to apply a
Calendar edit. Review must show the local target currently in effect and guard
the displayed occurrence identity, revision and generation.

Keep the independent deletion policy from the
[Calendar management contract](design/current/calendar-management.md):

- Confirmed Google deletion keeps local content and delivery, preserves
  Snooze/Postpone, suspends updates and presents the existing cancellation notice.
- Local Trash cancels local delivery and leaves Google unchanged.
- Unlink keeps local content and delivery, stops future transfers and leaves
  Google reminder settings unchanged. Fence unsent work; sent work permits
  outcome reconciliation without permission to issue more writes.
- Completed, skipped and trashed reminders keep read-only Calendar context.
  Sync never reopens them or remotely completes/deletes their events.
- Local or remote restoration never revives old write approvals. Resumption
  requires fresh identity, compatibility and baseline review.
- Purge erases private observations, snapshots and payloads. Late results cannot
  restore erased content or recreate either copy.

## Native opportunities, incremental transport and recovery

Use foreground opportunities after relevant committed edits and when returning
to the app, plus permitted native background work. Retain an explicit **Sync now**
action. Execution is bounded and connectivity-aware; background timing is subject
to Android scheduling and battery restrictions. Promise neither instant nor
continuous synchronization, and never require React Native or a JavaScript timer
for background work or alarm delivery.

Calendar authorization and HTTPS remain outside the serialized alarm worker.
All durable synchronization decisions, observation commits, operation capture,
local scheduling checkpoints and lifecycle fencing remain on that worker.
Automatic operations capture immutable input and the activation/link revision
that permits the write. New work must not reuse an obsolete manual approval.

Use consistent per-account/calendar incremental queries, bounded pagination,
durable cursors and allowlisted event associations. Save a new sync token only
after the associated pages/checkpoints are safely recorded. Expired-token HTTP
410 triggers reconstruction of the remote synchronization cache; it must not
erase local reminders, associations or alarms, or imply event deletion. Preserve
the existing typed distinction between cancellation, unavailable resources and
ordinary failed attempts.

Remote patches stay sparse and conditional, preserving unrelated Google fields.
Retries retain the original event identity and immutable intended operation.
Skip acknowledged local phases. Before another write after an uncertain outcome,
inspect the same Google event and establish what completed. Matching intended
values can confirm success. If uncertainty or conflict remains, keep both outcomes
visible and require manual recovery rather than blindly resending or rolling back
confirmed local changes. Recoverable unsent network/quota failures may retry with
bounded backoff without claiming a conflict or deletion.

Revalidate connection, ownership, eligibility, activation/link revision and local
guards before every commit/write. Account changes, Unlink, terminal actions,
Restore, Relink and Purge invalidate old permissions. A default destination change
never retargets an existing association. All Calendar tokens, cursors, snapshots,
jobs and account labels stay out of DP storage and portable backups. Audit CE
migration needs during implementation. CE 9→10 retains recurrence resource
identities and per-resource checkpoints. CE 10→11 adds automatic permission,
dirty revisions, provenance guards, cursors/cache, review issues/preferences,
notification fingerprints, saved run summaries and separate Calendar Activity.
DP remains 6 and portable backup remains 4. Migration grants no automatic permission.

One unique hourly WorkManager request uses connected-network constraints and a
15-minute flex window. Unique one-time work covers pending transfers and durable
continuations. A run has a two-minute I/O budget, at most ten collection pages
and fifty association attempts; continuation rotates calendars by their saved
checkpoints. Unsent transient requests back off from one minute to one hour.
WorkManager 2.12.0 is initialized on demand through Configuration.Provider;
locked boot never initializes Calendar work or opens CE storage. Background
authorization reuses the existing account and never opens consent UI.

## Status, buttons and review notices

Keep the reminder-first Details hierarchy and compact Calendar navigation row.
Use consistent relationship, outcome and action wording:

| Condition/action | P4-D presentation |
|---|---|
| Published once without a link | Not linked · Published once |
| Automatic transfers enabled | Linked · Automatic sync |
| Deliberately detached | Not linked · Updates stopped |
| Pending ordinary transfer | Update pending |
| Genuine conflict | Changes need review |
| Suspended transfers | Sync paused, with the specific reason |
| Unconfirmed Google write | Google update not confirmed |
| Confirmed comparison/transfer | Last successful sync [time] as supporting information |
| Immediate synchronization | Sync now; it may apply ordinary changes |
| Read-only inspection, if exposed | Check for changes |
| Unconfirmed-write inspection | Check update result |
| Required field resolution | Review changes |

Never imply continuous freshness or label a failed attempt as a successful sync.
The normal explanation is: **Changes update automatically between Remilo and
Google Calendar. Conflicts and unresolved updates need your review.** Linking or
relinking establishes identity/baseline and discloses automatic behavior before
activation; do not confuse that initial setup with confirming every routine edit.

Make Review changes the prominent action when needed. Sync now is secondary.
Keep **Unlink from Google Calendar** visible in its own lower group as an outlined
neutral action with an unlink symbol. It stops the relationship, not either copy;
avoid Trash/delete symbols and destructive red treatment. Confirmation explains
local alert retention, unchanged Google data/settings and any already-sent request.
Do not promise that a Google event exists when availability is unknown or deleted.

Use a lower-emphasis text action with an external-link symbol for **Open in Google
Calendar** near the source information instead of a full-width outlined button.
Preserve at least a 48 dp target, wrapping and readable text rather than shrinking
the hit area or truncating the label. Review confirmation actions retain 56 dp.

Show a persistent Agenda review notice with an affected count, affected reminder
metadata and a concise Details notice leading to review. Retain it until resolved,
even after a notification is dismissed. Clearly state the local alert currently
in effect where relevant; never promise audibility for Blocked/Pending delivery.

New issues discovered in the background may produce one quiet, grouped Calendar
review notification on a separate non-alarm channel, respecting permissions,
preferences and lock-screen privacy. Tapping opens the relevant current review,
not an automatic resolution. Deduplicate unchanged issues across retries/restarts.
Do not notify for routine successful sync or transient failures recoverable without
user action; do not use alarm audio, full-screen interruption or repeated modals.
In-app notices remain useful when notifications are disabled.

Remove **Previous Calendar operations** from the main management screen. Keep
current problems and phase-appropriate recovery there. Put concise user-relevant
entries in the existing reminder Activity destination, such as **Event time updated
from Google Calendar** or **Google Calendar unlinked**. Preserve internal durable
records for recovery/diagnostics; historical resolved failures are not current
warnings. Do not expose operation IDs or raw native error codes as product history.

## Explicit synchronization opportunities and feedback

`RequestCalendarSync` captures an immutable UUID and AllAuthorized or Association
scope before execution. Existing CE JSON receipts hold identity/permission guards;
a separate progress receipt holds durable stages and sets of checked/changed/
imported/published logical families. Agreement without a content change counts as
checked only. Multiple resources or fields do not inflate those counts. Existing
`confirmed` remains legacy agreement data and is not a count of updated reminders.

The existing runtime executes the opportunity under existing permissions and
budgets. It cannot activate manual links, override Pause/review or retarget fenced
work. Pending requests resume the same identity; uncertain writes still require
inspection before another write. Same UUID/different scope is OPERATION_REUSED.
The compatibility Sync now API uses this same capture and execution path.

Saved request status distinguishes Checking, NoChanges, Synced, Pending,
NeedsReview, AccessRequired, Unconfirmed, Paused, Failed, ScopeChanged and
NotChecked. NoChanges requires complete relevant inspection, including a checked
empty collection; no eligible work or interrupted pagination alone cannot prove
it. New current problems supersede an older success. Item success does not clear
unrelated global issues. Purge redacts private item progress/references and late
results cannot recreate them. Reads, disclosure expansion and navigation never
dispatch network work. Schema versions remain CE12/DP6/backup4.

Presentation follows the current [attention/details contract](design/current/calendar-management.md#calendar-attention-and-sync-details--14-october-2026).

## Required evidence

Cover every comparison-table case, different-group merges, time-only automatic
updates, shared equal edits, true conflicts, unrelated-field edits and timestamp
misordering. Verify safe past/ringing handling, linked versus independent timing,
preserved Snooze/Postpone and truthful Blocked/Pending outcomes.

Exercise intervening revisions/412, incremental pagination, expired tokens,
account/ownership changes, interrupted cursor/local/remote commits, lost replies,
same-operation recovery, uncertain-outcome inspection and obsolete activation.
Retain deletion/Trash/Restore/Unlink/Purge, terminal-state, backup/DP privacy and
blocked-I/O responsiveness regressions from P4-B and recurrence cases from P4-C.

Review production components in eight atmosphere/brightness pairs, narrow portrait,
landscape, 200% text, long English/Chinese, reduced motion, Android Back/keyboard
and TalkBack. Verify accurate state/actions, persistent notices, notification
deduplication/permission-denial/stale taps, compact external navigation and Activity
history. Fixtures must remain memory-only and unable to call Google or schedule
native alarms. Complete sequential shared/Android verification and identified
signed-build/live Google/phone acceptance before claiming the Calendar release gate.

## References and interpretation

- [Google event data and updated timestamp](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- [Google conditional writes](https://developers.google.com/workspace/calendar/api/guides/version-resources)
- [Google incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Android periodic-work restrictions](https://developer.android.com/reference/androidx/work/PeriodicWorkRequest)
- [Google notification guidance](https://developer.android.com/design/ui/mobile/guides/home-screen/notifications)
- [Material action emphasis](https://github.com/material-components/material-web/blob/main/docs/components/button.md)
- [Material 3 Expressive research](https://design.google/library/expressive-material-design-google-research)
- [Apple status feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
- [Apple button roles](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Apple WWDC25 writing guidance](https://developer.apple.com/videos/play/wwdc2025/404/)
- [Chen et al., CHI 2024: contextual notifications](https://www.ruizlab.org/wp-content/uploads/2024/10/3613904.3641993.pdf)
- [Weinshel et al., IMWUT 2025: transparency and activity history](https://www.synergylabs.org/yuvraj/docs/Weinshel_Ubicomp25_EvaluatingMechanisms.pdf)
- [Anik and Bunt, IUI 2026: information depth and progressive disclosure](https://hci.cs.umanitoba.ca/assets/publication_files/iui26-28.pdf)

These papers study health notifications, smart-home controls and AI explanations,
respectively; they inform selective interruption and accessible explanation/history.
They do not experimentally prescribe Remilo's conflict rule, exact labels or layout.
Those are the owner-approved product decisions recorded here.
