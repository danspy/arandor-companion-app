# Calendar

The calendar (`/calendar`, reached through **Tools** or the dashboard) lists the group's game
sessions. You need to be logged in.

## Events

Any logged-in user can add, edit and delete events: title, description, date, time, duration
(minutes, default 2 hours in calendar apps) and host (one of the players).

The next upcoming event appears on the dashboard with a countdown and an
**Add to my calendar** button.

## Subscribe in your own calendar app

The app publishes all events as an iCal feed:

```
https://arandor.app/api/calendar/ics.ics
```

On the calendar page, **Copy URL** copies it, **Download** saves a one-time `.ics` file (no
updates), and **Instructions** shows the steps below.

| App | Steps |
|---|---|
| Google Calendar (web) | *Other calendars* → **+** → *From URL* → paste → *Add calendar* |
| Apple Calendar (Mac) | *File* → *New Calendar Subscription* → paste → *Subscribe* |
| iPhone / iPad | *Settings* → *Calendar* → *Accounts* → *Add Account* → *Other* → *Add Subscribed Calendar* → paste |
| Outlook | *Add calendar* → *Subscribe from web* → paste, name it → *Import* |
| Android | Subscribe in Google Calendar on the web; it then appears on the phone |

Subscribed calendars refresh on their own schedule (often every few hours); the feed itself is
cached for 5 minutes. You set reminders in your calendar app.

The feed is public: anyone with the URL can see event titles, times, descriptions and hosts.

## Time zones

Enter times in the group's local time. They are read in the campaign's time zone,
`Europe/Berlin` by default (summer and winter time included), and published to calendar apps
in UTC, so everyone's calendar shows the right local time. The zone can be changed with the
`CAMPAIGN_TIME_ZONE` environment variable (e.g. `Europe/London`).

## For developers

- Page: `src/pages/calendar.astro`; feed: `src/pages/api/calendar/ics.ics.ts`;
  iCal generation (RFC 5545): `src/utils/ical.ts`.
- Turning a stored date and time into an instant: `campaignDateTime()` in
  `src/utils/campaignTime.ts`. Use it on the server instead of ``new Date(`${date}T${time}`)``,
  which would read the time as UTC.
- Each event's UID is `<event id>@arandor-companion-app`, so calendar apps update instead of
  duplicating events.
