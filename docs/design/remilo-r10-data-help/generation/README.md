# Generation records

The current r2 edits are recorded in `calls-r2-root.json` and
`calls-r2-05-06-14.json`. The current selected inventory and all 29 successful
calls are normalized in [generation-provenance.json](../generation-provenance.json).

[A35](../approval-record.json) accepts the current direction/templates with their
component corrections. Keep the accepted submission hashes; a later design edit
uses a new revision rather than replacing accepted reference pixels or sources.

The earlier unversioned call JSON files, `pending-08.json`, shared brief and
candidate files are retained r1 generation records only. Their prompts and
selected labels describe the first submitted images; they are superseded as
component instructions by the [r2 specification](../submission-specification-r2.md).
The complete immutable original bundle is in [history/r1](../history/r1/gallery.html).

Use `pack-r10-r2.mjs` and `validate-r10-r2.mjs` in the parent workspace for the
current bundle. The original r1 packer must not replace current r2 metadata.
