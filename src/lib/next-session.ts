// The next game night from the calendar, for the "no session" screen of the player display.
// Calendar events are a local date ('YYYY-MM-DD') and time ('HH:MM'), read as server local time.

type Slot = { date: string; time: string };

// First event that has not started yet (date + time ≥ now). Only date and time are returned, so
// an event's title or description never reaches the display.
export function nextSession(events: Slot[], now: Date): Slot | null {
  const start = ({ date, time }: Slot) => {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
  };
  const next = events
    .filter((e) => start(e) >= now.getTime()) // also drops unparseable dates (NaN)
    .sort((a, b) => start(a) - start(b))[0];
  return next ? { date: next.date, time: next.time } : null;
}
