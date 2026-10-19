import { test, expect, type Page } from '@playwright/test';

// Player display (/display): NPC portraits must fit every screen and every combination of
// location, timer and turn order, and must glide (never jump) when any of these change.
// /api/display is mocked, so these tests need no database content.

const NPCS = [
  ['Runara', 'Mensch, Drache · Äbtässin, Erzmagierin'],
  ['Ruppert Lokerius', 'Mensch · Besitzer des "Staubigen Krugs"'],
  ['Kimbal Laradan', 'Halbelf, Waldläufer'],
  ['Thorben Jodall', 'Mensch, Kämpfer'],
  ['Hermine Hermagor', 'Human'],
  ['Boldan Eisfaust', 'Kommandant der Stadtwache'],
  ['Mando Eichenschild', 'Oberkommandeur der Stadtwache'],
  ['Aramdir Lichtfels', 'König von Arandor'],
  ['Tex Millpfiff', 'Goblin · Ingenieur'],
  ['Ringo Makahn', 'Händler/Betrüger'],
  ['Aidron', 'Human / Dragon'],
  ['Rekzak', 'Goblin Boss'],
  ['Viktor Ventilschraube', 'Goblin'],
  ['Großmeister Plunck', 'Goblin'],
  ['Moltregaar Donnerhuf', 'Taure'],
  ['Prinz Serelvar', 'Human'],
].map(([name, subtitle], i) => ({ id: `npc-${i}`, name, subtitle, avatarUrl: null }));

interface Scene { npcs?: number; pick?: number[]; location?: boolean; turns?: boolean; timer?: boolean }

function displayState({ npcs = 0, pick, location = false, turns = false, timer = false }: Scene) {
  return {
    screenVisible: true,
    wallpaperUrl: null,
    backdropUrl: null,
    location: location ? { name: 'Frostheim', type: 'city', region: 'Rulik', imageUrl: null } : null,
    npcs: pick ? pick.map((i) => NPCS[i]) : NPCS.slice(0, npcs),
    initiative: turns
      ? {
          status: 'active', round: 3,
          entries: ['Thalia', 'Borin', 'Grimgar', 'Selene', 'Goblin 1', 'Goblin 2', 'Goblin 3', 'Wolf'].map((name, i) => ({
            id: `e${i}`, name, initiative: 20 - i, type: i < 4 ? 'character' : 'monster',
            health: i < 4 ? null : 'healthy', isStable: false, isCurrent: i === 2,
            conditions: i === 2 ? ['Poisoned', 'Exhaustion 2'] : i === 4 ? ['Frightened'] : [],
          })),
        }
      : null,
    timer: timer ? { status: 'paused', duration: 300, startedAt: 0, pausedAt: 60000 } : null,
  };
}

async function openDisplay(page: Page, first: Scene) {
  let current = displayState(first);
  await page.route('**/api/display', (route) => route.fulfill({ json: current }));
  await page.goto('/display');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'stage');
  return async (next: Scene) => {
    current = displayState(next);
    // The display polls; a visibility change makes it fetch right away
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  };
}

// Wait until nothing in the scene is moving, fading or rising any more
async function settled(page: Page) {
  await page.waitForFunction(() => {
    const busy = document.getAnimations().filter((a) => {
      const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
      return el?.closest('#cast, #locCaption') && a.playState === 'running';
    });
    return busy.length === 0 && !document.querySelector('#cast .is-leaving');
  }, null, { timeout: 10_000 });
}

// Geometry problems of the settled display, as readable strings
function layoutProblems() {
  const box = (el: Element) => el.getBoundingClientRect();
  const overlap = (a: DOMRect, b: DOMRect) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const problems: string[] = [];
  const scene = box(document.getElementById('scene')!);
  const side = document.getElementById('side')!;
  const overlaid = document.body.dataset.side === '1' && getComputedStyle(side).position === 'absolute';
  const panels = overlaid ? [...side.querySelectorAll('.t-panel:not([hidden])')].map(box) : [];
  const caption = document.body.dataset.location === '1' ? box(document.getElementById('locCaption')!) : null;
  const items = [...document.querySelectorAll('#cast > li')];
  const rects = items.map((li) => box(li.querySelector('.dsp-portrait')!));
  rects.forEach((r, i) => {
    const name = items[i].querySelector('.dsp-portrait-name')!;
    const who = name.textContent;
    if (r.left < scene.left - 1 || r.right > scene.right + 1 || r.top < scene.top - 1 || r.bottom > scene.bottom + 1) problems.push(`${who} outside the scene`);
    if (r.right > window.innerWidth + 1) problems.push(`${who} off screen`);
    if (panels.some((p) => overlap(r, p) > 1)) problems.push(`${who} under the side panel`);
    if (caption && overlap(r, caption) > 1) problems.push(`${who} over the place name`);
    rects.forEach((q, j) => { if (j > i && overlap(r, q) > 1) problems.push(`${who} overlaps ${items[j].textContent}`); });
    if (name.scrollWidth > name.clientWidth + 1) problems.push(`${who}: name overflows`);
  });
  // Full rows, and a shorter last row centred under them
  const rows = new Map<number, DOMRect[]>();
  rects.forEach((r) => rows.set(Math.round(r.top), [...(rows.get(Math.round(r.top)) ?? []), r]));
  const lines = [...rows.values()];
  const counts = lines.map((l) => l.length);
  if (counts.slice(0, -1).some((c) => c !== counts[0]) || counts[counts.length - 1] > counts[0]) problems.push(`uneven rows ${counts.join('/')}`);
  const mid = (l: DOMRect[]) => (Math.min(...l.map((r) => r.left)) + Math.max(...l.map((r) => r.right))) / 2;
  if (lines.length > 1 && Math.abs(mid(lines[0]) - mid(lines[lines.length - 1])) > 2) problems.push('last row not centred');
  return { problems, height: rects[0]?.height ?? 0, sceneHeight: scene.height, top: Math.min(...rects.map((r) => r.top)) - scene.top };
}

const SCREENS = {
  'TV 16:9': { width: 1920, height: 1080 },
  'laptop': { width: 1280, height: 720 },
  'super-ultrawide 32:9': { width: 3840, height: 1080 },
  'ultrawide 21:9': { width: 3440, height: 1440 },
  'tablet portrait': { width: 820, height: 1180 },
  'phone landscape': { width: 844, height: 390 },
  'phone portrait': { width: 390, height: 844 },
};

test.describe('Player display layout', () => {
  test.skip(({ isMobile }) => isMobile, 'Sets its own screen sizes');

  for (const [screen, viewport] of Object.entries(SCREENS)) {
    test(`portraits fit on ${screen}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      const show = await openDisplay(page, { npcs: 1 });
      for (const location of [true, false]) {
        for (const side of ['none', 'turns', 'timer', 'both']) {
          for (const npcs of [1, 3, 8, 16]) {
            const scene = { npcs, location, turns: side === 'turns' || side === 'both', timer: side === 'timer' || side === 'both' };
            await show(scene);
            await expect(page.locator('#cast > li:not(.is-leaving)')).toHaveCount(npcs);
            await settled(page);
            const m = await page.evaluate(layoutProblems);
            const label = `${npcs} NPCs, ${location ? 'location' : 'no location'}, side: ${side}`;
            expect(m.problems, label).toEqual([]);
            // Over a location on a landscape screen, a handful of portraits leave the upper
            // half of the picture free
            if (location && npcs <= 8 && viewport.width > viewport.height) {
              expect(m.top, `${label}: portraits reach too far up`).toBeGreaterThan(m.sceneHeight * 0.45);
            }
          }
        }
      }
    });
  }

  test('conditions show in the turn order and for whoever is acting', async ({ page }) => {
    await page.setViewportSize(SCREENS['TV 16:9']);
    await openDisplay(page, { npcs: 2, location: true, turns: true });
    await expect(page.locator('#nowName')).toHaveText('Grimgar');
    await expect(page.locator('#nowConds .dsp-cond')).toHaveText(['Poisoned', 'Exhaustion 2']);
    const rows = page.locator('#ledger .dsp-row');
    await expect(rows.nth(2).locator('.dsp-cond')).toHaveText(['Poisoned', 'Exhaustion 2']);
    await expect(rows.nth(4).locator('.dsp-cond')).toHaveText(['Frightened']);
    await expect(rows.nth(0).locator('.dsp-cond')).toHaveCount(0);
  });

  test('the turn order panel is only as tall as its rows', async ({ page }) => {
    await page.setViewportSize(SCREENS['TV 16:9']);
    const show = await openDisplay(page, { npcs: 3, location: true, turns: true });
    await show({ npcs: 3, location: true, turns: true });
    await settled(page);
    const { panel, ledger } = await page.evaluate(() => ({
      panel: document.getElementById('turns')!.getBoundingClientRect().height,
      ledger: document.getElementById('ledger')!.scrollHeight,
    }));
    // 8 combatants on a TV: no empty panel down to the bottom of the screen
    expect(ledger).toBeGreaterThan(0);
    expect(panel).toBeLessThan(SCREENS['TV 16:9'].height * 0.9);
  });
});

test.describe('Player display transitions', () => {
  test.skip(({ isMobile }) => isMobile, 'Sets its own screen sizes');

  // The moment a change is rendered, every portrait that stays and the place name must still
  // be exactly where they were on screen in the last frame; from there they glide.
  const CHANGES: [string, Scene, Scene][] = [
    ['an NPC joins', { npcs: 2, location: true }, { npcs: 3, location: true }],
    ['an NPC in the middle leaves', { pick: [0, 1, 2], location: true }, { pick: [0, 2], location: true }],
    ['the 9th NPC joins', { npcs: 8, location: true }, { npcs: 9, location: true }],
    ['the order changes', { pick: [0, 1, 2] }, { pick: [2, 0, 1] }],
    ['the turn order appears', { npcs: 3, location: true }, { npcs: 3, location: true, turns: true }],
    ['the turn order goes', { npcs: 3, location: true, turns: true }, { npcs: 3, location: true }],
    ['the timer appears', { npcs: 5 }, { npcs: 5, timer: true }],
    ['the location appears', { npcs: 3 }, { npcs: 3, location: true }],
    ['the location goes', { npcs: 3, location: true }, { npcs: 3 }],
    ['the first NPC joins (place name moves up)', { location: true }, { npcs: 1, location: true }],
    ['the last NPC leaves (place name moves down)', { npcs: 1, location: true }, { location: true }],
  ];

  for (const [screen, viewport] of [['TV 16:9', SCREENS['TV 16:9']], ['phone portrait', SCREENS['phone portrait']]] as const) {
    test(`nothing jumps on ${screen}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      const show = await openDisplay(page, { npcs: 1 });
      for (const [what, from, to] of CHANGES) {
        await show(from);
        await settled(page);
        // Note positions every frame; when the render lands (seen by a MutationObserver, which
        // runs right after it, before the next frame), compare with the last frame's positions.
        await page.evaluate(() => {
          const where = () => {
            const m = new Map<string, DOMRect>();
            document.querySelectorAll('#cast > li:not(.is-leaving):not(.is-entering)').forEach((li) => m.set(li.querySelector('.dsp-portrait-name')!.textContent!, li.getBoundingClientRect()));
            const cap = document.getElementById('locCaption')!.getBoundingClientRect();
            if (cap.width) m.set('(place name)', cap);
            return m;
          };
          const w = window as any;
          w.__jumps = null;
          let last = where();
          const frame = () => { if (w.__jumps === null) { last = where(); requestAnimationFrame(frame); } };
          requestAnimationFrame(frame);
          const mo = new MutationObserver(() => {
            mo.disconnect();
            const now = where();
            const jumps: string[] = [];
            now.forEach((r, k) => {
              const a = last.get(k);
              if (a && (Math.abs(a.left - r.left) > 1.5 || Math.abs(a.top - r.top) > 1.5 || Math.abs(a.height - r.height) > 1.5)) {
                jumps.push(`${k}: ${Math.round(a.left)},${Math.round(a.top)} h${Math.round(a.height)} → ${Math.round(r.left)},${Math.round(r.top)} h${Math.round(r.height)}`);
              }
            });
            w.__jumps = jumps;
          });
          mo.observe(document.body, { attributes: true, attributeFilter: ['data-side', 'data-location', 'data-cast', 'data-turns'] });
          mo.observe(document.getElementById('cast')!, { attributes: true, childList: true, subtree: true });
        });
        await show(to);
        const jumps = await page.waitForFunction(() => (window as any).__jumps).then((h) => h.jsonValue());
        expect(jumps, `${what}: portraits or the place name jumped`).toEqual([]);
        await settled(page);
        const m = await page.evaluate(layoutProblems);
        expect(m.problems, `${what}: settled layout`).toEqual([]);
      }
    });
  }
});
