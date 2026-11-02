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

## Release boundary

Production remains disabled with blank launch dates. This integration is for dev
review. A production release needs an explicit start/end window with timezone
offsets and `productionEnabled: true`, followed by the normal main release and
served-config verification. Setting `productionEnabled: false` and redeploying
Hosting is the configuration-only rollback; refreshed pages use normal Central.
Already-open sessions retain their resolved mode until reload.

The existing dev workflow also redeploys shared backend endpoints/schema. This
change adds no backend or schema modifications and starts from current main;
workflow concurrency serializes deployments. Do not mistake a dev push for a
verified release or turn on production as part of preview validation.
