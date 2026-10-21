import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { effectiveNpcHp, npcStatusUpdate, publicNpc, spotlightCombatant } from '../src/lib/npc-status';

// NPC status on the DM screen spotlight: HP and conditions per NPC, kept between sessions, for
// the DM only. The logged-in tests create their own NPCs, stat block and combatants and change
// the spotlight and the fight, so they only run against a test server with a copy of the data
// (never dev, preview or live data):
//   E2E_DM / E2E_DM_PASSWORD (dungeonmaster)   E2E_PLAYER / E2E_PLAYER_PASSWORD (player)

if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });

test.describe('NPC status rules', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('the stat block stands in until the NPC has HP of its own', () => {
    expect(effectiveNpcHp({ hp: null, maxHp: null }, 7)).toEqual({ hp: 7, maxHp: 7 });
    expect(effectiveNpcHp({ hp: 3, maxHp: null }, 7)).toEqual({ hp: 3, maxHp: 7 });
    expect(effectiveNpcHp({ hp: null, maxHp: 20 }, 7)).toEqual({ hp: 20, maxHp: 20 }); // unhurt
    expect(effectiveNpcHp({ hp: null, maxHp: null }, undefined)).toEqual({ hp: null, maxHp: null });
  });

  test('updates are checked and HP stays within max HP', () => {
    expect(npcStatusUpdate({ hp: 30 }, { hp: 5, maxHp: 20 })).toEqual({ update: { hp: 20 } });
    expect(npcStatusUpdate({ maxHp: 4 }, { hp: 5, maxHp: 20 })).toEqual({ update: { maxHp: 4, hp: 4 } });
    expect(npcStatusUpdate({ hp: '', maxHp: null }, { hp: 5, maxHp: 20 })).toEqual({ update: { hp: null, maxHp: null } });
    expect(npcStatusUpdate({ conditions: ['Prone', 'Poisoned', 'Exhaustion 2', 'Cursed'] }, { hp: null, maxHp: null }))
      .toEqual({ update: { conditions: ['Poisoned', 'Prone', 'Exhaustion 2', 'Cursed'] } });
    expect(npcStatusUpdate({ hp: -1 }, { hp: 5, maxHp: 20 })).toHaveProperty('error');
    expect(npcStatusUpdate({ hp: 2.5 }, { hp: 5, maxHp: 20 })).toHaveProperty('error');
    expect(npcStatusUpdate({ conditions: ['x'.repeat(33)] }, { hp: 5, maxHp: 20 })).toHaveProperty('error');
    expect(npcStatusUpdate({ conditions: 'Prone' }, { hp: 5, maxHp: 20 })).toHaveProperty('error');
  });

  test('players never get the status fields', () => {
    expect(publicNpc({ id: 'n', name: 'Runara', hp: 3, maxHp: 9, conditions: ['Prone'] })).toEqual({ id: 'n', name: 'Runara' });
  });

  test('a running fight wins: characters by id, NPCs by name', () => {
    const entries = [
      { id: 'a', name: 'Thalia', type: 'character', characterId: 'c1', isActive: true },
      { id: 'b', name: ' Runara ', type: 'npc', characterId: null, isActive: true },
      { id: 'c', name: 'Borin', type: 'npc', characterId: null, isActive: false },
    ];
    expect(spotlightCombatant(entries, 'active', 'character', { id: 'c1', name: 'Other name' })?.id).toBe('a');
    expect(spotlightCombatant(entries, 'paused', 'npc', { id: 'n1', name: 'Runara' })?.id).toBe('b');
    expect(spotlightCombatant(entries, 'stopped', 'npc', { id: 'n1', name: 'Runara' })).toBeNull();
    expect(spotlightCombatant(entries, 'active', 'npc', { id: 'n2', name: 'Borin' })).toBeNull(); // not in combat
    expect(spotlightCombatant(entries, 'active', 'npc', { id: 'n3', name: 'Thalia' })).toBeNull(); // a character's name
  });
});

// ── Against a test server ────────────────────────────────────────────────────

const DM = process.env.E2E_DM, DM_PASSWORD = process.env.E2E_DM_PASSWORD;
const PLAYER = process.env.E2E_PLAYER, PLAYER_PASSWORD = process.env.E2E_PLAYER_PASSWORD;

async function login(context: BrowserContext, username: string, password: string) {
  const res = await context.request.post('/api/auth/login', { data: { username, password } });
  expect(res.ok(), `login as ${username}`).toBe(true);
}

async function dmContext(browser: Browser, viewport?: { width: number; height: number }) {
  const dm = await browser.newContext(viewport ? { viewport } : {});
  await login(dm, DM!, DM_PASSWORD!);
  return dm;
}

const row = (page: Page, name: string) => page.locator('#spotlightNpcList .npc-item', { hasText: name });

test.describe('NPC status on a test server', () => {
  test.skip(!DM || !DM_PASSWORD || !PLAYER || !PLAYER_PASSWORD, 'Needs E2E_DM/E2E_DM_PASSWORD and E2E_PLAYER/E2E_PLAYER_PASSWORD (test server only)');
  test.describe.configure({ mode: 'serial' });

  const suffix = Math.random().toString(36).slice(2, 7);
  const linkedName = `Status Goblin ${suffix}`;
  const plainName = `Status Sage ${suffix}`;
  let linked: { id: string }, plain: { id: string }, creatureId: string, savedSpotlight: unknown, savedCombat: { status: string };

  test.beforeAll(async ({ browser }) => {
    test.skip(!DM || !DM_PASSWORD || !PLAYER || !PLAYER_PASSWORD);
    const dm = await dmContext(browser);
    const npc = (name: string) => dm.request.post('/api/npcs', { data: { name, race: 'Goblin', description: 'Test', relationship: 'enemy' } }).then((r) => r.json());
    linked = await npc(linkedName);
    plain = await npc(plainName);
    const creature = await dm.request.post('/api/creatures', { data: { name: `Status stat block ${suffix}`, hp: 7, ac: 15, npcIds: [linked.id] } });
    expect(creature.status()).toBe(201);
    creatureId = (await creature.json()).id;
    const state = await (await dm.request.get('/api/dm-screen')).json();
    savedSpotlight = { spotlightNpcIds: state.spotlightNpcIds, hiddenNpcIds: state.hiddenNpcIds, focusNpcIds: state.focusNpcIds, npcsHidden: state.npcsHidden };
    savedCombat = await (await dm.request.get('/api/combat-state')).json();
    await dm.request.put('/api/combat-state', { data: { status: 'stopped' } });
    await dm.request.put('/api/dm-screen', { data: { spotlightNpcIds: [linked.id, plain.id], hiddenNpcIds: [], focusNpcIds: [], npcsHidden: false } });
    await dm.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!linked) return;
    const dm = await dmContext(browser);
    await dm.request.put('/api/dm-screen', { data: savedSpotlight });
    await dm.request.put('/api/combat-state', { data: { status: savedCombat.status } });
    await dm.request.delete(`/api/creatures/${creatureId}`);
    await dm.request.delete(`/api/npcs/${linked.id}`);
    await dm.request.delete(`/api/npcs/${plain.id}`);
    await dm.close();
  });

  test('API: DM only, checked, and never sent to players', async ({ browser, request, isMobile }) => {
    test.skip(isMobile, 'API, once is enough');
    const dm = await dmContext(browser);
    const player = await browser.newContext();
    await login(player, PLAYER!, PLAYER_PASSWORD!);

    expect((await request.patch(`/api/npcs/${plain.id}`, { data: { hp: 1 } })).status()).toBe(401);
    expect((await player.request.patch(`/api/npcs/${plain.id}`, { data: { hp: 1 } })).status()).toBe(403);
    expect((await player.request.post(`/api/npcs/${plain.id}/hp`, { data: { kind: 'damage', amount: 1 } })).status()).toBe(403);
    expect((await dm.request.patch(`/api/npcs/${plain.id}`, { data: { hp: -3 } })).status()).toBe(400);
    expect((await dm.request.patch(`/api/npcs/${plain.id}`, { data: { conditions: ['x'.repeat(40)] } })).status()).toBe(400);
    expect((await dm.request.post(`/api/npcs/${plain.id}/hp`, { data: { kind: 'damage', amount: 1 } })).status()).toBe(400); // no HP yet

    const set = await (await dm.request.patch(`/api/npcs/${plain.id}`, { data: { maxHp: 12, hp: 40, conditions: ['Prone', 'Cursed'] } })).json();
    expect(set).toMatchObject({ hp: 12, maxHp: 12, conditions: ['Prone', 'Cursed'] });
    const hit = await (await dm.request.post(`/api/npcs/${plain.id}/hp`, { data: { kind: 'damage', amount: 5 } })).json();
    expect(hit).toMatchObject({ hp: 7, maxHp: 12, tempHp: null });

    // Linked to a stat block: its HP stand in, and the first change keeps them on the NPC
    const healed = await (await dm.request.post(`/api/npcs/${linked.id}/hp`, { data: { kind: 'heal', amount: 5 } })).json();
    expect(healed).toMatchObject({ hp: 7, maxHp: 7 });
    const hurt = await (await dm.request.post(`/api/npcs/${linked.id}/hp`, { data: { kind: 'damage', amount: 3 } })).json();
    expect(hurt).toMatchObject({ hp: 4, maxHp: 7 });

    // Players and visitors: no status fields anywhere in the NPC API
    for (const ctx of [player.request, request]) {
      const one = await (await ctx.get(`/api/npcs/${plain.id}`)).json();
      expect(one.name).toBe(plainName);
      for (const k of ['hp', 'maxHp', 'conditions']) expect(one).not.toHaveProperty(k);
      const all = await (await ctx.get('/api/npcs')).json();
      expect(all.find((n: { id: string }) => n.id === plain.id)).not.toHaveProperty('conditions');
    }
    // A player editing the NPC gets it back without them, and the edit leaves them alone
    const edited = await (await player.request.put(`/api/npcs/${plain.id}`, { data: { name: plainName, race: 'Elf', description: 'Test', relationship: 'enemy' } })).json();
    expect(edited).not.toHaveProperty('hp');
    expect(await (await dm.request.get(`/api/npcs/${plain.id}`)).json()).toMatchObject({ race: 'Elf', hp: 7, conditions: ['Prone', 'Cursed'] });
    // The player display shows no numbers or conditions of NPCs
    expect(JSON.stringify(await (await request.get('/api/display')).json())).not.toContain('Cursed');
    await player.close();
    await dm.close();
  });

  test('DM screen: damage, conditions and HP on the spotlight row, kept after a reload', async ({ browser, isMobile }) => {
    const dm = await dmContext(browser, isMobile ? { width: 390, height: 844 } : undefined);
    await dm.request.patch(`/api/npcs/${linked.id}`, { data: { hp: null, maxHp: null, conditions: [] } }); // fresh: stat block HP
    await dm.request.patch(`/api/npcs/${plain.id}`, { data: { hp: null, maxHp: null, conditions: [] } });
    const page = await dm.newPage();
    await page.goto('/tools/dm-screen');

    const goblin = row(page, linkedName);
    await expect(goblin.locator(`[data-hp-of="${linked.id}"]`)).toHaveText('7/7');
    await goblin.locator('.hp-amount').fill('3');
    await goblin.getByRole('button', { name: `Damage ${linkedName}` }).click();
    await expect(goblin.locator(`[data-hp-of="${linked.id}"]`)).toHaveText('4/7');

    // No HP yet: set them in the editor, then a condition and an own tag
    const sage = row(page, plainName);
    await expect(sage.getByText('No HP set')).toBeVisible();
    await sage.getByRole('button', { name: `HP and conditions of ${plainName}` }).click();
    const editor = sage.locator('.npc-edit');
    await editor.getByLabel('Max HP').fill('15');
    await editor.getByLabel('Max HP').press('Tab');
    await expect(sage.locator(`[data-hp-of="${plain.id}"]`)).toHaveText('15/15');
    await editor.getByRole('button', { name: 'Poisoned' }).click();
    await expect(editor.getByRole('button', { name: 'Poisoned' })).toHaveAttribute('aria-pressed', 'true');
    await editor.getByLabel('Add your own tag').fill('Cursed by Runara');
    await editor.getByLabel('Add your own tag').press('Enter');
    await expect(sage.locator('.npc-status .cond-chip')).toHaveText(['Poisoned', 'Cursed by Runara']);

    // Touch: every control on the rows is big enough to hit
    if (isMobile) {
      const small = await page.locator('#spotlightNpcList').evaluate((list) =>
        [...list.querySelectorAll<HTMLElement>('button, input, select')]
          .filter((el) => el.offsetParent)
          .map((el) => ({ what: el.getAttribute('aria-label') || el.textContent?.trim(), h: el.getBoundingClientRect().height }))
          .filter((b) => b.h < 40));
      expect(small).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: process.env.E2E_SHOTS ? `${process.env.E2E_SHOTS}/npc-dm-screen-phone.png` : undefined, fullPage: false });
    }

    await page.reload();
    await expect(row(page, linkedName).locator(`[data-hp-of="${linked.id}"]`)).toHaveText('4/7');
    await expect(row(page, plainName).locator('.npc-status .cond-chip')).toHaveText(['Poisoned', 'Cursed by Runara']);
    await dm.close();
  });

  test('in a running fight the row shows the combatant', async ({ browser, isMobile }) => {
    test.skip(isMobile, 'Desktop flow');
    const dm = await dmContext(browser);
    const combatant = await (await dm.request.post('/api/initiative', { data: { name: linkedName, initiative: 30, type: 'npc', hp: 2, maxHp: 7, conditions: ['Stunned'] } })).json();
    try {
      await dm.request.put('/api/combat-state', { data: { status: 'paused' } });
      const page = await dm.newPage();
      await page.goto('/tools/dm-screen');
      const goblin = row(page, linkedName);
      await expect(goblin.getByText('In combat')).toBeVisible();
      await expect(goblin.locator(`[data-hp-of="${combatant.id}"]`)).toHaveText('2/7');
      await expect(goblin.locator('.npc-status .cond-chip')).toHaveText(['Stunned']);
      // Damage here goes to the combatant, not to the NPC's own HP
      await goblin.locator('.hp-amount').fill('1');
      await goblin.getByRole('button', { name: `Damage ${linkedName}` }).click();
      await expect(goblin.locator(`[data-hp-of="${combatant.id}"]`)).toHaveText('1/7');
      expect((await (await dm.request.get(`/api/npcs/${linked.id}`)).json()).hp).toBe(4);
      // The fight ends: the NPC's own status is back
      await dm.request.put('/api/combat-state', { data: { status: 'stopped' } });
      await page.reload();
      await expect(goblin.locator(`[data-hp-of="${linked.id}"]`)).toHaveText('4/7');
      await expect(goblin.getByText('In combat')).toHaveCount(0);
    } finally {
      await dm.request.delete(`/api/initiative/${combatant.id}`);
      await dm.close();
    }
  });

  test('tablet: the rows fit', async ({ browser, isMobile }) => {
    test.skip(isMobile, 'One tablet run is enough');
    const dm = await dmContext(browser, { width: 820, height: 1180 });
    const page = await dm.newPage();
    await page.goto('/tools/dm-screen');
    await expect(row(page, plainName).locator('.npc-status .cond-chip')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const sage = row(page, plainName);
    await sage.getByRole('button', { name: `HP and conditions of ${plainName}` }).click();
    const box = await sage.boundingBox();
    const editor = await sage.locator('.npc-edit').boundingBox();
    expect(editor!.x + editor!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
    await dm.close();
  });
});
