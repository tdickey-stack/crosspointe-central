# Christmas public-shell integration

November 2, 2026. The current upward curtain reveal is approved; the original
snow-whiteout proposal in GitHub issue #14 is superseded.

## Behavior

The public navigation shell loads the shared seasonal resolver before paint.
Localhost and the exact Firebase dev channel host support
`/?seasonalPreview=christmas`; a fresh visit without a preference starts normal.
The Home and Sunday Home controls switch presentation in place and retain the
campaign-specific choice without changing light/dark, notes, the player, or tab.
Normal mode restores the normal loader on the next page load.

The layered popcorn controller follows Central's existing progress, stays below
completion while data loads, and finishes its ticket/kernels before the existing
upward curtain reveal. Decorative script/artwork failure cannot block recovery.
Sound is silent until explicitly enabled. Reduced motion avoids the sweeping
reveal. Back/forward restoration preserves a usable page or Reload recovery.

## Implementation and validation

- `central-seasonal.js`: public controls and browser-color synchronization.
- `navlab-christmas.css`: current public-shell theme, isolated by seasonal state.
- `central-christmas-loader.css`: loader-only styles extracted from the lab.
- `central-loader.js`: lifecycle owner and optional asynchronous artwork/audio.
- `seasonal-config.js`: shared static configuration with independent host gates.
  Unknown campaign IDs and ambiguous production timestamps fail closed.
- Both deployment jobs run `test:seasonal`; changed assets have no-store headers.

Run `npm run test:seasonal`, `npm run test:public-navigation`, and
`npm run check:syntax`. Browser review covers desktop, 390px and 320px, light/dark,
Home/Sunday, reduced motion, opt-out/reload/opt-in, active-tab retention, failed
content, and failed artwork. Local checks use read-only public data snapshots;
they do not change published Sunday settings. Firebase auth and notification
behavior must be judged on Hosting, not the plain local static server.

## Production activation — November 2, 2026

The user authorized promotion to main and production activation after final checks.
Christmas is the default on approved production hosts from November 2, 2026 at
midnight Central through January 1, 2027 at midnight Central (exclusive), using
explicit `-06:00` offsets. Dev still defaults to normal unless explicitly selected.
Visitor normal-mode opt-outs remain available and persist across reloads.

The current upward reveal and the correction isolating the artwork from global
SVG icon strokes are included. Final verification covers production-host default
activation without a query, saved opt-out/opt-in, light/dark, mobile layout,
reduced motion, loader recovery, and the hosted files after deployment.

For configuration-only rollback, set `productionEnabled: false`, commit to main,
and let the normal deployment complete. Verify the served config and a fresh
production visit are normal; do not revert the whole public shell. Refreshed
pages pick up this change; already-open sessions retain their mode until reload.

The existing dev workflow also redeploys shared backend endpoints/schema. This
change adds no backend or schema modifications and starts from current main;
workflow concurrency serializes deployments. Confirm workflow completion and
served asset/config matches before reporting a production release.
