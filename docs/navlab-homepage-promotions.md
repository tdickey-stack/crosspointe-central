# Central navigation lab and homepage promotions

Handoff: September 16, 2026. Continue on `dev`.

## Where we paused

The user approved the direction of the isolated `/navlab` prototype and asked to
save this plan, commit/push the current work to `dev`, and stop all local Firebase
emulators. The homepage-promotion feature below is agreed direction, **not yet
implemented**. Do not treat this document as authorization to deploy to `main`.

## Current prototype

- Tab and swipe order: **Home → Next Steps → Groups → Events**.
- Desktop navigation is in the header; mobile navigation is at the bottom.
- Mobile uses native horizontal scrolling and CSS snap, with separate vertical
  scrolling per page. Preserve this: several custom swipe implementations were
  rejected for sticking or failing when swiping back.
- The selected tab highlights as a swiped page becomes mostly visible; URL and
  accessibility state settle after scrolling. Explicit tab/button navigation is
  protected against stale scroll events resetting it to Home.
- Home uses Central's current hero, featured event, banner, Sunday information,
  worship set, and Quick Links. Quick Links are buttons, three per mobile row.
- Next Steps contains Next Steps, Serve Opportunities, and Resources in compact
  cards with simple colored icons. These sections are not repeated on Home.
- The “Join A Pointe Group” card opens the Groups tab.
- Groups reuses the public directory, including filters, attendance pills, and
  group detail dialogs. Events uses the public event/registration feed.
- Light and dark styling are supported. This remains a preview of the design;
  it does not replace the Central homepage or add navigation to it.

Data comes directly from anonymous public production endpoints:
`https://central.crosspointe.tv/api/central-data` and
`https://central.crosspointe.tv/api/groups`, including when viewing the dev lab.
There are no authenticated internal endpoint calls or data writes from the lab.
Serve Opportunity cards currently link to the existing production
`https://central.crosspointe.tv/#serve-needs` section because the public records
have no destination URL and the actual interest form lives on Central. The lab
does not duplicate that form or collect personal information.

## Approved direction: scheduled homepage promotions

The new navigation introduces a deliberate visibility hierarchy. Home should
surface what deserves attention now; the other tabs remain the complete browse
experience for their respective content.

Two promotion levels:

1. **Main feature:** retain the existing single prominent feature spot.
2. **Homepage highlights:** compact graphic cards for selected content. Start the
   MVP with three highlights alongside the main feature.

Everything except an individual Group should be eligible for homepage promotion.
Examples include Events, Next Steps, Resources, and Serve Opportunities. Inventory
other Central content types before defining the final supported-type list.

Proposed admin action: **Promote to Home**, with:

- Start date/time: immediately or scheduled.
- End date/time: automatically remove its homepage placement.
- Display order: editorial priority among active highlights.

Promotions reference the original item instead of copying its data. Edits to its
title/details should carry through to Home, and its action should use the same
underlying destination or details flow. Expiration removes only the homepage
placement, not the item in its regular tab. Inactive or unpublished source items
must stop appearing on Home even if their promotion window remains open.

The admin should display current and upcoming promotions together so overlaps
are visible before they happen. Individual Groups remain outside this system.

## Suggested next session

1. Review this plan with the current `/navlab` design. Prototype the mixed-content
   highlights section locally before building admin controls or persistence.
2. Audit existing featured-event, content-list, campaign, and visibility logic.
   Resolve stable source identifiers, event occurrence identity, timezone rules,
   expired events, and behavior when more than three promotions overlap.
3. Decide whether the main feature should remain event-only and whether an item
   can occupy both feature and highlight positions. These details are not settled.
4. Define the promotion record and admin editing flow. Reuse source records and
   existing content visibility rules; do not maintain a duplicate content list.
5. Implement scheduling and tests in a later authorized phase. Keep the current
   homepage intact until an intentional rollout is approved.

## Files and verification

- `public/navlab.html`: isolated shell and tab/page order.
- `public/navlab.js`: navigation, snap synchronization, theme, mobile layout.
- `public/navlab-content.js`: safe public content rendering and actions.
- `public/navlab.css`: responsive lab styling.
- `firebase.json`: `/navlab` rewrite and lab cache headers.
- `test/navlab-navigation.test.mjs`: navigation timing/order regressions.

Focused commands:

```sh
node --test test/navlab-navigation.test.mjs
node --check public/navlab.js
node --check public/navlab-content.js
git diff --check
```

Browser checks completed during development: desktop, tablet, 390px and 320px
mobile layouts; light/dark styles; tab navigation and native scrolling in both
directions; group filters/dialog destinations; Next Steps group action; three
Quick Link buttons without horizontal overflow; populated public content.

An iPhone 17 Pro running Chrome showed a large gap below the navigation immediately
on refresh. The latest fix puts mobile content and navigation into one `100dvh`
flex layout, retaining the home-indicator safe area. Browser measurements at 650px
and 844px heights showed zero gap and correct desktop restoration. **Physical
phone confirmation is still outstanding**; do not claim it was verified there.

## Restarting previews and release boundaries

All local Firebase emulators were requested stopped at handoff. Restart only when
needed for the next session. The ignored `.env.navlab-emulators.json` is a local
Hosting-only configuration listening on `0.0.0.0:5015`; if present:

```sh
./node_modules/.bin/firebase emulators:start --only hosting --project crosspointe-central --config .env.navlab-emulators.json
```

This local config is not committed. The lab is also available through the normal
Firebase dev Hosting preview after a successful `dev` workflow. Pushing `dev`
triggers `.github/workflows/firebase-deploy.yml`; it deploys a preview channel and
some shared backend endpoints/rules. A successful push alone is not proof of a
successful deployment. Main has not been merged or intentionally released here.

The earlier phone test used a temporary port-80 proxy to the Hosting emulator
because the phone could not connect directly to port 5015. That proxy is also
stopped; the old LAN URL will not work until local services are restarted.
