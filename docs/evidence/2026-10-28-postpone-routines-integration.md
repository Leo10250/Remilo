# Postpone and Routines integration — 28 October 2026

The owner requested integrating the compatible Routines source into existing
PR #20 after the phone's operational 9-to-8 refusal. The owner also explicitly
confirmed that Routine alerts keep their current Start routine/Snooze/Dismiss
controls. This integration combines the chooser branch with the restoration
baseline in an isolated managed worktree; unrelated edits in the original
checkout are preserved.

## Storage and profile boundaries

The integrated versions are **CE17 / DP10 / backup9**. Credential schema and
portable format remain those of the compatible Routines implementation.

| Operational input | Forward path to 10 | Preserved data |
|---|---|---|
| Original 7 | Add Routine fields/receipts and generalized Postpone receipts/mirror | Legacy Done/Snooze identities, alerts, sessions and generations |
| Chooser 8 (`848d76d92f0321341c8071cead845d4a`) | Add the missing Routine fields/receipts | Existing Postpone/Snooze receipt kinds/targets/members and saved-time mirror |
| Routines 8 (`5d7804e1ece64d848da5b28b8a4e6f0a`) | Add Routine day-started state and Postpone receipt/mirror fields | Dated profiles, expiry and existing receipt state |
| Routines 9 | Add Postpone receipt/mirror fields | Routine receipt settlement, day state, expiry and all existing deliveries |

The canonical historical 8 export retains the Routines lineage. Both frozen
version-8 exports are retained separately under verification/fixtures/storage.
Unknown version-8 identities fail before migration writes; no downgrade or
destructive fallback is used. Room exports the combined version-10 schema.

Ordinary reminders expose completion/Postpone and the uniform eight-tile chooser.
Routine actions, strict dated expiry, keyguard Start navigation and saved retries
remain intact. Mixed groups retain per-member actions. Captured regular-only
PostponeAll remains valid when an uncaptured Routine arrives later, while captured
Routine members reject generic actions with ROUTINE_ACTION_REQUIRED. Engine,
native presentation, Reminder Details and the isolated preview all enforce this
boundary. Draft/session ownership also defers a same-session Routine Start intent
until the open Postpone draft closes.

The catalog preserves all 2,306 Routines entries, including its Chinese wording
corrections, and adds the 31 Postpone entries unchanged: **2,337 English/Simplified
Chinese pairs** with regenerated TypeScript, Kotlin and Android resources.

## Shared verification

Shared verification passed **343 tests across 42 files** and **105 controlled
tooling tests**, catalog parity, design preservation, TypeScript and ESLint.
The merged lifecycle fixture retains both the guarded chooser dismissal/deferred
session checks and Routine unlock/navigation ownership checks. All four migration
SQL paths were independently compared against the combined table/column/default/
primary-key shape using in-memory SQLite.

## Native verification and signed assembly

The standard Android verification command completed successfully: **641 tests
across 52 suites**, zero failures/errors, module/app lint and signed ARM64 release
assembly. Release lint reported zero errors and 20 existing warnings. Room exported
schema10 with identity `fa19f5be12e728b197b8034c21b9aadb`.

The first assembly in the longer Windows worktree hit Ninja's 260-character path
limit. An optional `remilo.cmakeStagingDirectory` in ignored local.properties now
supports a shorter private native staging location. After correcting the property
escaping and invalidating stale generated lint results, the full standard command
passed. No test, lint rule or baseline was weakened. Default checkouts/CI retain
their existing native staging behavior. The README documents the local option.

The APK is com.remilo.app 0.4.0 (4), ARM64, signed with the existing identity,
SHA-256 `3edf59719e37232f76f6ef971866fb3e877f0e6b44d528a73c6d80eb2617dd27`.
Its release source map exactly matches the current Reminder Details, uniform
chooser, Routines route and full generated catalog source. Its DEX contains the
integrated Room10 identity, confirming both native and JavaScript halves are in
the assembled artifact. APKs and command logs remain ignored local evidence.

## Physical and release boundaries

The previously restored Routines APK and the owner's "Agenda loads normally"
confirmation belong to the separate storage-restoration evidence. This combined
DP10 build has not been installed as part of the PR integration. Integrated
upgrade/unlock/restart observations, full eight-pair Android rendering, real
pickers, TalkBack and sound/cutoff acceptance require a separately authorized
signed-phone run. Host checks and assembly do not establish beta acceptance or
authorize distribution. Keys, serials, raw captures/logs and APKs remain ignored.
Live task status belongs only in docs/backlog.md.
