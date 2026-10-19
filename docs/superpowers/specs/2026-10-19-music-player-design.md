# Music player: design (2026-10-19)

Agreed with the user in chat. User-facing behaviour will be documented in `docs/DM-Tools.md#music`.

## Goal

Everyone can build playlists from uploaded audio files and YouTube links and play them in the
app. Music keeps playing while you move between pages. The DM plays background music at the
table from the DM screen; the player display never shows it. Visitors get one curated playlist
on the dashboard.

## Decisions

| Question | Decision |
|---|---|
| Who hears playback | **Only the device that presses play.** No synced/broadcast playback |
| Page changes | **Music keeps playing.** One global player persisted in `Layout` (`transition:persist`), like `DiceFab` |
| Controls everywhere | A floating **mini bar** on every layout page, shown only while something is loaded |
| Playlist visibility | `public`: every logged-in user can see/play. `private`: owner only. Admins see and edit everything |
| Site playlist | Exactly one playlist is the **site playlist** (`isSiteDefault`). Shown on the dashboard, playable by **everyone including logged-out visitors**. Editable by admins **and DMs**; only an admin can choose which playlist is the site playlist. It is always treated as public |
| Track sources | Uploaded file, YouTube video, YouTube playlist (stored as one entry, expanded by YouTube's player at play time, no API key) |
| File formats | mp3, m4a/aac, ogg, opus, webm (audio), flac, wav |
| File size | 50 MB per file, no total quota |
| File privacy | Files are served by unguessable URL under `/uploads` like images; not access-checked |
| YouTube display | YouTube's terms forbid hidden audio-only playback, so a small (~200×200) video tile is visible while a YouTube track plays |

## Data

Migration `db/migrations/2026-10-19_music.sql`:

- `Playlist`: `id` (text UUID), `ownerId` (→ `User.id`), `name`, `visibility` (`'public'|'private'`,
  default `'private'`), `isSiteDefault` (0/1, default 0), `createdAt`, `updatedAt`.
  A partial unique index `ON Playlist(isSiteDefault) WHERE isSiteDefault = 1` keeps it to one.
- `PlaylistTrack`: `id`, `playlistId` (→ `Playlist.id`, cascade delete), `position` (int),
  `kind` (`'file'|'youtube_video'|'youtube_playlist'`), `title`, `ref` (upload path such as
  `/uploads/music/<uuid>.mp3`, or YouTube video/list id), `durationSec` (nullable), `createdAt`.
- Seed (and the migration on existing DBs): one empty public site playlist "Tavern music",
  owned by the first admin.

Uploaded music goes to `<UPLOAD_DIR>/music/<uuid>.<ext>`. Deleting a track or playlist deletes
its files. Same schema in `src/db/schema.ts`; `docs/Database.md` updated.

## Permissions

| Action | Visitor | Player | DM | Admin |
|---|---|---|---|---|
| Play site playlist | ✓ | ✓ | ✓ | ✓ |
| See/play public playlists | | ✓ | ✓ | ✓ |
| See/play own private playlists | | ✓ | ✓ | ✓ |
| See others' private playlists | | | | ✓ |
| Create playlists, edit own | | ✓ | ✓ | ✓ |
| Edit site playlist | | | ✓ | ✓ |
| Edit any playlist | | | | ✓ |
| Set site playlist | | | | ✓ |

A private playlist answers **404** (not 403) to anyone not allowed to see it.
A single helper `src/lib/music/access.ts` (`canView`, `canEdit`) is used by every route and page.
`docs/Roles-and-Permissions.md` updated.

## API (`/api/music/`)

| Route | Access | Purpose |
|---|---|---|
| `GET site` | anyone | Site playlist with tracks |
| `GET playlists` | logged in | Own + public + site (admin: all), without tracks |
| `POST playlists` | logged in | Create `{ name, visibility }` |
| `GET playlists/[id]` | `canView` | Playlist with tracks |
| `PATCH playlists/[id]` | `canEdit` | `{ name?, visibility? }` (site playlist cannot be made private) |
| `DELETE playlists/[id]` | `canEdit` | Delete with tracks and files. The current site playlist cannot be deleted (choose another first) |
| `POST playlists/[id]/site-default` | admin | Make this the site playlist; unsets the old one in one transaction; forces `public` |
| `POST playlists/[id]/tracks` | `canEdit` | multipart `file` (one or more), **or** JSON `{ youtubeUrl, mode?: 'video'|'playlist' }` |
| `PATCH tracks/[id]` | `canEdit` of its playlist | `{ title }` |
| `DELETE tracks/[id]` | `canEdit` of its playlist | Delete track and file |
| `PUT playlists/[id]/order` | `canEdit` | `{ trackIds: string[] }` (must be exactly the playlist's tracks) |

Upload checks: extension and MIME type both in the allowed list, size ≤ 50 MB. Multi-file
uploads answer per file (`{ results: [{ name, ok, track?, error? }] }`). File title = file name
without extension.

YouTube: `src/lib/music/youtube.ts` `parseYouTubeUrl(url)` → `{ videoId?, listId? }` for
`youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `music.youtube.com`, `list=`.
Both ids present and no `mode` → `409 { needsMode: true }`; the UI asks "This video or the whole
playlist?". Title from `https://www.youtube.com/oembed?url=…&format=json` (timeout 3 s), falling
back to the URL. `docs/API-Reference.md` updated.

`src/pages/uploads/[...file].ts`: add audio MIME types (mp3 `audio/mpeg`, m4a/aac `audio/mp4`,
ogg/opus `audio/ogg`, webm `audio/webm`, flac `audio/flac`, wav `audio/wav`) and serve Range
requests for `audio/*` as for video (needed for seeking).

## Player (client)

- `src/lib/music/player.ts`: singleton store. State: `queue` (tracks), `index`, `playing`,
  `position`, `volume`, `shuffle`, `repeat` (`off|all|one`), `source` (playlist id + name).
  API: `playPlaylist(playlist, startIndex?)`, `play`, `pause`, `toggle`, `next`, `prev`,
  `seek`, `setVolume`, `setShuffle`, `setRepeat`, `stop`. Emits `music:state` on `document`;
  every view renders from it.
- Backends behind one interface (`load`, `play`, `pause`, `seek`, `setVolume`, `onEnded`,
  `onError`, `onTime`):
  - `audio`: one `<audio>` element.
  - `youtube`: IFrame Player API, script loaded lazily on the first YouTube track. A playlist
    entry uses `listType: 'playlist'`; "ended" means the last video of that list ended.
    `prev`/`next` inside a YouTube playlist go to its previous/next video first.
- `src/components/MusicPlayer.astro` in `Layout`: `#music-root` with `transition:persist`,
  containing the `<audio>`, the YouTube tile, and the mini bar.
- localStorage `arandor.music`: volume, shuffle, repeat, last source + index + position.
  After a full page load (e.g. `/map`) the mini bar returns **paused** at that point; no autoplay.
  Saved state pointing to deleted items is dropped silently.
- Media Session API: title/artwork plus play, pause, next, previous handlers.
- If a browser reloads the persisted YouTube iframe on navigation, the player resumes at the
  last known time (`seekTo`). Checked first in implementation (Firefox, Safari/WebKit).

## Views

- **Mini bar** (all `Layout` pages, only while a queue is loaded): bottom-left pill (dice button
  is bottom-right; above the PWA dock on mobile). Title, ⏮ ⏯ ⏭, volume (desktop), expand
  (queue list, shuffle, repeat, seek bar), ✕ (stop and clear). The YouTube tile sits above it
  while a YouTube track is current.
- **Dashboard** (`src/components/dashboard/TavernMusic.astro`, below the hero): site playlist
  name, play and shuffle buttons, collapsible track list (click to play from there). Visible to
  everyone while the site playlist has tracks; for admin/DM always, with an "Edit" link to
  `/tools/music?playlist=<id>`.
- **Tools → Music** (`src/pages/tools/music.astro`, logged in; card in `tools.astro`): left
  list grouped *Site*, *Mine*, *Public from others* (+ *All others* for admins) and "New
  playlist"; right the selected playlist: play/shuffle, track list with play per track; if
  editable: drag-and-drop upload area (multiple files, per-file progress/errors), "Add YouTube
  link", drag to reorder, inline rename, delete track, rename playlist, public/private toggle,
  delete playlist, and for admins "Make site playlist".
- **DM screen**: new "Music" `t-panel` with playlist picker (own + public + site), track list
  and controls, all driving the global player. Nothing is stored in `DMScreenState`, so nothing
  reaches `/api/display`; `/display` does not use `Layout`, so the player never appears there.

## Errors

- Upload: wrong type → "Unsupported format (allowed: …)"; too big → "File is larger than
  50 MB". Per-file in multi-upload.
- Invalid YouTube link → 400 "Not a YouTube video or playlist link".
- Play time: YouTube `onError` (removed, private, embedding disabled) or audio `error` (missing
  file) → toast "Skipped: <title> (not playable)" and go to the next track; if every track in
  the queue fails, stop.
- Track or playlist deleted while queued: the current queue keeps what it already loaded.
- Visitors get 401 on every music route except `GET site`.

## Testing

`e2e/music.spec.ts` (Playwright, small mp3 fixture in `e2e/fixtures/`, oEmbed request stubbed):

- Create playlist, upload mp3, add YouTube link (video, playlist, and both-ids prompt), rename,
  reorder, toggle visibility, delete track/playlist (file gone from `/uploads`).
- Permissions: another player gets 404 on a private playlist and does not list it; visitor sees
  the dashboard player and only `GET site` works; DM edits the site playlist but
  `site-default` is 403; admin switches the site playlist.
- Persistence: play the mp3, navigate to two other pages, `audio.currentTime` keeps increasing,
  mini bar still shown; ✕ clears it.
- Upload rejects a `.txt` and an over-size file.
- DM screen Music panel plays; `/api/display` response has no music fields.
- Manual: YouTube across navigation in Firefox and WebKit.

## Out of scope

Synced "play for the table" playback, crossfade, importing a YouTube playlist as separate
tracks, storage quotas, sharing one track between playlists, access-checked file serving.
