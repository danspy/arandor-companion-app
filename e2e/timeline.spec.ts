import { test, expect } from '@playwright/test';
import { chronicle, storyEvents, overviewMarks, byStory } from '../src/lib/timeline-layout';

const entry = (id: string, year: number, extra: Record<string, unknown> = {}) =>
  ({ id, entryType: 'event', year, month: null as number | null, sortOrder: null as number | null, headline: id, ...extra });
const label = (id: string, year: number, extra: Record<string, unknown> = {}) =>
  entry(id, year, { entryType: 'label', headline: null, label: id, ...extra });

test.describe('Timeline layout', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('groups entries by year in story order, with a gap marker for long stretches', () => {
    const items = chronicle([entry('late', 823), label('start', 0), entry('mid', 20), entry('far', 420)]);
    expect(items.map((i) => (i.kind === 'year' ? i.year : `gap ${i.years}`))).toEqual([0, 20, 'gap 400', 420, 'gap 403', 823]);
  });

  test('stretches up to the threshold get no gap marker', () => {
    const items = chronicle([entry('a', 100), entry('b', 150), entry('c', 201)], 50);
    expect(items.map((i) => i.kind)).toEqual(['year', 'year', 'gap', 'year']);
  });

  test('within a year: by month, then sort order, labels without a month first', () => {
    const [year] = chronicle([
      entry('oni', 823, { month: 10 }),
      label('fire', 823),
      entry('jalun', 823, { month: 1, sortOrder: 2 }),
      entry('jalun-first', 823, { month: 1, sortOrder: 1 }),
    ]);
    expect(year.kind === 'year' && year.entries.map((e) => e.id)).toEqual(['fire', 'jalun-first', 'jalun', 'oni']);
  });

  test('story order of events skips labels and events without a headline', () => {
    const events = storyEvents([entry('b', 30, { month: 2 }), label('l', 10), entry('a', 30, { month: 1 }), entry('x', 5, { headline: null })]);
    expect(events.map((e) => e.id)).toEqual(['a', 'b']);
    expect([entry('b', 2), entry('a', 1)].sort(byStory).map((e) => e.id)).toEqual(['a', 'b']);
  });

  test('overview marks sit on a true scale from the first to the last year', () => {
    const marks = overviewMarks([entry('a', 100), label('b', 150), entry('c', 300)]);
    expect(marks).toEqual([
      { id: 'a', year: 100, kind: 'event', pct: 0 },
      { id: 'b', year: 150, kind: 'label', pct: 25 },
      { id: 'c', year: 300, kind: 'event', pct: 100 },
    ]);
    expect(overviewMarks([entry('only', 7)])).toEqual([{ id: 'only', year: 7, kind: 'event', pct: 50 }]);
    expect(overviewMarks([])).toEqual([]);
  });
});

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.describe('Timeline pages', () => {
  type Entry = { id: string; entryType: string; headline: string | null; characterIds: string[] };
  const linkedEvent = async (request: import('@playwright/test').APIRequestContext) =>
    ((await (await request.get('/api/timeline')).json()) as Entry[]).find((e) => e.entryType === 'event' && e.headline && e.characterIds?.length);

  test('the character page links to the event, and the event back to its place on the timeline', async ({ page, request }) => {
    const event = await linkedEvent(request);
    test.skip(!event, 'Needs a timeline event linked to a character');
    await page.goto(`/characters/${event!.characterIds[0]}`);
    await page.locator('#cs-campaign').getByRole('link', { name: event!.headline!, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/library/timeline/${event!.id}$`));
    await expect(page.locator('h1')).toHaveText(event!.headline!);

    await page.getByRole('link', { name: 'Show on timeline' }).click();
    await expect(page).toHaveURL(new RegExp(`/library/timeline#${event!.id}$`));
    const card = page.locator(`[id="${event!.id}"]`);
    await expect(card).toHaveClass(/tl-flash/);
    await expect(card).toBeInViewport();
  });

  test('a card opens its event page; the chronicle fits a phone', async ({ page, request }) => {
    const event = await linkedEvent(request);
    test.skip(!event, 'Needs a timeline event');
    await page.goto('/library/timeline');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    await page.locator(`[id="${event!.id}"] .tl-card`).click({ position: { x: 20, y: 20 } }); // anywhere on the card
    await expect(page).toHaveURL(new RegExp(`/library/timeline/${event!.id}$`));
  });

  test('a note has no page of its own: its link lands on the timeline', async ({ page, request }) => {
    const note = ((await (await request.get('/api/timeline')).json()) as Entry[]).find((e) => e.entryType === 'label');
    test.skip(!note, 'Needs a note');
    await page.goto(`/library/timeline/${note!.id}`);
    await expect(page).toHaveURL(new RegExp(`/library/timeline#${note!.id}$`));
    await expect(page.locator(`[id="${note!.id}"]`)).toBeInViewport();
  });
});
