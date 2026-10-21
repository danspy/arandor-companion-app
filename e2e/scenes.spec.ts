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

// ── Against a test server ────────────────────────────────────────────────────
// Logged-in tests change the DM screen, so they only run against a test server with a copy of
// the data (never dev, preview or live data): E2E_DM / E2E_DM_PASSWORD (dungeonmaster).

const DM = process.env.E2E_DM, DM_PASSWORD = process.env.E2E_DM_PASSWORD;

test.describe('Scenes API', () => {
  test.skip(!DM || !DM_PASSWORD, 'Needs E2E_DM/E2E_DM_PASSWORD (test server only)');
  test.skip(({ isMobile }) => isMobile, 'API only, once is enough');
  test.describe.configure({ mode: 'serial' });

  let dm: import('@playwright/test').BrowserContext;
  test.beforeAll(async ({ browser }) => {
    dm = await browser.newContext();
    const res = await dm.request.post('/api/auth/login', { data: { username: DM, password: DM_PASSWORD } });
    expect(res.ok(), 'login as dm').toBe(true);
  });
  test.afterAll(async () => {
    const list = await (await dm.request.get('/api/scenes')).json();
    for (const s of list) if (String(s.name).startsWith('E2E ')) await dm.request.delete(`/api/scenes/${s.id}`);
    await dm.request.put('/api/dm-screen', { data: { screenMode: 'live', spotlightNpcIds: [], showTimer: false } });
    await dm.close();
  });

  const put = (data: object) => dm.request.put('/api/dm-screen', { data });
  const state = async () => (await dm.request.get('/api/dm-screen')).json();
  const display = async () => (await dm.request.get('/api/display')).json();

  test('save current and apply', async () => {
    expect((await put({ currentLocationId: '1', spotlightNpcIds: ['2', 'character:1'], showTimer: false, screenMode: 'live' })).ok()).toBe(true);
    const made = await dm.request.post('/api/scenes', { data: { name: 'E2E scene', fromCurrent: true } });
    expect(made.status()).toBe(201);
    const card = await made.json();
    expect(card.setup).toMatchObject({ locationId: '1', spotlightIds: ['2', 'character:1'] });
    expect(card.location).toMatchObject({ id: '1' });
    expect(card.locationMissing).toBe(false);
    expect(card.portraits.map((p: any) => p.key)).toEqual(['2', 'character:1']);

    await put({ spotlightNpcIds: [], currentLocationId: null, showTimer: true });
    const applied = await dm.request.post(`/api/scenes/${card.id}/apply`);
    expect(applied.status()).toBe(200);
    const s = await state();
    expect(s.spotlightNpcIds).toEqual(['2', 'character:1']);
    expect(s.currentLocationId).toBe('1');
    expect(s.screenMode).toBe('live');
    expect(s.showTimer).toBe(true);
    expect((await applied.json()).spotlightNpcIds).toEqual(['2', 'character:1']);
  });

  test('rename, reorder, validation, delete', async () => {
    const a = await (await dm.request.post('/api/scenes', { data: { name: 'E2E a', setup: { locationId: null, spotlightIds: ['3'] } } })).json();
    const b = await (await dm.request.post('/api/scenes', { data: { name: 'E2E b', setup: {} } })).json();
    expect(b.sortOrder).toBe(a.sortOrder + 1);
    expect((await dm.request.post('/api/scenes', { data: { name: '', setup: {} } })).status()).toBe(400);
    const renamed = await dm.request.put(`/api/scenes/${a.id}`, { data: { name: 'E2E a2', setup: a.setup } });
    expect((await renamed.json()).name).toBe('E2E a2');
    expect((await dm.request.put('/api/scenes/nope', { data: { name: 'E2E x', setup: {} } })).status()).toBe(404);
    expect((await dm.request.put('/api/scenes/order', { data: { ids: [b.id, 'nope'] } })).status()).toBe(400);
    expect((await dm.request.put('/api/scenes/order', { data: { ids: [b.id, a.id] } })).status()).toBe(204);
    const names = (await (await dm.request.get('/api/scenes')).json()).map((s: any) => s.name).filter((n: string) => n.startsWith('E2E '));
    expect(names.indexOf('E2E b')).toBeLessThan(names.indexOf('E2E a2'));
    expect((await dm.request.delete(`/api/scenes/${a.id}`)).status()).toBe(204);
    expect((await dm.request.delete(`/api/scenes/${b.id}`)).status()).toBe(204);
  });

  test('apply drops deleted NPC', async () => {
    const npc = await (await dm.request.post('/api/npcs', { data: { name: 'E2E Ghost', race: 'Human', occupation: 'Test', relationship: 'neutral', description: 'x' } })).json();
    const card = await (await dm.request.post('/api/scenes', { data: { name: 'E2E ghost scene', setup: { spotlightIds: [npc.id, '2'], locationId: '1' } } })).json();
    expect((await dm.request.delete(`/api/npcs/${npc.id}`)).ok()).toBe(true);
    await dm.request.post(`/api/scenes/${card.id}/apply`);
    expect((await state()).spotlightNpcIds).toEqual(['2']);
    const list = await (await dm.request.get('/api/scenes')).json();
    const got = list.find((s: any) => s.id === card.id);
    expect(got.portraits.find((p: any) => p.key === npc.id).missing).toBe(true);
    expect(got.portraits.find((p: any) => p.key === '2').missing).toBe(false);
  });

  test('start mode on display', async () => {
    const startScreen = { title: 'The Frozen Pass', session: 12, date: '2026-10-21', recap: 'They fled.', showRecap: true };
    expect((await put({ screenMode: 'start', startScreen })).ok()).toBe(true);
    const d = await display();
    expect(d.mode).toBe('start');
    expect(d.startScreen).toEqual(startScreen);
    await put({ screenMode: 'live' });
    const live = await display();
    expect(live.mode).toBe('live');
    expect(live.startScreen).toBeNull();
    expect((await put({ startScreen: { ...startScreen, date: '21.10.2026' } })).status()).toBe(400);
    expect((await put({ screenMode: 'party' })).status()).toBe(400);
  });

  test('start defaults', async () => {
    const res = await dm.request.get('/api/dm-screen/start-defaults');
    expect(res.status()).toBe(200);
    const d = await res.json();
    expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d).toHaveProperty('session');
    expect(typeof d.recap).toBe('string');
  });

  test('display keeps screenVisible', async () => {
    await put({ screenMode: 'pause' });
    let d = await display();
    expect(d.screenVisible).toBe(false);
    expect(d.mode).toBe('pause');
    await put({ screenVisible: true });
    d = await display();
    expect(d.mode).toBe('live');
    expect(d.screenVisible).toBe(true);
    await put({ screenVisible: false });
    expect((await display()).mode).toBe('pause');
  });

  test('players cannot', async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
    expect([401, 403]).toContain((await anon.post('/api/scenes', { data: { name: 'E2E nope', setup: {} } })).status());
    expect([401, 403]).toContain((await anon.get('/api/scenes')).status());
    await anon.dispose();
  });
});
