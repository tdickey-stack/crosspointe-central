# Admin Invite Workflow

Central Admin can now invite a person by email before that person has ever
signed in.

## How It Works

1. In `Settings -> Admin Users`, enter the person's email address.
2. Choose the page permissions they should receive.
3. Click `Send Invite`.
4. Central writes a pending invite document to:
   `centralAdmin/root/invites/{inviteId}`
5. Central sends the invite email directly through the Gmail API from
   `central@crosspointe.tv`.
6. The recipient opens the link, signs in with that same Google account, and
   the invite is claimed.
7. On claim, Central creates or updates the actual admin user document at:
   `centralAdmin/root/users/{uid}`

## Invite Link

Invite links point to the admin dashboard with two query parameters:

- `invite`
- `token`

The dashboard reads those values after sign-in and calls the
`/api/admin/claim-invite` endpoint to finish the claim.

## Important Behavior

- Pending invites are listed alongside existing admin users in the Admin Users
  panel.
- Editing a pending invite resends the email with the latest permissions.
- If someone later gets added directly as an admin user, any pending invite for
  that same email is automatically marked as superseded so it no longer clutters
  the queue.
- Only approved admin emails can be invited right now. That means
  `@crosspointe.tv` addresses plus any explicit tester emails in the allowlist.

## Optional Function Config

- `CENTRAL_ADMIN_URL`
  Use this if invite emails should always point to a specific admin URL instead
  of the request origin.
- `CENTRAL_ADMIN_INVITE_TTL_DAYS`
  Controls how long invite links stay valid. Default is `14`.

## Shared Email Styling

The admin invite email and Serve Needs notification email both use the same
shared Central HTML email template, so brand changes can be made in one place
inside `functions/index.js`.
