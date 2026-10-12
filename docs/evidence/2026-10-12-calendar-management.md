# Calendar hierarchy and independent Trash evidence — 12 October 2026

The owner requested implementation of the discussed Calendar management plan,
choosing a separate management screen and cancellation notices in Agenda and
Details. [The current design contract](../design/current/calendar-management.md)
records the resulting behavior; task status belongs only in [the backlog](../backlog.md).

## Recorded implementation

- Details puts Title/local timing/state first and a compact Calendar row after
  Schedule details. Full connection/publication/recovery information moves to
  Calendar management. Finished linked operations start in collapsed history.
- Opening local pages reads CE metadata only. Explicit Check inspects Google and
  records availability without editing reminder content, scheduling or baseline.
  Terminal records allow a read-only check; normal review retains native previews.
- Confirmed cancellation produces mode-specific Agenda/Details notices and an
  ordinary guarded local Trash action. The local generation, exact target,
  postponement, alert mode and content remain. Offline checks preserve that fact.
- CE 8→9 stores structured observations, original account label and required review;
  DP 6/backup 4 remain. Old prose does not infer deletion or successful freshness.
  Calendar metadata stays outside backups/DP and is erased by purge.
- Owned matching cancelled tombstones and documented deleted-resource errors
  differ from ambiguous 404, generic/expired-sync 410, unsupported mapping and
  access failures. Tombstones are inspected before ordinary content mapping.
- Observation writes validate connection/source/link/record guards. Trash, Unlink
  and completion fence unsent work; reopening/restoring never revives old approval.
  Already-sent outcomes can be reconciled without reactivating or rewriting.
- Shared import review explains independent alerts. Associated Trash/Purge copy
  explicitly scopes the action to Remilo. P4-A sign-off is retained.

## Host checks

The final `release:prepare -- --json` workflow ran shared checks followed by
Android tests/lint/assembly, without a concurrent release-producing workflow.

| Check | Recorded result |
|---|---|
| Current design/evidence audit | Passed; existing approved-master resolution notices remain |
| TypeScript | Passed |
| ESLint | Passed |
| Shared/domain tests | 241 passed across 31 files |
| Controlled tooling/isolation tests | 91 passed |
| Native unit tests | 275 across 23 suites; zero failures/errors/skips |
| Native module debug lint and app release lint | Passed |
| Signed ARM64 release assembly | Passed; Gradle 4m 36s |

Native coverage includes exact alarm/Snooze preservation on cancellation,
restart/offline persistence, missing/unsupported classification, fresh restoration
requiring review, terminal checks, stale Unlink/Trash/Purge/account observations,
deletion during conditional PATCH, sent acknowledgement after Unlink, completion/
Reopen write fencing, migration from supported earlier schemas, and existing
publication/backup/DP/blocked-I/O regression checks.

An initial migration test seeded its legacy columns in the wrong order; named
columns corrected the fixture while retaining its assertions. A new preseeded
status fixture initially overlapped an existing import-recovery scenario; separate
status-only scenario names corrected that collision without changing old tests.
The final complete workflow above passed after both corrections.

## Actual fixture observations and limits

The repository's isolated, memory-only preview was inspected through the in-app
browser. No real authorization, Google request, device installation or native
alarm scheduling occurred.

- Sky Light cancellation Details: Title and primary local timing precede the
  concise notice; local Trash/Calendar details are present; the compact Calendar
  entry follows Notes/Schedule details in the accessibility reading order.
- At an observed 360×800 viewport, Sky Light management shows source/account,
  last observation, suspended-update explanation, Check, Unlink and local Trash.
  Opening it from Details used the existing retained reminder origin.
- Sunrise Light linked management: readable source group and the two relevant
  secondary Check/Unlink actions, without unnecessary resolution controls.
- Sunrise Dark partial-result management: readable local-save/unknown-Google
  outcomes and exact retry; content scrolls rather than compressing the controls.

Broader visual automation stalled on repeated browser navigation/focus deadlines,
including a fresh-tab retry and automation reset. Do not infer the complete
eight-pair, landscape, 200% text, long-content or reduced-motion matrix from these
focused observations. Those observations remain in the consolidated acceptance
requirements. The existing native Alert confirmation does not provide a web
dialog; Android unlink confirmation/Back interaction is not established by a
fixture button click.

## Identified local signed artifact

- Runtime source: `34470b731a28fb0f14f5bc8ac40affc92971990a`.
- Preparation completed: `2026-10-12T21:57:37.992Z` (14:57 PDT).
- Package/version: `com.remilo.app`, `0.4.0` (`4`).
- Variant/ABI: release, `arm64-v8a`; bundled JavaScript, non-debuggable.
- APK SHA-256: `c083267c9df803f86ac00d2019e8a2fe1bb5e6dfc46c0b2cf2e02576dcfc8ad3`.
- Existing signer certificate SHA-256:
  `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Private retained APK: `verification/local/calendar-management-34470b7-app-release.apk`.
- Private build record: `verification/local/calendar-management-build.json`.
- Private final log: `verification/local/calendar-management-release-final.log`.

Runtime files were committed before the final workflow and remained unchanged
during verification/assembly. The unrelated owner `.vscode/settings.json` change
was excluded. Subsequent changes to this evidence/backlog are documentation only.
The retained APK/hash were inspected after preparation; no installation or
distribution was performed.

Use the [consolidated owner checklist](../device-acceptance.md) for actual Google
deletion/restoration, offline delivery, keyboard/Back, TalkBack and large-text
observations on this identified build. Host results do not establish physical
audibility, OAuth, actual Google outcomes or the complete visual matrix.
