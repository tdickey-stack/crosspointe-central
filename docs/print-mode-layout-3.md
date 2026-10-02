# Print Mode Layout 3

Layout 3 (`readable`) is an experimental half-letter, two-sided layout. Layouts
1 (`classic`) and 2 (`scannable`) retain their existing rendering and fitting
behavior.

## Content rules

- Front: reserved hero and generosity sections, plus two flexible slots.
- Back: two columns of content-sized cards. Events remain individual cards.
  Cards use their natural height, with no six-slot limit; the complete page must fit.
- Campaigns, Serve Needs, and Custom Blocks can be placed on either side.
- Front: Standard uses one slot; Large uses two vertically stacked slots.
  Back: card height is automatic, including registration QR and complete copy.
- All generated print text is at least 12pt. Uploaded artwork retains its own
  embedded typography; inspect the actual-size paper proof.
- Hero and custom-block graphics display in uncropped 16:9 frames.
- Generosity keeps the original rounded four-stat grid, with centered amounts
  below their labels and the giving link below the grid. Its reserved height
  is 1.65 inches to retain at least 12pt labels and 16pt amounts.
- Text is never automatically reduced or clamped. The preview identifies
  overflowing regions on either side and disables Print / Save PDF until fixed.
  Saving an unfinished draft remains available.

## Editor workflow

Events use the existing tiled list, week filters, and one-click Include
checkboxes. Search events by title, description, location, date, or time. Starting
a search opens All 28 Days; choosing a week or Included narrows the search, and
later typing keeps that view. Every search word must match somewhere in the
event details. Search only changes the visible results, leaving selected events
and saved print copy intact. The other layouts offer Include Results and Exclude
Results while searching; with no search, those actions apply to all 28 days.
Reset to Week 1 clears the search and restores the first-week selection.
Campaigns, Serve Needs, and Custom Blocks use familiar checkbox
lists. Selected flexible items reveal Front/Back buttons, with Standard/Large
buttons for the front only. Back cards size automatically. Front selections that
exceed its two slots leave the arrangement intact. Back selections remain editable
even when the measured page overflows; Print stays disabled until the page fits. Reordering is available
under the collapsed Arrange front/back items section.
Controls wrap below the item when the editor column is narrow, keeping image
thumbnails and titles clear of the placement buttons.

The custom-block editor checks the current unsaved copy, image, size, and
placement against the printed layout at 12pt or larger. On the back it checks
the complete page with the current edits, including the other selected cards;
on the front it checks the chosen Standard/Large card. The 800-character
editing limit is separate from printed fit: a description below that limit can
still need more space. Fit checks preserve the copy and size you chose; unfinished
drafts can still be saved.

Back-page event cards omit photos and decorative fallback thumbnails to leave
more space for event copy. A safe registration link produces an offline vector
QR beside the copy, with its complete button caption below the code. Cards
without a registration link use the full width for text, with no empty media
rail. The front-page Featured Event retains its existing image behavior;
featured registration cards keep the source thumbnail and stable brand-color
fallback for missing or failed images, with the QR beneath the thumbnail.
Custom-block graphics remain unchanged. QR codes retain a
four-module quiet zone and print at one inch square in color and black-and-white.
Back cards expand for registration QR and longer copy; the preflight keeps
printing blocked when the complete page exceeds its physical space.

Image URLs and registration links refresh from Planning Center. They are not
stored in the editorial draft; staff title, description, location, selections,
and size choices remain saved independently.

## Compatibility and persistence

`layout3.items` stores `{key, side, size}` entries separately from legacy
placement fields. Keys use `campaign:`, `serve:`, `custom:`, or `event:` plus the
content ID. `side` is `front`, `back`, or `off`; `size` is 1 or 2. Back rendering ignores
size, retaining the saved value for front placement and older-client compatibility.

A missing/null arrangement imports existing selections on first use, without
truncating to slot capacity. Compact and Standard custom blocks import as
one-slot Standard; Large imports as two slots for the front. On the back all
imported cards use their natural content height. A legacy custom block on both
sides imports onto the front, since Layout 3 has one placement per item.

Copy, images, headings, and generosity values remain shared. Changing Layout 3
placement or size does not alter the old layouts. Existing Compact blocks keep
their Compact size in the old layouts; new Layout 3 custom blocks start
unselected there. The stored print format is retained, while Layout 3's effective
format is always half-letter.

The save endpoint preserves Layout 3 settings when older clients omit them.
The client removes expired event placements and deleted custom blocks before
the 250-entry normalization cap, so old weeks cannot displace new selections.

The back order editor follows saved reading order. The renderer measures each
card at its physical print width and chooses the contiguous column split with
the smallest maximum column height. It keeps whole cards and preserves reading
order from the top of the left column to the bottom of the right. Reordering
remains available; it never rewrites copy or saved placement sizes. The measured
split is applied to both the scaled preview and both hidden print copies. Font
and image loading recheck fit before printing.

## Verification

Run `npm run test:print-mode-client`, `npm --prefix functions run test:print-mode`,
`npm run check:syntax`, and `git diff --check`.

Browser checks should cover a four-section front, six individual events, more
than six short back cards, mixed long/short cards, the full CrossPointe NEXT
description, registration QR, images, Markdown, long essential details,
million-dollar giving values, and both color modes. Deliberately overflow a
front and a back region and verify printing is blocked while draft saving
remains available. Switch to both older layouts and verify their selections and
Compact sizes survive, then save/reload Layout 3. Check narrow and desktop editor
widths. Print at 100% scale and review with readers before choosing the final
layout.
