# Watching on Central

Central displays an estimate of active playback sessions beside the livestream
card's Watch Live heading and a compact version at the top of the mini-player.
The hero Watch Live link is unchanged. Both badges use the same count; unavailable
or failed responses hide them rather than display a fabricated zero.

## Measurement

- A cryptographically random session ID belongs to one player lifecycle, with no
  sign-in, personal information, IP storage, or persistent viewer identifier.
- Only validated Resi iframe playback snapshots activate the session. Clicking
  play optimistically, opening Central, or viewing the card does not activate it.
- Confirmed playback sends a heartbeat every 20 seconds. Confirmed pause, close,
  player teardown, or page exit sends an inactive update. Mini-player transitions
  preserve the session. BFCache restoration requires fresh playback validation.
- Closing a connected mini-player pauses and docks the existing iframe instead
  of reloading it, avoiding Resi's automatic playback restart after reload.
- Sessions expire after 60 seconds without a heartbeat. Counts refresh every
  15 seconds, so departures may take roughly a minute plus a polling interval
  to disappear if the inactive update cannot be delivered.
- Stream keys isolate live/dev environments, normalized configured Resi URL, and
  the local calendar day. The client verifies the server URL against its iframe
  before adopting a count, preventing an old player from counting toward a newly
  configured stream.

This counts streams, not people or households. Multiple tabs/devices can count
separately, and one device may serve several people. It excludes other websites
and platforms. Eligibility follows Central's scheduled or forced Sunday Mode;
the existing Resi bridge cannot distinguish live broadcast from replay or fully
verify buffering. Background mobile playback may undercount if the browser
suspends timers. The public client report remains an operational estimate.

## Backend

`GET /api/livestream-presence` returns availability, the configured `streamUrl`,
opaque `streamKey`, integer `count`, and ISO `updatedAt`.

`POST /api/livestream-presence` accepts only `sessionId`, `streamKey`, `active`,
and a positive increasing `sequence`. Server timestamps determine expiry.
Transactions retain inactive sequence tombstones so delayed or duplicate active
updates cannot resurrect stopped sessions.

Storage is server-only at
`centralLivestreamPresence/{streamKey}/sessions/{sessionId}`. Root documents have
`retireAt`; session documents have `sequence` and numeric `activeUntil`. Existing
default-deny Firestore rules cover these paths. No browser database access or new
composite indexes are required. Counts use a single-field range aggregation on
`activeUntil > now`, independent of cleanup timing.

The HTTP function restricts host/origin, methods, payload size and fields, and
applies bounded per-instance request/session rate limits. Loopback is accepted
only by the emulator. Configuration reads are cached for at most 15 seconds.
These guards limit accidental storms; they do not authenticate viewers or make
the estimate resistant to deliberate fabrication.

`centralLivestreamPresenceCleanup` runs hourly, draining bounded batches from
stream roots retired after 48 hours. It removes subcollection sessions before
their root. Large roots can require several hourly runs.

## Validation and release

Run `npm run test:livestream`, `npm run check:syntax`, and new-module ESLint.
Verify the HTTP route and aggregation in local Firebase emulators, plus actual
Resi playback, pause/resume, close, inline/mini transitions, narrow mobile layout,
and unavailable responses in a rendered browser.

An eventual release must include Hosting plus both functions:
`centralLivestreamPresence` and `centralLivestreamPresenceCleanup`. Deploy the
backend before the new frontend so the endpoint is available when the badges
begin polling. No Resi account API access or plan upgrade is required.
