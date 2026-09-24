# Studio follow-up reliability fixes

September 24, 2026. Addresses the follow-up review of deployed commit `0f33697`.

## Changes

- Every cloud save checks the revision loaded by the editor. Competing saves stop with a visible conflict prompt instead of silently overwriting newer content. Document pages, directory cards, and social slides commit atomically with the project revision. A remotely deleted project cannot be recreated by an old tab.
- Conflict actions preserve local work: keep a separate copy, or load the latest server version while retaining the local draft for recovery. Copies require uploaded project images to be added again because their storage paths belong to the original project.
- Browser storage now uses separate project records and separate pending drafts for each tab. Stale tabs cannot erase another tab's pending project. Competing drafts remain recoverable. Shared-project cache migration preserves the current viewer's identity, and failed migration keeps the original cache.
- Plain-text canvas paste uses the browser's native insertion history, restoring Undo and Redo while stripping pasted formatting.
- One Pager lists retain and render all entered items. Explicit count validation blocks PDF export and system print until lists fit. Shared limits govern the editor and validation; cloud hydration preserves excess items for correction.
- Directory export layout waits and PNG encoding have bounded timeouts. Failed export-module loads show a reload message and permit retry. Builds retain previously published hashed chunks for older open tabs.
- Main, preview, and manual Hosting workflows run the Studio backend and security-rules suites. All Firebase deploy workflows share the existing serialization group.

## Verification

- Studio client: 88 tests passed, including stale writers, editing after loading the latest version, deleted projects, missing revision markers, per-tab recovery, cache migration failures, list boundaries, and export timeouts.
- Studio backend: 10 tests passed.
- Firestore and Storage emulators: 28 tests passed, including concurrent clients, legacy revision migration, membership/ownership rules, and an atomic 20-page directory with 160 cards.
- Production build and repository JavaScript syntax checks passed.
- Fresh-origin local browser: Simple Statement multiline paste, Undo, and Redo passed at normal text size. An independent fixture also passed partial-selection multiline replacement.
- Fresh-origin local browser: four One Pager owner responsibilities remained visible, displayed a limit warning, and disabled both export paths; returning to three restored READY and enabled export.
- A valid One Pager PDF export completed and downloaded successfully in the browser.
- The actual conflict-message component was visually checked at desktop and 390px mobile widths; both action callbacks responded.

## Behavior and limits

This is conflict detection with explicit recovery, not simultaneous live merging. Existing tabs must refresh to use the new save protocol; stricter rules reject old writes instead of accepting an unchecked overwrite. Signed-in conflict behavior was verified against the emulator, not by editing production user projects.

Native paste history was verified in Chromium. The last-resort manual range insertion path, used only when native insertion is unavailable, preserves text but cannot add an entry to the browser's native Undo history.
