# Central Studio backend

Central Studio has an isolated Firebase Functions codebase in
`studio-functions/`. It does not import or modify the existing
`functions/index.js`.

## Unsplash access key

Unsplash's public client ID is the API **Access Key**. The Secret Key is not
needed for photo search.

For local emulator work:

1. Copy `studio-functions/.secret.local.example` to
   `studio-functions/.secret.local`.
2. Replace the placeholder with the Unsplash Access Key.
3. Keep `.secret.local` uncommitted.

For a Firebase environment, store the same Access Key in Secret Manager:

```sh
firebase functions:secrets:set UNSPLASH_ACCESS_KEY \
  --project crosspointe-central
```

The key is bound only to the two Unsplash functions. It is never included in
the browser bundle or returned by the API.

## Local development

Install both Functions workspaces, build Studio, and run the full Emulator
Suite:

```sh
npm ci --prefix functions
npm ci --prefix studio-functions
pnpm install
pnpm run build:studio
pnpm run emulators:full
```

Open `http://127.0.0.1:5005/studio`. The `?preview=1` bypass is useful for
local review. It can search Unsplash through the Functions emulator when the
local Access Key is configured, but it intentionally cannot save to Firestore,
upload files to Storage, or share projects.

Document projects use one Firestore project record plus an ordered `pages`
subcollection. Saves batch the root and its page changes together. Deleting a
document through the isolated Studio backend also deletes those page records;
event graphic deletion remains a single-record operation.

## Deployment boundary

Deploy only the isolated Studio backend:

```sh
firebase deploy --project crosspointe-central --only functions:studio
```

A normal full release deploy includes both Functions codebases, Hosting,
Firestore rules, and Storage rules. Do not deploy Studio Functions before the
`UNSPLASH_ACCESS_KEY` secret exists and the rules have been reviewed.
