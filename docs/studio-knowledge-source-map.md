# Central Studio knowledge source map

The prototype knowledge profile is a normalized, version-controlled extract of
the two authoritative Creative Ministry documents in Google Drive. Studio sends
the normalized rules with every server-side generation request; it does not let
the browser choose or rewrite the underlying guidance.

## CP-CM-1.3 CrossPointe Brand & Identity Guidelines

- Drive file ID: `1wIWv_YE8DdaqHMQcWqqUg8AoUDTZ6KEd`
- Source type: PDF
- Source modified: 2026-01-29T04:43:23.754Z
- Prototype extraction scope:
  - approved logo treatments and clear space;
  - prohibited logo changes;
  - Montserrat roles for logo, headings, body, and limited print use;
  - primary palette: `#EF3E2D`, `#27272A`, `#33BECC`, `#FFFFFF`;
  - secondary palette: `#64242E`, `#FAC8C3`, `#4BC3A7`, `#4BB8E9`,
    `#5558A6`.

The image model receives these as compatibility context only. The deterministic
template remains responsible for exact logos, typography, and colors.

## CP-CM-1.4 Brand Voice & Audience Personas

- Drive file ID: `1WG1GDTx0Tuf6iKbgp4_K7b-OD-i_m4LGgOFp2HzCGV4`
- Source type: Google Doc
- Source modified: 2026-06-26T15:17:08.313Z
- Effective date shown in the document: 2026-07-25
- Prototype extraction scope:
  - five audience personas and their communication postures;
  - loving, stable, authentic, engaging, and inspiring voice axioms;
  - not exclusive, not overwhelming, and not stale guardrails;
  - start with a persona, match depth, avoid caricature, and adjust delivery
    rather than doctrine;
  - pre-publish audience, obstacle, voice, and mission checks.

The profile stores audience context, communication guidance, and a bounded
translation to imagery. Persona names are mnemonic labels for communication
postures, not gender-, age-, or identity-specific audience segments. Selecting
Caring Carly does not mean communicating only to women or depicting a woman.
It selects clarity, compassion, practical stability, and reduced complexity.
The same posture may apply to anyone. Persona selection never authorizes
demographic inference or caricature; the creative concept governs who or what
appears in the image.

Persona and subject matter are independent. The same communication posture can
guide candid people photography, scenery, abstract imagery, or an object-led
still life. Selecting a persona never requires a person to appear.

## Studio application clarifications

The product owner supplied these implementation clarifications for the
normalized prototype:

- A persona's memorable name must not dictate a facial expression, demeanor,
  visible emotion, gender, or subject.
- Happy Henry describes someone generally content with life who may wonder why
  God, faith, or church is relevant. The posture uses gentle challenge rather
  than defaulting to laughter or visible happiness.
- Caring Carly describes someone who regularly carries other people's needs
  while neglecting their own. The posture offers clarity, relief, and support
  without defaulting to a smiling caregiver or a visibly frustrated person.
- An optional target-audience gender control is separate from the persona and
  visual subject. It guides creative relevance for every visual approach,
  including scenery, without requiring people or dictating cast gender.
- Target-audience gender must not become shorthand for stereotyped hobbies,
  colors, occupations, interests, emotional range, or personality.
- When people appear, Studio uses relationship-neutral peer-group composition
  and avoids romantic cues, intimate touch, isolated pairs, matched-couple
  posing, and symmetrical two-by-two seating.

## Prototype versioning rule

The current normalized profile version is `0.5.0-drive-sourced`. A reviewed
change to either source should create a new immutable Studio profile version
before it affects new generations. Existing generations retain the profile
version in their metadata.
