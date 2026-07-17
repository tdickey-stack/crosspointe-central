# Planning Center Registrations Integration

Central treats Planning Center Registrations as the system of record for event
signups. Central displays approved public signup details and opens the exact
hosted Church Center signup in a new tab. The registration itself is never
submitted to Central.

## Privacy Boundary

The backend requests only these Registrations resources:

- `Signup`
- `Category`
- public `SelectionType`
- `SignupTime`
- `SignupLocation`

It does not request or persist:

- attendees or registration contacts;
- Planning Center people or households;
- email addresses, phone numbers, or birthdates;
- emergency contacts, form answers, or waivers; or
- payments, balances, or refunds.

No registration collection is added to Firestore. The homepage and Sunday-mode
module ordering continue to use the existing public settings documents.

## Planning Center Setup

1. Enable Planning Center Registrations for the existing CrossPointe Planning
   Center organization.
2. Create a Registrations category named `Central`.
3. Add that category only to signups approved for the public Central feed.
4. Publish each approved signup to Church Center and keep its registration
   status open.
5. Configure public selection types, the next signup time, and the public
   location as needed.
6. In Planning Center Publishing, add a primary navigation URL labeled
   `Central` that points to `https://central.crosspointe.tv`.

The category name is an exact, case-sensitive safety boundary. A signup that is
open but lacks the category is not returned to the Central frontend.

## Environment Configuration

The default category is configured in `functions/.env.example`:

```dotenv
PCO_CENTRAL_REGISTRATION_CATEGORY_NAME=Central
```

The Functions runtime continues to use the existing `PCO_APP_ID` and
`PCO_SECRET`. The Planning Center user associated with those credentials must
have access to the approved Registrations signups.

## Central Experience

The Registrations module is enabled by default on the standard homepage and is
available, but disabled by default, in Sunday Mode. Admins can reorder or
disable it with the existing Hub module editor.

Registration signups use the same compact card pattern as other Central events.
The card shows the date, time, `SignupLocation.subpremise` room label, a Learn
More button, and the existing Google/Apple/Outlook Add to Calendar menu.

The Learn More modal can show:

- open, waitlist, or full status;
- date, time, room, venue, and public address;
- free or paid price range;
- registration close date; and
- a direct Church Center registration link with an explicit new-tab note.

Seven days before `close_at`, an otherwise open signup changes to
`Registration closing soon`. After `close_at`, it remains visible as
`Registration closed` until its final signup time ends. After the event ends,
Central removes the signup automatically.

As a feed safety boundary, Central only returns registration events whose next
signup time begins within the next 30 days. Signups farther out—or without a
usable signup time—remain hidden until they enter that rolling window.

## Verification

Run the focused mapper tests:

```bash
cd functions
node --test planning-center/registrations.test.js
```

Run the complete Planning Center and Wayfinder test suite:

```bash
npm run test:wayfinder
```

An empty `registrations` array is expected until an open signup is assigned to
the configured Central category.
