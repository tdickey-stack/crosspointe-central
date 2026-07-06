# Serve Needs Email Setup

Serve Needs interest submissions now do two things in Firebase:

- save the submission in Firestore at
  `centralServeNeeds/root/interests/{submissionId}`
- queue an email document in `mail/{mailDocId}` for the Firebase
  `firestore-send-email` extension to send

## Current Delivery Flow

The `shareServeNeedInterest` function does not send mail directly anymore.
Instead it writes a Firestore document like this:

```js
{
  to: "ministry@crosspointe.tv",
  replyTo: "person@example.com",
  message: {
    subject: "New Serve Interest: Parking Team",
    text: "...",
    html: "<!doctype html>..."
  }
}
```

The Trigger Email extension watches the `mail` collection and delivers that
message using the OAuth2 Gmail configuration you installed in Firebase.

## Notes

- The ministry leader recipient still comes from each Serve Need's
  `contact_email` field in the admin dashboard.
- The submission's email address is written as the message `replyTo` when it is
  valid, so the ministry leader can reply directly to the person who filled out
  the form.
- Both the plain-text and HTML versions are now written so the Trigger Email
  extension can send a branded Central email instead of a plain-text-only
  message.
- The interest record stores queue metadata like `notificationStatus` and
  `notificationMailDocId`.
- A Firestore trigger watches the extension's `mail` document updates and syncs
  the interest record to `sent`, `retry`, or `failed` as delivery progresses.
- If you ever change the extension's email collection away from `mail`, update
  the function configuration to match before deploying.

## Gmail Workspace Setup

This project is now set up around the Firebase Trigger Email extension with:

- sender mailbox: `central@crosspointe.tv`
- authentication: `OAuth2`
- SMTP host: `smtp.gmail.com`
- SMTP port: `465`
- secure connection: `Yes`

Because Gmail OAuth2 is handled by the extension, these values no longer need
to live in `functions/.env`.
