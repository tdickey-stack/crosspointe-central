# Studio audit fixes — September 2026

This release addresses the eleven findings in the September 23 Studio audit.

| Audit finding | Result |
| --- | --- |
| Newer browser edits replaced by cloud copies | Pending revisions are durable and reconciled by account; uncertain legacy records are retained for recovery. |
| Cross-project debounce cancellation | Each project has its own serialized save queue with retry and revision tracking. |
| Delayed creation after deletion | Deletion cancels pending saves, waits for in-flight writes/uploads, and cleans nested directory records and uploaded assets. |
| Document clipping | Rendered page overflow is reported in the editor and blocks PDF/System Print; users can shorten content or add a page. |
| Tiny styled text while pasting | Canvas paste inserts plain text immediately, preserving multiline fields and approved template typography. |
| Silent text truncation and stale counts | Accepted canvas edits update state immediately; over-limit edits are rejected with a visible message. |
| Cloud-invalid document field lengths | One Pager and Checklist controls use enforced string limits; existing over-limit values produce warnings. |
| Upload completion overwrites newer edits | Request tokens discard stale results and patches apply to current page/card state by stable ID. |
| Mutable export previews | Exports mount an immutable project snapshot and lock navigation/editing until preparation finishes. |
| Unbounded export/print resource waits | Fonts, image loading, layout preparation, and rendering have deadlines and recoverable error messages. |
| Late ZIP filename failure | Final generated filenames are checked before rendering, including carousel suffixes. |

## Consolidation and performance

- Shared graphic field definitions and document length metadata replace divergent contracts.
- Document defaults, preview renderers, inspectors, and serializers use focused registries while preserving separate template designs.
- Removed the unused step-based editor and obsolete policy PDF exporter.
- Document thumbnail previews are memoized; hidden export trees mount only for an export.
- Export libraries load on demand through hashed ESM chunks. Initial Studio JavaScript fell from approximately 1.22 MB to 0.39 MB uncompressed; this is a bundle-size result, not a measured startup-time claim.
- Carousel PNGs are packaged as bytes instead of retaining base64 copies.
- Document root/page writes commit atomically. Directory cards remain a second phase because existing security rules require committed parent records; a failed phase leaves the revision pending for retry.

## Validation

The client suite exercises queue ordering/recovery/deletion, upload request identity, field boundaries, paste normalization, overflow, export deadlines, and filename limits. Firebase emulator checks validate document batches against the existing rules, including a 20-page project. Browser verification covers direct text editing, rejected long edits, document overflow and recovery, export downloads, and desktop/mobile layouts.

The original rich clipboard source was not available during the audit; plain-text normalization addresses the suspected pasted-style cause without changing the template's approved typography. Network and account races are verified with deterministic tests rather than changes to production project data.
