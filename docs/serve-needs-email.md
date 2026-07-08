# Serve Needs Email Setup

Serve Needs interest submissions now do two things in Firebase:

- save the submission in Firestore at
  `centralServeNeeds/root/interests/{submissionId}`
- send an email directly through the Gmail API using the `central@crosspointe.tv`
  mailbox credentials configured in Functions

## Current Delivery Flow

The `shareServeNeedInterest` function sends mail directly through the Gmail API
after exchanging the configured refresh token for an access token.

## Notes

- The ministry leader recipient still comes from each Serve Need's
  `contact_email` field in the admin dashboard.
- The submission's email address is written as the message `replyTo` when it is
  valid, so the ministry leader can reply directly to the person who filled out
  the form.
- Both the plain-text and HTML versions are sent so Central keeps the same
  branded email experience.
- The interest record stores direct-delivery metadata like
  `notificationStatus`, `notificationAttempts`, and `notificationMessageId`.

## Gmail API Setup

This project is now set up around the Gmail API with:

- sender mailbox: `central@crosspointe.tv`
- scope: `https://www.googleapis.com/auth/gmail.send`
- delivery path: Cloud Functions calls the Gmail API directly

These Function env vars now power delivery:

- `CENTRAL_GMAIL_CLIENT_ID`
- `CENTRAL_GMAIL_CLIENT_SECRET`
- `CENTRAL_GMAIL_REFRESH_TOKEN`
- `CENTRAL_GMAIL_SENDER_EMAIL`

The refresh token should be generated for the same mailbox that sends the mail,
and the OAuth client should only request `gmail.send`.

## Generate A Refresh Token

If the Google OAuth Playground gives you trouble, this repo now includes a
local helper:

```bash
CENTRAL_GMAIL_CLIENT_ID="your-client-id" \
CENTRAL_GMAIL_CLIENT_SECRET="your-client-secret" \
CENTRAL_GMAIL_SENDER_EMAIL="central@crosspointe.tv" \
pnpm run gmail:token
```

If `pnpm` is not installed in your shell, run the script directly with Node:

```bash
CENTRAL_GMAIL_CLIENT_ID="your-client-id" \
CENTRAL_GMAIL_CLIENT_SECRET="your-client-secret" \
CENTRAL_GMAIL_SENDER_EMAIL="central@crosspointe.tv" \
node scripts/get-gmail-refresh-token.mjs
```

The script prints:

- the exact localhost redirect URI to add to your OAuth client
- the Google authorization URL to open in a browser
- the resulting refresh token after Google redirects back locally
