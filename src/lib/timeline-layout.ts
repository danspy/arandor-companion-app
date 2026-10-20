// The timeline page as a chronicle (src/pages/library/timeline.astro): entries grouped by year in
// story order, long empty stretches collapsed into a gap marker, and an overview bar on a true scale.

interface Row { id: string; entryType: string; year: number; month: number | null; sortOrder: number | null; headline?: string | null }

export type ChronicleItem<T> = { kind: 'year'; year: number; entries: T[] } | { kind: 'gap'; years: number };

// Year, month, sort order; within the same month a label (a short note on the spine) comes first
export const byStory = (a: Row, b: Row) =>
  a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  || (a.entryType === 'label' ? 0 : 1) - (b.entryType === 'label' ? 0 : 1);

export function chronicle<T extends Row>(entries: T[], gapYears = 50): ChronicleItem<T>[] {
  const items: ChronicleItem<T>[] = [];
  let current: Extract<ChronicleItem<T>, { kind: 'year' }> | null = null;
  for (const entry of [...entries].sort(byStory)) {
    if (current?.year === entry.year) { current.entries.push(entry); continue; }
    if (current && entry.year - current.year > gapYears) items.push({ kind: 'gap', years: entry.year - current.year });
    current = { kind: 'year', year: entry.year, entries: [entry] };
    items.push(current);
  }
  return items;
}

// The events a reader steps through on the detail page (previous / next)
export const storyEvents = <T extends Row>(entries: T[]) =>
  entries.filter((e) => e.entryType === 'event' && e.headline).sort(byStory);

export function overviewMarks(entries: Row[]) {
  if (!entries.length) return [];
  const years = entries.map((e) => e.year);
  const min = Math.min(...years);
  const span = Math.max(...years) - min;
  return [...entries].sort(byStory).map((e) => ({
    id: e.id, year: e.year, kind: e.entryType === 'label' ? 'label' : 'event',
    pct: span ? Math.round(((e.year - min) / span) * 1000) / 10 : 50,
  }));
}
