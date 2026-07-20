# Functions Secrets And Credential Rotation

CrossPointe Central uses two configuration files locally:

- `functions/.env` contains non-sensitive settings such as URLs, IDs, tag
  names, timezones, and feature settings.
- `functions/.secret.local` contains sensitive values used only by the local
  Firebase Functions emulator. It is ignored by Git.

Deployed functions read sensitive values from Google Cloud Secret Manager.
Each deployed function is bound only to the secrets it needs.

This repository currently points both branches at the single
`crosspointe-central` Firebase project. Secret Manager changes and Functions
deployments therefore affect the shared live backend; branch preview channels
do not provide a separate secret store.

## Configuration Inventory

### Secret Manager

- `PCO_APP_ID`
- `PCO_SECRET`
- `CENTRAL_GMAIL_CLIENT_SECRET`
- `CENTRAL_GMAIL_REFRESH_TOKEN`
- `CENTRAL_CALENDAR_SIGNING_KEY`
- `WAYFINDER_GEMINI_API_KEY` (already migrated before this runbook)

### Ordinary Functions settings

- `CENTRAL_GOOGLE_WEB_CLIENT_ID`
- `CENTRAL_GMAIL_CLIENT_ID`
- `CENTRAL_GMAIL_SENDER_EMAIL`
- `CENTRAL_ADMIN_URL`
- `CENTRAL_ADMIN_INVITE_TTL_DAYS`
- Planning Center tag, category, timezone, lookahead, and service settings
- Sunday Mode schedule settings
- `YOUVERSION_APP_KEY` and `YOUVERSION_DEFAULT_BIBLE_ID`
- `WAYFINDER_GEMINI_MODEL`

The YouVersion JavaScript SDK runs in the browser and requires its app key
there. `YOUVERSION_APP_KEY` is therefore browser-visible by design and is not a
server secret. Secret Manager cannot hide a value that the browser must receive.

### Retired

- `CENTRAL_APPS_SCRIPT_URL`
- `CENTRAL_API_KEY`

Neither retired name is referenced by the current application, deployment
workflow, documentation, or tracked Git history. Remove both from local and
GitHub environment configuration.

## Local Setup For Every Developer

1. Copy `functions/.env.example` to `functions/.env` and fill in only the
   non-sensitive settings.
2. Copy `functions/.secret.local.example` to `functions/.secret.local`.
3. Create a separate Planning Center Personal Access Token under your own
   Planning Center developer account. Do not share the deployed app's token.
4. Put that local token's client ID in `PCO_APP_ID` and secret in `PCO_SECRET`
   inside `functions/.secret.local`.
5. Add other local secrets only when the feature under test needs them.
6. Start the Functions emulator normally. Firebase automatically loads
   `.secret.local` as the local override for Secret Manager values.

To run the focused Planning Center check:

```bash
npm --prefix functions run wayfinder:pco-check
```

Local credentials still call the real Planning Center organization and have
the permissions of the Planning Center user who created them. Use the least
privileged account practical, and never put real values in a commit, issue,
chat, screenshot, or shared `.env` file.

## Initial Migration And Rotation Order

Perform the migration as a controlled cutover. Do not revoke a working
credential until the replacement has been deployed and verified.

### 1. Create the calendar signing key

From the repository root, generate and store a new random value without putting
it in shell history:

```bash
openssl rand -base64 32 | ./node_modules/.bin/firebase functions:secrets:set CENTRAL_CALENDAR_SIGNING_KEY --data-file=- --project crosspointe-central
```

Generate a separate random value for `functions/.secret.local`; local calendar
links do not need to match production.

### 2. Replace the Planning Center token

1. In the Planning Center developer account for the production integration,
   create a new Personal Access Token.
2. Store its client ID and secret interactively:

```bash
./node_modules/.bin/firebase functions:secrets:set PCO_APP_ID --project crosspointe-central
./node_modules/.bin/firebase functions:secrets:set PCO_SECRET --project crosspointe-central
```

3. Deploy the functions bound to Planning Center plus both calendar-signing
   consumers:

```bash
./node_modules/.bin/firebase deploy --project crosspointe-central --only functions:centralData,functions:centralCalendarEvent,functions:wayfinderFeaturedEventHealth,functions:wayfinderEvaluations,functions:wayfinderGenerateAnswer,functions:wayfinderPublicAnswer
```

4. Verify Central events, registrations, Featured Events, setlists, calendar
   links, and Wayfinder live context.
5. Delete the old Personal Access Token in Planning Center only after those
   checks pass.

### 3. Replace Gmail credentials

1. In Google Cloud Console, create a new client secret for Central's existing
   OAuth client.
2. Run `pnpm run gmail:token` (or the documented Node fallback) and authorize
   only `gmail.send` as `central@crosspointe.tv` to receive a new refresh token.
3. Store the replacements interactively:

```bash
./node_modules/.bin/firebase functions:secrets:set CENTRAL_GMAIL_CLIENT_SECRET --project crosspointe-central
./node_modules/.bin/firebase functions:secrets:set CENTRAL_GMAIL_REFRESH_TOKEN --project crosspointe-central
```

4. Deploy the Gmail-bound functions:

```bash
./node_modules/.bin/firebase deploy --project crosspointe-central --only functions:upsertAdminUser,functions:shareServeNeedInterest
```

5. Verify one admin invitation and one Serve Needs notification.
6. Revoke the old refresh token and delete the old OAuth client secret only
   after both mail paths pass.

### 4. Remove old copies

After the deployed functions are verified:

- Remove all migrated secrets plus the two retired Google Sheet settings from
  `functions/.env`.
- Update `FIREBASE_FUNCTIONS_ENV` and `FIREBASE_FUNCTIONS_ENV_DEV` in GitHub so
  they contain only the non-sensitive settings from `functions/.env`.
- Remove old one-time-secret links, notes, downloads, and messages containing
  credentials where possible.
- Keep only the current local developer credentials in `.secret.local`.

## Verification

Before revoking any old value, verify:

- `/api/central-data` returns current Planning Center data and does not include
  any PCO or Gmail credential.
- `/api/calendar-event.ics` accepts newly generated calendar links.
- the admin invitation email path sends successfully;
- the Serve Needs interest email path sends successfully; and
- Wayfinder answers and Featured Event health can retrieve Planning Center
  context.

Changing `CENTRAL_CALENDAR_SIGNING_KEY` invalidates calendar links generated
with the old key. Existing links can be regenerated from Central after cutover.
