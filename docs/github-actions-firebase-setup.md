# GitHub To Firebase Auto-Deploy Setup

This project already includes a live deploy workflow at:

- `.github/workflows/firebase-deploy.yml`

It deploys when:

- you push to `main`
- you manually run the workflow from the GitHub Actions tab

## What You Need

Before this will work, GitHub must have two repository secrets:

- `FIREBASE_SERVICE_ACCOUNT_CROSSPOINTE_CENTRAL`
- `FIREBASE_FUNCTIONS_ENV`

## Secret 1: Firebase Service Account JSON

This is the full JSON key for a Google Cloud service account that can deploy the Firebase project.

### Create The Service Account

1. Open the Google Cloud Service Accounts page for the project:
   - `https://console.cloud.google.com/iam-admin/serviceaccounts?project=crosspointe-central`
2. Click `Create service account`.
3. Name it something clear like:
   - `github-actions-deploy`
4. Click `Create and continue`.
5. Grant it a role.

For the first pass, the most reliable option is:

- `Editor`

This is broader than ideal, but it is the fastest way to get the existing workflow working for Hosting, Functions, and Firestore deploys together. After everything is stable, you can tighten the permissions later.

6. Click `Continue`.
7. Skip the optional user access step unless you specifically need it.
8. Click `Done`.

### Create The JSON Key

1. Click the new service account email address.
2. Open the `Keys` tab.
3. Click `Add key`.
4. Click `Create new key`.
5. Choose `JSON`.
6. Click `Create`.
7. A JSON file will download to your machine.

Treat that file like a password. Do not commit it to Git. Do not paste it into chat.

## Secret 2: Non-Sensitive Functions Environment File

This is the exact full content of your local `functions/.env` file.

The workflow writes that secret back into `functions/.env` during deployment.
Sensitive server credentials must not be included in this file. They are stored
in Google Cloud Secret Manager and bound to only the functions that use them.

The expected keys are shown in:

- `functions/.env.example`

At the time of writing, those keys are:

- `CENTRAL_GOOGLE_WEB_CLIENT_ID`
- `CENTRAL_GMAIL_CLIENT_ID`
- `CENTRAL_GMAIL_SENDER_EMAIL`
- `CENTRAL_ADMIN_URL`
- `CENTRAL_ADMIN_INVITE_TTL_DAYS`
- `PCO_TIMEZONE`
- `PCO_CENTRAL_TAG_NAME`
- `PCO_CENTRAL_FEATURED_TAG_NAME`
- `PCO_CENTRAL_REGISTRATION_CATEGORY_NAME`
- `PCO_WAYFINDER_PRIORITY_TAG_NAME`
- `PCO_CALENDAR_LOOKAHEAD_DAYS`
- `PCO_REQUEST_MIN_INTERVAL_MS`
- `PCO_SERVICE_TYPES`
- `SUNDAY_MODE_START_HOUR`
- `SUNDAY_MODE_END_HOUR`
- `SUNDAY_SERVICE_DURATION_MINUTES`
- `YOUVERSION_APP_KEY`
- `YOUVERSION_DEFAULT_BIBLE_ID`

Important:

- Use the real local `functions/.env`, not the example file by itself.
- Paste the full file contents into the GitHub secret exactly as multi-line text.
- Do not include `PCO_APP_ID`, `PCO_SECRET`, Gmail client secrets, refresh
  tokens, or any other server credential.
- Follow `docs/functions-secrets.md` to create and rotate deployed secrets.

## Add The Secrets To GitHub

Open the repository Actions secrets page:

- `https://github.com/tdickey-stack/crosspointe-central/settings/secrets/actions`

Then add these two repository secrets.

### Add `FIREBASE_SERVICE_ACCOUNT_CROSSPOINTE_CENTRAL`

1. Click `New repository secret`.
2. Name: `FIREBASE_SERVICE_ACCOUNT_CROSSPOINTE_CENTRAL`
3. Value: paste the entire downloaded JSON file contents.
4. Click `Add secret`.

### Add `FIREBASE_FUNCTIONS_ENV`

1. Click `New repository secret`.
2. Name: `FIREBASE_FUNCTIONS_ENV`
3. Value: paste the exact full contents of `functions/.env`.
4. Click `Add secret`.

## Test The Workflow

Once both secrets are added, you can test the deploy in one of two ways.

### Option A: Run It Manually

1. Open:
   - `https://github.com/tdickey-stack/crosspointe-central/actions`
2. Click `Deploy Firebase`.
3. Click `Run workflow`.
4. Leave the branch on `main`.
5. Click the green `Run workflow` button.

### Option B: Push A Small Commit

Any push to `main` will trigger the workflow.

For example:

```bash
git commit --allow-empty -m "Test GitHub Actions deploy"
git push
```

## What Success Looks Like

The workflow should complete these steps successfully:

- `Write Functions environment file`
- `Authenticate to Google Cloud`
- `Deploy live Firebase project`

## If It Fails

### Failure: missing secret

Usually means one of these does not exist in GitHub or is misspelled:

- `FIREBASE_SERVICE_ACCOUNT_CROSSPOINTE_CENTRAL`
- `FIREBASE_FUNCTIONS_ENV`

### Failure: invalid JSON or auth error

Usually means the service account JSON was pasted incorrectly, or the downloaded key does not match the intended Firebase project.

### Failure: permission denied during deploy

Usually means the service account role is too limited. If you tried to use a narrower role set, temporarily switch to `Editor` to confirm the workflow path works end to end.

### Failure: functions config or runtime error

Usually means `FIREBASE_FUNCTIONS_ENV` is missing a required key or contains a typo.

## Security Cleanup After It Works

Once deploys are working:

1. Keep the JSON key stored securely.
2. Delete unused older keys from the service account.
3. Consider tightening the service account permissions later.
4. Rotate the key if you think it was exposed.

## Useful Links

- Firebase CLI CI authentication:
  - `https://firebase.google.com/docs/cli#use_the_cli_with_ci_systems`
- GitHub repository secrets:
  - `https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets`
- Google Cloud service account keys:
  - `https://cloud.google.com/iam/docs/keys-create-delete`
- GitHub Action used by this repo:
  - `https://github.com/google-github-actions/auth`
