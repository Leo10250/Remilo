# Verification and development workflows

Choose checks according to changed behavior and risk. Report actual commands and
observations, with important failures/limitations in the handoff. Routine work
needs no new evidence document, permanent physical acceptance row or reconstruction
of earlier testing. Known failures and important deliberately skipped checks belong
in the relevant task or [backlog](backlog.md).

## Host checks

| Command | Coverage |
|---|---|
| `npm run verify` | Localization, local docs links, current assets/presentation, TypeScript, ESLint, shared tests and Node tooling fixtures |
| `npm run verify:docs` | Maintained Markdown links/images/local anchors; no network |
| `npm run verify:assets` | Current manifests, file facts, copies and generated presentation; `verify:design` is an alias |
| `npm run verify:localization` | Bilingual messages, argument/plural shape, escaping and generated-output determinism |
| `npm run test:tooling` | Controlled host/process/build/device fixtures without real installation |
| `npm run verify:android` | Native unit tests, module/app lint and bundled release assembly |
| `npm run verify:all` | Shared plus Android checks and assembly, with a private summary |
| `npm run release:prepare` | Combined checks and existing-key signed assembly; no installation/publication |

Run focused tests during changes and the appropriate integrated check afterwards.
Repeat broader suites only for changed inputs, failures or unresolved concerns.
Preserve behavioral assertions when retiring historical documentation/audit tests.

Native tests cover policy, Room migration/recovery, command identities and lifecycle
simulations. Robolectric's pinned API 34 SDK/resource dependencies are staged through
Gradle; resolution failure is not a skipped/passing behavioral check. Host tests do
not establish physical audio, OEM presentation, real idle timing or accessibility.

Asset checks establish current file integrity and selection consistency. Encoded
header checks do not establish decoded pixels or visual quality; deterministic
export/audit fixtures use Pillow for those claims. Authorized asset edits update
the current manifest, without historical commits, approval files or deletion lists.

## Match validation to the change

- Documentation: local links/anchors, current intent and useful ownership.
- UI: production-component preview, meaningful interactions, English/Chinese and
  affected narrow/large-text layouts; native behavior needs native/device checks.
- Localization: [language guidance](../localization/README.md) and `$remilo-localize`;
  catalog parity and linguistic quality are separate checks.
- Engine/storage/actions: relevant cases for stale input, exact retry, interrupted
  writes, privacy, compatibility and recovery.
- Asset tooling: geometry, alpha/color, decoded pixels, copies, safe paths,
  complete prevalidation, stale/concurrent publication and interrupted recovery.
- Build/deploy scripts: controlled argument, cancellation, signing/data and
  reporting fixtures before an authorized device operation.
- Calendar: relevant consent/comparison/transport/recovery cases; fixture state
  does not establish real Google transport or background timing.

## UI preview

`npm run preview:ui -- --port 8092` runs memory-only fixtures through production
components. Preview variables remain child-only and are stripped from release
builds. Fixtures cannot initialize real scheduling, credentials, Google transport,
persistence or Android actions.

Inspect affected empty/loading/error/recovery states. Cover atmosphere/brightness
variants for shared theme changes and larger text/narrow widths for layout/copy.
Keep temporary captures ignored. Screenshots do not establish focus, Back, keyboard,
TalkBack, native pickers or alarm behavior.

## Physical testing

Physical checking is part of normal development. Use the installed signed bundled
build for actual delivery observations; browser/Metro results are insufficient.
There is no permanent per-feature pass/pending ledger.

Select relevant scenarios from this reusable release smoke menu:

- Delivery with app closed, another app foregrounded, screen locked, offline and
  under Android idle/battery restrictions.
- Done/Postpone and group-member scope, stale actions, original audio cutoff,
  time selection/cancellation and required unlock handoff.
- Reboot/process recovery without elapsed-alert replay; independent future
  registrations and Direct Boot privacy.
- Data-preserving in-place upgrade/restore when storage/export changes.
- Changed UI/native/widget behavior, English/Chinese, text scaling/accessibility.
- Live Calendar authorization, both directions, conflicts, uncertain writes and
  relevant background/reconnection opportunities.

This is a menu, not a full matrix required for every feature. A reported failure
remains actionable; absence of old paperwork alone is not a failure. Describe the
scope of new reliability claims without inferring coverage from generic success.

## Build and device workflows

Run one release-producing command per checkout at a time. Build/deploy use Gradle
and ADB without receipts or Git prerequisites. Android verification can assemble
unsigned CI releases; beta/preparation commands require existing private signing.
Summaries report actual checks/artifacts without assigning physical-acceptance status.

Requested deployment uses `npm run deploy`, without compulsory doctor/full-check/
preparation chains. It builds current source, installs an update and leaves UI
closed. `--device SERIAL` selects the target; `--launch` opens it when requested.
Otherwise selection uses `ANDROID_SERIAL` or the sole listed authorized transport.
Multiple transports, including unauthorized companions, need explicit selection.

Compare actual storage compatibility when switching branches. Equal APK versions
do not prove compatible schemas. Unsupported newer/unknown storage retains its
bytes and fails closed. Keep signing/data; never bypass failure with uninstall,
data clear, permission grants, downgrade flags, replacement keys or restarting ADB.
Cancelled installation is uncertain; inspect before retrying. Installation and
optional launch have separate outcomes.

`verify:device -- --device SERIAL --json` compares optional local/installed APK
hashes. Missing/different artifacts are diagnostic; inspection errors fail. A
match establishes bytes, not source attribution or physical alarm behavior.

## Private diagnostics and handoff

Doctor/devices provide read-only diagnosis/discovery. `device:logs` captures
bounded Remilo logs; `--follow` streams a requested session, while `--crashes`
selects exact-package AndroidRuntime blocks. `device:capture` captures the current
screen without unlocking/navigation. Never clear logs or upload raw captures.
Keep serials, credentials, keys, captures and summaries in ignored local storage.

Report checks, actual artifact/device observations and concrete remaining issues
in chat or the PR description. Preserve distinctions between build, installation,
launch, hash comparison, preview and physical behavior. Installation, remote
publication and distribution require applicable user scope; preparation does not
perform them.
