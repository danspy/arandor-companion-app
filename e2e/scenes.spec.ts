import { test, expect } from '@playwright/test';
import {
  matchesSetup,
  normalizeSetup,
  setupToStateUpdate,
  snapshotSetup,
  startDefaults,
  validateScene,
  validateStartScreen,
  type SceneSetup,
} from '../src/lib/scenes';

// Saved display scenes and the start screen: pure logic only.

test.describe('Scenes logic', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  const base: SceneSetup = {
    locationId: null,
    locationHidden: false,
    spotlightIds: [],
    hiddenIds: [],
    focusIds: [],
    npcsHidden: false,
  };
  const none = { npcIds: new Set<string>(), characterIds: new Set<string>(), locationIds: new Set<string>() };

  test('normalizes marks', () => {
    const s = normalizeSetup({ ...base, spotlightIds: ['a', 'a', 'b'], hiddenIds: ['b', 'x'], focusIds: ['x'] });
    expect(s.spotlightIds).toEqual(['a', 'b']);
    expect(s.hiddenIds).toEqual(['b']);
    expect(s.focusIds).toEqual([]);
  });

  test('snapshot then match', () => {
    const row: any = {
      currentLocationId: 'loc1',
      locationHidden: false,
      spotlightNpcIds: ['a', 'character:c1'],
      hiddenNpcIds: ['a'],
      focusNpcIds: [],
      npcsHidden: false,
    };
    const setup = snapshotSetup(row);
    expect(matchesSetup(row, setup)).toBe(true);
    expect(matchesSetup({ ...row, spotlightNpcIds: ['character:c1', 'a'] }, setup)).toBe(false);
    expect(matchesSetup({ ...row, npcsHidden: true }, setup)).toBe(false);
  });

  test('apply replaces setup', () => {
    const u = setupToStateUpdate({ ...base, spotlightIds: ['n1'] }, { ...none, npcIds: new Set(['n1']) });
    expect(Object.keys(u).sort()).toEqual(
      ['currentLocationId', 'focusNpcIds', 'hiddenNpcIds', 'locationHidden', 'npcsHidden', 'screenMode', 'screenVisible', 'spotlightNpcIds'],
    );
    expect(u.screenMode).toBe('live');
    expect(u.screenVisible).toBe(true);
  });

  test('apply drops missing references', () => {
    const u = setupToStateUpdate(
      { ...base, locationId: 'loc-gone', spotlightIds: ['n1', 'character:c1', 'n-gone', 'character:c-gone'], hiddenIds: ['n-gone'] },
      { npcIds: new Set(['n1']), characterIds: new Set(['c1']), locationIds: new Set() },
    );
    expect(u.spotlightNpcIds).toEqual(['n1', 'character:c1']);
    expect(u.hiddenNpcIds).toEqual([]);
    expect(u.currentLocationId).toBeNull();
  });

  test('validates a scene', () => {
    const setup = { ...base, spotlightIds: ['a', 'a'], hiddenIds: ['zz'] };
    expect(validateScene({ name: '  ', setup }).ok).toBe(false);
    expect(validateScene({ name: 'x'.repeat(81), setup }).ok).toBe(false);
    const r = validateScene({ name: ' Tavern ', setup });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.name).toBe('Tavern');
      expect(r.setup.spotlightIds).toEqual(['a']);
      expect(r.setup.hiddenIds).toEqual([]);
    }
  });

  test('scene needs a setup object', () => {
    const r = validateScene({ name: 'X', setup: { spotlightIds: ['a'] } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.setup.spotlightIds).toEqual(['a']);
    expect(validateScene({ name: 'X' }).ok).toBe(false);
    expect(validateScene({ name: 'X', setup: { spotlightIds: [1] } }).ok).toBe(false);
  });

  test('validates a start screen', () => {
    const ok = { title: 'Return', session: 3, date: '2026-10-21', recap: 'r', showRecap: true };
    expect(validateStartScreen({ ...ok, session: 0 }).ok).toBe(false);
    expect(validateStartScreen({ ...ok, session: null }).ok).toBe(true);
    expect(validateStartScreen({ ...ok, recap: 'x'.repeat(5001) }).ok).toBe(false);
    expect(validateStartScreen({ ...ok, title: 'x'.repeat(121) }).ok).toBe(false);
    expect(validateStartScreen(ok).ok).toBe(true);
  });

  test('start defaults from the diary', () => {
    expect(startDefaults([], '2026-10-21')).toEqual({ session: null, date: '2026-10-21', recap: '' });
    const d = startDefaults([{ session: 7, summary: 'B' }, { session: 3, summary: 'A' }], '2026-10-21');
    expect(d).toEqual({ session: 8, date: '2026-10-21', recap: 'B' });
    expect(startDefaults([{ session: 3, summary: 'A' }, { session: 7, summary: null }], 'd').recap).toBe('');
  });
});
