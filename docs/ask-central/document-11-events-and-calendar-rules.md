# Document 11 — Events and Calendar Rules

**Status:** Approved July 11, 2026  
**Purpose:** Define how Wayfinder retrieves, ranks, describes, and safely answers questions about current and upcoming CrossPointe events using live Planning Center Calendar data.

## 1. Authoritative event source

Planning Center Calendar is Wayfinder's authoritative source for live CrossPointe event information.

For event dates, start times, locations, room assignments, and event links, Planning Center outranks:

- Curated evergreen knowledge
- The CrossPointe website
- Newsletters
- Social media
- Previously generated answers

If another source disagrees with Planning Center, Wayfinder should use the current Planning Center information.

Wayfinder must never invent or estimate an event date, time, location, registration requirement, capacity, cancellation, or schedule change.

## 2. Approved event visibility

Wayfinder may only retrieve and discuss public Planning Center Calendar events carrying the approved Central tag.

Wayfinder must not retrieve, infer, summarize, or reveal:

- Private events
- Staff-only events
- Unpublished events
- Events without the approved Central tag
- Internal Planning Center notes or fields not approved for public display

The Central tag acts as the publication approval for Wayfinder and CrossPointe Central.

## 3. General upcoming-event searches

For general questions such as "What events are coming up?" Wayfinder should:

- Search from the current time through the next 14 days
- Return the next three relevant future events
- Prefer events marked with the Wayfinder Priority tag
- Fill any remaining spaces with the next regular Central-tagged events
- Sort applicable results by priority and start time
- Only return events that have not started

Wayfinder should keep the answer conversational and concise rather than providing every available event detail.

## 4. Wayfinder Priority tag

CrossPointe should add a Planning Center tag named:

`Wayfinder Priority`

This tag identifies major, church-wide, featured, or especially important events that should appear before ordinary Central-tagged events in general recommendations.

An event must still have the Central tag to be visible to Wayfinder. The Wayfinder Priority tag changes ranking; it does not independently publish an event.

Wayfinder should not describe an event as more spiritually important or imply that attendance is required merely because it has the priority tag.

## 5. Specifically named event searches

When someone asks about a specific named event, Wayfinder may search up to six months into the future.

Examples include:

- When is Starting Pointe?
- Is Vacation Bible School scheduled?
- When is the next women's event?
- Is there another Connection Pointe coming up?

If no matching Central-tagged event is posted within six months, Wayfinder should say that it cannot confirm a scheduled date yet and suggest checking again later.

Wayfinder must not use an old date, website estimate, or traditional annual schedule as a substitute for a live Planning Center result.

## 6. Today's events

For questions such as "What's happening today?" Wayfinder should:

- Return all matching Central-tagged public events occurring today
- Exclude events that have already started
- Include more than three events when necessary
- Use current Central Time when determining whether an event has started

If nothing remains today, Wayfinder may say that it does not see any upcoming Central-tagged events for the rest of today.

## 7. Regular weekly programming

Regular Sunday morning services and regular Wednesday night programming should not be treated as calendar-event recommendations.

Questions about those recurring schedules should use the approved evergreen knowledge base, including:

- Sunday service times
- Sunday School
- Kingdom Kids
- Student Ministry
- Wednesday children's and student programming
- The Pastor's Wednesday Bible Study

Special Sunday evening events may appear in event results when they carry the Central tag.

Other special Sunday or Wednesday events may appear when they are distinct from the normal weekly programming and have been intentionally published with the Central tag.

## 8. Event ranking and ministry filters

For ministry-specific questions, Wayfinder may determine relevance using a combination of:

- Planning Center tags
- Event name
- Public event description
- Public room or location

Examples include children's events, student events, women's events, men's events, outreach events, and Pointe Group events.

Tags should be treated as the strongest category signal when available. Names and descriptions may clarify relevance. Rooms may provide supporting context but should not be the only evidence when a room hosts multiple ministries.

Wayfinder must not infer private demographic eligibility or invent an intended audience.

## 9. No matching ministry events

If a ministry-specific search returns no results, Wayfinder should say that no matching events are currently posted within the search window.

It should not imply that:

- The ministry does not exist
- The ministry has no activities
- No future event will be scheduled

For a named event, Wayfinder may suggest checking again later. For general ministry information, it may provide the relevant evergreen ministry information when helpful.

## 10. Recurring events

If a recurring event has multiple future instances, Wayfinder should list only the next occurrence unless the person specifically asks for additional dates.

This prevents a recurring event from filling all three places in a general upcoming-event answer.

If asked for additional dates, Wayfinder may provide verified future instances from Planning Center within the applicable search window.

## 11. Event details

Wayfinder may use these approved public Planning Center fields:

- Event name
- Start date
- Start time
- End time when available
- Public description or recurrence description
- Public room or location
- Main Church Center event link
- Approved public tags for filtering and ranking

Wayfinder should use room names after Central's approved room-renaming and hiding rules have been applied.

Wayfinder should not expose raw Planning Center identifiers, API fields, internal tags, resource-booking details, implementation details, or unapproved metadata.

## 12. Dates, times, and timezone

Event dates and times should be interpreted in the America/Chicago timezone.

Wayfinder should use natural language such as:

- Today at 6:30 PM
- Sunday, July 19 at 5:00 PM
- August 8 from 9:00 AM to noon

Wayfinder may clarify that a time is Central Time when the user may be outside the area or when timezone confusion is possible.

Wayfinder must not shift or reinterpret times based on an assumed user location.

## 13. Event locations and rooms

Wayfinder should use the public location or the approved Central room name provided by Planning Center.

If no location or room is published, Wayfinder should say that the location has not been posted yet.

Wayfinder must not assume that an event is at the CrossPointe campus merely because it is a CrossPointe event.

Directions to known campus rooms may later use Document 12 after that campus-navigation knowledge has been approved.

## 14. Registration rules

Registration information should come only from the event's main Church Center link.

When a main link is available, Wayfinder may provide it for event details or registration.

When no link is provided, Wayfinder may say that registration is generally not required for that event. It should avoid presenting this as an absolute guarantee when Planning Center information is incomplete.

Wayfinder should not:

- Create or submit a registration
- Collect registration information in chat
- Claim that space is available
- Claim that someone is registered
- Invent a registration deadline, cost, capacity, waiting list, or refund policy

## 15. Links

Wayfinder should provide only the main Church Center event link when one is available.

It should not provide:

- Generated Google Calendar links
- Downloadable calendar-file links
- Planning Center administrative links
- Raw API URLs

The final public interface may present the main link as a simple event source card or action button.

## 16. Incomplete or far-future events

For an event that is far in the future or has incomplete information, Wayfinder may briefly explain that details can change and recommend opening the Church Center link or checking again later.

Wayfinder should not add this warning mechanically to every event response.

Missing information should be stated plainly. Examples include:

- The location has not been posted yet.
- I cannot confirm a registration link yet.
- I do not see a scheduled date within the next six months.

## 17. Cancellations and last-minute changes

Planning Center should remain the primary source for normal event updates.

Because cancellations and last-minute changes are not currently recorded consistently, the future operational-notice system should also support:

- Event cancellations
- Postponements
- Last-minute time changes
- Last-minute location changes
- Temporary registration or capacity notices

An active approved operational notice should override the normal Planning Center event detail for the notice's effective period and automatically expire afterward.

Wayfinder must not claim that an event is cancelled, postponed, full, or relocated without verified Planning Center data or an active approved operational notice.

## 18. Events that have started or ended

Wayfinder should only return events that have not started.

An event that is currently in progress should not be presented as an upcoming event.

Past events should not be used to answer current schedule questions. Historical event questions are outside the initial event-search scope unless an approved historical source is added later.

## 19. Live-source failure

If the Planning Center event retrieval fails, times out, lacks credentials, or returns data that cannot be verified, Wayfinder should not provide event dates or times from memory or other lower-trust sources.

Approved fallback wording should be conversational, such as:

> I can't verify the current event schedule right now. Please check the CrossPointe events page or contact the church office for the latest information.

Wayfinder may provide:

- CrossPointe events page: https://www.crosspointe.tv/events
- Church office email: info@crosspointe.tv
- Church office call or text: 405-374-4740

## 20. Event-answer style

Wayfinder should:

- Lead with the direct answer
- Use short paragraphs or a compact list
- Show the next three events for a general upcoming-events question
- Include all remaining events today for a today-specific question
- Include date, time, and location when available
- Provide the main link when useful
- Keep source references internally even if the final public interface hides technical source details

Wayfinder should not:

- Produce a long calendar dump
- Repeat the same recurring event several times
- Mix unverified website or social-media dates into live results
- Reveal internal Planning Center details
- Treat a missing result as proof that an event or ministry will never occur

## 21. Implementation requirements

The backend event-retrieval layer should support two query modes:

1. General mode: current time through 14 days, with the next three ranked results.
2. Named-event mode: current time through six months for a specifically named event.

The backend should:

- Require the Central tag
- Recognize the Wayfinder Priority tag for ranking
- Exclude normal Sunday morning and Wednesday night programming from event recommendations
- Exclude already-started events
- Deduplicate recurring events to the next occurrence
- Apply approved room-renaming and hiding rules
- Return only approved public fields to Gemini
- Preserve source identifiers internally for verification and logging
- Fail closed when live event data cannot be verified

Gemini should summarize only the verified event objects supplied by the backend. Gemini should never independently search for, calculate, or invent live event information.
