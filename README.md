# CrossPointe Central

CrossPointe Central is a Firebase-hosted church hub app with:

- Firebase Hosting for the public app and admin dashboard
- Cloud Functions for the API, approvals, invites, and integrations
- Firestore for published content, admin data, and settings
- Planning Center and YouVersion integrations

## Source Of Truth

This repository is intended to be the source of truth for the project.

- `main` should represent production-ready code
- pushes to `main` can deploy automatically through GitHub Actions
- the live deploy target is `crosspointe-central`

## Project Structure

- `public/`: public site and admin dashboard assets
- `functions/`: Firebase Cloud Functions backend
- `src/`: source for generated frontend assets like the YouVersion reader
- `docs/`: project notes and bootstrap docs

## Backend Data Reference

The canonical Firestore path map, document shapes, and content/admin upsert
flows are documented in:

- `docs/backend-data-schema.md`

First-admin setup and older editor-specific examples remain in:

- `docs/admin-firestore-bootstrap.md`

## Local Development

Install the web dependencies:

```bash
pnpm install
```

Install the Functions dependencies:

```bash
npm ci --prefix functions
```

Start the local emulators:

```bash
pnpm run emulators:full
```

Rebuild the generated YouVersion bundle when needed:

```bash
pnpm run build:youversion
```

Quick syntax check:

```bash
pnpm run check:syntax
```

## Environment Variables

Local Functions environment variables live in:

- `functions/.env.example`
- `functions/.env` for real local values

Do not commit `functions/.env`.

## GitHub Deployment

This repo includes a live-only workflow at:

- `.github/workflows/firebase-deploy.yml`

It deploys on:

- pushes to `main`
- manual `workflow_dispatch`

The workflow expects these GitHub repository secrets:

- `FIREBASE_SERVICE_ACCOUNT_CROSSPOINTE_CENTRAL`
  The full JSON for a Google service account that can deploy Hosting, Functions, and Firestore rules for the `crosspointe-central` Firebase project.
- `FIREBASE_FUNCTIONS_ENV`
  The full multi-line contents of `functions/.env`.

Detailed setup steps live in:

- `docs/github-actions-firebase-setup.md`

## Recommended GitHub Setup

1. Create a GitHub repository, preferably named `crosspointe-central`.
2. Push this local repo to GitHub.
3. Add the two required GitHub Actions secrets.
4. Protect `main` so changes flow through pull requests before deployment.
5. Let merges to `main` trigger the live Firebase deploy automatically.

## Manual Live Deploy

If you ever need to deploy from a local machine:

```bash
pnpm run deploy:live
```
