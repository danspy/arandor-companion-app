import { test, expect, type BrowserContext } from '@playwright/test';
import { audioFileCheck, MAX_AUDIO_BYTES } from '../src/lib/music/formats';
import { parseYouTubeUrl, fetchYouTubeTitle } from '../src/lib/music/youtube';
import { canView, canEdit, canSetSiteDefault } from '../src/lib/music/access';

// Silent 8 kHz mono 8-bit PCM WAV with a 44-byte RIFF header
export function wav(seconds: number): Buffer {
  const data = 8000 * seconds;
  const b = Buffer.alloc(44 + data, 0x80);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34);
  b.write('data', 36); b.writeUInt32LE(data, 40);
  return b;
}

test.describe('Music helpers', () => {
  test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough');

  test('audio file check', () => {
    expect(audioFileCheck('Tavern Song.mp3', 1000)).toEqual({ ok: true, ext: 'mp3', title: 'Tavern Song' });
    expect(audioFileCheck('LOUD.MP3', 1)).toMatchObject({ ok: true, ext: 'mp3' });
    expect(audioFileCheck('a.b.flac', 1)).toMatchObject({ ok: true, ext: 'flac', title: 'a.b' });
    for (const bad of ['song', 'evil.mp3.html', 'notes.txt', '.mp3x'])
      expect(audioFileCheck(bad, 1)).toMatchObject({ ok: false, error: expect.stringContaining('Unsupported format') });
    expect(audioFileCheck('big.wav', MAX_AUDIO_BYTES + 1)).toEqual({ ok: false, error: 'File is larger than 50 MB' });
    expect(audioFileCheck('edge.wav', MAX_AUDIO_BYTES).ok).toBe(true);
  });

  test('YouTube links', () => {
    const V = 'dQw4w9WgXcQ', L = 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG';
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${V}`)).toEqual({ videoId: V });
    expect(parseYouTubeUrl(`https://youtu.be/${V}?t=42`)).toEqual({ videoId: V });
    expect(parseYouTubeUrl(`https://m.youtube.com/watch?v=${V}&list=${L}&index=3`)).toEqual({ videoId: V, listId: L });
    expect(parseYouTubeUrl(`https://www.youtube.com/playlist?list=${L}`)).toEqual({ listId: L });
    expect(parseYouTubeUrl(`https://youtube.com/shorts/${V}`)).toEqual({ videoId: V });
    expect(parseYouTubeUrl(`https://www.youtube.com/embed/${V}`)).toEqual({ videoId: V });
    expect(parseYouTubeUrl(`https://music.youtube.com/watch?v=${V}`)).toEqual({ videoId: V });
    expect(parseYouTubeUrl(`https://evil.example/watch?v=${V}`)).toBeNull();
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseYouTubeUrl('not a url')).toBeNull();
  });

  test('oEmbed title falls back to null', async () => {
    const ok = (async () => new Response(JSON.stringify({ title: 'Tavern Ambience' }))) as typeof fetch;
    const fail = (async () => new Response('', { status: 404 })) as typeof fetch;
    const boom = (async () => { throw new Error('offline'); }) as typeof fetch;
    expect(await fetchYouTubeTitle('https://youtu.be/dQw4w9WgXcQ', ok)).toBe('Tavern Ambience');
    expect(await fetchYouTubeTitle('https://youtu.be/dQw4w9WgXcQ', fail)).toBeNull();
    expect(await fetchYouTubeTitle('https://youtu.be/dQw4w9WgXcQ', boom)).toBeNull();
  });

  test('access rules', () => {
    const admin = { id: 'a', role: 'admin' }, dm = { id: 'd', role: 'dungeonmaster' };
    const owner = { id: 'o', role: 'player' }, other = { id: 'x', role: 'player' };
    const priv = { ownerId: 'o', visibility: 'private', isSiteDefault: false };
    const pub = { ...priv, visibility: 'public' };
    const site = { ownerId: 'a', visibility: 'public', isSiteDefault: true };
    expect([null, other, dm].map(v => canView(priv, v))).toEqual([false, false, false]);
    expect([owner, admin].map(v => canView(priv, v))).toEqual([true, true]);
    expect([null, other].map(v => canView(pub, v))).toEqual([false, true]);
    expect(canView(site, null)).toBe(true);
    expect([other, dm, owner, admin].map(v => canEdit(pub, v))).toEqual([false, false, true, true]);
    expect([null, other, dm, admin].map(v => canEdit(site, v))).toEqual([false, false, true, true]);
    expect([dm, admin].map(canSetSiteDefault)).toEqual([false, true]);
  });
});

// ── Music API (test server only: creates and deletes playlists) ─────────────
const E = process.env;
const haveAccounts = !!(E.E2E_ADMIN && E.E2E_ADMIN_PASSWORD && E.E2E_DM && E.E2E_DM_PASSWORD && E.E2E_PLAYER && E.E2E_PLAYER_PASSWORD && E.E2E_PLAYER2 && E.E2E_PLAYER2_PASSWORD);

async function login(context: BrowserContext, username: string, password: string) {
  const res = await context.request.post('/api/auth/login', { data: { username, password } });
  expect(res.ok(), `login as ${username}`).toBe(true);
}

test.describe('Music API', () => {
  test.skip(!haveAccounts, 'Needs E2E_ADMIN, E2E_DM, E2E_PLAYER and E2E_PLAYER2 accounts (test server only)');
  test.skip(({ isMobile }) => isMobile, 'Desktop flow');
  test.describe.configure({ mode: 'serial' });

  let admin: BrowserContext, dm: BrowserContext, player: BrowserContext, player2: BrowserContext;
  const created: string[] = [];
  const stamp = Date.now();
  let n = 0;
  const uname = () => `E2E music ${stamp} ${++n}`;

  test.beforeAll(async ({ browser }) => {
    [admin, dm, player, player2] = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext(), browser.newContext()]);
    await login(admin, E.E2E_ADMIN!, E.E2E_ADMIN_PASSWORD!);
    await login(dm, E.E2E_DM!, E.E2E_DM_PASSWORD!);
    await login(player, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
    await login(player2, E.E2E_PLAYER2!, E.E2E_PLAYER2_PASSWORD!);
  });

  test.afterAll(async () => {
    for (const id of created) await admin.request.delete(`/api/music/playlists/${id}`);
    await Promise.all([admin, dm, player, player2].map((c) => c?.close()));
  });

  async function create(ctx: BrowserContext, data: Record<string, unknown>) {
    const res = await ctx.request.post('/api/music/playlists', { data });
    if (res.status() === 201) created.push((await res.json()).id);
    return res;
  }
  const listIds = async (ctx: BrowserContext) => (await (await ctx.request.get('/api/music/playlists')).json()).map((p: any) => p.id);

  test('visitor: site playlist is public, the rest needs login', async ({ request }) => {
    const res = await request.get('/api/music/site');
    expect(res.status()).toBe(200);
    const site = (await res.json()).playlist;
    expect(site.isSiteDefault).toBe(true);
    expect((await request.get(`/api/music/playlists/${site.id}`)).status()).toBe(401);
    expect((await request.get('/api/music/playlists')).status()).toBe(401);
    expect((await request.post('/api/music/playlists', { data: { name: 'x' } })).status()).toBe(401);
  });

  test('privacy: a private playlist is visible to its owner and admin only', async () => {
    const res = await create(player, { name: uname(), visibility: 'private' });
    expect(res.status()).toBe(201);
    const p = await res.json();
    expect(p.visibility).toBe('private');
    expect((await player2.request.get(`/api/music/playlists/${p.id}`)).status()).toBe(404);
    expect(await listIds(player2)).not.toContain(p.id);
    expect((await admin.request.get(`/api/music/playlists/${p.id}`)).status()).toBe(200);
    expect((await dm.request.get(`/api/music/playlists/${p.id}`)).status()).toBe(404);
    expect(await listIds(player)).toContain(p.id);
  });

  test('public: others can see but not change', async () => {
    const p = await (await create(player, { name: uname() })).json();
    expect(p.visibility).toBe('private'); // default
    const patch = await player.request.patch(`/api/music/playlists/${p.id}`, { data: { visibility: 'public' } });
    expect(patch.status()).toBe(200);
    const list = await (await player2.request.get('/api/music/playlists')).json();
    expect(list.find((x: any) => x.id === p.id)).toMatchObject({ canEdit: false, trackCount: 0 });
    const detail = await (await player2.request.get(`/api/music/playlists/${p.id}`)).json();
    expect(detail).toMatchObject({ canEdit: false, tracks: [] });
    expect((await player2.request.patch(`/api/music/playlists/${p.id}`, { data: { name: 'x' } })).status()).toBe(403);
    expect((await player2.request.delete(`/api/music/playlists/${p.id}`)).status()).toBe(403);
  });

  test('validation: name and visibility', async () => {
    for (const data of [{ name: '' }, { name: '   ' }, { name: 'a'.repeat(81) }, { name: uname(), visibility: 'secret' }]) {
      expect((await player.request.post('/api/music/playlists', { data })).status(), JSON.stringify(data).slice(0, 40)).toBe(400);
    }
  });

  test('site playlist: DM edits, only admin sets default, never private or deleted', async () => {
    const site = (await (await dm.request.get('/api/music/site')).json()).playlist;
    const other = await (await create(player, { name: uname() })).json();
    const orig = site.name;
    try {
      expect((await dm.request.patch(`/api/music/playlists/${site.id}`, { data: { name: `${orig} (e2e)` } })).status()).toBe(200);
      expect((await dm.request.post(`/api/music/playlists/${other.id}/site-default`)).status()).toBe(403);
      expect((await admin.request.patch(`/api/music/playlists/${site.id}`, { data: { visibility: 'private' } })).status()).toBe(400);
      const del = await admin.request.delete(`/api/music/playlists/${site.id}`);
      expect(del.status()).toBe(409);
      expect((await del.json()).error).toContain('site playlist');
    } finally {
      await dm.request.patch(`/api/music/playlists/${site.id}`, { data: { name: orig } });
    }
  });

  test('switch site: the new default becomes public and the only one', async () => {
    const original = (await (await admin.request.get('/api/music/site')).json()).playlist;
    const p = await (await create(admin, { name: uname(), visibility: 'private' })).json();
    try {
      expect((await admin.request.post(`/api/music/playlists/${p.id}/site-default`)).status()).toBe(200);
      const now = (await (await admin.request.get('/api/music/site')).json()).playlist;
      expect(now).toMatchObject({ id: p.id, visibility: 'public', isSiteDefault: true });
      const list = await (await admin.request.get('/api/music/playlists')).json();
      expect(list.filter((x: any) => x.isSiteDefault).map((x: any) => x.id)).toEqual([p.id]);
    } finally {
      await admin.request.post(`/api/music/playlists/${original.id}/site-default`);
    }
    expect((await (await admin.request.get('/api/music/site')).json()).playlist.id).toBe(original.id);
  });

  test('tracks: upload, YouTube, order, rename, delete', async () => {
    const p = await (await create(player, { name: uname(), visibility: 'public' })).json();
    const base = `/api/music/playlists/${p.id}`;
    const get = async () => (await (await player.request.get(base)).json()).tracks as any[];

    // upload: one good, one bad, in a single request
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(wav(5))], { type: 'audio/wav' }), 'Rain.wav');
    form.append('file', new Blob(['hi'], { type: 'text/plain' }), 'notes.txt');
    const up = await player.request.post(`${base}/tracks`, { multipart: form });
    expect(up.status()).toBe(201);
    const results = (await up.json()).results;
    expect(results[0]).toMatchObject({ name: 'Rain.wav', ok: true, track: { title: 'Rain', kind: 'file' } });
    const wavTrack = results[0].track;
    expect(wavTrack.ref).toMatch(/^\/uploads\/music\/[0-9a-f-]{36}\.wav$/);
    expect((await player.request.get(wavTrack.ref)).status()).toBe(200);
    expect(results[1]).toMatchObject({ name: 'notes.txt', ok: false, error: expect.stringContaining('Unsupported format') });

    const two = await player.request.post(`${base}/tracks`, {
      multipart: { file: { name: 'Wind.wav', mimeType: 'audio/wav', buffer: wav(1) } },
    });
    expect(two.status()).toBe(201);

    // too big
    const big = await player.request.post(`${base}/tracks`, {
      multipart: { file: { name: 'big.mp3', mimeType: 'audio/mpeg', buffer: Buffer.alloc(50 * 1024 * 1024 + 1) } },
    });
    expect(big.status()).toBe(400);
    expect((await big.json()).results[0].error).toBe('File is larger than 50 MB');

    // YouTube
    const V = 'dQw4w9WgXcQ', L = 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG';
    const yt = await player.request.post(`${base}/tracks`, { data: { youtubeUrl: `https://youtu.be/${V}`, title: 'Test video' } });
    expect(yt.status()).toBe(201);
    const ytTrack = await yt.json();
    expect(ytTrack).toMatchObject({ kind: 'youtube_video', ref: V, title: 'Test video' });
    const both = `https://www.youtube.com/watch?v=${V}&list=${L}`;
    const need = await player.request.post(`${base}/tracks`, { data: { youtubeUrl: both, title: 'x' } });
    expect(need.status()).toBe(409);
    expect((await need.json()).needsMode).toBe(true);
    const pl = await player.request.post(`${base}/tracks`, { data: { youtubeUrl: both, mode: 'playlist', title: 'Mix' } });
    expect(pl.status()).toBe(201);
    expect(await pl.json()).toMatchObject({ kind: 'youtube_playlist', ref: L });
    expect((await player.request.post(`${base}/tracks`, { data: { youtubeUrl: 'https://example.com' } })).status()).toBe(400);

    // positions increase
    let tracks = await get();
    expect(tracks.map((t) => t.position)).toEqual([...tracks.keys()].map((i) => tracks[0].position + i));
    expect(tracks).toHaveLength(4);

    // order
    const ids = tracks.map((t) => t.id);
    const put = (trackIds: string[]) => player.request.put(`${base}/order`, { data: { trackIds } });
    expect((await put([...ids].reverse())).status()).toBe(200);
    expect((await get()).map((t) => t.id)).toEqual([...ids].reverse());
    const current = (await get()).map((t) => t.id);
    for (const bad of [current.slice(1), [...current.slice(1), 'foreign-id'], [current[0], ...current]]) {
      expect((await put(bad)).status()).toBe(400);
      expect((await get()).map((t) => t.id)).toEqual(current);
    }

    // rename
    expect((await player2.request.patch(`/api/music/tracks/${ytTrack.id}`, { data: { title: 'Nope' } })).status()).toBe(403);
    const ren = await player.request.patch(`/api/music/tracks/${ytTrack.id}`, { data: { title: 'Renamed' } });
    expect(ren.status()).toBe(200);
    expect((await ren.json()).title).toBe('Renamed');
    expect((await player.request.patch(`/api/music/tracks/${ytTrack.id}`, { data: { title: '' } })).status()).toBe(400);

    // delete removes the file
    expect((await player2.request.delete(`/api/music/tracks/${wavTrack.id}`)).status()).toBe(403);
    expect((await player.request.delete(`/api/music/tracks/${wavTrack.id}`)).status()).toBe(200);
    expect((await player.request.get(wavTrack.ref)).status()).toBe(404);
    expect((await get()).map((t) => t.id)).not.toContain(wavTrack.id);
  });

  test('tracks: private playlist hides tracks, logged-out is 401', async ({ request }) => {
    const p = await (await create(player, { name: uname(), visibility: 'private' })).json();
    const t = await (await player.request.post(`/api/music/playlists/${p.id}/tracks`, { data: { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', title: 'T' } })).json();
    expect((await request.post(`/api/music/playlists/${p.id}/tracks`, { data: { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' } })).status()).toBe(401);
    expect((await player2.request.post(`/api/music/playlists/${p.id}/tracks`, { data: { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' } })).status()).toBe(404);
    expect((await player2.request.patch(`/api/music/tracks/${t.id}`, { data: { title: 'x' } })).status()).toBe(404);
    expect((await player2.request.put(`/api/music/playlists/${p.id}/order`, { data: { trackIds: [] } })).status()).toBe(404);
    expect((await request.delete(`/api/music/tracks/${t.id}`)).status()).toBe(401);
  });

  test('uploads: audio is served with its MIME type and Range support', async () => {
    const p = await (await create(player, { name: uname(), visibility: 'public' })).json();
    const up = await player.request.post(`/api/music/playlists/${p.id}/tracks`, {
      multipart: { file: { name: 'Rain.wav', mimeType: 'audio/wav', buffer: wav(2) } },
    });
    expect(up.status()).toBe(201);
    const ref = (await up.json()).results[0].track.ref as string;

    const full = await player.request.get(ref);
    expect(full.status()).toBe(200);
    expect(full.headers()['content-type']).toBe('audio/wav');
    expect(full.headers()['accept-ranges']).toBe('bytes');
    const size = (await full.body()).length;

    const part = await player.request.get(ref, { headers: { Range: 'bytes=0-99' } });
    expect(part.status()).toBe(206);
    expect(part.headers()['content-type']).toBe('audio/wav');
    expect(part.headers()['content-range']).toBe(`bytes 0-99/${size}`);
    expect((await part.body()).length).toBe(100);
  });
});

// ── Music player (store + mini bar), logged in as player; desktop and Pixel 5 ─
test.describe('Music player', () => {
  test.skip(!haveAccounts, 'Needs the E2E_* accounts (test server only)');
  test.describe.configure({ mode: 'serial' });

  let owner: BrowserContext;
  let playlist: { id: string; name: string; tracks: { id: string; kind: string; title: string; ref: string }[] };

  test.beforeAll(async ({ browser }) => {
    owner = await browser.newContext();
    await login(owner, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
    const p = await (await owner.request.post('/api/music/playlists', { data: { name: `E2E player ${Date.now()}`, visibility: 'private' } })).json();
    for (const name of ['Rain.wav', 'Wind.wav']) {
      const up = await owner.request.post(`/api/music/playlists/${p.id}/tracks`, {
        multipart: { file: { name, mimeType: 'audio/wav', buffer: wav(20) } },
      });
      expect(up.status()).toBe(201);
    }
    playlist = await (await owner.request.get(`/api/music/playlists/${p.id}`)).json();
    expect(playlist.tracks.map((t) => t.title)).toEqual(['Rain', 'Wind']);
  });

  test.afterAll(async () => {
    if (playlist) await owner.request.delete(`/api/music/playlists/${playlist.id}`);
    await owner?.close();
  });

  test.beforeEach(async ({ context }) => {
    await login(context, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
  });

  const asQueue = (tracks: typeof playlist.tracks) => tracks.map(({ id, kind, title, ref }) => ({ id, kind, title, ref }));
  async function start(page: import('@playwright/test').Page, tracks = asQueue(playlist.tracks)) {
    await page.goto('/');
    await page.waitForFunction(() => !!window.__music);
    await page.evaluate(({ id, name, tracks }) => window.__music.playPlaylist({ id, name, tracks: tracks as any }), { id: playlist.id, name: playlist.name, tracks });
  }
  const audio = (page: import('@playwright/test').Page) => page.locator('#music-audio');
  const currentTime = (page: import('@playwright/test').Page) => audio(page).evaluate((a: HTMLAudioElement) => a.currentTime);
  const paused = (page: import('@playwright/test').Page) => audio(page).evaluate((a: HTMLAudioElement) => a.paused);
  async function navTo(page: import('@playwright/test').Page, href: string, isMobile: boolean) {
    if (isMobile) {
      await page.locator('#mobileMenuBtn').click();
      await page.locator(`#mobileMenu a[href="${href}"]`).click();
    } else {
      await page.locator(`[data-testid="desktop-nav"] a[href="${href}"]`).click();
    }
    await page.waitForURL(`**${href}`);
  }

  test('keeps playing across pages', async ({ page, isMobile }) => {
    await start(page);
    const bar = page.locator('#music-bar');
    await expect(bar).toBeVisible();
    await expect(page.locator('#music-title')).toHaveText('Rain');
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0.2);
    const t1 = await currentTime(page);
    // A marker on window survives client-side navigation but not a full page load
    await page.evaluate(() => ((window as any).__noReload = true));
    await navTo(page, '/characters', isMobile);
    await navTo(page, '/npcs', isMobile);
    expect(await page.evaluate(() => (window as any).__noReload)).toBe(true);
    await expect.poll(() => currentTime(page)).toBeGreaterThan(t1);
    expect(await paused(page)).toBe(false);
    await expect(bar).toBeVisible();
    await expect(page.locator('#music-title')).toHaveText('Rain');
  });

  test('next and stop', async ({ page }) => {
    await start(page);
    await expect(page.locator('#music-title')).toHaveText('Rain');
    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(page.locator('#music-title')).toHaveText('Wind');
    await expect.poll(() => paused(page)).toBe(false);
    await page.getByRole('button', { name: 'Stop and close player' }).click();
    await expect(page.locator('#music-bar')).toBeHidden();
    expect(await paused(page)).toBe(true);
  });

  test('skips unplayable', async ({ page }) => {
    const missing = { id: 'missing', kind: 'file', title: 'Ghost', ref: '/uploads/music/nope.wav' };
    await start(page, [missing, ...asQueue(playlist.tracks).slice(0, 1)]);
    await expect(page.locator('#arandor-toasts')).toContainText('Skipped: Ghost (not playable)');
    await expect(page.locator('#music-title')).toHaveText('Rain');
    await expect.poll(() => paused(page)).toBe(false);
  });

  // ── YouTube (real youtube.com; desktop Chromium only) ──
  // YouTube refuses to embed into a page whose origin is a bare IP (error 150 for every video),
  // so these tests open the test server as localhost instead of 127.0.0.1.
  test.describe('YouTube', () => {
    test.skip(({ isMobile }) => isMobile, 'Desktop Chromium only');
    test.skip(!!E.CI_OFFLINE, 'Needs youtube.com (CI_OFFLINE is set)');
    test.use({ baseURL: async ({ baseURL }, use) => use(baseURL?.replace('//127.0.0.1', '//localhost')) });

    const ytState = (page: import('@playwright/test').Page) => page.evaluate(() => window.__music.getState());
    const ytVideo = { id: 'yt-rick', kind: 'youtube_video', title: 'Never Gonna', ref: 'dQw4w9WgXcQ' };
    /** The YouTube track at queue index `i` is current and playing past `sec` seconds. */
    const ytPlaying = (page: import('@playwright/test').Page, sec: number, i = 0) =>
      expect.poll(async () => { const s = await ytState(page); return s.index === i && s.playing && s.position > sec; }, { timeout: 20_000 }).toBe(true);

    test('tile while a video plays, audio after next', async ({ page }) => {
      await start(page, [ytVideo, ...asQueue(playlist.tracks).slice(0, 1)]);
      const frame = page.locator('#music-yt-tile iframe');
      await expect(frame).toBeVisible({ timeout: 20_000 });
      const box = await frame.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(200);
      expect(box!.height).toBeGreaterThanOrEqual(200);
      await expect(page.locator('#music-title')).toHaveText('Never Gonna');
      await ytPlaying(page, 1);

      // ▾ shrinks the tile to its minimum, never below 200×200 and never hidden
      await page.getByRole('button', { name: 'Shrink video' }).click();
      const small = await frame.boundingBox();
      expect(small!.width).toBeGreaterThanOrEqual(200);
      expect(small!.height).toBeGreaterThanOrEqual(200);
      expect(small!.width * small!.height).toBeLessThan(box!.width * box!.height);
      await page.getByRole('button', { name: 'Enlarge video' }).click();

      // Navigation keeps the same iframe playing (Chromium moves it with moveBefore)
      await frame.evaluate((f) => { f.dataset.e2e = 'first'; });
      const t1 = (await ytState(page)).position;
      await navTo(page, '/characters', false);
      await navTo(page, '/npcs', false);
      await expect(page.locator('#music-yt-tile iframe[data-e2e="first"]')).toBeVisible();
      await ytPlaying(page, t1 + 1);

      await page.getByRole('button', { name: 'Next track' }).click();
      await expect(page.locator('#music-title')).toHaveText('Rain');
      await expect(page.locator('#music-yt-tile')).toBeHidden();
      await expect(page.locator('#music-yt-tile iframe')).toHaveCount(0);
      await expect.poll(() => paused(page)).toBe(false);
      expect((await ytState(page)).youtubeVisible).toBe(false);
    });

    test('resumes where it was when the iframe reloads', async ({ page }) => {
      await start(page, [ytVideo]);
      await ytPlaying(page, 4);
      const t1 = (await ytState(page)).position;
      // What Firefox/WebKit do on a page swap without moveBefore(): detach and re-attach the
      // persisted element, which reloads the iframe inside it.
      await page.evaluate(() => {
        const tile = document.getElementById('music-yt-tile')!;
        tile.querySelector('iframe')!.dataset.e2e = 'old';
        const parent = tile.parentNode!, next = tile.nextSibling;
        document.documentElement.appendChild(tile);
        parent.insertBefore(tile, next);
        document.dispatchEvent(new Event('astro:after-swap'));
      });
      await expect(page.locator('#music-yt-tile iframe:not([data-e2e="old"])')).toHaveCount(1, { timeout: 20_000 });
      await ytPlaying(page, 0);
      const t2 = (await ytState(page)).position;
      expect(t2).toBeGreaterThanOrEqual(t1 - 1);
      expect(t2).toBeLessThan(t1 + 10);
    });

    test('stops at the end of the queue and seeking then stays paused', async ({ page }) => {
      await start(page, [ytVideo]);
      await ytPlaying(page, 1);
      const dur = (await ytState(page)).duration;
      expect(dur).toBeGreaterThan(10);
      await page.evaluate((d) => window.__music.seek(d - 2), dur);
      // Repeat off, last track: stop, paused at 0 - and stay stopped (no loop)
      await expect.poll(async () => { const s = await ytState(page); return !s.playing && s.position === 0; }, { timeout: 15_000 }).toBe(true);
      await page.waitForTimeout(2500);
      expect((await ytState(page)).playing).toBe(false);
      expect((await ytState(page)).position).toBe(0);
      // Seeking while stopped (cued) must not start playback either
      await page.evaluate(() => window.__music.seek(30));
      await page.waitForTimeout(2000);
      const s = await ytState(page);
      expect(s.playing).toBe(false);
      expect(s.position).toBe(30);
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    });

    test('unplayable video is skipped', async ({ page }) => {
      const broken = { id: 'yt-broken', kind: 'youtube_video', title: 'Broken', ref: 'xxxxxxxxxxx' };
      await start(page, [broken, ...asQueue(playlist.tracks).slice(0, 1)]);
      await expect(page.locator('#arandor-toasts')).toContainText('Skipped: Broken (not playable)', { timeout: 20_000 });
      await expect(page.locator('#music-title')).toHaveText('Rain');
      await expect(page.locator('#music-yt-tile')).toBeHidden();
      await expect.poll(() => paused(page)).toBe(false);
    });
  });

  test('restores paused', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await start(page);
    await expect.poll(() => currentTime(page)).toBeGreaterThan(1);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await expect(page.locator('#music-bar')).toBeVisible();
    await expect(page.locator('#music-title')).toHaveText('Rain');
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0.5);
    await page.waitForTimeout(500);
    expect(await paused(page)).toBe(true);
    expect(await page.evaluate(() => window.__music.getState().playing)).toBe(false);

    // The saved playlist is gone: the saved state is dropped silently
    const del = await owner.request.delete(`/api/music/playlists/${playlist.id}`);
    expect(del.ok()).toBe(true);
    playlist = undefined as any;
    await page.reload();
    await page.waitForFunction(() => !!window.__music);
    await page.waitForTimeout(800);
    await expect(page.locator('#music-bar')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('arandor.music') ?? '{}').source ?? null)).toBeNull();
    expect(errors).toEqual([]);
  });
});

// ── Tools → Music page (UI), desktop and Pixel 5 ─────────────────────────────
test.describe('Music page', () => {
  test.skip(!haveAccounts, 'Needs the E2E_* accounts (test server only)');
  test.describe.configure({ mode: 'serial' });

  const V = 'dQw4w9WgXcQ', L = 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG';
  let admin: BrowserContext;
  const created: string[] = [];
  let name = '';
  let id = '';

  test.beforeAll(async ({ browser }) => {
    admin = await browser.newContext();
    await login(admin, E.E2E_ADMIN!, E.E2E_ADMIN_PASSWORD!);
  });

  test.afterAll(async () => {
    for (const pid of created) await admin.request.delete(`/api/music/playlists/${pid}`);
    await admin?.close();
  });

  const titles = (page: import('@playwright/test').Page) => page.locator('#mp-tracks .mp-title');

  test('player creates a playlist and uploads a file', async ({ page, context }) => {
    await login(context, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
    await page.goto('/tools');
    await expect(page.locator('a[href="/tools/music"]')).toContainText('Playlists from your files and YouTube');
    await page.goto('/tools/music');
    name = `E2E page ${Date.now()}`;
    await page.locator('#mp-new-name').fill(name);
    await page.locator('#mp-new-create').click();
    await expect(page.locator('#mp-name')).toHaveText(name);
    await expect(page).toHaveURL(/[?&]playlist=/);
    id = new URL(page.url()).searchParams.get('playlist')!;
    created.push(id);
    await expect(page.locator('[data-group="mine"] .mp-item', { hasText: name })).toBeVisible();

    await page.locator('#mp-file').setInputFiles({ name: 'Rain.wav', mimeType: 'audio/wav', buffer: wav(3) });
    await expect(page.locator('#mp-uploads li', { hasText: 'Rain.wav' })).toContainText('Added');
    await expect(titles(page)).toHaveText(['Rain']);

    await page.locator('#mp-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await expect(page.locator('#mp-uploads li', { hasText: 'notes.txt' })).toContainText('Unsupported format');
    await expect(titles(page)).toHaveText(['Rain']);

    // ▶ on a row plays the playlist from there; the row is marked as current
    await page.locator('#mp-tracks li').first().getByRole('button', { name: 'Play Rain' }).click();
    await expect(page.locator('#mp-tracks li').first()).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('#music-title')).toHaveText('Rain');
    await page.evaluate(() => window.__music.stop());
  });

  test('YouTube links, with the two-choice prompt', async ({ page, context }) => {
    await login(context, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
    await page.goto(`/tools/music?playlist=${id}`);
    await expect(page.locator('#mp-name')).toHaveText(name);
    await page.locator('#mp-yt-url').fill(`https://youtu.be/${V}`);
    await page.locator('#mp-yt-title').fill('Tavern Ambience');
    await page.locator('#mp-yt-add').click();
    await expect(titles(page)).toHaveText(['Rain', 'Tavern Ambience']);

    await page.locator('#mp-yt-url').fill(`https://www.youtube.com/watch?v=${V}&list=${L}`);
    await page.locator('#mp-yt-title').fill('Boss Theme');
    await page.locator('#mp-yt-add').click();
    const choice = page.locator('#mp-yt-choice');
    await expect(choice).toBeVisible();
    await expect(choice).toContainText('This video or the whole playlist?');
    await choice.getByRole('button', { name: 'The whole playlist' }).click();
    await expect(titles(page)).toHaveText(['Rain', 'Tavern Ambience', 'Boss Theme']);
    await expect(choice).toBeHidden();
    const tracks = (await (await context.request.get(`/api/music/playlists/${id}`)).json()).tracks;
    expect(tracks.map((t: any) => [t.kind, t.ref])).toEqual([['file', expect.any(String)], ['youtube_video', V], ['youtube_playlist', L]]);
  });

  test('drag to reorder persists after reload', async ({ page, context, isMobile }) => {
    await login(context, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
    await page.goto(`/tools/music?playlist=${id}`);
    await expect(titles(page)).toHaveText(['Rain', 'Tavern Ambience', 'Boss Theme']);
    await page.locator('#mp-tracks').scrollIntoViewIfNeeded();
    const handle = page.locator('#mp-tracks li', { hasText: 'Boss Theme' }).locator('.mp-handle');
    const from = (await handle.boundingBox())!;
    const to = (await page.locator('#mp-tracks li').first().boundingBox())!;
    const saved = page.waitForResponse((r) => r.url().endsWith(`/api/music/playlists/${id}/order`) && r.request().method() === 'PUT');
    const x = from.x + from.width / 2;
    if (isMobile) {
      // A real touch drag (touch pointer events), as on a phone
      const cdp = await context.newCDPSession(page);
      const touch = (type: string, y?: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: y === undefined ? [] : [{ x, y }] });
      await touch('touchStart', from.y + from.height / 2);
      for (let i = 1; i <= 12; i++) await touch('touchMove', from.y + from.height / 2 + ((to.y + 4 - from.y - from.height / 2) * i) / 12);
      await touch('touchEnd');
    } else {
      await page.mouse.move(x, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(x, to.y + 4, { steps: 12 });
      await page.mouse.up();
    }
    expect((await saved).ok()).toBe(true);
    await expect(titles(page)).toHaveText(['Boss Theme', 'Rain', 'Tavern Ambience']);
    await page.reload();
    await expect(titles(page)).toHaveText(['Boss Theme', 'Rain', 'Tavern Ambience']);
  });

  test('made public, player2 sees it without edit controls', async ({ page, context }) => {
    await login(context, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
    await page.goto(`/tools/music?playlist=${id}`);
    const saved = page.waitForResponse((r) => r.url().endsWith(`/api/music/playlists/${id}`) && r.request().method() === 'PATCH');
    await page.locator('#mp-public').check();
    expect((await saved).ok()).toBe(true);

    await login(context, E.E2E_PLAYER2!, E.E2E_PLAYER2_PASSWORD!);
    await page.goto('/tools/music');
    const item = page.locator('[data-group="public"] .mp-item', { hasText: name });
    await expect(item).toBeVisible();
    await item.click();
    await expect(page.locator('#mp-name')).toHaveText(name);
    await expect(titles(page)).toHaveText(['Boss Theme', 'Rain', 'Tavern Ambience']);
    await expect(page.locator('#mp-play')).toBeVisible();
    await expect(page.locator('#mp-edit')).toBeHidden();
    await expect(page.locator('#mp-tracks .mp-handle')).toHaveCount(0);
    await expect(page.locator('#mp-tracks .mp-del')).toHaveCount(0);
    await expect(page.locator('[data-group="others"]')).toHaveCount(0);
  });

  test('site playlist: DM edits it, only admin can make a site playlist', async ({ page, context }) => {
    const site = (await (await context.request.get('/api/music/site')).json()).playlist;
    await login(context, E.E2E_DM!, E.E2E_DM_PASSWORD!);
    await page.goto(`/tools/music?playlist=${site.id}`);
    await expect(page.locator('#mp-name')).toHaveText(site.name);
    await expect(page.locator('#mp-edit')).toBeVisible();
    await expect(page.locator('#mp-public')).toBeDisabled();
    await expect(page.locator('#mp-public')).toBeChecked();
    await expect(page.locator('#mp-delete')).toBeHidden();
    await expect(page.locator('#mp-site')).toBeHidden();

    // a private playlist of player2: only the admin sees it, under "All others"
    const p2 = await browserlessCreate(context);
    created.push(p2.id);
    await login(context, E.E2E_ADMIN!, E.E2E_ADMIN_PASSWORD!);
    await page.goto(`/tools/music?playlist=${id}`);
    await expect(page.locator('#mp-name')).toHaveText(name);
    await expect(page.locator('#mp-site')).toBeVisible();
    await expect(page.locator('#mp-delete')).toBeVisible();
    await expect(page.locator('[data-group="others"] .mp-item', { hasText: p2.name })).toBeVisible();
    await page.goto(`/tools/music?playlist=${site.id}`);
    await expect(page.locator('#mp-name')).toHaveText(site.name);
    await expect(page.locator('#mp-site')).toBeHidden();
  });

  async function browserlessCreate(context: BrowserContext) {
    await login(context, E.E2E_PLAYER2!, E.E2E_PLAYER2_PASSWORD!);
    const res = await context.request.post('/api/music/playlists', { data: { name: `E2E private ${Date.now()}`, visibility: 'private' } });
    expect(res.status()).toBe(201);
    return res.json();
  }

  test('rename, delete track, delete playlist', async ({ page, context }) => {
    await login(context, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
    await page.goto(`/tools/music?playlist=${id}`);
    await page.locator('#mp-tracks li', { hasText: 'Rain' }).locator('.mp-title').click();
    const input = page.locator('#mp-tracks input.mp-rename');
    await input.fill('Heavy Rain');
    await input.press('Enter');
    await expect(titles(page)).toHaveText(['Boss Theme', 'Heavy Rain', 'Tavern Ambience']);

    await page.locator('#mp-name').click();
    await page.locator('#mp-name-input').fill(`${name} 2`);
    await page.locator('#mp-name-input').press('Enter');
    await expect(page.locator('#mp-name')).toHaveText(`${name} 2`);
    await expect(page.locator('[data-group="mine"] .mp-item', { hasText: `${name} 2` })).toBeVisible();

    await page.locator('#mp-tracks li', { hasText: 'Tavern Ambience' }).locator('.mp-del').click();
    await page.locator('[data-confirm]').click();
    await expect(titles(page)).toHaveText(['Boss Theme', 'Heavy Rain']);

    await page.locator('#mp-delete').click();
    await page.locator('[data-confirm]').click();
    await expect(page.locator('.mp-item', { hasText: `${name} 2` })).toHaveCount(0);
    expect((await context.request.get(`/api/music/playlists/${id}`)).status()).toBe(404);
  });
});
