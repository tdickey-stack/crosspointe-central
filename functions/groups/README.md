# Public Groups lab

`/group-lab` is an isolated prototype. It adds no Central homepage/navigation
entry and changes neither ChurchCo nor the event Embeds admin. The standalone
`public/group-directory.js` module exports `mountGroupDirectory(root, options)`
for later embed reuse; `public/group-directory.css` scopes directory styles.

The directory follows Central's ancestor `data-theme="light"` or
`data-theme="dark"` setting. The lab-only `public/group-lab-theme.js` controller
provides a preview switch, uses Central's saved theme preference, and defaults
to the system theme. Switching themes preserves the current filters. Attendance
pill colors and image positioning stay consistent in both themes.

View Group Details opens a native modal in Central. It includes the public
description, schedule, public location name, artwork, and attendance guidance.
Open in Church Center opens the group's public URL in a new tab for contact
and roster requests. Escape, Close, or the backdrop dismisses the modal and
returns focus to its card without changing filters.
Opening and closing match Central's event-details modal: a 0.4-second fade/lift
in and 0.75-second fade/lift out, with motion disabled for reduced-motion users.

## Source and privacy

`GET /api/groups` → `centralGroupsPublic` uses the existing secret-bound PCO
transport and request gate. The service adapts Studio's group/image
normalization and Wayfinder's published/listed/archived checks without exposing
either authenticated endpoint. Only the public display contract is serialized:
id, name, description, type, schedule, meetingDays, location, locationTags,
imageUrl, url, attendance. The description comes only from `description_as_plain_text`, is
bounded to 12,000 characters, and is rendered as text with its paragraph breaks.

Groups must be published, explicitly listed, unarchived, in a visible group
type, and have a CrossPointe Church Center detail URL. No membership, person,
enrollment, contact, note, address, coordinate, or virtual-meeting-link fields
are requested or returned. All pagination is exhausted; invalid/cyclic
pagination fails instead of silently truncating the directory.

Locations use **display_preference**, never staff-level **strategy**. Only
physical locations explicitly marked `exact` return the location **name**.
Approximate/hidden/missing visibility returns no location. This intentionally
omits some room names until PCO's public visibility permits them; full addresses
are never serialized. This public location name is used for card/modal details,
not for filtering.

The Location type filter uses only assigned tags from the public PCO tag group
named **Location Type**. Labels are discovered automatically; options include
only nonblank labels assigned to eligible groups and are deduplicated. Groups
without these tags remain under All locations. Missing, hidden, or ambiguous
Location Type tag groups produce no location options. Physical location names,
addresses, group types, and enrollment never determine these categories.

The API exposes `schedule` as text, with no structured regular weekday field.
Meeting-day filtering recognizes full weekday words (singular/plural), without
inferring from dates, group names, enrollment, or individual event dates.
Unclear/date-of-month/range/exception schedules remain unclassified and appear
under Any day. Original schedule text remains visible on cards.

## Attendance configuration

Read-only inspection on 2026-09-16 found Central tag group **538569**, configured
as single-choice and hidden from Church Center tag filters, with **zero tags**.
No PCO data was modified. To enable pills, an administrator must create and
assign the appropriate exact label within the Central tag group:

- Drop-ins welcome
- Connect before visiting

The directory discovers that tag group by name and resolves its tag IDs on
refresh. It uses explicitly requested Group `tag_ids`; `include=tags` is not
supported by the Groups API. Only the two authorized labels can become public
pills, even when the tag group itself is hidden from Church Center filters.
Unassigned, unknown, or conflicting labels produce no pill. Never infer
attendance from group type or enrollment strategy.

## Freshness and release

The process cache lasts 60 seconds and coalesces concurrent loads. HTTP/CDN
cache lifetime is 60 seconds, so changes can take approximately two minutes to
appear. Expired data is not served after upstream failure. Failures return a
generic 503 without upstream error bodies. No persistent duplicate group list
or Firestore cache is used.

`npm run test:groups` checks backend privacy/eligibility, tag/day normalization,
pagination/cache behavior and frontend filtering. `npm run check:syntax`
includes the new modules. The normal Firebase workflow runs Groups tests on
both branches and deploys the endpoint in dev before Hosting preview, then the
main workflow deploys the production project.

Reference docs:
- https://api.planningcenteronline.com/docs/apps/groups/versions/2023-07-10/vertices/group
- https://api.planningcenteronline.com/docs/apps/groups/versions/2023-07-10/vertices/location
- https://api.planningcenteronline.com/docs/apps/groups/versions/2023-07-10/vertices/tag_group
