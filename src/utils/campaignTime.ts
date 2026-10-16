/**
 * Calendar events are stored as a plain date ("2026-11-05") and time ("18:00") in the
 * group's own time zone. The server runs in UTC, so `new Date('2026-11-05T18:00')` on the
 * server would be 18:00 UTC. These helpers read the stored values in the campaign's time
 * zone instead (daylight saving time included).
 */
export const CAMPAIGN_TIME_ZONE = process.env.CAMPAIGN_TIME_ZONE || 'Europe/Berlin';

/** Offset of `timeZone` from UTC at the instant `utcMs`, in milliseconds. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** The instant an event starts: `date` (YYYY-MM-DD) and `time` (HH:MM) in the campaign's time zone. */
export function campaignDateTime(date: string, time: string | null | undefined, timeZone = CAMPAIGN_TIME_ZONE): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const wallClock = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  // Two passes get the right offset also right next to a daylight-saving switch.
  let utc = wallClock - zoneOffsetMs(wallClock, timeZone);
  utc = wallClock - zoneOffsetMs(utc, timeZone);
  return new Date(utc);
}
