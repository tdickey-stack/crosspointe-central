# Central interaction analytics

CrossPointe Central records privacy-safe interaction events through the existing
Firebase Analytics property. The public site sends events only from hosted
environments. Localhost logs the same sanitized payloads to the browser console
instead, prefixed with `[Central Analytics]`.

No free-form or personal content is allowed in an analytics payload. This
includes names, email addresses, phone numbers, Serve Interest notes, sermon
notes, Wayfinder questions, Wayfinder answers, and Wayfinder feedback notes.
Outbound URLs are reduced to their hostname and pathname, with query strings
and fragments removed.

## Event taxonomy

| Event | What it measures |
| --- | --- |
| `central_page_view` | First render of the homepage or Sunday mode |
| `central_section_view` | A section heading becoming at least 50% visible |
| `select_content` | Every physical link or button click inside an instrumented section |
| `central_ui_action` | A Central-specific UI action such as opening event details |
| `registration_click` | Intent to register by opening the off-site registration page |
| `calendar_add` | Selection of Google, Apple, or Outlook calendar |
| `generate_lead` | Successful Serve Interest or campaign-contact submission |
| `notes_action` | Notes started, copied, cleared, or saved to Google Docs |
| `livestream_action` | Use of Central's livestream or mini-player controls |
| `wayfinder_action` | Wayfinder open, close, question, answer, link, or feedback outcome |

Registration completion happens in Church Center, so `registration_click`
measures registration intent rather than a completed registration.

Every physical click emits exactly one `select_content` event. When that click
also represents a meaningful outcome, Central emits an additional specialized
event with the same section, content ID, and content label. For example,
choosing Google Calendar emits both `select_content` and `calendar_add`. Do not
sum the click event and its outcome event when calculating raw click totals.

## Parameters

The service accepts only this allowlist:

- `page_mode`
- `section_id`
- `interaction_action`
- `content_type`
- `content_id`
- `content_label`
- `item_id`
- `item_name`
- `link_domain`
- `link_path`
- `calendar_provider`
- `result`
- `expanded`
- `debug_mode`
- `lead_source`

Values are normalized and limited to 100 characters before they reach
Analytics.

## GA4 setup

In Google Analytics, open **Admin → Data display → Custom definitions** and
create event-scoped custom dimensions for the parameters that should be
available in standard reports:

| Dimension name | Event parameter |
| --- | --- |
| Central page mode | `page_mode` |
| Central section | `section_id` |
| Interaction action | `interaction_action` |
| Content label | `content_label` |
| Content ID | `content_id` |
| Calendar provider | `calendar_provider` |
| Interaction result | `result` |
| Lead source | `lead_source` |

`select_content`, `content_type`, and `content_id` follow GA4's recommended
event contract. Custom definitions affect reporting from the time they are
created; they do not backfill older data.

Useful explorations include:

- Raw click counts using only `select_content`, grouped by `section_id`,
  `content_label`, and `interaction_action`.
- Event count by `section_id` and `interaction_action`.
- Registration intent by `content_label`.
- Calendar adds by `calendar_provider`.
- Wayfinder `question_submitted` versus `answer_received` with `result`.
- Serve Interest completions from `generate_lead`.

For a clean click-count report, filter **Event name** to exactly
`select_content`. Use specialized events in separate outcome reports for
calendar adds, registration intent, successful submissions, notes saves,
livestream actions, and Wayfinder results.

## Verification

1. Run Central locally and open the browser console. Interactions should log as
   `[Central Analytics]` and must not send network events.
2. On a hosted dev URL, append `?analytics_debug=1`. Sanitized event payloads
   will appear in the console and include `debug_mode: true`.
3. Confirm the events in GA4 Realtime or DebugView.
4. Allow normal Analytics processing time before expecting custom dimensions
   in standard reports.

Implementation references:

- [GA4 recommended events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [GA4 custom dimensions and metrics](https://support.google.com/analytics/answer/14239696)
