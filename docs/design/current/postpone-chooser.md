# Uniform Postpone chooser

Owner-approved implementation plan, 28 October 2026. This correction supersedes
the native quick-Snooze controls and mixed Postpone shortcut/row layout in earlier
current contracts. Accepted reference bundles remain historical visual evidence.

## Actions and presentation

Native single/member controls and ringing Reminder Details expose **Mark as done**
and **Postpone**. Group footers expose **Mark all as done (N)** and **Postpone all**.
Notifications, non-ringing quick actions and the Snooze preference retain their
existing behavior and legacy commands.

Both native and app choosers use one eight-tile anatomy, in this row-major order:
15 min / 30 min; 1 hour / 1 day; Tomorrow morning / Tomorrow afternoon;
Tomorrow evening / Custom. Relative tiles show their resulting clock time; 1 day
also states 24 hours later. Tomorrow labels display the three saved clock times.
All tiles share their width, height, padding, alignment and 16 dp corners, with
8 dp gaps and an 80 dp minimum height. Content grows together rather than clips.
Titles use 16 sp and supporting values 14 sp. Selected tiles have the shared
primary outline/container and a checkmark. Custom has a navigation chevron until
a valid custom choice is selected. Two columns reflow as one consistent column
at font scale 1.6 or when measured content cannot fit.

Use the existing opaque sheet, 24 dp top corners, 16 dp gutters and shared roles.
Keep one exact next-alert preview and persistent confirmation outside the choices
scroller. Native footer actions retain 64 dp minimums; members/app actions retain
56 dp. If the footer cannot fit, the complete sheet becomes scrollable. Retain
captured atmosphere, safe insets, focus restoration and reduced motion.

## Time and custom selection

Opening selects now plus **15 minutes**. Relative selections capture the deliberate
selection instant: 15/30/60 minutes and exactly 24 elapsed hours for **1 day**.
Tomorrow means the next local calendar date at the saved minutes-of-day in the
chooser's captured device timezone. Custom civil time uses the native gap-forward,
earlier-fold policy. The Kotlin resolver is shared through a read-only bridge.

The draft captures its timezone and shortcut values. Once selected, its target is
a fixed instant: waiting, recreation, preference changes and retry never rebase it.
Show the exact date/time and relevant zone; expiry disables confirmation until
the user selects again. Foreground preview refresh does not schedule delivery.

Custom opens a separate Date/Time step seeded from the valid selected target, or
now plus 15 minutes if expired. Android pickers change only provisional fields.
**Use this time** promotes a valid target and returns to the tiles; **Back to
choices** discards provisional changes. Back closes the active picker first,
then the custom step, then the chooser. Cancellation performs no mutation.

## Native ownership, privacy and recovery

Opening/choosing/cancelling does not stop sound or mutate work. Playback continues
with the original five-minute deadline. Confirmation changes only the captured
occurrences' next alert; work remains unfinished and original overdue/Event/Due
and future recurring slots are preserved.

Capture occurrence IDs/generations and session at opening. Postpone all keeps its
displayed count/set; later arrivals stay excluded. Stale captured members reject
the whole uncommitted operation. Closing/reopening deliberately captures current
controls. A confirmed timeout closes an unsubmitted chooser with its activity.
Unknown submitted commands retain their exact operation, membership and target.
Operational draft state survives recreation without saving titles or notes.

PostponeAll uses one serialized protected transaction and durable group receipt,
then recoverable per-member registration. Never implement it as individual UI
commands. Exact retries recognize receipts before new-action time validation;
recovery never replaces newer generations or silently retimes elapsed targets.
Report Scheduled/Blocked/Pending/Superseded/Missed outcomes truthfully.

Operational schema 8 mirrors only three Tomorrow clock-minute integers and their
settings revision, alongside generalized bulk receipts. Credential schema 13 and
backup format 4 are unchanged. Before first unlock use generic content and the
protected mirror only. If an upgrade has no mirror, keep relative/Custom available
and the three Tomorrow tiles disabled with an unlock explanation. Never guess
the owner's saved preferences. Normal unlocked initialization/settings/recovery
repairs the mirror. Notification Snooze remains compatible.

Implementation/verification status belongs only in the backlog. Host/fixture
checks never establish signed-phone sound, Direct Boot, picker or TalkBack acceptance.
