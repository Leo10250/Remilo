# Remilo localization

`catalog.json` is the canonical UTF-8 source for English and Simplified Chinese.
Use stable keys, complete messages, named typed arguments, translator context,
and English `one`/`other` plus Chinese `other` when a quantity changes wording.
Do not pass English plural suffixes as arguments. Authored titles, notes, names
and imported/Calendar content are data; never translate arbitrary Text content.

Run `npm run localization:generate` after editing the catalog. Commit the generated
TypeScript catalogs, Android default/Hans resources, native catalog and typed
`NativeMessages` descriptor constructors. `npm run verify:localization` checks
parity, arguments, escaping and deterministic output without changing files.
The same check is part of `npm run verify`.

React render boundaries use `useTranslation`; standalone presentation functions
accept explicit formatting/translator context when they need it. A native-confirmed
snapshot selects the application language. `useLocalizedState` captures feedback
descriptors at state boundaries, including notices and native confirmations, without
remounting editors or navigation. Captured action identities are never translated.
The compatibility lookup is limited to app-owned feedback and is not a general
translation layer for reminder content.

Native presentation uses generated typed descriptors. `L10n.calendarDescriptor`
recognizes only catalog entries explicitly allowlisted as historical Calendar
status copy. Preserve the original prose and machine outcomes; unknown legacy
details receive a neutral translated fallback. Changing wording must not enqueue
Calendar operations or alter reminder timing.

Typography comes from `assets/atmospheres/presentation.json`. Chinese uses the
platform sans-serif, native locale selection, natural spacing and shared role
metrics. Validation targets and installation policy are documented in
`docs/design/current/localization.md`; status belongs in `docs/backlog.md`.
