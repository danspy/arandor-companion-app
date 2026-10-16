# Calendar Subscription Feature

## Overview
The calendar subscription feature allows users to subscribe to D&D session events in their preferred calendar application (Google Calendar, Apple Calendar, Outlook, Android, etc.) using the standard iCal/ICS format (RFC 5545).

## Implementation Details

### Files Added/Modified
1. **src/utils/ical.ts** - iCal generation utility
   - Generates RFC 5545 compliant iCal format
   - Handles event formatting, timezone conversion (UTC)
   - Escapes special characters properly

2. **src/pages/api/calendar/ics.ics.ts** - iCal feed endpoint
   - Endpoint: `GET /api/calendar/ics.ics`
   - Returns all events from the Event table
   - Includes host information from User table
   - Sets proper content-type headers for calendar files

3. **src/pages/calendar.astro** - Enhanced calendar page
   - Added subscription section with three action buttons:
     - Copy URL - Copies subscription URL to clipboard
     - Download - Downloads the .ics file directly
     - Instructions - Shows detailed setup instructions
   - Added comprehensive instructions modal with guides for:
     - Google Calendar
     - Apple Calendar (macOS/iOS)
     - Microsoft Outlook
     - Android devices

## Usage

### For Users

#### Subscribe to Calendar:
1. Go to the Calendar page in the app
2. Click "Copy URL" to copy the subscription link
3. Follow the instructions for your calendar app:

**Google Calendar:**
- Click "+" next to "Other calendars"
- Select "From URL"
- Paste the subscription URL
- Click "Add calendar"

**Apple Calendar:**
- File → New Calendar Subscription (Mac)
- Settings → Calendar → Accounts → Add Account → Other (iOS)
- Paste the URL and click Subscribe

**Outlook:**
- Add calendar → Subscribe from web
- Paste the URL
- Enter a calendar name and click Import

#### Download Calendar:
- Click "Download" button to download the .ics file
- Open it with your calendar app
- Note: This is a one-time import, not a subscription

### For Developers

#### iCal Format Example:
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Arandor Companion App//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Arandor D&D Sessions
X-WR-TIMEZONE:UTC
X-WR-CALDESC:Events from Arandor Companion App
BEGIN:VEVENT
UID:event-id@arandor-companion-app
DTSTAMP:20260103T124343Z
DTSTART:20260110T190000Z
DTEND:20260110T220000Z
SUMMARY:D&D Session 1
DESCRIPTION:First session of the campaign
ORGANIZER;CN=John Doe:noreply@arandor-companion-app
END:VEVENT
END:VCALENDAR
```

#### API Endpoint:
```typescript
GET /api/calendar/ics.ics
```

Response:
- Content-Type: `text/calendar; charset=utf-8`
- Content-Disposition: `attachment; filename="arandor-calendar.ics"`
- Cache-Control: `no-cache, no-store, must-revalidate`

#### Integration with Event Management:
The iCal feed automatically includes all events from the Event table with the following fields:
- Title
- Description (optional)
- Date and Time (converted to UTC)
- Duration (defaults to 2 hours if not specified)
- Host/Organizer (from User table)

## Benefits

1. **Cross-Platform Compatibility**: Works with all major calendar applications
2. **Automatic Updates**: Subscribed calendars refresh automatically (usually every few hours)
3. **No Manual Entry**: Users don't need to manually add events to their calendars
4. **Reminders**: Users can set their own reminders in their calendar app
5. **Availability Management**: Events appear alongside personal calendar items

## Technical Notes

### Time Zones
- Event times are stored as simple date (YYYY-MM-DD) and time (HH:MM) strings in the database
- When generating the iCal feed, times are interpreted as the **server's local timezone** and then converted to UTC
- Calendar applications automatically convert UTC times to the user's local timezone for display
- **Important**: For best results, ensure all events are entered in the same timezone (the campaign's local timezone)
- Users viewing the calendar in different timezones will see the events adjusted to their local time

### Updates
- When events are added, modified, or deleted in the app, the iCal feed updates immediately
- The feed is cached for 5 minutes to reduce server load while maintaining reasonable update frequency
- Calendar apps typically refresh subscribed calendars every 1-24 hours (varies by app/settings)
- Users can force a refresh in their calendar app settings

### Security
- The iCal feed is publicly accessible (no authentication required)
- This allows calendar apps to subscribe without storing credentials
- Only event data is exposed (no user passwords or sensitive information)

## Future Enhancements

Potential improvements:
- [ ] Per-user calendar feeds (filtered by host/participant)
- [ ] Private feed URLs with authentication tokens
- [ ] Event categories/colors in calendar apps
- [ ] Recurring event support
- [ ] Event location/venue information
- [ ] RSVP/attendance tracking via calendar apps
