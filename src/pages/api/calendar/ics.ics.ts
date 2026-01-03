import type { APIRoute } from 'astro';
import { db, Event, User } from 'astro:db';
import { generateICalFeed } from '../../../utils/ical';

// Helper function to get host name
const getHostName = (hostId: string | null, users: any[]): string => {
  if (!hostId) return 'TBD';
  const host = users.find(u => u.id === hostId);
  return host ? (host.firstName || host.username) : 'Unknown';
};

/**
 * GET /api/calendar/ics.ics
 * Returns an iCal feed of all events that can be subscribed to by calendar applications
 */
export const GET: APIRoute = async () => {
  try {
    // Fetch all events from the database
    const events = await db.select().from(Event);
    const users = await db.select().from(User);

    // Transform events to iCal format
    const icalEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      duration: event.duration,
      hostName: getHostName(event.hostId, users),
    }));

    // Generate the iCal feed
    const icalContent = generateICalFeed(icalEvents, 'Arandor D&D Sessions');

    // Return the iCal feed with proper headers
    return new Response(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="arandor-calendar.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  } catch (error) {
    console.error('Error generating iCal feed:', error);
    return new Response('Error generating calendar feed', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
