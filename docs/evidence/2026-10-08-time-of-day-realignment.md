# Four-atmosphere documentation realignment

8 October 2026 · baseline c128fd1 · branch codex/realign-time-of-day-docs.
[A36](../design/approved-time-of-day-realignment.json) records the owner's scope,
planning choices and direct implementation authorization. Existing pending A33–A35
R10 documentation is preserved in this consolidation.

## Delivered documentation

[Current design](../design/current/README.md) supplies one entry point for shared
visual/IME rules, Automatic/manual policy, page contracts and honest coverage.
All eight R3 images remain the visual source. R4/R5/R6/R7/R8/R10 accepted templates
retain correction conditions; R9 remains draft. Old conflicting execution prose
leaves the current queue; six TD units replace it. One static Classic identity
supersedes palette variants, and dynamic icons remain optional future scope.

Thirty-two historical living-document snapshots preserve their exact bytes and
logical link bases. P01's six hashed submission artifacts and the P02 foundation
sample specification remain unchanged at their original paths. This exception
preserves original approval verification; the registry/index classifies them as
historical, not current instructions. No old acceptance record was rewritten.

The entire 113-file R10 bundle is now repository-local, copied byte-for-byte with
its r1/r2 history, fourteen selected PNGs and provenance. Frozen submission links
resolve through their original logical docs/design base; active gallery resources
are local. Scoped .gitattributes rules prevent line-ending normalization of the
copied submissions and snapshots. Product source/build/exported icons are unchanged.
Frozen bundles retain original CRLF/EOF whitespace; scoped attributes recognize
those historical bytes instead of altering the submission to satisfy formatting.
Current living documentation keeps normal whitespace checks.

## Checks actually performed

Run the non-mutating checker from the repository root:

```text
node docs/evidence/time-of-day-realignment/verify.mjs
git diff --check
git diff --cached --check
```

- 89 preexisting immutable reference/submission identities unchanged.
- 32 archived snapshot hashes and seven frozen P01/P02 artifacts match.
- 152 imported/snapshot/frozen hashes also match the actual staged Git blobs;
  the commit preserves their submitted bytes rather than normalized text copies.
- All 113 relocated files match their original hashes; all fourteen current R10
  PNGs and all eight R3 references match the accepted identity records.
- All 45 unrelated task rows and all 20 historical AR/RD rows are preserved verbatim.
  The checker also compares the original table header (66 matching lines total).
- Current local Markdown links, JSON syntax and gallery resources were checked.
  The [checkpoint result](time-of-day-realignment/validation.json) records counts.
- Active contracts/plans were searched for contradictory automatic defaults,
  five-band schedules, per-reminder/classifier gates and mandatory dynamic icons.
  Historical/frozen submissions and deliberately labeled shipped-baseline facts
  retain their original language; they are not current requirements.
- Diff scope excludes production source, packages, Android/build configuration,
  foundation assets and shipped icon exports. Documentation/gallery files and the
  scoped byte-preservation attributes are the only deliverables.

## Independent review

The initial delegated attempts failed; the root agent audited and implemented
directly. Three restarted read-only reviewers subsequently completed:

- Roadmap/backlog: all 45 unrelated and 20 historical rows retained; dependencies,
  optional icon scope, R9 draft status and redirect paths passed review.
- Core contracts: found an audio-lifecycle paragraph omitted during cleanup and
  stale Browse/trailing-completion wording. The paragraph was restored verbatim;
  future U checks now follow current roots, while older observations are labeled baseline.
  Remaining recurrence/data/privacy/Calendar/cloud/iOS semantics were retained.
- Reference integrity: 113 relocated files, accepted R3/R10 hashes and 210 local
  gallery/current-document references passed. Old P01 source/build hash differences
  predate this PR; original evidence identifies the captured revisions.

No runtime tests, builds, installations, phone interactions, measured accessibility
or new image generation were performed. TD implementation and G1/G2/G3 physical
observations remain future work. Documentation verification does not approve R9
compositions, settle list icons or establish final production colors/artwork.

## Follow-up: prevent stale instructions being consumed

The owner asked whether legacy instructions were removed and said they did not
want an agent reading stale specifications and becoming confused. The historical
bytes remain preserved; they are not all physically deleted. The root agent
read-first sequence now requires the current design before UI/UX/theme work.
Scoped AGENTS.md files in design, history, P02 and the roadmap explicitly exclude
legacy/frozen instructions from routine implementation and requirements searches.
Historical material is consulted only for an explicitly requested provenance audit.
Current design/TD contracts take precedence; an unresolved conflict requires the
owner's clarification, not fallback to an older specification. Hash, link and
whitespace checks were rerun; no frozen artifact or production source changed.
