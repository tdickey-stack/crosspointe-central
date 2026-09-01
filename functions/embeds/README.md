# Central Embeds backend boundary

This folder owns persistent Central Embed administration and the narrow public
read layer. Planning Center remains authoritative; saved items contain source
event IDs plus embed-specific presentation overrides. Each draft and published
version also stores a validated `standard` or `compact` layout preset. An item
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

- `function.js` owns authenticated draft/publish operations and public reads.
- `payload.js` owns IDs, limits, normalization, and public source sanitization.
- `render.js` owns source fallback resolution and semantic HTML rendering.
- `storage.js` owns permission-checked custom event graphic uploads.

The public endpoint returns only the published configuration after resolving it
against the current shared Central event cache. The JavaScript loader is a
client-side convenience; the `.html` endpoint is the server/build-time path for
placing the same semantic event markup in a host page's initial HTML.

Copied embed code includes a snapshot of the current semantic event HTML plus a
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
npm --prefix functions run test:embeds
```
