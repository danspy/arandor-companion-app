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
