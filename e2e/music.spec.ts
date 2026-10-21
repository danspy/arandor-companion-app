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
    expect(audioFileCheck('Old Song.mpga', 1)).toEqual({ ok: true, ext: 'mpga', title: 'Old Song' });
    expect(audioFileCheck('x.MPEG', 1)).toMatchObject({ ok: true, ext: 'mpeg' });
    expect(audioFileCheck('x.mp2', 1)).toMatchObject({ ok: false });
    expect(audioFileCheck('x.mp2', 1)).toEqual({
      ok: false,
      error: 'Unsupported format (allowed: mp3, mpga, mpeg, m4a, aac, ogg, opus, webm, flac, wav)',
    });
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
if (process.env.E2E_BASE_URL) test.use({ baseURL: process.env.E2E_BASE_URL });
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
    // The dashboard switch is gone: showOnDashboard alone is nothing to change
    const site = (await (await dm.request.get('/api/music/site')).json()).playlist;
    expect((await dm.request.patch(`/api/music/playlists/${site.id}`, { data: { showOnDashboard: false } })).status()).toBe(400);
  });

  test('import: YouTube video ids become separate tracks', async ({ request }) => {
    const p = await (await create(player, { name: uname(), visibility: 'public' })).json();
    const first = await player.request.post(`/api/music/playlists/${p.id}/tracks`, { data: { youtubeUrl: 'https://youtu.be/e2eFirst000', title: 'First' } });
    expect(first.status()).toBe(201);
    const url = `/api/music/playlists/${p.id}/import`;
    const ids = ['e2eImport01', 'e2e-Import2', 'e2e_Import3'];
    const titles = { e2eImport01: 'One', 'e2e-Import2': 'Two', e2e_Import3: 'Three' };
    const res = await player.request.post(url, { data: { videoIds: [ids[0], ids[1], ids[0], ids[2], ids[1]], titles } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.added).toBe(3);
    expect(body.tracks.map((t: any) => [t.kind, t.ref, t.title, t.position])).toEqual([
      ['youtube_video', ids[0], 'One', 1], ['youtube_video', ids[1], 'Two', 2], ['youtube_video', ids[2], 'Three', 3],
    ]);
    const detail = await (await player.request.get(`/api/music/playlists/${p.id}`)).json();
    expect(detail.tracks.map((t: any) => t.title)).toEqual(['First', 'One', 'Two', 'Three']);
    expect(detail.tracks.map((t: any) => t.position)).toEqual([0, 1, 2, 3]);

    const many = Array.from({ length: 201 }, (_, i) => `e2eMany${String(i).padStart(4, '0')}`);
    const huge = Array(1001).fill('e2eImport01'); // rejected on length alone (even as duplicates)
    for (const videoIds of [many, huge, [], ['short'], ['e2eImport01', 'bad id here'], 'e2eImport01', undefined]) {
      const r = await player.request.post(url, { data: { videoIds, titles } });
      expect(r.status(), String(JSON.stringify(videoIds)).slice(0, 40)).toBe(400);
      expect((await r.json()).error).toBeTruthy();
    }
    expect((await player2.request.post(url, { data: { videoIds: ids, titles } })).status()).toBe(403);
    expect((await request.post(url, { data: { videoIds: ids, titles } })).status()).toBe(401);
    expect((await player.request.post('/api/music/playlists/nope/import', { data: { videoIds: ids, titles } })).status()).toBe(404);
    expect((await (await player.request.get(`/api/music/playlists/${p.id}`)).json()).tracks).toHaveLength(4);
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

    // .mpga is accepted and served as audio/mpeg
    const mpga = await player.request.post(`${base}/tracks`, {
      multipart: { file: { name: 'Song.mpga', mimeType: 'audio/mpeg', buffer: wav(1) } },
    });
    expect(mpga.status()).toBe(201);
    const mpgaRes = (await mpga.json()).results[0];
    expect(mpgaRes.ok).toBe(true);
    expect(mpgaRes.track.ref).toMatch(/\.mpga$/);
    expect((await player.request.get(mpgaRes.track.ref)).headers()['content-type']).toBe('audio/mpeg');
    expect((await player.request.delete(`/api/music/tracks/${mpgaRes.track.id}`)).status()).toBe(200);

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

// A stand-in for YouTube's IFrame API that records which player methods are called, for
// YouTube playlists (they can't play from the test server: error 150). Mirrors YouTube:
// loadPlaylist/nextVideo/previousVideo and seekTo from CUED start playback; cuePlaylist doesn't.
// getPlaylist() returns window.__ytLists[listId] when a test sets it.
const FAKE_YT_API = `(() => {
  const calls = window.__ytCalls = [];
  class Player {
    constructor(el, opts) {
      this.ev = opts.events || {}; this.state = -1; this.t = 0; this.i = 0; this.list = ['a', 'b', 'c'];
      const host = el.parentElement, r = host ? host.getBoundingClientRect() : { width: 0, height: 0 };
      (window.__ytHosts = window.__ytHosts || []).push({ cls: host ? host.className : '', w: r.width, h: r.height });
      this.f = document.createElement('iframe'); this.f.id = 'fake-yt'; el.replaceWith(this.f);
      setTimeout(() => this.ev.onReady && this.ev.onReady(), 10);
    }
    set(s) { this.state = s; setTimeout(() => this.ev.onStateChange && this.ev.onStateChange({ data: s }), 10); }
    rec(name, arg) { calls.push({ name, arg: arg === undefined ? null : arg, state: this.state }); }
    getIframe() { return this.f; }
    setVolume() {}
    loadPlaylist(o) { this.rec('loadPlaylist', o); this.listId = o.list; this.i = o.index || 0; this.t = o.startSeconds || 0; this.set(1); }
    cuePlaylist(o) { this.rec('cuePlaylist', o); this.listId = o.list; this.i = o.index || 0; this.t = o.startSeconds || 0; this.set(5); }
    loadVideoById(id, t) { this.rec('loadVideoById', id); this.t = t || 0; this.set(1); }
    cueVideoById(id, t) { this.rec('cueVideoById', id); this.t = t || 0; this.set(5); }
    playVideo() { this.rec('playVideo'); this.set(1); }
    pauseVideo() { this.rec('pauseVideo'); this.set(2); }
    seekTo(t) { this.rec('seekTo', t); this.t = t; if (this.state !== 2) this.set(1); }
    nextVideo() { this.rec('nextVideo'); this.i++; this.t = 0; this.set(1); }
    previousVideo() { this.rec('previousVideo'); this.i--; this.t = 0; this.set(1); }
    getCurrentTime() { return this.t; }
    getDuration() { return 100; }
    getPlayerState() { return this.state; }
    getPlaylist() { return (window.__ytLists && window.__ytLists[this.listId]) || this.list; }
    getPlaylistIndex() { return this.i; }
    getVideoData() { return { title: 'Entry ' + this.list[this.i], video_id: this.list[this.i] }; }
    destroy() { this.f.remove(); }
  }
  window.YT = { Player, get: () => window.__ytPlayer };
  const P = Player; window.YT.Player = function (el, o) { return (window.__ytPlayer = new P(el, o)); };
  window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();
})();`;

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

  test('mini bar shows a display-only progress line', async ({ page }) => {
    await start(page);
    const fill = page.locator('#music-bar #music-progress-fill');
    await expect(page.locator('#music-bar #music-progress')).toBeVisible();
    const frac = async () => fill.evaluate((e: HTMLElement) => Number(/scaleX\(([\d.e-]+)\)/.exec(e.style.transform)?.[1] ?? NaN));
    await expect.poll(frac).toBeGreaterThan(0);
    const a = await frac();
    await page.waitForTimeout(1500);
    expect(await frac()).toBeGreaterThan(a);
    await page.getByRole('button', { name: 'Stop and close player' }).click();
    await expect(page.locator('#music-bar')).toBeHidden();
  });

  test('skips unplayable', async ({ page }) => {
    const missing = { id: 'missing', kind: 'file', title: 'Ghost', ref: '/uploads/music/nope.wav' };
    await start(page, [missing, ...asQueue(playlist.tracks).slice(0, 1)]);
    await expect(page.locator('#arandor-toasts')).toContainText('Skipped: Ghost (not playable)');
    await expect(page.locator('#music-title')).toHaveText('Rain');
    await expect.poll(() => paused(page)).toBe(false);
  });

  // A file whose metadata is still loading when its player is dropped (✕, or a switch to
  // YouTube) must not leave the store ignoring time/play events of the next player: a YouTube
  // track would never show its progress (nothing else settles that pending load).
  const ytVideo = { id: 'yt-v', kind: 'youtube_video', title: 'Fake video', ref: 'vid' };
  const st = (page: import('@playwright/test').Page) => page.evaluate(() => window.__music.getState());
  async function expectProgress(page: import('@playwright/test').Page) {
    await expect.poll(async () => (await st(page)).duration).toBeGreaterThan(0);
    await expect.poll(async () => (await st(page)).position).toBeGreaterThan(0.3);
    expect((await st(page)).playing).toBe(true);
  }
  async function playQueue(page: import('@playwright/test').Page, tracks: unknown[]) {
    await page.evaluate(({ id, name, tracks }) => window.__music.playPlaylist({ id, name, tracks: tracks as any }), { id: playlist.id, name: playlist.name, tracks });
  }

  test('stop while a file is loading: the next track still reports time (fake YouTube API)', async ({ page }) => {
    await page.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT_API }));
    await page.goto('/');
    await page.waitForFunction(() => !!window.__music);
    const q = asQueue(playlist.tracks);
    await page.evaluate(({ id, name, q }) => {
      window.__music.playPlaylist({ id, name, tracks: q as any });
      window.__music.stop(); // metadata not loaded yet
    }, { id: playlist.id, name: playlist.name, q });
    await page.waitForTimeout(300);
    await playQueue(page, [ytVideo]);
    await expect(page.locator('#music-title')).toHaveText('Fake video');
    await expect.poll(async () => (await st(page)).duration).toBe(100);
    await playQueue(page, q);
    await expectProgress(page);
    await page.getByRole('button', { name: 'Stop and close player' }).click();
  });

  test('switching to YouTube while a file is loading: time is still reported (fake YouTube API)', async ({ page }) => {
    await page.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT_API }));
    await page.goto('/');
    await page.waitForFunction(() => !!window.__music);
    const q = asQueue(playlist.tracks);
    await page.evaluate(({ id, name, q, yt }) => {
      window.__music.playPlaylist({ id, name, tracks: [q[0], yt] as any });
      window.__music.next(); // drops the audio player before its metadata arrived
    }, { id: playlist.id, name: playlist.name, q, yt: ytVideo });
    await expect(page.locator('#music-title')).toHaveText('Fake video');
    await expect.poll(async () => (await st(page)).duration).toBe(100);
    await playQueue(page, q);
    await expect(page.locator('#music-title')).toHaveText('Rain');
    await expectProgress(page);
    await page.getByRole('button', { name: 'Stop and close player' }).click();
  });

  test('paused YouTube playlist: next/prev cue the entry and stay paused and hidden (fake YouTube API)', async ({ page }) => {
    await page.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT_API }));
    const list = { id: 'yt-list', kind: 'youtube_playlist', title: 'Fake list', ref: 'PLfake' };
    await start(page, [list]);
    const calls = () => page.evaluate(() => (window as any).__ytCalls.splice(0) as { name: string; arg: any; state: number }[]);
    const st = () => page.evaluate(() => window.__music.getState());
    await expect.poll(async () => (await st()).youtubeVisible && (await st()).playing).toBe(true);
    await expect(page.locator('#music-yt-tile')).toBeVisible();
    await expect(page.locator('#music-title')).toHaveText('Entry a');
    // Playing: next moves on inside the list with nextVideo() (keeps playing)
    await calls();
    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(page.locator('#music-title')).toHaveText('Entry b');
    expect((await calls()).map((c) => c.name)).toEqual(['nextVideo']);

    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.locator('#music-yt-tile')).toBeHidden();
    await calls();
    // Paused: next cues entry c (no nextVideo, nothing starts) and the tile stays hidden
    await page.getByRole('button', { name: 'Next track' }).click();
    await expect(page.locator('#music-title')).toHaveText('Entry c');
    let c = await calls();
    expect(c.map((x) => x.name)).toEqual(['cuePlaylist']);
    expect(c[0].arg).toMatchObject({ list: 'PLfake', index: 2, startSeconds: 0 });
    // Paused (cued): prev cues entry b
    await page.getByRole('button', { name: 'Previous track' }).click();
    await expect(page.locator('#music-title')).toHaveText('Entry b');
    c = await calls();
    expect(c.map((x) => x.name)).toEqual(['cuePlaylist']);
    expect(c[0].arg).toMatchObject({ index: 1, startSeconds: 0 });
    // Cued, more than 3 s in: prev restarts the entry by cueing it (seekTo would start it)
    await page.evaluate(() => { (window as any).__ytPlayer.t = 10; });
    await page.getByRole('button', { name: 'Previous track' }).click();
    await expect.poll(async () => (await calls()).map((x) => x.name)).toEqual(['cuePlaylist']);
    await page.waitForTimeout(300);
    const s = await st();
    expect(s.playing).toBe(false);
    expect(s.youtubeVisible).toBe(false);
    expect(s.position).toBe(0);
    await expect(page.locator('#music-yt-tile')).toBeHidden();
    expect(await page.evaluate(() => (window as any).__ytPlayer.state)).not.toBe(1);
    await page.getByRole('button', { name: 'Stop and close player' }).click();
  });

  test('pause during an autoplay load keeps the tile until YouTube has paused (fake YouTube API)', async ({ page }) => {
    // The fake player becomes ready only after 1.5 s, so the pause lands mid-load
    await page.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript',
      body: FAKE_YT_API.replace("setTimeout(() => this.ev.onReady && this.ev.onReady(), 10)", "setTimeout(() => this.ev.onReady && this.ev.onReady(), 1500)") }));
    await start(page, [{ id: 'yt-v', kind: 'youtube_video', title: 'Fake video', ref: 'vid' }]);
    await expect(page.locator('#music-yt-tile')).toBeVisible();
    await page.evaluate(() => {
      const w = window as any;
      w.__bad = 0;
      // Record any moment the fake player plays while the tile is hidden
      setInterval(() => { const p = w.__ytPlayer; const t = document.getElementById('music-yt-tile')!;
        if (p && p.state === 1 && !t.checkVisibility({ visibilityProperty: true } as any)) w.__bad++; }, 5);
      window.__music.pause();
    });
    expect((await page.evaluate(() => window.__music.getState())).youtubeVisible).toBe(true);
    await expect(page.locator('#music-yt-tile')).toBeHidden({ timeout: 5000 });
    expect(await page.evaluate(() => (window as any).__ytPlayer.state)).toBe(2);
    expect(await page.evaluate(() => (window as any).__bad)).toBe(0);
    await page.getByRole('button', { name: 'Stop and close player' }).click();
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

    // ── Hidden while paused (YouTube's terms: only a *playing* player must be visible) ──
    const tile = (page: import('@playwright/test').Page) => page.locator('#music-yt-tile');
    /** Tile shown with the iframe ≥ 200×200 in view. */
    async function expectTileShown(page: import('@playwright/test').Page) {
      await expect(tile(page)).toBeVisible();
      const f = page.locator('#music-yt-tile iframe');
      await expect(f).toBeVisible();
      const box = await f.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(200);
      expect(box!.height).toBeGreaterThanOrEqual(200);
    }
    /** Watches the real YouTube player every 25 ms and records any moment it is PLAYING (1)
     *  while its tile or iframe is not visible at ≥ 200×200. Also counts hidden samples. */
    async function watchHiddenPlayback(page: import('@playwright/test').Page) {
      await page.evaluate(() => {
        const w = window as any;
        w.__ytWatch = { violations: [] as string[], hiddenSamples: 0, hiddenStates: [] as number[] };
        setInterval(() => {
          const t = document.getElementById('music-yt-tile');
          const f = t?.querySelector('iframe');
          if (!t || !f || !f.id) return;
          const state = w.YT?.get?.(f.id)?.getPlayerState?.();
          if (typeof state !== 'number') return;
          const r = f.getBoundingClientRect(), tr = t.getBoundingClientRect();
          const shown = !t.hidden && f.checkVisibility({ visibilityProperty: true, opacityProperty: true } as any) &&
            r.width >= 200 && r.height >= 200 && tr.width >= 200 && tr.height >= 200;
          if (!shown) { w.__ytWatch.hiddenSamples++; w.__ytWatch.hiddenStates.push(state); }
          if (state === 1 && !shown) w.__ytWatch.violations.push(`${Date.now()} playing while hidden`);
        }, 25);
      });
    }
    const watchResult = (page: import('@playwright/test').Page) =>
      page.evaluate(() => (window as any).__ytWatch as { violations: string[]; hiddenSamples: number; hiddenStates: number[] });

    test('tile hides while paused and shows again before it plays', async ({ page }) => {
      await start(page, [ytVideo]);
      await expect(page.locator('#music-yt-tile iframe')).toBeVisible({ timeout: 20_000 });
      await watchHiddenPlayback(page);
      await ytPlaying(page, 1);
      await expectTileShown(page);
      expect((await ytState(page)).youtubeVisible).toBe(true);
      await page.locator('#music-yt-tile iframe').evaluate((f) => { f.dataset.e2e = 'kept'; });

      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect(tile(page)).toBeHidden();
      expect((await ytState(page)).youtubeVisible).toBe(false);
      expect((await ytState(page)).playing).toBe(false);
      // The same iframe element stays (not destroyed or reloaded)
      await expect(page.locator('#music-yt-tile iframe[data-e2e="kept"]')).toHaveCount(1);
      await page.waitForTimeout(1500);
      const hidden = await watchResult(page);
      expect(hidden.hiddenSamples).toBeGreaterThan(10);
      expect(hidden.hiddenStates.filter((s) => s === 1)).toEqual([]);
      const tPaused = (await ytState(page)).position;

      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expectTileShown(page);
      await expect(page.locator('#music-yt-tile iframe[data-e2e="kept"]')).toHaveCount(1);
      await ytPlaying(page, tPaused + 1);
      expect((await ytState(page)).youtubeVisible).toBe(true);
      expect((await watchResult(page)).violations).toEqual([]);

      // Safety net: whatever starts the hidden player (here YouTube's API directly), the tile shows
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect(tile(page)).toBeHidden();
      await page.evaluate(() => {
        const f = document.querySelector<HTMLIFrameElement>('#music-yt-tile iframe')!;
        (window as any).YT.get(f.id).playVideo();
      });
      await expectTileShown(page);
      await expect.poll(async () => { const s = await ytState(page); return s.youtubeVisible && s.playing; }, { timeout: 15_000 }).toBe(true);
    });

    test('restored YouTube track stays hidden until play', async ({ page }) => {
      const add = await owner.request.post(`/api/music/playlists/${playlist.id}/tracks`, { data: { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', title: 'Never Gonna' } });
      expect(add.status()).toBe(201);
      const yt = await add.json();
      try {
        await start(page, [{ id: yt.id, kind: yt.kind, title: yt.title, ref: yt.ref }]);
        await ytPlaying(page, 2);
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
        await page.reload();
        await page.waitForFunction(() => !!window.__music);
        await watchHiddenPlayback(page);
        await expect(page.locator('#music-title')).toHaveText('Never Gonna');
        // Paused restore: the player is cued in the (hidden) tile
        await expect(page.locator('#music-yt-tile iframe')).toHaveCount(1, { timeout: 20_000 });
        await expect.poll(async () => (await watchResult(page)).hiddenSamples, { timeout: 20_000 }).toBeGreaterThan(10);
        await expect(tile(page)).toBeHidden();
        const s = await ytState(page);
        expect(s.playing).toBe(false);
        expect(s.youtubeVisible).toBe(false);

        await page.getByRole('button', { name: 'Play', exact: true }).click();
        await expectTileShown(page);
        await ytPlaying(page, s.position + 1);
        const w = await watchResult(page);
        expect(w.violations).toEqual([]);
        expect(w.hiddenStates.filter((x) => x === 1)).toEqual([]);
      } finally {
        await owner.request.delete(`/api/music/tracks/${yt.id}`);
      }
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
      // Ended and paused: the tile is hidden
      await expect(page.locator('#music-yt-tile')).toBeHidden();
      expect(s.youtubeVisible).toBe(false);
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

  // ── Installed app (standalone, phone): the mini bar against the bottom dock and dice seal ──
  test.describe('PWA mode', () => {
    test.skip(({ isMobile }) => !isMobile, 'Phone (mobile project) only');

    type Box = { x: number; y: number; width: number; height: number };
    const meets = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    const box = async (page: import('@playwright/test').Page, sel: string) => (await page.locator(sel).boundingBox())!;

    /** Standalone display mode. This Chromium ignores CDP's display-mode media emulation
     *  (`Emulation.setEmulatedMedia` leaves `(display-mode: standalone)` false), so the app's own
     *  CSS and HTML are served with that media query switched on; no rules are copied. */
    async function standalone(page: import('@playwright/test').Page) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] });
      if (await page.evaluate(() => matchMedia('(display-mode: standalone)').matches)) return;
      const origin = new URL(E.E2E_BASE_URL ?? test.info().project.use.baseURL ?? 'http://127.0.0.1:4340').origin;
      await page.route((u) => u.origin === origin, async (route) => {
        const res = await route.fetch();
        if (!/text\/(css|html)/.test(res.headers()['content-type'] ?? '')) return route.fulfill({ response: res });
        const body = (await res.text()).replace(/\(display-mode:\s*standalone\)/g, '(min-width: 0px)');
        return route.fulfill({ response: res, body });
      });
    }
    async function tucked(page: import('@playwright/test').Page, on: boolean) {
      await page.evaluate((on) => document.documentElement.classList.toggle('pwa-dock-tucked', on), on);
      await page.waitForTimeout(450); // the bar, the seal and the player slide (0.3 s)
    }
    /** The music button and (open) the mini bar meet neither the dock bar nor the dice seal and lie
     *  fully inside the viewport; the button is at least 44px to tap. */
    async function clear(page: import('@playwright/test').Page, state: string) {
      const vp = page.viewportSize()!;
      const seal = await box(page, '#dice-fab-root button#dice-fab');
      const dock = page.locator('.pwa-dock-root .pwa-dock-bar');
      const d = (await dock.isVisible()) ? await dock.boundingBox() : null;
      const sels = ['#music-fab', ...(await page.locator('#music-bar').isVisible() ? ['#music-bar'] : [])];
      for (const sel of sels) {
        const b = await box(page, sel);
        expect(meets(b, seal), `${state}: ${sel} meets the dice seal`).toBe(false);
        if (d && d.y < vp.height) expect(meets(b, d), `${state}: ${sel} meets the dock`).toBe(false);
        expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width && b.y + b.height <= vp.height, `${state}: ${sel} inside the viewport`).toBe(true);
        expect(Math.min(b.width, b.height), `${state}: ${sel} at least 44px`).toBeGreaterThanOrEqual(44);
      }
      const f = await box(page, '#music-fab');
      expect(f.x, `${state}: music button on the left`).toBeLessThan(seal.x);
    }

    test('music button, mini bar, toasts, page end and YouTube tile clear the dock and the dice seal', async ({ page }) => {
      test.slow(); // every request of the page goes through the route above
      await page.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT_API }));
      await standalone(page);
      await start(page);
      await expect(page.locator('.pwa-dock-root .pwa-dock-bar')).toBeVisible(); // standalone rules apply
      await expect(page.locator('#music-bar')).toBeVisible();
      await expect(page.locator('#music-progress')).toBeVisible();
      await page.waitForTimeout(450);
      await clear(page, 'dock shown');
      // The button sits just above the dock, on the left
      const dockBox = await box(page, '.pwa-dock-root .pwa-dock-bar');
      const shown = await box(page, '#music-fab');
      expect(shown.y + shown.height, 'button above the dock').toBeLessThanOrEqual(dockBox.y);
      expect(dockBox.y - (shown.y + shown.height), 'button close to the dock').toBeLessThanOrEqual(24);
      await tucked(page, true);
      await clear(page, 'dock tucked');
      // ...and drops with the dock when it tucks away
      expect((await box(page, '#music-fab')).y, 'button drops with the dock').toBeGreaterThan(shown.y + 30);
      // Shut: only the button, still clear of everything
      await page.locator('#music-fab').click();
      await expect(page.locator('#music-bar')).not.toBeVisible();
      await page.waitForTimeout(400);
      await clear(page, 'shut, dock tucked');
      await tucked(page, false);
      await clear(page, 'shut, dock shown');
      await page.locator('#music-fab').click();
      await expect(page.locator('#music-bar')).toBeVisible();
      await page.waitForTimeout(400);

      // A toast never covers the mini bar
      await page.evaluate(() => window.alert('Skipped: Ghost (not playable)'));
      const toast = page.locator('#arandor-toasts .arandor-toast');
      await expect(toast).toBeVisible();
      expect(meets(await box(page, '#arandor-toasts .arandor-toast'), await box(page, '#music-bar')), 'toast meets the mini bar').toBe(false);
      await toast.click();

      // Scrolled to the end, the page's last content sits above the mini bar
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(300);
      await tucked(page, false);
      const end = await page.evaluate(() => {
        const m = document.querySelector('main')!;
        return m.getBoundingClientRect().bottom - parseFloat(getComputedStyle(m).paddingBottom);
      });
      expect(end, 'end of the page content is above the mini bar').toBeLessThanOrEqual((await box(page, '#music-bar')).y);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(300);

      // The dice panel opens over the player: button, bar and queue step aside rather than peek out around it
      await page.locator('#dice-fab').click();
      await expect(page.locator('#dice-fab-panel')).toBeVisible();
      await expect(page.locator('#music-bar')).not.toBeVisible();
      await expect(page.locator('#music-fab')).not.toBeVisible();
      await page.locator('#dice-fab').click();
      await expect(page.locator('#dice-fab-panel')).toBeHidden();
      await expect(page.locator('#music-bar')).toBeVisible();
      await expect(page.locator('#music-fab')).toBeVisible();

      // The YouTube tile sits above the mini bar, clear of the dock and the seal
      await page.evaluate(() => window.__music.playPlaylist({ id: 'yt', name: 'YT', tracks: [{ id: 'yt-v', kind: 'youtube_video', title: 'Fake video', ref: 'vid' }] as any }));
      await expect(page.locator('#music-yt-tile')).toBeVisible();
      for (const t of [false, true]) {
        await tucked(page, t);
        const tile = await box(page, '#music-yt-tile');
        const bar = await box(page, '#music-bar');
        expect(tile.y + tile.height, 'tile above the mini bar').toBeLessThanOrEqual(bar.y);
        expect(meets(tile, await box(page, '#dice-fab')), 'tile meets the seal').toBe(false);
        expect(tile.y >= 0 && tile.x + tile.width <= page.viewportSize()!.width, 'tile inside the viewport').toBe(true);
        await clear(page, `YouTube, dock ${t ? 'tucked' : 'shown'}`);
      }
      // Shut while the video plays: the tile stays, right above the button
      await page.locator('#music-fab').click();
      await page.waitForTimeout(400);
      await expect(page.locator('#music-yt-tile')).toBeVisible();
      for (const t of [false, true]) {
        await tucked(page, t);
        const tile = await box(page, '#music-yt-tile');
        expect(tile.y + tile.height, 'tile above the button').toBeLessThanOrEqual((await box(page, '#music-fab')).y);
        expect(meets(tile, await box(page, '#dice-fab')), 'tile meets the seal').toBe(false);
        await clear(page, `YouTube shut, dock ${t ? 'tucked' : 'shown'}`);
      }
      await page.locator('#music-fab').click();
      await tucked(page, false);
      await page.getByRole('button', { name: 'Stop and close player' }).click();
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

    // Offline at the next load (the restore check fails): nothing shown, but the saved state
    // survives the next pagehide and comes back once the server is reachable again
    await page.route('**/api/music/site', (r) => r.abort());
    await page.reload();
    await page.waitForFunction(() => !!window.__music);
    await page.waitForTimeout(800);
    await expect(page.locator('#music-bar')).toBeHidden();
    await page.evaluate(() => window.__music.setVolume(0.5)); // settings still save
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('arandor.music') ?? '{}'));
    expect(kept.source?.playlistId).toBe(playlist.id);
    expect(kept.volume).toBe(0.5);
    await page.unroute('**/api/music/site');
    await page.reload();
    await expect(page.locator('#music-title')).toHaveText('Rain');
    await expect(page.locator('#music-bar')).toBeVisible();
    errors.length = 0; // the aborted request logs a network error

    // The saved playlist is gone: the saved state is dropped silently (and the site playlist, if
    // it has tracks, is cued in its place, unsaved)
    const del = await owner.request.delete(`/api/music/playlists/${playlist.id}`);
    expect(del.ok()).toBe(true);
    const gone = playlist.id;
    playlist = undefined as any;
    await page.reload();
    await page.waitForFunction(() => !!window.__music);
    await page.waitForTimeout(800);
    await expect(page.locator('#music-title')).not.toHaveText('Rain');
    expect((await page.evaluate(() => window.__music.getState())).source?.playlistId).not.toBe(gone);
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
    await expect(choice).toContainText('This link has a playlist. What should be added?');
    await expect(choice.getByRole('button', { name: 'This video' })).toBeVisible();
    await expect(choice.getByRole('button', { name: 'Import as separate tracks' })).toBeVisible();
    await choice.getByRole('button', { name: 'Whole playlist (one entry)' }).click();
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
    await expect(page.locator('#mp-dashboard')).toHaveCount(0); // no dashboard switch any more

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
  test('YouTube playlist import: separate tracks and "Expand into tracks" (fake YouTube API)', async ({ page, context, isMobile }) => {
    test.skip(isMobile, 'Desktop flow');
    await login(context, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
    const lists = { PLe2eNew: ['e2eNewVid01', 'e2eNewVid02', 'e2eNewVid03'], PLe2eOld: ['e2eOldVid01', 'e2eOldVid02'] };
    await page.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT_API }));
    await page.addInitScript((l) => { (window as any).__ytLists = l; }, lists);
    const res = await context.request.post('/api/music/playlists', { data: { name: `E2E import ${Date.now()}`, visibility: 'private' } });
    const pid = (await res.json()).id as string;
    created.push(pid);
    for (const [youtubeUrl, title] of [[`https://youtu.be/${V}`, 'Intro'], ['https://www.youtube.com/playlist?list=PLe2eOld', 'Old list'], [`https://youtu.be/${V}`, 'Outro']]) {
      expect((await context.request.post(`/api/music/playlists/${pid}/tracks`, { data: { youtubeUrl, title } })).status()).toBe(201);
    }
    const refs = async () => (await (await context.request.get(`/api/music/playlists/${pid}`)).json()).tracks.map((t: any) => [t.kind, t.ref]);
    await page.goto(`/tools/music?playlist=${pid}`);
    await expect(titles(page)).toHaveText(['Intro', 'Old list', 'Outro']);

    // A plain list link: no "This video", import adds one row per video at the end
    await page.locator('#mp-yt-url').fill('https://www.youtube.com/playlist?list=PLe2eNew');
    await page.locator('#mp-yt-add').click();
    const choice = page.locator('#mp-yt-choice');
    await expect(choice).toBeVisible();
    await expect(choice.getByRole('button', { name: 'This video' })).toBeHidden();
    await choice.getByRole('button', { name: 'Import as separate tracks' }).click();
    await expect(page.locator('#arandor-toasts')).toContainText('Imported 3 tracks');
    await expect(titles(page)).toHaveCount(6);
    await expect(choice).toBeHidden();
    await expect(page.locator('#mp-yt-url')).toHaveValue('');
    expect(await refs()).toEqual([
      ['youtube_video', V], ['youtube_playlist', 'PLe2eOld'], ['youtube_video', V],
      ...lists.PLe2eNew.map((r) => ['youtube_video', r]),
    ]);

    // Expand an existing list entry: its videos take its place, the entry is gone
    const row = page.locator('#mp-tracks li', { hasText: 'Old list' });
    await row.getByRole('button', { name: 'Expand Old list into tracks' }).click();
    await expect(page.locator('#arandor-toasts')).toContainText('Imported 2 tracks');
    await expect(titles(page)).toHaveCount(7);
    await expect(page.locator('#mp-tracks li', { hasText: 'Old list' })).toHaveCount(0);
    expect(await refs()).toEqual([
      ['youtube_video', V], ...lists.PLe2eOld.map((r) => ['youtube_video', r]), ['youtube_video', V],
      ...lists.PLe2eNew.map((r) => ['youtube_video', r]),
    ]);
    // Only cued, never played, and the reader player was visible (at least 200×200)
    const calls = await page.evaluate(() => (window as any).__ytCalls as { name: string }[]);
    expect(calls.map((c) => c.name)).toEqual(['cuePlaylist', 'cuePlaylist']);
    const hosts = await page.evaluate(() => (window as any).__ytHosts as { w: number; h: number }[]);
    expect(hosts).toHaveLength(2);
    for (const h of hosts) { expect(h.w).toBeGreaterThanOrEqual(200); expect(h.h).toBeGreaterThanOrEqual(200); }
    await expect(page.locator('#mp-root iframe')).toHaveCount(0);

    // A list YouTube cannot read (truncated link, private list, Mix): explains what to check, adds nothing
    await page.locator('#mp-yt-url').fill('https://www.youtube.com/playlist?list=PLe2eCut');
    await page.locator('#mp-yt-add').click();
    await page.evaluate(() => { (window as any).__ytLists.PLe2eCut = []; });
    await choice.getByRole('button', { name: 'Import as separate tracks' }).click();
    await expect(page.locator('#arandor-toasts')).toContainText(
      "Could not read this YouTube playlist. Check that the link is complete (copy it via Share → Copy link) and that the playlist is public or unlisted — private playlists and YouTube Mixes can't be read.",
      { timeout: 15_000 });
    await expect(titles(page)).toHaveCount(7);
  });
});

// ── Music button (bottom left, everyone, every Layout page) ──────────────────
// The site playlist is stubbed (route), so these run as a visitor and change no data.
test.describe('Music button', () => {
  test.describe.configure({ mode: 'serial' });

  type Box = { x: number; y: number; width: number; height: number };
  const meets = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const box = async (page: import('@playwright/test').Page, sel: string) => (await page.locator(sel).boundingBox())!;
  const st = (page: import('@playwright/test').Page) => page.evaluate(() => window.__music.getState());
  const audio = (page: import('@playwright/test').Page) => page.locator('#music-audio');
  const currentTime = (page: import('@playwright/test').Page) => audio(page).evaluate((a: HTMLAudioElement) => a.currentTime);
  const fab = (page: import('@playwright/test').Page) => page.locator('#music-fab');
  const bar = (page: import('@playwright/test').Page) => page.locator('#music-bar');

  const SITE = {
    id: 'e2e-site', name: 'Tavern music', tracks: [
      { id: 'e2e-s1', kind: 'file', title: 'Site One', ref: '/uploads/music/e2e-site-one.wav' },
      { id: 'e2e-s2', kind: 'file', title: 'Site Two', ref: '/uploads/music/e2e-site-two.wav' },
    ],
  };
  async function stubSite(page: import('@playwright/test').Page, playlist: unknown = SITE) {
    await page.route('**/api/music/site', (r) => r.fulfill({ json: { playlist } }));
    await page.route('**/uploads/music/e2e-*.wav', (r) => r.fulfill({ contentType: 'audio/wav', body: wav(20) }));
  }
  async function open(page: import('@playwright/test').Page, stub: unknown = SITE) {
    await stubSite(page, stub);
    await page.goto('/');
    await page.waitForFunction(() => !!window.__music);
  }

  test('the site playlist waits, paused, behind the button', async ({ page }) => {
    await open(page);
    await expect(page.locator('#tavern-music')).toHaveCount(0); // the dashboard panel is gone
    await expect(fab(page)).toBeVisible();
    await expect(fab(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(bar(page)).not.toBeVisible();
    await expect.poll(async () => (await st(page)).queue.map((t) => t.title)).toEqual(['Site One', 'Site Two']);
    const s = await st(page);
    expect(s.cued).toBe(true);
    expect(s.playing).toBe(false);
    expect(await audio(page).evaluate((a: HTMLAudioElement) => a.currentSrc)).toBe(''); // nothing loaded yet

    // The dice button's twin, on the other side, clear of it
    await fab(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished))); // the pop-in
    const f = await box(page, '#music-fab');
    expect(Math.round(f.width)).toBe(56);
    expect(Math.round(f.height)).toBe(56);
    expect(f.x).toBeLessThan(page.viewportSize()!.width / 2);
    expect(meets(f, await box(page, '#dice-fab')), 'music button meets the dice button').toBe(false);

    await fab(page).click();
    await expect(fab(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(bar(page)).toBeVisible();
    await expect(page.locator('#music-title')).toHaveText('Site One');
    await expect(page.locator('#music-toggle')).toHaveAttribute('aria-label', 'Play');
    await page.waitForTimeout(500);
    expect((await st(page)).playing).toBe(false); // never autoplays

    // A cued queue is not saved: each load cues the site playlist afresh
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('arandor.music') ?? '{}'));
    expect(saved.source ?? null).toBeNull();
    expect(saved.queue ?? []).toEqual([]);

    // Open or shut is remembered
    await page.reload();
    await expect(bar(page)).toBeVisible();
    await expect(page.locator('#music-title')).toHaveText('Site One');
    await fab(page).click();
    await expect(bar(page)).not.toBeVisible();
    await page.reload();
    await expect(fab(page)).toBeVisible();
    await expect(fab(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(bar(page)).not.toBeVisible();
    // Shut, the player is out of the tab order
    expect(await page.locator('#music-drawer').evaluate((d: HTMLElement) => d.inert)).toBe(true);
  });

  test('one tap on play; shut while playing shows the equaliser; ✕ cues the site playlist again', async ({ page, isMobile }) => {
    await open(page);
    await fab(page).click();
    await page.locator('#music-toggle').click();
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0.3);
    expect((await st(page)).cued).toBe(false);
    await expect(fab(page)).toHaveClass(/is-playing/);

    // Shut while playing: only the button, with the equaliser; the music goes on
    await fab(page).click();
    await expect(bar(page)).not.toBeVisible();
    await expect(page.locator('#music-fab .music-fab-eq')).toBeVisible();
    await expect(page.locator('#music-fab .music-fab-note')).toBeHidden();
    await expect(fab(page)).toHaveAttribute('aria-label', 'Music player (playing)');
    const t1 = await currentTime(page);
    await expect.poll(() => currentTime(page)).toBeGreaterThan(t1);

    // A soft page change keeps the button, its state and the playback
    await page.evaluate(() => ((window as any).__noReload = true));
    if (isMobile) {
      await page.locator('#mobileMenuBtn').click();
      await page.locator('#mobileMenu a[href="/characters"]').click();
    } else {
      await page.locator('[data-testid="desktop-nav"] a[href="/characters"]').click();
    }
    await page.waitForURL('**/characters');
    expect(await page.evaluate(() => (window as any).__noReload)).toBe(true);
    await expect(fab(page)).toBeVisible();
    await expect(fab(page)).toHaveAttribute('aria-expanded', 'false');
    const t2 = await currentTime(page);
    await expect.poll(() => currentTime(page)).toBeGreaterThan(t2);

    // ✕ stops and shuts; the site playlist is cued again
    await fab(page).click();
    await page.getByRole('button', { name: 'Stop and close player' }).click();
    await expect(bar(page)).not.toBeVisible();
    await expect(fab(page)).toBeVisible();
    await expect(fab(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(fab(page)).not.toHaveClass(/is-playing/);
    await expect.poll(async () => (await st(page)).cued).toBe(true);
    const s = await st(page);
    expect(s.playing).toBe(false);
    expect(s.queue[s.index].title).toBe('Site One');
  });

  test('nothing to play: no button; playback started elsewhere brings it, open', async ({ page }) => {
    await open(page, { ...SITE, tracks: [] });
    await page.waitForTimeout(800);
    await expect(fab(page)).toBeHidden();
    await expect(bar(page)).toBeHidden();
    // (no site playlist at all: the same)
    await page.unroute('**/api/music/site');
    await page.route('**/api/music/site', (r) => r.fulfill({ json: { playlist: null } }));
    await page.reload();
    await page.waitForFunction(() => !!window.__music);
    await page.waitForTimeout(800);
    await expect(fab(page)).toBeHidden();

    // e.g. from Tools → Music or the DM screen
    await page.evaluate((tracks) => window.__music.playPlaylist({ id: 'elsewhere', name: 'Elsewhere', tracks: tracks as any }), SITE.tracks);
    await expect(fab(page)).toBeVisible();
    await expect(fab(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(bar(page)).toBeVisible();
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0.2);
    await page.getByRole('button', { name: 'Stop and close player' }).click();
    await expect(fab(page)).toBeHidden();
  });

  test('playback started elsewhere slides the shut player open', async ({ page }) => {
    await open(page);
    await expect(fab(page)).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => window.__music.play()); // e.g. a headset's play key
    await expect(fab(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(bar(page)).toBeVisible();
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0.2);
    // It can be shut again while it plays, and stays shut on the next track
    await fab(page).click();
    await page.evaluate(() => window.__music.next());
    await expect(page.locator('#music-title')).toHaveText('Site Two');
    await page.waitForTimeout(400);
    await expect(fab(page)).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => window.__music.stop());
  });

  test('shut while YouTube plays: the video tile stays visible beside the button (fake YouTube API)', async ({ page }) => {
    await page.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT_API }));
    await open(page);
    await page.evaluate(() => window.__music.playPlaylist({ id: 'yt', name: 'YT', tracks: [{ id: 'yt-v', kind: 'youtube_video', title: 'Fake video', ref: 'vid' }] as any }));
    await expect.poll(async () => (await st(page)).playing).toBe(true);
    const tile = page.locator('#music-yt-tile');
    await expect(tile).toBeVisible();
    await fab(page).click();
    await expect(fab(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(bar(page)).not.toBeVisible();
    await page.waitForTimeout(400); // the slide
    await expect(tile).toBeVisible();
    const frame = await box(page, '#music-yt-frame');
    expect(frame.width, 'video at least 200 wide').toBeGreaterThanOrEqual(200);
    expect(frame.height, 'video at least 200 high').toBeGreaterThanOrEqual(200);
    const t = await box(page, '#music-yt-tile');
    const f = await box(page, '#music-fab');
    expect(meets(t, f), 'tile meets the button').toBe(false);
    expect(t.y + t.height, 'tile right above the button').toBeLessThanOrEqual(f.y);
    expect(f.y - (t.y + t.height), 'nothing between tile and button').toBeLessThanOrEqual(12);
    expect(t.x >= 0 && t.y >= 0 && t.x + t.width <= page.viewportSize()!.width, 'tile inside the viewport').toBe(true);
    expect(meets(t, await box(page, '#dice-fab')), 'tile meets the dice button').toBe(false);
    // Paused: the tile goes (YouTube allows that); the button stays
    await page.evaluate(() => window.__music.pause());
    await expect(tile).toBeHidden();
    await expect(fab(page)).toBeVisible();
    await page.evaluate(() => window.__music.stop());
  });

  test('tablet: button, player and dice button keep clear of each other', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await open(page);
    await fab(page).click();
    await page.locator('#music-expand').click();
    await expect(page.locator('#music-panel')).toBeVisible();
    await page.waitForTimeout(400);
    const dice = await box(page, '#dice-fab');
    for (const sel of ['#music-fab', '#music-bar', '#music-panel']) {
      const b = await box(page, sel);
      expect(meets(b, dice), `${sel} meets the dice button`).toBe(false);
      expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= 820 && b.y + b.height <= 1180, `${sel} inside the viewport`).toBe(true);
    }
    expect((await box(page, '#music-bar')).y + 44, 'bar above the button').toBeLessThanOrEqual((await box(page, '#music-fab')).y);
  });
});

test.describe('DM screen music', () => {
  test.skip(!haveAccounts, 'Needs E2E accounts (test server only)');
  test.skip(({ isMobile }) => isMobile, 'Desktop flow');

  test('dm picks a playlist and plays it; nothing reaches the display', async ({ browser }) => {
    const dm = await browser.newContext();
    await login(dm, E.E2E_DM!, E.E2E_DM_PASSWORD!);
    const name = `E2E dmscreen ${Date.now()}`;
    const res = await dm.request.post('/api/music/playlists', { data: { name } });
    expect(res.status()).toBe(201);
    const id = (await res.json()).playlist?.id ?? (await res.json()).id;
    try {
      for (const f of ['Alpha.wav', 'Beta.wav']) {
        const up = await dm.request.post(`/api/music/playlists/${id}/tracks`, {
          multipart: { file: { name: f, mimeType: 'audio/wav', buffer: wav(20) } },
        });
        expect(up.status()).toBe(201);
      }
      const page = await dm.newPage();
      await page.goto('/tools/dm-screen');
      const panel = page.locator('#dm-music');
      await expect(panel).toContainText('Music');
      await panel.locator('#dmm-select').selectOption(id);
      const rows = panel.locator('[data-dmm-row]');
      await expect(rows).toHaveCount(2);
      await rows.nth(1).locator('[data-dmm-play]').click();
      await expect(page.locator('#music-bar')).toBeVisible();
      await expect(page.locator('#music-title')).toHaveText('Beta');
      await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true');
      await expect(rows.nth(0)).not.toHaveAttribute('aria-current', 'true');
      await panel.locator('#dmm-shuffle').click();
      await expect(panel.locator('#dmm-shuffle')).toHaveAttribute('aria-pressed', 'true');
      // shuffle on: the marked row is still the one playing (queue order differs from playlist order)
      await panel.locator('#dmm-next').click();
      await expect(rows.locator('xpath=self::*[@aria-current="true"]')).toHaveCount(1);
      const playing = (await page.locator('#music-title').textContent())!.trim();
      await expect(panel.locator('[data-dmm-row][aria-current="true"]')).toContainText(playing);
      await panel.locator('#dmm-repeat').click();
      await expect(panel.locator('#dmm-repeat')).toHaveAttribute('data-mode', 'all');
      await panel.locator('#dmm-toggle').click();
      await expect(panel.locator('#dmm-toggle')).toHaveAttribute('aria-label', 'Play');

      const display = await (await dm.request.get('/api/display')).text();
      expect(display).not.toContain(name);
      expect(display.toLowerCase()).not.toContain('music');
      const dp = await dm.newPage();
      await dp.goto('/display');
      await expect(dp.locator('#music-root')).toHaveCount(0);
    } finally {
      await dm.request.delete(`/api/music/playlists/${id}`);
      await dm.close();
    }
  });

  test('seek row follows the selected playlist and seeks', async ({ browser }) => {
    const dm = await browser.newContext();
    await login(dm, E.E2E_DM!, E.E2E_DM_PASSWORD!);
    const ids: string[] = [];
    try {
      for (const n of ['A', 'B']) {
        const res = await dm.request.post('/api/music/playlists', { data: { name: `E2E seek${n} ${Date.now()}` } });
        const id = (await res.json()).playlist?.id ?? (await res.json()).id;
        ids.push(id);
        const up = await dm.request.post(`/api/music/playlists/${id}/tracks`, {
          multipart: { file: { name: `Seek${n}.wav`, mimeType: 'audio/wav', buffer: wav(20) } },
        });
        expect(up.status()).toBe(201);
      }
      const page = await dm.newPage();
      await page.goto('/tools/dm-screen');
      const panel = page.locator('#dm-music');
      const row = panel.locator('#dmm-seek-row');
      await expect(row).toBeHidden();
      await panel.locator('#dmm-select').selectOption(ids[0]);
      await panel.locator('[data-dmm-play]').first().click();
      await expect(row).toBeVisible();
      const pos = panel.locator('#dmm-pos');
      await expect(pos).not.toHaveText('0:00');
      const t0 = await pos.textContent();
      await expect(pos).not.toHaveText(t0!, { timeout: 3000 });
      await expect(panel.locator('#dmm-dur')).toHaveText('0:20');
      const seek = panel.getByRole('slider', { name: 'Seek' });
      await seek.evaluate((e: HTMLInputElement) => { e.value = '10'; e.dispatchEvent(new Event('change', { bubbles: true })); });
      await expect.poll(() => page.evaluate(() => window.__music.getState().position)).toBeGreaterThanOrEqual(9.5);
      await panel.locator('#dmm-select').selectOption(ids[1]);
      await expect(panel.locator('[data-dmm-row]')).toHaveCount(1);
      await expect(row).toBeHidden();
      await panel.locator('#dmm-select').selectOption(ids[0]);
      await expect(row).toBeVisible();
    } finally {
      for (const id of ids) await dm.request.delete(`/api/music/playlists/${id}`);
      await dm.close();
    }
  });

  test('remembers the selected playlist per user on this device', async ({ browser }) => {
    const dm = await browser.newContext();
    await login(dm, E.E2E_DM!, E.E2E_DM_PASSWORD!);
    const mk = async (name: string, file: string) => {
      const res = await dm.request.post('/api/music/playlists', { data: { name } });
      expect(res.status()).toBe(201);
      const body = await res.json();
      const id = body.playlist?.id ?? body.id;
      const up = await dm.request.post(`/api/music/playlists/${id}/tracks`, {
        multipart: { file: { name: file, mimeType: 'audio/wav', buffer: wav(20) } },
      });
      expect(up.status()).toBe(201);
      return id as string;
    };
    const ids: string[] = [];
    try {
      const id = await mk(`E2E dmpick ${Date.now()}`, 'Pick.wav');
      const other = await mk(`E2E dmother ${Date.now()}`, 'Other.wav');
      ids.push(id, other);
      const page = await dm.newPage();
      await page.goto('/tools/dm-screen');
      const panel = page.locator('#dm-music');
      const sel = panel.locator('#dmm-select');
      await expect(sel.locator(`option[value="${id}"]`)).toHaveCount(1);
      await expect(sel).toHaveValue('');
      await sel.selectOption(id);
      await expect(panel.locator('[data-dmm-row]')).toHaveCount(1);
      const me = await panel.locator('#dm-music-host').getAttribute('data-me');
      expect(me).toBeTruthy();

      // 1. reload: restored, tracks loaded, no autoplay
      await page.reload();
      await expect(sel).toHaveValue(id);
      await expect(panel.locator('[data-dmm-row]')).toHaveCount(1);
      expect(await page.evaluate(() => window.__music.getState().playing)).toBe(false);

      // 1b. the playlist request fails once (server error): empty state, but the pick is kept
      let failed = 0;
      await page.route(`**/api/music/playlists/${id}`, (r) => {
        if (r.request().method() === 'GET' && !failed++) return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
        return r.fallback();
      });
      const failedRes = page.waitForResponse((r) => r.url().endsWith(`/api/music/playlists/${id}`));
      await page.reload();
      expect((await failedRes).status()).toBe(500);
      await page.waitForTimeout(300); // let the page handle the failed response
      await expect(sel).toHaveValue('');
      await expect(panel.locator('[data-dmm-row]')).toHaveCount(0);
      expect(await page.evaluate((k) => localStorage.getItem(k), `arandor.music.dmPick.${me}`)).toBe(id);
      await page.unroute(`**/api/music/playlists/${id}`);
      await page.reload();
      await expect(sel).toHaveValue(id);
      await expect(panel.locator('[data-dmm-row]')).toHaveCount(1);

      // 2. ClientRouter navigation away and back
      await page.locator('[data-testid="desktop-nav"] a[href="/tools"]').click();
      await expect(page).toHaveURL(/\/tools$/);
      await page.goBack();
      await expect(page.locator('#dmm-select')).toHaveValue(id);
      await expect(page.locator('#dm-music [data-dmm-row]')).toHaveCount(1);

      // 3. other music starting elsewhere does not move the selection
      await page.evaluate(async (pid) => {
        const r = await fetch(`/api/music/playlists/${pid}`);
        const d = await r.json();
        const pl = d.playlist ?? d;
        window.__music.playPlaylist({ id: pl.id, name: pl.name, tracks: pl.tracks.map((t: any) => ({ id: t.id, kind: t.kind, title: t.title, ref: t.ref })) }, 0);
      }, other);
      await expect.poll(() => page.evaluate(() => window.__music.getState().source?.playlistId)).toBe(other);
      await expect(page.locator('#dmm-select')).toHaveValue(id);

      // 5. another user in the same browser is not pre-selected
      await login(dm, E.E2E_ADMIN!, E.E2E_ADMIN_PASSWORD!);
      await page.goto('/tools/dm-screen');
      await expect(page.locator('#dmm-select')).toBeVisible();
      await expect(page.locator('#dmm-select option').first()).toHaveText(/Choose/);
      await expect(page.locator('#dmm-select')).toHaveValue('');
      expect(await page.evaluate((k) => localStorage.getItem(k), `arandor.music.dmPick.${me}`)).toBe(id);
      await login(dm, E.E2E_DM!, E.E2E_DM_PASSWORD!);

      // 4. selected playlist deleted: empty state, key removed
      await dm.request.delete(`/api/music/playlists/${id}`);
      ids.shift();
      await page.goto('/tools/dm-screen');
      await expect(page.locator('#dmm-select option').first()).toHaveText(/Choose/);
      await expect(page.locator('#dmm-select')).toHaveValue('');
      await expect(page.locator('#dm-music [data-dmm-row]')).toHaveCount(0);
      await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), `arandor.music.dmPick.${me}`)).toBeNull();
    } finally {
      for (const id of ids) await dm.request.delete(`/api/music/playlists/${id}`);
      await dm.close();
    }
  });
});

// ── Music keeps playing while navigating to the map (it used to force a full reload) ─
test.describe('Map navigation', () => {
  test.skip(!haveAccounts, 'Needs the E2E_* accounts (test server only)');
  test.describe.configure({ mode: 'serial' });

  let owner: BrowserContext;
  let playlist: { id: string; name: string; tracks: { id: string; kind: string; title: string; ref: string }[] };

  test.beforeAll(async ({ browser }) => {
    owner = await browser.newContext();
    await login(owner, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
    const p = await (await owner.request.post('/api/music/playlists', { data: { name: `E2E map ${Date.now()}`, visibility: 'private' } })).json();
    const up = await owner.request.post(`/api/music/playlists/${p.id}/tracks`, {
      multipart: { file: { name: 'Rain.wav', mimeType: 'audio/wav', buffer: wav(30) } },
    });
    expect(up.status()).toBe(201);
    playlist = await (await owner.request.get(`/api/music/playlists/${p.id}`)).json();
  });

  test.afterAll(async () => {
    if (playlist) await owner.request.delete(`/api/music/playlists/${playlist.id}`);
    await owner?.close();
  });

  test.beforeEach(async ({ context }) => {
    await login(context, E.E2E_PLAYER!, E.E2E_PLAYER_PASSWORD!);
    // count requestAnimationFrame calls so a leaked map render loop shows up
    await context.addInitScript(() => {
      (window as any).__raf = 0;
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb: FrameRequestCallback) => { (window as any).__raf++; return orig(cb); };
    });
  });

  async function navTo(page: import('@playwright/test').Page, href: string, isMobile: boolean) {
    if (isMobile) {
      await page.locator('#mobileMenuBtn').click();
      await page.locator(`#mobileMenu a[href="${href}"]`).click();
    } else {
      await page.locator(`[data-testid="desktop-nav"] a[href="${href}"]`).click();
    }
    await page.waitForURL(`**${href}`);
  }
  const audio = (page: import('@playwright/test').Page) => page.locator('#music-audio');
  const currentTime = (page: import('@playwright/test').Page) => audio(page).evaluate((a: HTMLAudioElement) => a.currentTime);
  const paused = (page: import('@playwright/test').Page) => audio(page).evaluate((a: HTMLAudioElement) => a.paused);
  // the engine paints into #worldCanvas; non-blank once the terrain is drawn
  async function expectMapRendered(page: import('@playwright/test').Page) {
    await expect(page.locator('#mapViewport[data-ready="1"] #worldCanvas')).toBeVisible();
    await expect.poll(() => page.locator('#worldCanvas').evaluate((c: HTMLCanvasElement) => {
      if (!c.width || !c.height) return 0;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const first = d.slice(0, 4).join();
      let diff = 0;
      for (let i = 0; i < d.length; i += 4 * 97) if (d.slice(i, i + 4).join() !== first) diff++;
      return diff;
    }), { timeout: 10_000 }).toBeGreaterThan(0);
  }

  test('music survives map visits, and the map loop stops on leaving', async ({ page, isMobile }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });

    await page.goto('/');
    await page.waitForFunction(() => !!window.__music);
    const tracks = playlist.tracks.map(({ id, kind, title, ref }) => ({ id, kind, title, ref }));
    await page.evaluate(({ id, name, tracks }) => window.__music.playPlaylist({ id, name, tracks: tracks as any }), { id: playlist.id, name: playlist.name, tracks });
    await expect.poll(() => currentTime(page)).toBeGreaterThan(0.2);
    await page.evaluate(() => ((window as any).__noReload = true));

    await navTo(page, '/map', isMobile);
    await expectMapRendered(page);
    const t1 = await currentTime(page);
    await expect.poll(() => currentTime(page)).toBeGreaterThan(t1);
    expect(await paused(page)).toBe(false);
    expect(await page.evaluate(() => (window as any).__noReload)).toBe(true);

    for (const away of ['/characters', '/npcs']) {
      await navTo(page, away, isMobile);
      await navTo(page, '/map', isMobile);
      await expectMapRendered(page);
      expect(await page.evaluate(() => (window as any).__noReload)).toBe(true);
    }

    // leave the map for good: its requestAnimationFrame loop must be gone
    await navTo(page, '/characters', isMobile);
    await page.waitForTimeout(500);
    const rafOver = async () => {
      const a = await page.evaluate(() => (window as any).__raf as number);
      await page.waitForTimeout(1000);
      return (await page.evaluate(() => (window as any).__raf as number)) - a;
    };
    const afterMap = await rafOver();
    expect(afterMap).toBeLessThanOrEqual(5);

    expect(await paused(page)).toBe(false);
    expect(await currentTime(page)).toBeGreaterThan(t1);
    expect(errors).toEqual([]);
  });
});
