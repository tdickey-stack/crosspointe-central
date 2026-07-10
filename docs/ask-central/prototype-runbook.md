# Wayfinder Prototype Runbook

## Current scope

The first Wayfinder prototype is retrieval-only. It validates the approved
knowledge bundles, imports them into draft Firestore collections, and ranks
the entries that best match an admin's test question.

It does not:

- Call Gemini
- Generate a public-facing answer
- Expose a public chat interface
- Write to published Wayfinder collections
- Delete Firestore documents
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
the lower-level script with `--allow-production`. Production imports should
not be enabled until the draft review and publishing workflow is designed.

## Draft Firestore collections

- `centralAssistantConfigDraft/document-00` contains Wayfinder policy.
- `centralAssistantKnowledgeDraft/{entryId}` contains approved knowledge
  entries in draft publication state.

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

The response explicitly states that no Gemini answer was generated.

## Private Wayfinder Lab page

The browser-based lab is available at:

```text
/admin/wayfinder
```

It uses the same Firebase sign-in and admin access checks as Central. An active
admin needs access to the Integrations area. The page sends the test question
to the private diagnostic endpoint and displays:

- Retrieval confidence and match scores
- The approved entries selected for the question
- Required and allowed facts
- Approved links and contact actions
- Guardrails and prohibited claims
- Any requirement to use a live source such as Planning Center

The lab does not call Gemini or generate a guest-facing answer. If the draft
Firestore collection is empty, run the emulator import command before local
testing.

For a full local browser test:

1. Start the Firebase Auth, Functions, Firestore, and Hosting emulators.
2. Import the approved Wayfinder bundles into the Firestore emulator.
3. Open `http://127.0.0.1:5000/admin/wayfinder`.
4. Sign in with an active local admin account that has Integrations access.
5. Ask the same idea with different wording and compare the selected entries.

## Next prototype milestone

After the retrieval results have been evaluated, the next milestone is a
server-side Gemini call that receives only the selected approved entries. The
model response must use a structured schema and pass source, URL, and safety
validation before it can be returned to a user.
