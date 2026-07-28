# Central Studio image-generation prototype

This local-only spike answers one question from issue #7: can Central's existing
server-side Gemini integration produce a usable, brand-directed supporting
image for a deterministic Studio template?

It is deliberately not a public Studio feature. It does not add a Hosting
route, Cloud Function, Firestore document, Storage object, permission, approval
workflow, or deployment.

## What it proves

- The existing `@google/genai` dependency can call the current Gemini image
  model without adding Genkit or another SDK.
- A structured Studio request can combine a creative concept, desired feeling,
  communication posture, subject placement, aspect ratio, and resolution.
- CrossPointe's preliminary voice, personas, visual direction, typography,
  palette, photography rules, and controlled-element exclusions can be
  inserted on the server for every request.
- The response can be decoded into a real JPEG while retaining model, prompt
  hash, brand-profile version, input, interaction, latency, and output metadata.

The versioned profile in `functions/studio/knowledge-base.js` is normalized
from the authoritative Google Drive sources:

- CP-CM-1.3 CrossPointe Brand & Identity Guidelines
- CP-CM-1.4 Brand Voice & Audience Personas

Its source file IDs, modification timestamps, and CP-CM-1.4 effective date are
recorded with the profile. It remains a prototype extract: production needs a
repeatable source-review/versioning process so a Drive edit cannot silently
change generation behavior.

## Run it

The command reads ignored local settings from `functions/.env` and
`functions/.secret.local`. It accepts `STUDIO_GEMINI_API_KEY` and temporarily
falls back to the existing `WAYFINDER_GEMINI_API_KEY` for this developer spike.
Production Studio should have an independently managed secret and budget.

```bash
npm --prefix functions run studio:image
```

Use the normal creative-director mode with a short request:

```bash
npm --prefix functions run studio:image -- \
  --request="Inviting Sunday backdrop, abstract and flowy." \
  --persona="caring_carly" \
  --visual="abstract" \
  --gender="unspecified" \
  --aspect="4:5"
```

Studio first uses the text model to create a schema-validated creative brief
from the knowledge profile, persona, visual approach, and short staff request.
The Terminal prints that brief for inspection, and the JSON metadata retains it.
Nano Banana 2 then generates the image from the same brief.

Use the expert `--concept` override only for precise prompt experiments:

```bash
npm --prefix functions run studio:image -- \
  --concept="A candid community meal with natural human connection." \
  --feeling="warm, grounded, and welcoming" \
  --persona="happy_henry" \
  --visual="scenery" \
  --gender="unspecified" \
  --placement="right" \
  --aspect="16:9" \
  --size="1K"
```

`--request` and `--concept` cannot be used together.

Allowed prototype output options:

- aspect: `1:1`, `4:5`, or `16:9`
- size: `1K` or `2K`
- placement: `left`, `center`, or `right`
- persona: `universal`, `new_nancy`, `caring_carly`, `boomer_bill`,
  `sooner_sam`, or `happy_henry`
- visual approach: `auto`, `people`, `scenery`, `abstract`, or `objects`
- target-audience gender: `unspecified`, `male`, `female`, or `mixed`

Images and JSON metadata are written to ignored `output/studio/`. The same
persona manifest exposes labels and descriptions suitable for a future Studio
dropdown while the server retains the authoritative persona-to-guidance map.

To polish an accepted generation with Nano Banana Pro while preserving its
composition and saved creative context:

```bash
npm --prefix functions run studio:refine -- \
  --source="output/studio/studio-example.jpg" \
  --size=1K
```

This performs an image-to-image photorealism refinement using
`gemini-3-pro-image`. It writes a new image and lineage metadata without
overwriting the source.

To regenerate an accepted saved creative brief from scratch with another image
model:

```bash
npm --prefix functions run studio:image -- \
  --from-metadata="output/studio/studio-example.json" \
  --model="gemini-3-pro-image"
```

This reuses the exact saved concept, feeling, persona, target audience, visual
approach, composition, exclusions, aspect ratio, and image size. It does not
rerun the creative-director model or use the previous image as input.

Persona names are mnemonic communication tools, not audience demographics.
Selecting Caring Carly, for example, selects a clear, compassionate, stable,
and practical communication posture. It never means "female," "over 40," or a
literal Carly should appear in the image. The server prompt strips demographic
details from persona application and explicitly prevents demographic inference.
They also do not prescribe a facial expression or visible emotional state.
Happy Henry represents comfortable self-sufficiency that needs gentle,
relevance-led challenge; Caring Carly represents someone who regularly carries
others' needs and may need clarity, relief, and support.

`--gender` is an optional target-audience control. It tells Studio who the
communication should resonate with, but it never changes the meaning of the
selected persona or requires that audience to appear in the image. It continues
to guide the creative strategy for scenery, abstract, and object-led imagery.
Studio should use the event request and persona to interpret that context
without defaulting to gender stereotypes about hobbies, colors, occupations,
interests, or emotional range.

When people do appear, imagery is still composed as a relationship-neutral peer
group and avoids romantic cues, intimate touch, isolated pairs, matched couple
posing, and symmetrical two-by-two seating. Audience gender does not dictate
the gender of the visible cast.

Audience posture and visual subject are separate controls. A selected persona
can guide people-led photography, scenery, abstract atmospheric imagery, or an
object-led still life. `scenery`, `abstract`, and `objects` explicitly prohibit
people. `auto` lets Studio choose without preferring people by default.

## Before this becomes a user-facing feature

The next implementation boundary should be an authenticated, server-controlled
endpoint with explicit Studio authorization, App Check, quotas/budgets, a kill
switch, moderation, backend-mediated Storage, and audit logging. The canonical
brand profile and a deterministic template should be approved before evaluating
whether generated imagery is acceptably "CrossPointe."

A brand-aware text generator fits the same server-side profile and posture
layer. It should return a schema-validated creative brief and controlled copy
fields; it should not generate authoritative event facts or final layout.
