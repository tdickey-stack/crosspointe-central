# Backend Data Schema and Upsert Guide

CrossPointe Central uses Firebase Authentication, Cloud Functions, and
Firestore. Firestore is schemaless, so there is no database DDL or generated
schema file. The effective schema is defined by:

- path constants, validation, and write helpers in `functions/index.js`;
- admin-side payload builders in `public/admin.js`; and
- access rules in `firestore.rules`.

This document is the canonical human-readable map of that implementation.
When this guide and the code disagree, the code is the source of truth.

## Data Flow

```text
Admin browser
  |-- direct draft writes (only selected editors)
  |     `centralAppDraft/...` and `centralContentDraft/...`
  |
  |-- POST /api/admin/publish-preview-content
  |     Cloud Function validates and normalizes the payload
  |     then writes `centralApp/...` or `centralContent/...`
  |
  `-- POST /api/admin/submit-change-request
        writes `centralAdmin/root/changeRequests/{requestId}`
        approval merges the requested upserts/removals and publishes them

Public browser
  `-- GET /api/central-data
        Cloud Function combines published Firestore content with live
        Planning Center data and returns the public response
```

The public browser can read published content, but cannot write it. Most
privileged writes go through Cloud Functions using the Firebase Admin SDK.

## Firestore Path Map

### Public application settings

| Path | Purpose |
| --- | --- |
| `centralApp/root/public/settings` | Homepage copy and module ordering |
| `centralApp/root/public/sundaySettings` | Sunday Mode copy, schedule, and integration settings |
| `centralApp/root/public/thisSunday` | Current sermon/Sunday details |
| `centralApp/root/public/whatsNew` | Public What's New fallback document |
| `centralApp/root/public/meta` | Public integration metadata, currently a fallback Google web client ID |

### Published list content

| Path | Document ID | Purpose |
| --- | --- | --- |
| `centralContent/campaigns/items/{id}` | Stable slug-like ID | Campaign cards |
| `centralContent/nextSteps/items/{id}` | Stable slug-like ID | Next Step cards |
| `centralContent/serveNeeds/items/{id}` | Stable slug-like ID | Volunteer opportunities |
| `centralContent/resources/items/{id}` | Stable slug-like ID | Resource cards |
| `centralContent/quickLinks/items/{id}` | Stable slug-like ID | Homepage and Sunday links |
| `centralContent/roomRules/items/{id}` | Stable slug-like ID | Planning Center room-name transformations |
| `centralContent/statusBanner/items/live` | Always `live` | Current status banner |

Each list section also has a metadata document at
`centralContent/{section}/meta/state`. It records whether the Firestore
override is initialized, whether it is active, the item count, and publish
metadata.

### Draft content

Only editors that explicitly save drafts use these paths:

| Path | Purpose |
| --- | --- |
| `centralAppDraft/root/public/settings` | Homepage draft |
| `centralAppDraft/root/public/sundaySettings` | Sunday Mode draft |
| `centralContentDraft/statusBanner/items/live` | Status banner draft |
| `centralContentDraft/quickLinks/items/{id}` | Quick Link drafts |
| `centralContentDraft/quickLinks/meta/state` | Quick Link draft initialization state |

Campaigns, Next Steps, Serve Needs, Resources, and Room Rules use an in-browser
working list and publish through the backend endpoint; they do not currently
have equivalent persisted draft collections.

### Admin and workflow data

| Path | Purpose |
| --- | --- |
| `centralAdmin/root` | First-admin bootstrap state |
| `centralAdmin/root/users/{uid}` | Admin identity and per-page access |
| `centralAdmin/root/invites/{inviteId}` | Pending and historical admin invitations |
| `centralAdmin/root/changeRequests/{requestId}` | Pending content approval requests |
| `centralAdmin/root/auditLog/{logId}` | Publish and approval audit entries |
| `centralAdmin/root/pages/{pageId}` | Reserved/readable admin page records |
| `centralAdmin/root/roles/{roleId}` | Reserved/readable role records |
| `centralAdmin/root/public/whatsNew` | Admin What's New fallback document |

### Operational data

| Path | Purpose |
| --- | --- |
| `centralServeNeeds/root/interests/{submissionId}` | Public Serve Needs interest submissions and notification status |
| `mail/{mailId}` | Legacy/optional mail-delivery status source watched by a trigger; the collection name can be changed with `CENTRAL_MAIL_COLLECTION_PATH` |

Planning Center events, today's schedule, the Central Featured event,
Registrations signups, and setlists are fetched at runtime; they are not
currently maintained as the primary Firestore content collections. The
featured event is the next future instance tagged both `Central` and
`Central Featured`; its description and image come directly from the parent
Planning Center event.

The public Registrations feed is restricted to open signups in the configured
`PCO_CENTRAL_REGISTRATION_CATEGORY_NAME` category (default: `Central`). Central
requests only signup configuration, public selection types, the next signup
time, and the public signup location. It does not request or persist Planning
Center attendee, registration, person, emergency-contact, form-answer, or
payment resources. The final registration is completed on the hosted Church
Center signup page.
The repo-hosted `public/content/whats-new.json` is checked before the Firestore
What's New fallback documents.

## Published Document Shapes

Firestore timestamps shown below are added by the backend and are omitted from
the content field lists for readability.

### List items

| Section | Content fields |
| --- | --- |
| Campaign | `title`, `description`, `button_text`, `button_url`, `ongoing`, `start_date`, `end_date`, `sort`, `active` |
| Next Step | `title`, `description`, `button_text`, `button_url`, `sort`, `active` |
| Serve Need | `need`, `ministry`, `priority`, `description`, `button_text`, `contact_email`, `sort`, `active` |
| Resource | `title`, `type`, `description`, `button_text`, `button_url`, `sort`, `active` |
| Quick Link | `title`, `url`, `sort`, `active`, `sunday_only` |
| Room Rule | `match_type`, `match_text`, `display_location`, `behavior`, `priority`, `active` |
| Status Banner | `title`, `message`, `button_text`, `button_url`, `active` |

Published item documents also receive:

- `createdAt`
- `updatedAt`
- `publishedToPreviewAt`
- `publishedToPreviewByUid`
- `publishedToPreviewByEmail`
- `publishedToPreviewByName`

The item's Firestore document ID is its `id`. The `id` is normally included in
API payloads but is not duplicated as a field inside the published item
document.

### Homepage settings

`centralApp/root/public/settings` contains:

```text
site_title
hero_heading
hero_subheading
primary_button_text
primary_button_url
secondary_button_text
secondary_button_url
countdown_label
countdown_title
countdown_datetime
featured_event_enabled
homepage_modules[]
```

Each `homepage_modules` entry has an `id` and `enabled` value. The array order is
the display order.

### Sunday settings and integrations

`centralApp/root/public/sundaySettings` is intentionally shared by three admin
areas. Their writes are merged so one area does not erase the others.

- Sunday Mode presentation: `sunday_eyebrow`, `sunday_heading`,
  `sunday_subheading`, primary/secondary button fields, labels, scripture copy,
  livestream title, and `sunday_modules[]`.
- Live Sunday controls: `sunday_mode_override`, `force_sunday_mode`,
  `sunday_mode_start_time`, and `sunday_mode_end_time`.
- Dev-preview Sunday controls: `dev_sunday_mode_override`,
  `dev_sunday_mode_start_time`, and `dev_sunday_mode_end_time`. These fields
  are used by the Firebase `dev` preview channel and the local emulator, so
  forcing Sunday Mode in dev does not alter the live page.
- Integrations: `sunday_livestream_url`, `sunday_livestream_note`,
  `sunday_scripture_bible_id`, `google_web_client_id`,
  `google_docs_enabled`, and `calendar_integrations_enabled`.

### This Sunday

`centralApp/root/public/thisSunday` contains:

```text
date
date_iso
series
sermon_title
speaker
scripture
note
```

### What's New fallbacks

The Firestore fallback documents at `centralApp/root/public/whatsNew` and
`centralAdmin/root/public/whatsNew` use:

```text
active
force_show
version
title
message
button_text
```

The hosted `public/content/whats-new.json` adds an `enabled` switch and contains
separate `public` and `admin` objects with the same practical fields.

## What "Upsert" Means Here

An upsert creates a document when its ID does not exist and updates it when the
ID already exists. There are two relevant implementations.

### Content upserts

The admin sends list changes using this logical shape:

```json
{
  "section": "nextSteps",
  "operation": "publish",
  "baselineItems": [],
  "changeSet": {
    "upsertItems": [
      {
        "id": "join-a-group",
        "title": "Join a Group",
        "description": "Find a place to grow and belong.",
        "button_text": "Learn More",
        "button_url": "https://crosspointe.tv/groups",
        "sort": 10,
        "active": true
      }
    ],
    "removeIds": []
  },
  "payload": {
    "items": []
  }
}
```

The backend merge flow is:

1. Normalize `baselineItems`, `changeSet.upsertItems`, and
   `changeSet.removeIds`.
2. Load the current published collection.
3. Reject the request if the same item changed since the submitted baseline.
4. Apply upserts by stable `id` and removals by `id`.
5. Publish the resulting complete list in one Firestore batch.
6. Create or replace every resulting item and delete documents no longer in
   that complete list.

The same merge-safe pattern is used for Campaigns, Next Steps, Serve Needs,
Resources, Room Rules, and Quick Links. A full-list publish can omit
`baselineItems` and `changeSet`, but then `payload.items` is treated as the
entire desired collection.

The main implementation points are:

- `resolveDirectPreviewPublishPayload_()` and
  `resolveChangeRequestPayloadForApproval_()` for merge/conflict handling;
- each section's `apply*ChangeSet_()` helper for upserts and removals; and
- `publishPreview*Payload_()` for the final Firestore batch write.

### Admin-user upsert

`POST /api/admin/upsert-user` maps to the exported `upsertAdminUser` Cloud
Function and the `upsertAdminUserRecord_()` helper.

Request body:

```json
{
  "uid": "firebase-auth-uid-if-known",
  "email": "person@crosspointe.tv",
  "displayName": "Person Name",
  "active": true,
  "pageAccess": {
    "hub": "edit",
    "settings": "view",
    "users": "none"
  }
}
```

The request requires `Authorization: Bearer <Firebase ID token>` and the caller
must have active Admin access to the Users section.

- If the UID resolves to an existing admin document, it is merged into
  `centralAdmin/root/users/{uid}`.
- If the UID does not exist, the user document is created.
- If only an email is supplied and no matching Firebase/admin user exists, the
  same endpoint creates or refreshes an invite in
  `centralAdmin/root/invites/{inviteId}` instead.

Admin user documents contain:

```text
uid
email
displayName
photoUrl
active
roleIds[]
pageAccess{}
createdAt
updatedAt
```

Valid `pageAccess` values are `none`, `view`, `propose`, `edit`, `approve`, and
`admin`.

## Serve Needs Interest Shape

New public submissions are assigned an automatic Firestore document ID and
stored at `centralServeNeeds/root/interests/{submissionId}`. The record keeps a
snapshot of the opportunity so later edits to the published Serve Need do not
change what the person originally responded to.

```text
serveNeedId
serveNeedSource
serveNeedNeed
serveNeedMinistry
serveNeedPriority
serveNeedDescription
serveNeedButtonText
contactEmail
notifyMethod
name
email
phone
preferredContactMethod
additionalNotes
status
notificationStatus
notificationAttempts
notificationProvider
notificationMessageId
notificationSentAt
notificationError
sourceHost
userAgent
createdAt
updatedAt
```

Some notification fields are added only after an email attempt.

## Change Request Shape

Pending requests at `centralAdmin/root/changeRequests/{requestId}` contain the
common fields below, plus section-specific baseline hashes, baseline items, and
change sets for merge-safe approval:

```text
target
section
sectionLabel
operation
status
summary
payload
submittedByUid
submittedByEmail
submittedByName
createdAt
updatedAt
```

Approved or rejected requests are logged and then deleted. The audit log is the
durable history, not the `changeRequests` collection.

## Access Rules Summary

- Published `centralApp` and `centralContent/*/items` data is publicly readable.
- Published data is never directly writable from the browser.
- Authenticated admins can read/edit only the draft sections allowed by their
  `pageAccess` record.
- Admin users can directly read only their own user record.
- User management, publishing, approvals, invitations, audit writes, and Serve
  Needs submissions are handled by privileged Cloud Functions.

See `firestore.rules` for the exact rule expressions and
`docs/admin-firestore-bootstrap.md` for first-admin setup and editor-specific
examples.
