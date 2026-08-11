# Central Embeds backend boundary

This folder owns persistent Central Embed administration and the narrow public
read layer. Planning Center remains authoritative; saved items contain source
event IDs plus embed-specific presentation overrides. Each draft and published
version also stores a validated `standard` or `compact` layout preset. Existing
documents without a layout continue to use the standard cards.

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

Copied embed code includes a normal crawlable link to that `.html` endpoint
inside the loader host. Browsers replace the fallback with the live cards after
JavaScript loads, while crawlers that do not run JavaScript can still discover
the semantic event HTML. Loader failures retain the same crawlable path.

The compact preset keeps cards bounded instead of stretching a single event
across the host page. Its public HTML includes only the event graphic, title,
schedule, location, and action; switching back to standard restores the saved
description without losing its source or override.

Run focused verification with:

```bash
npm --prefix functions run test:embeds
```
