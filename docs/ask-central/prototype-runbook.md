# Wayfinder Prototype Runbook

## Current scope

Wayfinder validates approved knowledge bundles, imports them into draft
Firestore collections, retrieves live public Planning Center context, and
produces grounded Gemini answers. It supports a private admin lab, a staff
alpha, and an invitation-only beta on the normal Central homepage.

It does not:

- Expose Wayfinder to visitors who have not received beta access
- Write to published Wayfinder collections
- Access private Planning Center data

## Knowledge commands

Run these commands from the repository root.

Validate every approved bundle:

```bash
npm run wayfinder:validate
```

Run the retrieval tests:

```bash
npm run wayfinder:test
```

Ask a natural-language test question:

```bash
npm run wayfinder:query -- "Do I have to dress up for church?"
```

This prints the best matching entries, approved facts, links, guardrails, and
whether the question requires a live source such as Planning Center. It does
not contact Firebase or Gemini.

Preview the import without writing anywhere:

```bash
npm run wayfinder:import:dry-run
```

Import into a running local Firestore emulator:

```bash
npm run wayfinder:import:emulator
```

The importer refuses production access unless the operator deliberately runs
the lower-level script with `--allow-production`. An authenticated operator can
reuse an existing Firebase CLI login without creating a service-account key:

```bash
node functions/scripts/import-wayfinder-knowledge.mjs \
  --allow-production \
  --firebase-cli-auth \
  --project=crosspointe-central
```

The command still validates every bundle before writing and never prints the
Firebase CLI refresh token.

## Draft Firestore collections

- `centralAssistantConfigDraft/document-00` contains Wayfinder policy.
- `centralAssistantKnowledgeDraft/{entryId}` contains approved knowledge
  entries in draft publication state.
- `centralAssistantNotices/{noticeId}` contains expiring operational notices.
- `centralAssistantKnowledgeOverrides/{entryId}` contains the current durable
  revision that takes precedence over an imported entry.
- `centralAssistantKnowledgeRevisionHistory/{revisionId}` preserves permanent
  change and reversion history.
- `centralAssistantBetaConfig/settings` stores invited-beta limits and status.
- `centralAssistantBetaInvites/{tokenHash}` stores reusable invitation records.
- `centralAssistantBetaAccess/{sessionHash}` stores anonymous browser Access
  IDs, revocation status, and persistent usage counters.
- `centralAssistantBetaUsage/{centralDate}` stores the shared daily beta count.
- `centralAssistantBetaConversations/{responseId}` stores beta conversations
  until their TTL expiry.

Importing is additive and overwrites only documents with matching IDs. It does
not delete documents that are absent from the local bundles.

## Private diagnostic endpoint

The endpoint is:

```text
POST /api/admin/wayfinder/prototype-query
```

Request body:

```json
{
  "question": "Do I have to dress up for church?"
}
```

The request must include a valid Firebase admin ID token as a Bearer token.
The admin account must be active and have access to Central's Integrations or
Settings area.

The response includes:

- Retrieval confidence
- Matching knowledge entry IDs and titles
- Match scores and terms
- Approved facts, actions, and links
- Prohibited claims or information
- Required live source type, when applicable

The diagnostic response reports retrieval details without generating an answer.

## Wayfinder admin page

The browser-based lab is available at:

```text
/admin/wayfinder
```

It uses the same Firebase sign-in and admin access checks as Central. An active
admin needs Wayfinder Admin permission. The page sends test questions to the
private diagnostic endpoint and displays:

- Retrieval confidence and match scores
- The approved entries selected for the question
- Required and allowed facts
- Approved links and contact actions
- Guardrails and prohibited claims
- Any requirement to use a live source such as Planning Center

The lab can use Gemini to generate a grounded preview, manage expiring notices,
and propose permanent revisions to existing knowledge entries. Enter
`Alohomora` to open a five-minute authenticated update session and
`Colloportus` to close it. Temporary and permanent changes require an explicit
preview approval. Permanent changes are stored as audited overrides so later
JSON imports cannot silently erase them.

If the draft Firestore collection is empty, run the emulator import command
before local testing.

## Invited beta operations

The invited beta is managed under **Central Admin → Wayfinder**. A Wayfinder
Admin can:

- Enable or pause all invited-beta access
- Set the per-Access-ID and shared daily question limits
- Set session and transcript-retention lengths
- Create reusable invitation links with activation and expiration limits
- See anonymous Access IDs and their question/feedback counts
- Revoke one Access ID or an invitation and all sessions created from it
- Browse testers by anonymous Access ID, then open that user's paginated
  retained history, including interactions without explicit feedback

The default limits are 20 browser activations per invitation, 30-day browser
sessions, 25 questions per Access ID per Central calendar day, 250 beta
questions across all testers per day, a 2.5-second burst cooldown, and 30-day
conversation retention. The admin can change all defaults except the short
burst cooldown.

Invitation links use this shape:

```text
https://central.crosspointe.tv/#wayfinder-invite=SECRET_TOKEN
```

Central exchanges the secret invitation token for an opaque browser session,
removes the token from the address bar, and shows the standard homepage
Wayfinder launcher. The invitation and session tokens are stored only as
SHA-256 hashes in Firestore. The raw invitation link is shown once when it is
created; copy it before reloading or leaving the admin page. One invitation can
be shared with a whole cohort, and each browser activation receives a distinct
anonymous Access ID.

Tester questions and feedback notes have email addresses and phone numbers
masked before transcript storage. The chat tells testers that conversations
are retained for up to 30 days and may be reviewed to improve Wayfinder.
Knowledge, unknown-answer, and unavailable-live-source fallbacks use a 2–5
second client-side minimum response window. Fixed policy and safety responses,
Gemini answers, and errors are not artificially delayed.

Firestore TTL uses each conversation's `expiresAt` field. Deploying the
Firestore index configuration enables automatic expiry in the project; TTL
deletion is asynchronous and may occur after the exact expiration time.

For a full local browser test:

1. Restart the Firebase Auth, Functions, Firestore, and Hosting emulators after
   pulling these rewrites.
2. Import the approved Wayfinder bundles into the Firestore emulator.
3. Open `http://127.0.0.1:5005/admin/wayfinder?emulators=1`.
4. Sign in with an active local admin account that has Wayfinder Admin access.
5. Enable Invited Beta and create a short-lived local invitation.
6. Open the link in another browser profile or private window and confirm that
   the normal homepage launcher appears after the token leaves the address bar.
7. Ask a question, reload Central to confirm the session persists, and verify
   the Access ID under Beta Conversations. Open that Access ID and confirm its
   question and answer appear in the retained history.
8. Send `Thank you` and confirm Wayfinder returns its fixed friendly closing
   without calling Gemini.

A code deploy does not publish or refresh Wayfinder knowledge. Run the guarded
knowledge import separately when approved content needs to change.
