# Print Mode Layout 3

Layout 3 (`readable`) is an experimental half-letter, two-sided layout. Layouts
1 (`classic`) and 2 (`scannable`) retain their existing rendering and fitting
behavior.

## Content rules

- Front: reserved hero and generosity sections, plus two flexible slots.
- Back: six slots in two columns of three. Events remain individual cards.
- Campaigns, Serve Needs, and Custom Blocks can be placed on either side.
- Standard uses one slot; Large uses two vertically stacked slots. Event cards
  always use one back slot. At most two Large blocks fit on the back.
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
checkboxes. Campaigns, Serve Needs, and Custom Blocks use familiar checkbox
lists. Selected flexible items reveal Front/Back and Standard/Large buttons;
events always use one back slot. A rejected selection leaves the existing
arrangement intact and explains which side is full. Reordering is available
under the collapsed Arrange front/back items section.
Controls wrap below the item when the editor column is narrow, keeping image
thumbnails and titles clear of the placement buttons.

## Compatibility and persistence

`layout3.items` stores `{key, side, size}` entries separately from legacy
placement fields. Keys use `campaign:`, `serve:`, `custom:`, or `event:` plus the
content ID. `side` is `front`, `back`, or `off`; `size` is 1 or 2.

A missing/null arrangement imports existing selections on first use, without
truncating to slot capacity. Compact and Standard custom blocks import as
one-slot Standard; Large imports as two slots. A legacy custom block on both
sides imports onto the front, since Layout 3 has one placement per item.

Copy, images, headings, and generosity values remain shared. Changing Layout 3
placement or size does not alter the old layouts. Existing Compact blocks keep
their Compact size in the old layouts; new Layout 3 custom blocks start
unselected there. The stored print format is retained, while Layout 3's effective
format is always half-letter.

The save endpoint preserves Layout 3 settings when older clients omit them.
The client removes expired event placements and deleted custom blocks before
the 250-entry normalization cap, so old weeks cannot displace new selections.

The back order editor displays the actual column-by-column reading order.
Moves that would leave too little contiguous space for a Large block are
rejected with an explanation. Accepted moves preserve the requested reading
order.

## Verification

Run `npm run test:print-mode-client`, `npm --prefix functions run test:print-mode`,
`npm run check:syntax`, and `git diff --check`.

Browser checks should cover a four-section front, six individual events, two
Large blocks plus two events, images, Markdown, long essential details,
million-dollar giving values, and both color modes. Deliberately overflow a
front and a back region and verify printing is blocked while draft saving
remains available. Switch to both older layouts and verify their selections and
Compact sizes survive, then save/reload Layout 3. Check narrow and desktop editor
widths. Print at 100% scale and review with readers before choosing the final
layout.
