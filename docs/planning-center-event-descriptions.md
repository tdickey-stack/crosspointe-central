# Calendar event descriptions and action buttons

Central preserves supported rich text from Planning Center Calendar descriptions
in the event details popup: paragraphs, headings, bold, italics, underline, lists,
blockquotes, and web/email links. Central controls typography and removes custom
styles, embedded media, scripts, and unsupported attributes. Plain descriptions
remain available for cards, Print Mode, and calendar exports.

## Add a button

Place one marker in its own paragraph at the end of the Calendar description:

```text
{button_text:"Register Your Booth"|button_link:"https://crosspointetv.churchcenter.com/people/forms/1309469"}
```

Use an HTTPS destination and quote both values. Straight single/double quotes
and smart quotes are accepted. Planning Center's auto-linked URLs and emphasis
inside the marker are supported. Keep ordinary inline links in the copy as needed.

Central removes the marker from its displayed description and plain exports.
The featured card (normal and Sunday Mode) shows the custom action plus View
Event. The same action appears inside the event details popup. Other systems
that display the original Planning Center description may show the raw marker.

A valid marker overrides Calendar's registration URL. Without a valid marker,
Central uses Calendar's registration URL with the label Sign Up, if available.
With neither, the featured card retains View Event only. Malformed or duplicate
markers do not create a custom action; an editor-visible warning appears beside
the event editing control. Correct the marker in Planning Center.

## Central overrides

Central's existing description editor remains plain text. A description override
replaces the displayed copy and disables the rich-text version until the override
is reset. The event's action still comes from Planning Center. Manage button
markers in Planning Center, not in the Central description override.

## Implementation and checks

- Parser: `functions/planning-center/event-description.js`
- Calendar import, projection, and cached presentation: `functions/index.js`
- Frontend presentation: `public/app.js` and `public/styles.css`
- Calendar source cache version is v4 so old plain-text-only entries are refreshed.

Run the focused suite:

```sh
node --test functions/planning-center/event-description.test.js \
  test/event-description-pipeline.test.mjs test/event-presentation.test.mjs
```
