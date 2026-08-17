# Planning Center form requests for Promotion Planner

## Scope

Central receives new Planning Center People form submissions and creates a
review request at `/planner`. It does not backfill historical submissions and
does not create a campaign until a Planner editor reviews the request.

Supported forms:

- Event/Promo: Planning Center form `930568`. The request is accepted only when
  field `7301964` selects Yes option `7963996` and field `7452308` selects Yes
  option `8136339`.
- General Promotion: Planning Center form `1229879`. Every new submission is
  accepted and its event date always requires manual review.

The Event/Promo free-text date is preserved. Central fills the primary date
only when its conservative parser can understand the answer; otherwise the
request is marked for manual date review. The original answer remains visible.

## Data boundary

The webhook fetches the canonical `FormSubmission` and its
`FormSubmissionValue` answers from the People API. It stores only campaign
planning answers: form/submission identity, submitted time, proposed name,
ministry, description/notes, requested platforms and promotion window, and
date-review metadata. It does not store the PCO Person resource, email, phone,
address, submitter name, or raw webhook body.

Requests use deterministic documents:

```text
centralPromotionRequests/pco_{formId}_{submissionId}
```

Webhook redelivery therefore cannot create a duplicate request. Converted
campaigns also use a deterministic ID derived from the request, making a
conversion retry safe.

## Planning Center webhook

Create one subscription in Planning Center's Webhooks dashboard:

```text
https://api.planningcenteronline.com/webhooks
```

Choose the People event for a newly created Form Submission. Do not subscribe
this endpoint to Form Submission update events. The handler also rejects
non-created delivery types and ignores all form IDs except the two above.

Use this production callback URL:

```text
https://central.crosspointe.tv/api/webhooks/planning-center/forms
```

Create the subscription under a named, least-privileged Planning Center user
that can view both forms. Webhook deliveries inherit that user's visibility.

Planning Center displays an authenticity secret for the subscription. Store it
as the Firebase Functions secret `PCO_WEBHOOK_AUTHENTICITY_SECRET`; never put it
in `.env`, source control, or a browser bundle.

```bash
npx -y firebase-tools@latest functions:secrets:set \
  PCO_WEBHOOK_AUTHENTICITY_SECRET --project crosspointe-central
```

The function also binds the existing `PCO_APP_ID` and `PCO_SECRET` values so it
can fetch the canonical submission. Local emulator values belong in ignored
`functions/.secret.local`.

Deploy the function, Hosting rewrite, and Firestore rules before sending a test
delivery. If Planning Center requires the subscription to exist before it
reveals its authenticity secret, first deploy with a temporary random secret,
then replace it with the displayed secret and redeploy the webhook function
before testing or enabling the subscription.

## Processing behavior

1. Require POST and verify `X-PCO-Webhooks-Authenticity` against the exact raw
   body using HMAC-SHA256 and constant-time comparison.
2. Accept only Form Submission created deliveries for the two supported forms.
3. Fetch the canonical submission plus submission values from the People API.
4. Apply the stable option-ID eligibility checks.
5. Normalize only campaign-planning answers and conservatively parse the Event
   form's free-text date.
6. Create the deterministic request document if it does not already exist.
7. Return 200 for ignored or duplicate deliveries. Return 503 with
   `Retry-After` for temporary upstream failures so Planning Center can retry.

## Planner review

Planner viewers can see requests. Planner editors can change only review-owned
fields, including the proposed name and reviewed event date, then either:

- create the campaign with a selected level/playbook; or
- dismiss the request.

Campaign conversion is one atomic Firestore batch: the campaign, its Scheduled
Plays, and the request's converted state either all commit or none commit. The
converted request must link to the matching deterministic campaign source.
Converted and dismissed requests are then immutable.

Source form identity, submission identity, original answers, eligibility, and
submission/creation timestamps remain immutable in browser security rules.
