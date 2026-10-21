import { test, expect } from '@playwright/test';
import { canSee, normalize, plainText, search, snippet, type SearchRecord } from '../src/lib/search';
import { COMMANDS, diceAction } from '../src/lib/search/commands';

// Global search (⌘K / Ctrl+K): ranking, role filtering, the API and the palette.
// The logged-in tests need an account on the server under test (never live data):
//   E2E_USER / E2E_PASSWORD (a player) and optionally E2E_DM / E2E_DM_PASSWORD
// They are skipped when those are not set.

const npc = (id: string, title: string, body = ''): SearchRecord => ({
  group: 'npcs', id, title, body, href: `/npcs/${id}`, access: 'public',
});
const titles = (query: string, records: SearchRecord[], viewer: Parameters<typeof search>[2] = null) =>
  search(query, records, viewer).flatMap((g) => g.results.map((r) => r.title));

test.describe('Search core', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('ignores case and accents', () => {
    expect(normalize('Úlfgar')).toBe('ulfgar');
    expect(titles('ulfgar', [npc('1', 'Úlfgar Ironfist')])).toEqual(['Úlfgar Ironfist']);
  });

  test('every word must match', () => {
    const records = [npc('1', 'Young Red Dragon'), npc('2', 'Red Wizard')];
    expect(titles('red dragon', records)).toEqual(['Young Red Dragon']);
  });

  test('ranks title matches above body matches', () => {
    const records = [
      npc('4', 'Mara', 'She hates goblins.'),
      npc('3', 'Hobgoblin'),
      npc('2', 'Goblin Boss'),
      npc('1', 'Goblin'),
    ];
    expect(titles('goblin', records)).toEqual(['Goblin', 'Goblin Boss', 'Hobgoblin', 'Mara']);
  });

  test('snippets are escaped and marked', () => {
    const s = snippet('<script>x</script> the goblin', ['goblin']);
    expect(s).toContain('&lt;script&gt;');
    expect(s).toContain('<mark>goblin</mark>');
    expect(snippet('Ein Zwerg namens Úlfgar', ['ulfgar'])).toContain('<mark>Úlfgar</mark>');
  });

  test('snippets are short plain text', () => {
    const body = `![map](/uploads/map.png) ${'Lorem ipsum dolor sit amet. '.repeat(100)} the [dragon](/npcs/1) sleeps ${'x '.repeat(500)}`;
    const s = snippet(plainText(body), ['dragon'])!;
    expect(s).toContain('<mark>dragon</mark>');
    expect(s).not.toContain('![');
    expect(s).not.toContain('](');
    expect(s.replace(/<\/?mark>/g, '').length).toBeLessThanOrEqual(140);
  });

  test('odd characters are searched literally', () => {
    const records = [npc('1', 'The (Old) Tower *'), npc('2', '<b>Bold</b>')];
    expect(() => search('a(', records, null)).not.toThrow();
    expect(titles('(old)', records)).toEqual(['The (Old) Tower *']);
    expect(titles('<b>', records)).toEqual(['<b>Bold</b>']);
    expect(titles('x', records)).toEqual([]); // too short
  });

  test('access by role', () => {
    expect(canSee('public', null)).toBe(true);
    expect(canSee('user', null)).toBe(false);
    expect(canSee('user', 'player')).toBe(true);
    expect(canSee('dm', 'player')).toBe(false);
    expect(canSee('dm', 'dungeonmaster')).toBe(true);
    expect(canSee('admin', 'dungeonmaster')).toBe(false);
    expect(canSee('admin', 'admin')).toBe(true);
    expect(titles('dm screen', COMMANDS, 'player')).toEqual([]);
    expect(search('dm screen', COMMANDS, 'dungeonmaster')[0].results[0].href).toBe('/tools/dm-screen');
    expect(titles('users', COMMANDS, 'dungeonmaster')).toEqual([]);
  });

  test('limits results per group', () => {
    const records = Array.from({ length: 9 }, (_, i) => npc(String(i), `Guard ${i}`));
    expect(search('guard', records, null)[0].results).toHaveLength(8);
  });

  test('dice notation becomes a roll action', () => {
    expect(diceAction('2d6+3')).toEqual({ label: 'Roll 2d6+3', notation: '2d6+3' });
    expect(diceAction('d20')?.notation).toBe('1d20');
    expect(diceAction('goblin')).toBeNull();
    expect(diceAction('12')).toBeNull(); // a plain number is not a roll
  });
});
