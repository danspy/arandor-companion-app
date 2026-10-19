# Music Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Playlists of uploaded audio files and YouTube links, played by one global player that survives page changes, with views in a mini bar, on the dashboard (site playlist, also for visitors), in Tools → Music and on the DM screen.

**Architecture:** Two new tables (`Playlist`, `PlaylistTrack`) behind `/api/music/*` routes that all use one access helper. On the client a singleton store (`src/lib/music/player.ts`) drives an `<audio>` backend and a lazily loaded YouTube IFrame backend; both live in `MusicPlayer.astro`, rendered once from `Layout` with `transition:persist`. Every view renders from the store's `music:state` event.

**Tech Stack:** Astro 7 (SSR, node adapter, `ClientRouter`), Drizzle ORM over SQLite, Tailwind v4 with tokens from `src/styles/global.css`, plain TypeScript in `<script>` tags, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-music-player-design.md`

## Global Constraints

- Allowed audio: extensions `mp3, m4a, aac, ogg, opus, webm, flac, wav`; served MIME: mp3 `audio/mpeg`, m4a/aac `audio/mp4`, ogg/opus `audio/ogg`, webm `audio/webm`, flac `audio/flac`, wav `audio/wav`.
- Max file size **50 MB** (`50 * 1024 * 1024`), no quota.
- Music files are stored at `<uploadDir>/music/<uuid>.<ext>`; URL `/uploads/music/<uuid>.<ext>`. `uploadDir` = `public/uploads` in dev, else `process.env.UPLOAD_DIR || '/srv/arandor/uploads'` (same rule as `src/pages/api/upload.ts`).
- `visibility` is `'public' | 'private'` (default `'private'`); `kind` is `'file' | 'youtube_video' | 'youtube_playlist'`.
- Only one playlist has `isSiteDefault = 1`; it is always public, cannot be made private, cannot be deleted.
- Private playlist → **404** for anyone not allowed to see it. Logged-out → 401 on every music route except `GET /api/music/site`.
- DM (`dungeonmaster`) can edit the site playlist; only `admin` can choose it (`site-default`) or edit others' playlists.
- No autoplay after a full page load; restored state is paused.
- No music state in `DMScreenState` or `/api/display`.
- YouTube tile ≥ 200×200 px and visible while a YouTube track is current.
- Dark-only UI; use `t-panel`, `t-section-h`, `t-muted`, `t-link`, `t-label` and colour tokens; no new dependencies.
- API response helper style: `const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })` as in `src/pages/api/dice-presets.ts`.
- Branch `feat/music-player`; open a PR, **do not merge** (dev first, the user approves merges). Commit trailer per session instructions.
- Tests run against an isolated test server (see memory "deploy-workflow"), never against dev/preview/live data. E2E accounts via env: `E2E_ADMIN/E2E_ADMIN_PASSWORD`, `E2E_DM/E2E_DM_PASSWORD`, `E2E_PLAYER/E2E_PLAYER_PASSWORD`, `E2E_PLAYER2/E2E_PLAYER2_PASSWORD`; logged-in suites `test.skip` when unset (pattern in `e2e/bestiary.spec.ts:153-180`). Run: `npm run build && npx playwright test e2e/music.spec.ts`.

## Review Focus

1. **Filename with no or misleading extension** (`song`, `song.MP3`, `evil.mp3.html`): the extension is taken from the last dot, lower-cased; anything not allowed is rejected, and the stored name is always `<uuid>.<allowed ext>`. Test in Task 2 (`audioFileCheck`).
2. **YouTube link variants with extra params / timestamps** (`youtu.be/ID?t=42`, `watch?v=ID&list=PL…&index=3`, `m.youtube.com`, a non-YouTube host with `v=`): parsed ids are exactly 11 chars for videos, list ids `[A-Za-z0-9_-]+`; foreign hosts give `null`. Test in Task 2.
3. **Reorder with stale/foreign ids** (a track deleted by someone else meanwhile, or an id from another playlist): `PUT order` returns 400 and changes nothing. Test in Task 4.
4. **Deleting a playlist that is in the current queue / saved localStorage state**: the player keeps playing what it has; after reload, stale saved state is dropped without an error and no mini bar appears. Test in Task 6.
5. **Admin switches the site playlist**: old one loses `isSiteDefault` in the same transaction (never two, never zero), the new one becomes public, the dashboard shows the new one. Test in Task 3.

---

### Task 1: Schema, migration, seed

**Files:**
- Modify: `src/db/schema.ts` (append `Playlist`, `PlaylistTrack`)
- Create: `db/migrations/2026-10-19_music.sql`
- Modify: `db/seed.ts` (site playlist "Tavern music", owner user id `'1'`, public, `isSiteDefault: true`)

**Interfaces:**
- Produces: tables `Playlist { id, ownerId, name, visibility, isSiteDefault: boolean, createdAt: Date, updatedAt: Date }`, `PlaylistTrack { id, playlistId, position: number, kind, title, ref, durationSec: number|null, createdAt: Date }`, exported via `@/db`.

- [ ] **Step 1:** Add both tables to `schema.ts` with the existing helpers (`text`, `integer`, `bool`, `now`). `ref` holds the upload URL for files and the YouTube id for YouTube kinds.
- [ ] **Step 2:** Write `2026-10-19_music.sql`: header comment (what it adds; the old release ignores it), `CREATE TABLE IF NOT EXISTS Playlist` / `PlaylistTrack` (dates `text NOT NULL`, booleans `integer NOT NULL DEFAULT 0`, `FOREIGN KEY (playlistId) REFERENCES Playlist(id) ON DELETE CASCADE`), `CREATE UNIQUE INDEX IF NOT EXISTS Playlist_one_site ON Playlist(isSiteDefault) WHERE isSiteDefault = 1`, `CREATE INDEX IF NOT EXISTS PlaylistTrack_playlist ON PlaylistTrack(playlistId, position)`, and an `INSERT … SELECT` of "Tavern music" owned by `(SELECT id FROM User WHERE role = 'admin' ORDER BY createdAt LIMIT 1)` guarded by `WHERE NOT EXISTS (SELECT 1 FROM Playlist WHERE isSiteDefault = 1)`. Id: `lower(hex(randomblob(16)))`; timestamps `strftime('%Y-%m-%dT%H:%M:%fZ','now')`.
- [ ] **Step 3:** Add the partial unique index to Drizzle too (`uniqueIndex('Playlist_one_site').on(t.isSiteDefault).where(sql\`isSiteDefault = 1\`)`) so `db:dev` creates it.
- [ ] **Step 4:** Verify on a scratch copy: `cp data/dev.db $SCRATCH/m.db && sqlite3 $SCRATCH/m.db < db/migrations/2026-10-19_music.sql && sqlite3 $SCRATCH/m.db "select name,visibility,isSiteDefault from Playlist"` → `Tavern music|public|1`; run the migration a second time → still exactly one row. Then `DATABASE_FILE=$SCRATCH/fresh.db npm run db:dev` → seed creates the same row.
- [ ] **Step 5:** Back up `data/dev.db` to `data/archive/` and apply the migration to `/srv/arandor-dev/data/dev.db`. Update `docs/Database.md` (both tables). Commit.

### Task 2: Pure helpers (formats, YouTube parsing, access)

**Files:**
- Create: `src/lib/music/formats.ts`, `src/lib/music/youtube.ts`, `src/lib/music/access.ts`
- Test: `e2e/music.spec.ts` (describe "Music helpers", `test.skip(({ isMobile }) => isMobile, 'Pure functions, once is enough')`)

**Interfaces:**
- Produces:
  - `AUDIO_MIME: Record<string, string>` (the Global Constraints map), `MAX_AUDIO_BYTES = 52428800`
  - `audioFileCheck(name: string, size: number): { ok: true; ext: string; title: string } | { ok: false; error: string }` — `title` = name without its last extension, trimmed; errors exactly `` `Unsupported format (allowed: mp3, m4a, aac, ogg, opus, webm, flac, wav)` `` and `'File is larger than 50 MB'`.
  - `parseYouTubeUrl(input: string): { videoId?: string; listId?: string } | null`
  - `fetchYouTubeTitle(url: string, fetchImpl?: typeof fetch): Promise<string | null>` — GET `https://www.youtube.com/oembed?url=<enc>&format=json`, 3 s `AbortSignal.timeout`, returns `title` or `null` on any failure.
  - `type Viewer = { id: string; role: string } | null`; `canView(p: { ownerId: string; visibility: string; isSiteDefault: boolean }, viewer: Viewer): boolean`; `canEdit(p, viewer): boolean`; `canSetSiteDefault(viewer): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2:** Run `npx playwright test e2e/music.spec.ts -g "Music helpers"` → FAIL (modules missing).
- [ ] **Step 3:** Implement the three modules. `parseYouTubeUrl` uses `new URL`, accepts hosts `youtube.com`, `www.`, `m.`, `music.` and `youtu.be`; video id must match `/^[A-Za-z0-9_-]{11}$/`, list id `/^[A-Za-z0-9_-]+$/`. Must not import `@/db` (the test imports these files directly).
- [ ] **Step 4:** Re-run → PASS. Commit.

### Task 3: Playlist API (list, site, CRUD, site-default)

**Files:**
- Create: `src/lib/music/server.ts`, `src/pages/api/music/site.ts`, `src/pages/api/music/playlists/index.ts`, `src/pages/api/music/playlists/[id]/index.ts`, `src/pages/api/music/playlists/[id]/site-default.ts`
- Test: `e2e/music.spec.ts` (describe "Music API", needs all four E2E accounts, desktop only)

**Interfaces:**
- Consumes: `canView`, `canEdit`, `canSetSiteDefault`, `Viewer` (Task 2).
- Produces (in `server.ts`):
  - `getViewer(cookies): Promise<Viewer>` (from `getCurrentUser`)
  - `musicDir(): string` (the `music/` sub-folder of uploadDir, created on demand) and `deleteMusicFile(ref: string): Promise<void>` (only for refs starting `/uploads/music/`, ignores ENOENT)
  - `loadPlaylist(id: string): Promise<(Playlist & { tracks: PlaylistTrack[] }) | null>` (tracks ordered by `position`)
  - `type PlaylistSummary = { id, name, visibility, isSiteDefault, ownerId, ownerName: string, trackCount: number, canEdit: boolean }`
  - JSON shapes: `GET /api/music/site` → `{ playlist: PlaylistWithTracks | null }`; `GET playlists` → `PlaylistSummary[]`; `GET playlists/[id]` → `PlaylistWithTracks & { canEdit: boolean }`.

- [ ] **Step 1: Write the failing tests** (create playlists through the API with unique names `E2E music <Date.now()>`, delete them in `afterAll`)
  - `visitor`: `GET /api/music/site` → 200 with `playlist.isSiteDefault === true`; `GET /api/music/playlists` → 401; `POST /api/music/playlists` → 401.
  - `privacy`: player creates `{ name, visibility: 'private' }` → 201 with `visibility: 'private'`; player2 `GET playlists/<id>` → 404 and the id is absent from player2's `GET playlists`; admin `GET` → 200; dm `GET` → 404.
  - `public`: player PATCHes `{ visibility: 'public' }` → player2 sees it in the list with `canEdit: false`; player2 `PATCH { name: 'x' }` → 403; `DELETE` by player2 → 403.
  - `validation`: `POST` with `name: ''` or 81 chars → 400; `visibility: 'secret'` → 400.
  - `site playlist`: dm `PATCH site { name }` → 200; dm `POST playlists/<any>/site-default` → 403; `PATCH site { visibility: 'private' }` → 400; admin `DELETE site` → 409 with error containing `site playlist`.
  - `switch site` (Review Focus 5): admin creates a private playlist P, `POST P/site-default` → 200; `GET /api/music/site` returns P with `visibility: 'public'`; admin list has exactly one `isSiteDefault`; then switch back to the original and delete P.
- [ ] **Step 2:** Build, start the isolated test server, run → FAIL (404 routes).
- [ ] **Step 3:** Implement the routes. Name rule: trimmed, 1–80 chars. `GET playlists` filters with `canView` (admins: everything) and sorts site first, then own, then others by name. `site-default` runs in `db.transaction`: unset old, set new + `visibility = 'public'`. `DELETE playlist` deletes each file via `deleteMusicFile` and the rows (tracks cascade; delete them explicitly as well, since SQLite FK enforcement may be off).
- [ ] **Step 4:** Re-run → PASS. Commit.

### Task 4: Track API (upload, YouTube, rename, delete, order)

**Files:**
- Create: `src/pages/api/music/playlists/[id]/tracks.ts`, `src/pages/api/music/playlists/[id]/order.ts`, `src/pages/api/music/tracks/[id].ts`
- Test: `e2e/music.spec.ts` ("Music API" describe)

**Interfaces:**
- Consumes: `audioFileCheck`, `parseYouTubeUrl`, `fetchYouTubeTitle` (Task 2); `getViewer`, `loadPlaylist`, `musicDir`, `deleteMusicFile` (Task 3).
- Produces:
  - `POST tracks`, multipart (one or more `file` fields) → `201 { results: { name: string; ok: boolean; track?: PlaylistTrack; error?: string }[] }` (201 if at least one ok, else 400).
  - `POST tracks`, JSON `{ youtubeUrl: string; mode?: 'video'|'playlist'; title?: string }` → `201 PlaylistTrack`; `400 { error: 'Not a YouTube video or playlist link' }`; `409 { needsMode: true }` when both ids and no `mode`. `title` given → skip oEmbed (lets tests and users set a name); else oEmbed title, else the URL.
  - `PATCH tracks/[id] { title }` (1–200 chars) → `PlaylistTrack`; `DELETE tracks/[id]` → `{ ok: true }`.
  - `PUT order { trackIds: string[] }` → `{ ok: true }`; 400 unless the ids are exactly the playlist's track ids (same set, no duplicates).
  - New tracks get `position = max + 1`.

- [ ] **Step 1: Write the failing tests** (helper `wav(seconds)` builds a silent 8 kHz mono 8-bit PCM WAV `Buffer` with a 44-byte RIFF header; no binary fixture)
  - Upload `{ name: 'Rain.wav', mimeType: 'audio/wav', buffer: wav(5) }` plus `notes.txt` in one request → 201; results: `Rain.wav` ok with `title: 'Rain'`, `kind: 'file'`, `ref` matching `/^\/uploads\/music\/[0-9a-f-]{36}\.wav$/`; `notes.txt` `ok: false` with the format error.
  - Upload 50 MB + 1 byte `.mp3` → 400 with `'File is larger than 50 MB'`.
  - YouTube: `{ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', title: 'Test video' }` → `kind: 'youtube_video', ref: 'dQw4w9WgXcQ'`; a `watch?v=…&list=…` URL without mode → 409 `needsMode`; with `mode: 'playlist'` → `kind: 'youtube_playlist'`, `ref` = list id; `https://example.com` → 400.
  - Order: reverse the three ids → `GET` returns them reversed; `trackIds` missing one, with a foreign id, or with a duplicate → 400 and order unchanged (Review Focus 3).
  - Rename → new title; player2 rename on a public playlist → 403.
  - Delete the wav track → `GET <ref>` afterwards returns 404.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Content type decides JSON vs multipart. Files are written as `<uuid>.<ext>` from `audioFileCheck`, never from the client name. The order update runs in one transaction.
- [ ] **Step 4:** Run → PASS. Commit.

### Task 5: Serve audio from `/uploads` with Range

**Files:**
- Modify: `src/pages/uploads/[...file].ts` (MIME map, `isVideoMimeType` → `isStreamable` for `video/*` and `audio/*`)
- Test: `e2e/music.spec.ts`

**Interfaces:**
- Consumes: `AUDIO_MIME` (Task 2) merged into `MIME_TYPES`. Note: `ogg` becomes `audio/ogg` (was `video/ogg`); `ogv` stays `video/ogg`; `webm` stays `video/webm` (the browser plays an audio-only webm from a `video/webm` response; no change).

- [ ] **Step 1: Write the failing test:** upload `Rain.wav` (Task 4 helper), `GET ref` with header `Range: bytes=0-99` → 206, `content-type: audio/wav`, `content-range: bytes 0-99/<size>`, body length 100. Without Range → 200 with the full length.
- [ ] **Step 2:** Run → FAIL (200 `application/octet-stream`).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS, including `e2e/display.spec.ts` (location video still streams). Commit.

### Task 6: Player store, audio backend, mini bar (persists across pages)

**Files:**
- Create: `src/lib/music/player.ts`, `src/lib/music/audio-backend.ts`, `src/components/MusicPlayer.astro`
- Modify: `src/layouts/Layout.astro` (render `<MusicPlayer />` next to `<DiceFab />`)
- Test: `e2e/music.spec.ts` (describe "Music player", logged in as player)

**Interfaces:**
- Produces (`player.ts`, all views use only this):
  - `type QueueTrack = { id: string; kind: 'file'|'youtube_video'|'youtube_playlist'; title: string; ref: string }`
  - `type MusicState = { source: { playlistId: string; name: string } | null; queue: QueueTrack[]; index: number; playing: boolean; position: number; duration: number; volume: number; shuffle: boolean; repeat: 'off'|'all'|'one'; youtubeVisible: boolean }`
  - `music.getState(): MusicState`, `music.playPlaylist(p: { id: string; name: string; tracks: QueueTrack[] }, startIndex = 0, opts?: { shuffle?: boolean })`, `play()`, `pause()`, `toggle()`, `next()`, `prev()`, `seek(sec)`, `setVolume(0..1)`, `setShuffle(b)`, `setRepeat(m)`, `stop()`
  - Event `document.dispatchEvent(new CustomEvent('music:state', { detail: MusicState }))` on every change (time updates throttled to 4/s).
  - `interface MusicBackend { load(t: QueueTrack, at?: number): Promise<void>; play(); pause(); seek(s); setVolume(v); destroy(); onEnded; onError; onTime }` — `youtube-backend.ts` (Task 7) implements the same interface.
  - The store is a module singleton, created once; it binds to `#music-audio` inside `#music-root`.
  - localStorage key `arandor.music`: `{ volume, shuffle, repeat, source, queue, index, position }`, wrapped in try/catch.
- Mini bar: `#music-root` (`transition:persist`) with `<audio id="music-audio" preload="metadata">`, `#music-yt-tile` (empty for now) and `#music-bar` (hidden while `queue` is empty). Bottom-left, mirroring `--dice-fab-bottom`, above the PWA dock on mobile. Controls: title (truncate), prev / play-pause / next, volume range (≥ 768 px), expand (queue list with click-to-jump, seek range, shuffle, repeat cycle), ✕ = `stop()`. All buttons have `aria-label`s. Media Session metadata + handlers set on track change.
- Errors: backend `onError` → toast `Skipped: <title> (not playable)` (reuse the app toast if one exists, else a `role="status"` line in the bar) and `next()`; once every queue track has failed, `stop()`.
- Restore: on first load, state is restored **paused** at `position`. A saved `source` is re-checked with `GET /api/music/playlists/<id>` (or `/api/music/site` for visitors); 404/401, or a current track that is no longer in it → clear the saved state, no bar.

- [ ] **Step 1: Write the failing tests**
  - `keeps playing across pages`: create a playlist with two `wav(20)` tracks through the API, open `/`, and start it with `page.evaluate(() => window.__music.playPlaylist(...))` (the UI views come in Tasks 8–10; `player.ts` exposes the store as `window.__music`). Assert `#music-bar` visible with title `Rain`; `t1 = audio.currentTime`; click the nav link to `/characters` and then `/npcs` (through `ClientRouter`, not `goto`); `audio.currentTime > t1`, `audio.paused === false`, bar still visible.
  - `next and stop`: click next → title of track 2; click ✕ → bar hidden, `audio.paused`.
  - `skips unplayable`: queue `[missing file ref '/uploads/music/nope.wav', Rain]` → status text contains `Skipped: ` and the title shows `Rain`.
  - `restores paused` (Review Focus 4): play, `page.reload()` → bar visible, `audio.paused === true`, no `play` started; then delete the playlist via API and reload → bar hidden and no console error.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Re-bind views on `astro:page-load`; the store itself is created once (guard with `window.__music`).
- [ ] **Step 4:** Run → PASS (desktop and Pixel 5). Commit.

### Task 7: YouTube backend and tile

**Files:**
- Create: `src/lib/music/youtube-backend.ts`
- Modify: `src/lib/music/player.ts` (pick the backend per `kind`), `src/components/MusicPlayer.astro` (`#music-yt-tile`)

**Interfaces:**
- Consumes: `MusicBackend` (Task 6).
- Produces: `createYouTubeBackend(host: HTMLElement): MusicBackend`. It loads `https://www.youtube.com/iframe_api` on the first `load()`. `youtube_video` → `loadVideoById(ref, at)`; `youtube_playlist` → `loadPlaylist({ list: ref, listType: 'playlist' })`. `onEnded` fires on `ENDED` when it isn't a playlist, or on the last index of a playlist. `next()`/`prev()` in the store first call the backend's `nextInList()` / `prevInList(): boolean` (`true` = moved inside the YouTube list). The title of the current video comes from `getVideoData().title` while in a list. Error codes 2/5/100/101/150 → `onError`.
- Tile: 200×200 minimum, above the mini bar, visible exactly while `state.youtubeVisible`; a ▾ button shrinks the tile to its minimum size but never hides it.

- [ ] **Step 1: Spike first (throwaway, findings go in the PR description):** play a YouTube video in the persisted tile and navigate twice in Chromium, Firefox and WebKit (`npx playwright install firefox webkit` if needed; headed or a manual check on dev). Note whether the iframe reloads. If it does, implement resume: store `position` every second and `seekTo(position)` after `onReady` when the backend sees its iframe was recreated (`astro:after-swap` + iframe `load` event).
- [ ] **Step 2: Write the failing test** (Chromium, `test.skip` when `process.env.CI_OFFLINE`): queue `[YouTube 'dQw4w9WgXcQ', Rain]`, play → `#music-yt-tile iframe` visible with a bounding box ≥ 200×200; next → tile hidden, `audio` playing. Error path: queue `[youtube_video 'xxxxxxxxxxx', Rain]` → `Skipped:` and then `Rain`.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS; the Task 6 tests still pass. Commit.

### Task 8: Tools → Music page

**Files:**
- Create: `src/pages/tools/music.astro`, `src/lib/music/editor.ts` (client logic for the page: list, select, upload, YouTube add, reorder, rename, delete, visibility, site default)
- Modify: `src/pages/tools.astro` (card "Music": icon, `h2.t-section-h`, `p.t-muted` "Playlists from your files and YouTube")

**Interfaces:**
- Consumes: the Task 3/4 API, `music.playPlaylist` (Task 6).
- Page: logged in, else `Astro.redirect('/login')`. `?playlist=<id>` selects a playlist. Left: groups *Site*, *Mine*, *Public from others*, plus *All others* for admins; "New playlist" (name + visibility). Right: name, owner, play / shuffle buttons, track list (▶ per row = `playPlaylist(p, i)`; the row of the current track is marked from `music:state`). If `canEdit`: drop zone + file input (`accept` from `AUDIO_MIME` extensions, `multiple`), per-file progress via `XMLHttpRequest.upload.onprogress` with ok/error per file; "Add YouTube link" (on 409 ask "This video or the whole playlist?" with two buttons, then resend with `mode`); drag handle reorder (pointer events, works on touch) → `PUT order`; inline rename on click; delete track (confirm); rename playlist; public/private toggle (disabled with a note on the site playlist); delete playlist (confirm; hidden for the site playlist); admin only: "Make site playlist".

- [ ] **Step 1: Write the failing tests:** player creates a playlist through the UI, uploads `Rain.wav` via `setInputFiles` → the row "Rain" appears; adds a YouTube link (with title via the API, then checks the UI row); a link with both ids shows the two-choice prompt; drag reorder persists after reload; toggling to public shows it to player2 under *Public from others* without edit controls; dm on the site playlist sees edit controls but no "Make site playlist"; admin sees it.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Use `frontend-design` guidance for the layout; reuse the existing panel and card classes.
- [ ] **Step 4:** Run → PASS on desktop and Pixel 5 (single column on mobile). Commit.

### Task 9: Dashboard "Tavern music"

**Files:**
- Create: `src/components/dashboard/TavernMusic.astro`
- Modify: `src/pages/index.astro` (directly below the hero / next-event block)

**Interfaces:**
- Consumes: `loadPlaylist` / site lookup on the server (Task 3), `music.playPlaylist` (Task 6).
- The server renders the site playlist into the component (no extra fetch). Shown when it has ≥ 1 track; for admin/DM always shown (empty text "No tracks yet") with "Edit" → `/tools/music?playlist=<id>`. Play, shuffle, collapsible track list (`<details>`), click a row to play from it.

- [ ] **Step 1: Write the failing tests:** a visitor (fresh context) with a site playlist that has a track sees `Tavern music`, clicks play → `#music-bar` shows the first title; the visitor's `/tools/music` redirects to `/login`; with an empty site playlist a visitor sees no panel and a dm sees it with "Edit".
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. Commit.

### Task 10: DM screen Music panel

**Files:**
- Modify: `src/pages/tools/dm-screen.astro` (new `t-panel` "Music" after Quick Actions)
- Create: `src/lib/music/picker.ts` (a playlist picker with a track list, mounted into a host element; used by the DM screen)

**Interfaces:**
- Consumes: `GET /api/music/playlists`, `GET /api/music/playlists/[id]`, `music.*` (Task 6).
- Produces: `mountMusicPicker(host: HTMLElement): void` — a `<select>` (site, own, public), a track list with play-per-row, play/pause, next, shuffle, repeat bound to `music:state`. It writes nothing to `/api/dm-screen`.

- [ ] **Step 1: Write the failing tests:** dm opens `/tools/dm-screen`, picks the test playlist, plays → `#music-bar` shows the title; `GET /api/display` body does not contain the playlist name or `"music"`; `/display` has no `#music-root`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS together with `e2e/display.spec.ts`. Commit.

### Task 11: Docs, full run, PR on dev

**Files:**
- Modify: `docs/API-Reference.md` (all `/api/music` routes), `docs/DM-Tools.md` (`#music`: what each view does, formats, 50 MB, YouTube tile, the `/map` full-reload note), `docs/Roles-and-Permissions.md` (the spec's permission table), `docs/Database.md` (if Task 1 didn't finish it).

- [ ] **Step 1:** Update the docs.
- [ ] **Step 2:** `npm run build && npx playwright test` (whole suite) on the isolated test server → all pass; paste the summary into the PR.
- [ ] **Step 3:** Check by hand on dev.arandor.app: an mp3 upload plays and seeks; music keeps playing across 3 pages; `/map` comes back paused; YouTube tile; visitor dashboard.
- [ ] **Step 4:** Push `feat/music-player` and open the PR (title "Music player: playlists, uploads, YouTube, persistent player"; body: summary, the migration file, the spike result from Task 7, test summary, and "migration applied to dev only; preview/live before merging/promoting"). **Do not merge.** Tell the user it is on dev and wait for explicit approval.
