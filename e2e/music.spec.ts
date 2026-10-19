import { test, expect } from '@playwright/test';
import { audioFileCheck, MAX_AUDIO_BYTES } from '../src/lib/music/formats';
import { parseYouTubeUrl, fetchYouTubeTitle } from '../src/lib/music/youtube';
import { canView, canEdit, canSetSiteDefault } from '../src/lib/music/access';

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
