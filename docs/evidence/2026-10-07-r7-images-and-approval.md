# R7 images and outline approval

Recorded 7 October 2026 against starting commit `0b80c66`.
[A26](../design/r7-lists-repeats-image-intake.json) authorizes the twelve screens;
[A27](../design/approved-ui-r7-outline-acceptance.json) records the owner's overall
UI/UX-outline approval, provisional list icons and permitted Night/state inference.
This is reference/documentation evidence, not a production or phone result.

## Output and corrections

[The gallery](../design/remilo-r7-lists-repeats/gallery.html) shows one readable
screen at a time at 360/420/540/original width, with
[per-image notes](../design/remilo-r7-lists-repeats/review-notes.json).
Twelve selected PNGs were produced with built-in `image_gen` in 25 calls including
targeted repairs. Aspect, invented list glyphs, ambiguous controls, timing text and
keyboard-footer composition were repaired where consequential. Selected PNGs are
copied unchanged; original/discarded generations remain outside Git.

The owner specifically requests raising decorative list-icon presence/style during
implementation, currently favors omission, and does not request a custom-icon
picker. That condition appears in the gallery, live specification, acceptance,
product/appearance contracts and P05/P06/P07 intake. Other notes cover shared neutral
roles, matching backgrounds, compact header/type/targets, native data/order, scope
labels, modal/safe-area and IME/disabled-control approximations.

## Actual verification

- Inspected all twelve selected images and corresponding R3 references. Independent
  generation/review work covered the eight theme/appearance combinations.
- Selected copies/source identities match; twelve A27-associated hashes/dimensions
  match gallery metadata. Each renders about 800 px high at 360 px width.
- All eight R3 input hashes and **31 prior reference PNGs** remain unchanged.
  Four historical acceptance JSON records and frozen pre-generation R7 revision-1
  specification/fixtures remain byte-identical to their source Git records.
- **298 current local references** resolve. Both gallery scripts pass syntax checks;
  **24 controlled mocked-DOM selections** verify twelve image/note/hash mappings per
  gallery plus original/360-width selection. This is not browser rendering proof.
- Read-only approval audit passed after two wording corrections: gallery references
  replace stale proposal labels, and the empty glyph is optional under A27.
- `git diff --check` passed. Application/native/module source and backlog status
  have no changes. Local packing/check tooling remains outside Git.

## Limits

A27 accepts the overall outline; this record does not assert separate owner review
of every individual raster or freeze exact colors/geometry. Actual contrast,
large-text/IME/TalkBack, native/phone verification and production P05/P06/P07
execution remain separate. Browser rendering was not performed; the gallery was
checked statically and with a controlled DOM. No build, installation or distribution
occurred. Settings/Appearance/permissions are the next unrefined screen family.
