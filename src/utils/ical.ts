/**
 * iCal/ICS utilities for generating RFC 5545 compliant calendar feeds
 */

interface ICalEvent {
  id: string;
  title: string;
  description?: string | null;
  date: string; // ISO date string (YYYY-MM-DD)
  time: string; // Time string (HH:MM)
  duration?: number | null; // Duration in minutes
  hostName?: string;
}

/**
 * Escape special characters in iCal text fields
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Format a date-time for iCal (YYYYMMDDTHHMMSS)
 */
function formatICalDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generate a single VEVENT component
 */
function generateVEvent(event: ICalEvent): string {
  const startDateTime = new Date(`${event.date}T${event.time}`);
  const endDateTime = new Date(startDateTime);
  
  // If duration is provided, add it to the end time
  if (event.duration) {
    endDateTime.setMinutes(endDateTime.getMinutes() + event.duration);
  } else {
    // Default to 2 hours if no duration specified
    endDateTime.setHours(endDateTime.getHours() + 2);
  }

  const now = new Date();
  const dtstamp = formatICalDateTime(now);
  const dtstart = formatICalDateTime(startDateTime);
  const dtend = formatICalDateTime(endDateTime);

  let vevent = [
    'BEGIN:VEVENT',
    `UID:${event.id}@arandor-companion-app`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeICalText(event.title)}`,
  ];

  if (event.description) {
    vevent.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }

  if (event.hostName && event.hostName !== 'TBD') {
    vevent.push(`ORGANIZER;CN=${escapeICalText(event.hostName)}:noreply@arandor-companion-app`);
  }

  vevent.push('END:VEVENT');

  return vevent.join('\r\n');
}

/**
 * Generate a complete iCal feed
 */
export function generateICalFeed(events: ICalEvent[], calendarName: string = 'Arandor Calendar'): string {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Arandor Companion App//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(calendarName)}`,
    'X-WR-TIMEZONE:UTC',
    'X-WR-CALDESC:Events from Arandor Companion App',
  ];

  const footer = [
    'END:VCALENDAR'
  ];

  const vevents = events.map(event => generateVEvent(event));

  return [...header, ...vevents, ...footer].join('\r\n');
}
