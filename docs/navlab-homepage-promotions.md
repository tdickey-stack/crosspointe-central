# Central navigation lab and homepage promotions

Handoff: September 17, 2026. Continue on `dev`.

## September 17 implementation progress

The first implementation phase is now a local `/navlab` UI preview:

- Home has three compact graphic highlights beneath the existing hero/main
  feature. Each content type has its own colored icon treatment, distinct from
  its normal browse card. Light and dark themes are supported.
- The confirmed eligible types are **Events, Registrations, Campaigns, and Serve
  Needs only**. Next Steps, Resources, and individual Groups are not included.
- Highlights reference public source IDs; they do not copy content into another
  list or remove it from its regular section. Events/Registrations remain in
  Events; Campaigns now appear in Next Steps alongside Serve Opportunities.
- The default preview takes one available Event, Campaign, and Serve Need, with
  available sources filling missing types. This is a visual sample, not an
  automatic editorial promotion policy.
- “Preview a different mix” below the cards allows any of the four source types
  in the three positions. Choices are in memory and reset on refresh. There is
  **no saved scheduling, admin promotion action, or production rollout yet**.
- Event/Registration highlights reuse the lab's details dialog. Campaign links
  reuse the original URL. Contact campaigns and Serve Needs open their existing
  Central sections, where their forms already live.
- Events restores **Today at CrossPointe** above the upcoming Events/Registrations
  list, using the same graphic cards with each event's time and location. It
  reads the public `today` projection, honors its module visibility, and does not
  impose Home's three-card limit. Matching the existing homepage, started events
  disappear (checked every minute), and the section hides when nothing remains.
  Upcoming-list filters do not filter the Today section. Details/calendar actions
  use the existing dialog.

Browser verification: live public content at desktop 1365px, tablet 900px, and
mobile 390px/320px; light/dark cards; event and registration details/actions;
campaign/serve destinations; regular-section retention; preview selection.
Narrow layouts have no horizontal overflow, and mobile navigation ends at the
viewport bottom. Physical iPhone verification remains outstanding.

The user approved committing and pushing this preview to `dev` on September 17
for feedback. The `dev` push runs the existing Firebase preview workflow; verify
that workflow and the served assets before treating the share URL as updated.
The production homepage rollout remains separate. The Hosting-only local preview
is available at `http://localhost:5015/navlab` while the emulator runs.

### Sunday Mode preview

The small Sunday Mode button in the lab's top strip switches between the regular
four-tab layout and **Home → Notes → Next Steps → Groups → Events**. It starts
off on a fresh visit; a `#notes` link enables it. Switching the mode returns Home
for comparison. It does not change the published Sunday schedule or settings.

- Sunday Home presents the sermon/service details, Take Notes, Watch Live,
  worship set, featured event, mixed highlights, and Quick Links.
- Notes keeps the rich-text editor and YouVersion reader together on desktop;
  mobile has a Notes/Bible switch, initially Notes. Tabs and mode switches keep
  these mounted. An unconfigured passage is labeled Browse the Bible.
- Drafts use a date-keyed lab namespace and the existing rich-text format. An
  existing Central draft can be copied on first use, but lab edits and Clear
  never modify the regular Central draft.
- Google Docs export remains an explicit user action. OAuth/export has not been
  exercised in browser verification.
- Watch Live loads only on request, then retains one iframe across tabs and
  mode changes. The movable/resizable mini-player has pause, return, and close
  controls and respects mobile navigation. Close stops the player.

This is local preview work; production Sunday Mode and backend data remain
unchanged. Physical phone and on-screen keyboard verification remain outstanding.

Sunday verification: 44 focused navigation/content/study/player/Groups tests pass.
Rendered desktop and 390px/320px mobile checks covered light/dark styling,
Notes/Bible switching, keyboard tab controls, draft persistence through reload
and mode changes, and Resi pause/return/close with mini-player placement above
navigation. Browser console warnings/errors were empty after final checks.

### Next implementation phase

Build saved promotion scheduling and admin controls after reviewing these cards.
Use a separate server-managed promotion collection with source type, source ID,
start/end timestamps, display order, and active state. Resolve against the
already-filtered public source payload, so unavailable sources cannot appear.

The source audit established:

- Events use `planning_center_instance_id || id`, **not** the series/event ID.
- Registrations use the Planning Center Signup ID. Their public feed already
  handles open/closed, full/waitlist, archive, and event-end eligibility. Do not
  infer expiry from formatted labels such as `close_date`.
- Campaigns and Serve Needs use their published document IDs. Keep promotions
  outside their replace-all source-list publishing flows.
- Campaign visibility uses inclusive Chicago calendar dates; promotion windows
  need explicit timestamps and an America/Chicago admin display.
- Contact campaigns and Serve Needs must retain existing form actions; neither
  should be implemented by exposing internal contact email fields.

Still open: whether the main feature becomes mixed-content; whether a source may
occupy both the main feature and a highlight; and the saved-schedule overflow
policy when more than three highlights overlap. The user's confirmation that
Home items remain in their normal browse sections does not settle those two
Home-placement questions. The prototype retains the event-only main feature,
avoids it in the initial sample when possible, and allows manual preview choices.

## Where we paused

At the September 16 handoff, the user approved the direction of the isolated `/navlab` prototype and asked to
save this plan, commit/push the current work to `dev`, and stop all local Firebase
emulators. The scheduling/admin feature below remains unimplemented; the local
card preview is described above. Do not treat this document as authorization to
deploy to `main`.

## Current prototype

- Tab and swipe order: **Home → Next Steps → Groups → Events**.
- Desktop navigation is in the header; mobile navigation is at the bottom.
- Header branding follows Print Mode's bulletin lockup: circular mark, bold
  uppercase CrossPointe, and smaller tracked Central underneath.
- Mobile uses native horizontal scrolling and CSS snap, with separate vertical
  scrolling per page. Preserve this: several custom swipe implementations were
  rejected for sticking or failing when swiping back.
- The selected tab highlights as a swiped page becomes mostly visible; URL and
  accessibility state settle after scrolling. Explicit tab/button navigation is
  protected against stale scroll events resetting it to Home.
- Home uses Central's current hero, featured event, banner, Sunday information,
  worship set, and Quick Links. Quick Links are buttons, three per mobile row.
- Next Steps contains Next Steps, Campaigns, Serve Opportunities, and Resources in
  compact cards with simple colored icons. Selected Campaigns and Serve Needs
  can also appear as Home highlights; their full browse sections stay here.
- The “Join A Pointe Group” card opens the Groups tab.
- Groups reuses the public directory, including filters, attendance pills, and
  group detail dialogs. Events uses the public event/registration feed.
- Both public feeds start at page startup without waiting for a tab visit. The
  Central feed prepares Home, Events, and Next Steps; Groups loads independently
  in the background. Tab changes reuse the mounted directory and retain filters.
  A fast visit may still show loading while the initial request is in flight;
  failed Groups loads retain the directory's existing retry action.
- Light and dark styling are supported. This remains a preview of the design;
  it does not replace the Central homepage or add navigation to it.

Data comes directly from anonymous public production endpoints:
`https://central.crosspointe.tv/api/central-data` and
`https://central.crosspointe.tv/api/groups`, including when viewing the dev lab.
There are no authenticated internal endpoint calls or Central backend writes from
the lab. Sunday notes save locally; Google Docs export writes only after its
explicit user-triggered authorization flow.
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

The September 17 scope is Events, Registrations, Campaigns, and Serve Needs.
This supersedes the original suggestion to include all content except Groups.

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

## Original implementation sequence (current status above)

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
- `public/navlab-promotions.js`: supported types and reference-based preview selection.
- `public/navlab-study.js` / `.css`: isolated Sunday notes and YouVersion workspace.
- `public/navlab-player.js` / `.css`: persistent inline/mini livestream player.
- `public/navlab.css`: responsive lab styling.
- `firebase.json`: `/navlab` rewrite and lab cache headers.
- `test/navlab-navigation.test.mjs`: navigation timing/order regressions.
- `test/navlab-promotions.test.mjs`: source eligibility, identity, selection, and retention contracts.
- `test/navlab-today.test.mjs`: Today projection, start-time expiration, visibility, and legacy timestamp handling.

Focused commands:

```sh
node --test test/navlab-*.test.mjs
node --check public/navlab.js
node --check public/navlab-content.js
node --check public/navlab-promotions.js
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

All local Firebase emulators were stopped at the September 16 handoff. The
Hosting-only emulator was restarted for September 17 card verification. The
ignored `.env.navlab-emulators.json` is a local
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
