# Print Mode backend boundary

This folder owns the backend behavior for the Firebase `bulletinMode`
function. The public function name, request and response shapes, Firestore
paths, Storage prefix, and permission behavior must remain backward compatible.

## Files

- `function.js` owns the HTTP handler, authentication, authorization, Firestore
  settings access, and audit write.
- `payload.js` owns saved-setting defaults, limits, and normalization.
- `planning-center.js` owns Print Mode's shared Planning Center snapshot and
  cached-calendar fallback.
- `storage.js` owns fallback-image validation and upload behavior.
- `errors.js` owns endpoint error mapping.

`functions/index.js` is the composition root. It preserves the exported
`bulletinMode` Firebase function and injects shared calendar, featured-event,
room-rule, secret, and admin dependencies into this module.

## Refactor boundary

The broader Functions refactor should treat `functions/print-mode/` and
`functions/studio/` as feature-owned boundaries. Shared infrastructure may be
extracted behind stable imports, but the refactor should not rename, relocate,
or behaviorally rewrite these feature folders.

Run the focused verification with:

```bash
npm --prefix functions run test:print-mode
```
