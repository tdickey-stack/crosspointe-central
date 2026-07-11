# CrossPointe Admin Firestore Bootstrap

This file documents the Firestore paths that the admin dashboard currently
expects.

## Why These Paths Look Different

Firestore data must alternate collection/document/collection/document.

That means:

- `centralContent/statusBanner/items/{itemId}` is valid.
- `centralAdmin/users/{uid}` is not a valid document path.
- `centralApp/public/settings` is not a valid document path.

To keep the original grouping intent while making the paths valid, the repo now
uses a root document under `centralAdmin` and `centralApp`.

## Current Paths

The repo now uses a draft/published split for the Firestore-backed admin work,
and the public site now reads from the published Firestore data directly.

### Preview-published singleton docs

- `centralApp/root/public/settings`
- `centralApp/root/public/sundaySettings`
- `centralApp/root/public/thisSunday`
- `centralApp/root/public/whatsNew`
- `centralApp/root/public/meta`

### Preview-published content collections

- `centralContent/statusBanner/items/{itemId}`
- `centralContent/today/items/{itemId}`
- `centralContent/events/items/{itemId}`
- `centralContent/setlist/items/{itemId}`
- `centralContent/campaigns/items/{itemId}`
- `centralContent/nextSteps/items/{itemId}`
- `centralContent/serveNeeds/items/{itemId}`
- `centralContent/resources/items/{itemId}`
- `centralContent/quickLinks/items/{itemId}`
- `centralContent/roomRules/items/{itemId}`

### Draft admin paths

- `centralAppDraft/root/public/settings`
- `centralAppDraft/root/public/sundaySettings`
- `centralContentDraft/statusBanner/items/live`
- `centralContentDraft/quickLinks/items/{itemId}`
- `centralContentDraft/quickLinks/meta/state`

### Quick links editor

The admin editor now saves quick-link drafts here first:

- `centralContentDraft/quickLinks/items/{itemId}`
- `centralContentDraft/quickLinks/meta/state`

Suggested quick-link document shape:

```json
{
  "title": "Church Center",
  "url": "https://crosspointe.tv",
  "sort": 10,
  "active": true,
  "sunday_only": false
}
```

Behavior:

- Saving in the admin UI writes to the draft collection only.
- Publishing copies the whole draft collection to `centralContent/quickLinks/items/{itemId}` for preview.
- `sunday_only: true` keeps a link off the regular homepage and only shows it during Sunday Mode.
- If the published collection is empty, the Quick Links section stays hidden in Central until you add items again.

### Campaigns editor

The admin editor publishes campaigns here for preview:

- `centralContent/campaigns/items/{itemId}`

Suggested campaign document shape:

```json
{
  "title": "Back to School Drive",
  "description": "Help stock classrooms and support local families.",
  "button_text": "View Details",
  "button_url": "https://crosspointe.tv",
  "ongoing": false,
  "start_date": "2026-08-01",
  "end_date": "2026-08-31",
  "sort": 10,
  "active": true
}
```

Behavior:

- Editing in the admin UI builds a local working list first.
- Ongoing campaigns ignore start and end dates and stay visible until removed.
- Scheduled campaigns use both a start date and an end date.
- Publishing replaces the preview campaigns collection with the current working list.
- Submitting for approval stores the proposed list as a change request for admins.
- The public app only shows campaigns whose schedule is currently active.
- If the published collection is empty, the Campaigns section stays hidden in Central until you add items again.

### Next Steps editor

The admin editor publishes Next Steps here for preview:

- `centralContent/nextSteps/items/{itemId}`

Suggested Next Step document shape:

```json
{
  "title": "Join a Group",
  "description": "Find a place to grow and belong this week.",
  "button_text": "Learn More",
  "button_url": "https://crosspointe.tv",
  "sort": 10,
  "active": true
}
```

Behavior:

- Editing in the admin UI builds a local working list first.
- Publishing replaces the preview Next Steps collection with the current working list.
- Submitting for approval stores the proposed list as a change request for admins.
- If the published collection is empty, the Next Steps section stays hidden in Central until you add items again.

### Resources editor

The admin editor publishes resources here for preview:

- `centralContent/resources/items/{itemId}`

Suggested resource document shape:

```json
{
  "title": "Prayer Guide",
  "type": "Guide",
  "description": "Walk through a simple prayer rhythm for the week.",
  "button_text": "Open Resource",
  "button_url": "https://crosspointe.tv",
  "sort": 10,
  "active": true
}
```

Behavior:

- Editing in the admin UI builds a local working list first.
- Publishing replaces the preview resources collection with the current working list.
- Submitting for approval stores the proposed list as a change request for admins.
- If the published collection is empty, the Resources section stays hidden in Central until you add items again.

### Status banner editor

The admin editor now saves the banner draft here first:

- `centralContentDraft/statusBanner/items/live`

Suggested status-banner document shape:

```json
{
  "title": "Service Update",
  "message": "Weather changed our service schedule for tonight.",
  "button_text": "See details",
  "button_url": "https://crosspointe.tv",
  "active": true
}
```

Behavior:

- Saving in the admin UI writes to the draft document only.
- Publishing copies the draft to `centralContent/statusBanner/items/live` for preview.
- Hiding in preview writes `active: false` to the published preview document.
- If the published banner document does not exist, the banner stays hidden in Central until you publish one.

### Hub editor

The Hub page now saves drafts in these singleton Firestore docs:

- `centralAppDraft/root/public/settings`
- `centralAppDraft/root/public/sundaySettings`

Behavior:

- If either document does not exist yet, the admin page starts from the current public `/api/central-data` values so edits begin from what people already see.
- Publishing copies the homepage draft to `centralApp/root/public/settings` for preview.
- Publishing copies the Hub-owned Sunday Mode copy to `centralApp/root/public/sundaySettings` for preview.
- Any sections without a published doc simply use empty-state behavior in Central until you publish them.

### Settings editor

The Settings page manages operational controls instead of homepage copy.

- `Force Sunday Mode`
- `Livestream URL`
- `Livestream Note`
- `Bible ID`
- Room Rules
- Admin user access

Behavior:

- Publishing Sunday controls writes to `centralApp/root/public/sundaySettings` for preview.
- Room Rules publish to `centralContent/roomRules/items/{itemId}`.
- Admin users are managed through privileged Functions endpoints rather than direct browser writes.

### Admin collections

- `centralAdmin/root/users/{uid}`
- `centralAdmin/root/roles/{roleId}`
- `centralAdmin/root/pages/{pageId}`
- `centralAdmin/root/changeRequests/{requestId}`
- `centralAdmin/root/auditLog/{logId}`

## First Admin User

The preview admin screen can now try to create the first admin document
automatically after you sign in with your CrossPointe Google account.

If you need the manual fallback, create a document at:

`centralAdmin/root/users/<your-firebase-auth-uid>`

Starter shape:

```json
{
  "uid": "<your-firebase-auth-uid>",
  "email": "<your-crosspointe-email>",
  "displayName": "<your-name>",
  "photoUrl": "",
  "active": true,
  "roleIds": [],
  "pageAccess": {
    "hub": "admin",
    "settings": "admin",
    "integrations": "admin",
    "sundaySettings": "admin",
    "thisSunday": "admin",
    "whatsNew": "admin",
    "statusBanner": "admin",
    "today": "admin",
    "events": "admin",
    "setlist": "admin",
    "campaigns": "admin",
    "nextSteps": "admin",
    "serveNeeds": "admin",
    "resources": "admin",
    "quickLinks": "admin",
    "roomRules": "admin",
    "users": "admin",
    "roles": "admin",
    "changeRequests": "admin"
  }
}
```

Timestamp fields can be added later. They are not required for the initial
access bootstrap.

## Serve Needs Notes

Serve Needs content lives at:

- `centralContent/serveNeeds/items/{itemId}`

Each item can include:

- `need`
- `ministry`
- `priority`
- `description`
- `button_text`
- `contact_email`
- `sort`
- `active`

Public interest submissions are stored separately at:

- `centralServeNeeds/root/interests/{submissionId}`

Those submissions now attempt to email the ministry leader automatically when
the Gmail API is configured in Functions. See `docs/serve-needs-email.md` for
the current setup notes.
