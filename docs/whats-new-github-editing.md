# What's New GitHub Editing

The primary GitHub-editable file for both "What's New" modals is:

- `public/content/whats-new.json`

Both the public app and the admin app now check that file first. If a section is
not enabled there, the apps fall back to the existing Firestore document.

## Public section

```json
{
  "public": {
    "enabled": true,
    "active": true,
    "force_show": false,
    "version": "2026.07.09",
    "title": "What's New In Central",
    "message": "## New this week\n\n- Updated homepage modules\n- Better Sunday notes flow",
    "button_text": "Sounds Good"
  }
}
```

## Admin section

```json
{
  "admin": {
    "enabled": true,
    "active": true,
    "force_show": false,
    "version": "2026.07.09",
    "title": "What's New In Central Admin",
    "message": "## Dashboard update\n\n- Added a cleaner release note workflow",
    "button_text": "Sounds Good"
  }
}
```

## How to use it

1. Edit `public/content/whats-new.json` in GitHub.
2. Set `enabled` to `true` for the section you want GitHub to control.
3. Commit the change.
4. Deploy Hosting.

Notes:

- `enabled: false` means "keep using Firestore for this section."
- `active: false` means "the GitHub file is in control, but do not show the modal."
- `message` supports the same lightweight Markdown rendering already used by the
  app.
- A Hosting deploy is enough because the file is served from `public/`.
