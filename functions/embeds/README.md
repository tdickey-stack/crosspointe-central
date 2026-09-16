# Central Embeds backend boundary

This folder owns persistent Central Embed administration and the narrow public
read layer. The immutable top-level `type` is `events` or `groups`; legacy
documents without a type remain Event Embeds. Unknown types and attempts to
change an existing Embed's type are rejected.

For Event Embeds, Planning Center remains authoritative; saved items contain
source event IDs plus embed-specific presentation overrides. Each draft and
published version also stores a validated `standard` or `compact` layout. An item
with the `Central Featured` Planning Center tag automatically gets a larger
card and visible label while normal Standard cards stay in a bounded grid.
Featured cards always render first; each Featured and normal group is then
chronological. Saved items do not store prominence, and legacy manual values
are ignored. Existing documents without a layout continue to use Standard.

Embeds use a dedicated 60-day Planning Center calendar cache. A selected item
can also store its Planning Center parent event ID and canonical source title.
The renderer expands that one saved selection into every future instance of
the same PCO series in the current window. The title is a bounded fallback when
Planning Center does not provide a parent event ID.

Groups Embeds store only a `light`, `dark`, or `responsive` theme. Light is the
default. Responsive follows the visitor's operating-system color preference at
render time and whenever that preference changes. Published Groups HTML is a loading/fallback shell; the shared
browser directory engine loads current records from `/api/groups`. Group records
are never copied into Embed documents or HTML, and `/group-lab` page copy is not
part of the Embed contract.

- `function.js` owns authenticated draft/publish operations and public reads.
- `payload.js` owns IDs, limits, normalization, and public source sanitization.
- `render.js` owns source fallback resolution and semantic HTML rendering.
- `storage.js` owns permission-checked custom event graphic uploads.

The public endpoint returns only the published configuration. Event Embeds are
resolved against the current shared Central event cache. Groups JSON contains
only the Embed ID, type, theme, schema version, and published version, while the
Groups shell hands off to the reusable directory engine and its safe public API.
Groups requests never load the Event cache.

The JavaScript loader is a client-side convenience; the `.html` endpoint is the
server/build-time path for placing semantic Event markup or the Groups mount
shell in a host page's initial HTML. A direct Groups `.html` request includes the
shared stylesheet and deferred loader around an outer `data-central-embed`
wrapper. `?styles=0` returns only the inner shell for loader refreshes.

Copied Event embed code includes a snapshot of the current semantic event HTML plus a
normal crawlable link to the always-current `.html` endpoint. Bots and visitors
without JavaScript can read the event cards directly from the host page source.
Browsers progressively enhance that snapshot, fetch the newest published HTML,
and add the selected interactions. Loader failures retain the readable snapshot
and its path to the current server-rendered listing. The inline snapshot changes
only when the host snippet is replaced; a host that needs always-current source
HTML must fetch the `.html` endpoint during its server render or site build.

The compact preset keeps cards bounded instead of stretching a single event
across the host page. Its public HTML includes only the event graphic, title,
schedule, location, and action; switching back to standard restores the saved
description without losing its source or override.

Run focused verification with:

```bash
npm run test:embeds
npm run test:groups
```

The Groups loader imports `public/group-embed.js`, mounts the shared directory
inside a Shadow DOM to isolate website styles, and uses an absolute Central
`/api/groups` URL. Hosting allows cross-origin imports of the two Groups modules.
Fonts are self-hosted under `public/fonts/groups/` and loaded with unique family
names so they cannot restyle surrounding website text.
Container queries adapt the filters and card columns to the embed's actual width.
Light/Dark/Responsive colors apply to that directory only; no host-page theme,
local storage, headings, or lab controls are changed. Without JavaScript, the
copied shell provides a link to the public Church Center groups directory.

`npm run seed:embed-lab` seeds local-emulator-only Event and Groups configs,
including `embed_labgroupslight`, `embed_labgroupsdark`, and
`embed_labgroupsresponsive`. Groups still use current public PCO records.
