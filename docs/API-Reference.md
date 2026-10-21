# API reference

All endpoints live under `src/pages/api/` and speak JSON. Each route checks access itself, with
the helpers in `src/lib/middleware.ts`:

| Label | Meaning | Failure |
|---|---|---|
| **public** | No login needed | – |
| **login** | Any logged-in user (`requireAuth`) | 401 |
| **player+** | Logged in and the account still exists (`requirePlayerOrAbove`); in practice the same as *login* | 401 / 403 |
| **DM** | Role `dungeonmaster` or `admin` | 401 / 403 |
| **admin** | Role `admin` | 401 / 403 |
| **owner** | Admin, the character's owner (`Character.userId`), or anyone if the character has no owner | 403 |

Reading campaign content is public on purpose; see [Roles and permissions](Roles-and-Permissions.md).

## Auth and accounts

| Endpoint | Method | Purpose | Access |
|---|---|---|---|
| `/api/auth/login` | POST | `{username, password}` → sets the `session` cookie | public |
| `/api/auth/logout` | POST | Clears the cookie | public |
| `/api/profile` | GET | Own profile | login |
| `/api/dice-presets` | GET | Own saved dice rolls (`[{ id, name, parts: [{ label, expr }] }]`) | login |
| `/api/dice-presets` | PUT | Replace own list (max 30 presets, 1–4 parts, every roll checked and stored as e.g. `1d20+5`); 400 with a readable `error` | login |
| `/api/profile` | PUT | Update own `firstName`, `profileImageUrl`, `characterIds`, `favoritePages` (max 4); password change with `currentPassword` + `newPassword` (min. 6 chars) | login |
| `/api/users` | GET, POST | List users / create a user (username ≥ 3, password ≥ 6, role) | admin |
| `/api/users/[id]` | GET, PUT, DELETE | Read / change role, name, password (`adminPasswordReset: true` skips the current password) / delete. The user `admin` cannot be deleted | admin |

## Campaign content

| Endpoint | Read | Write (POST, PUT, DELETE) |
|---|---|---|
| `/api/diary`, `/api/diary/[id]` | public | player+ |
| `/api/diary/[id]/summary` (DELETE only: remove an entry's summary) | – | DM |
| `/api/diary-notes/[diaryEntryId]` | login, own note only | login, own note only |
| `/api/npcs`, `/api/npcs/[id]` | public (`hp`, `maxHp`, `conditions` only for DM/admin) | player+ |
| `/api/locations`, `/api/locations/[id]` (incl. map pin `mapX`, `mapY`, `visibleOnMap`) | public | player+ |
| `/api/library`, `/api/library/[id]` | public | player+ |
| `/api/timeline`, `/api/timeline/[id]` | public | player+ |
| `/api/quests`, `/api/quests/[id]` | public | DM |
| `/api/factions`, `/api/factions/[id]` | public | DM |
| `/api/campaign-progress`, `/api/campaign-progress/[id]` | public | PUT: DM |
| `/api/page-settings/[pageName]` (hero banner per page) | public | PUT: DM |

`index` routes take POST (create) and GET (list); `[id]` routes take GET, PUT and DELETE.

### Search

`GET /api/search?q=…` (public; at least 2 characters) →
`{ groups: [{ group, label, results: [{ group, id, title, subtitle?, snippet?, href, score }] }] }`.
What is searched depends on the role: logged-out visitors get public content and pages; logged
in adds calendar events and the tools pages; DM/admin add the bestiary (own creatures and SRD).
`snippet` is HTML (escaped text with `<mark>` around matches). Never reads private notes.
Ranking and matching: `src/lib/search/index.ts`; sources: `src/lib/search/sources.ts`.

## Characters and D&D Beyond

| Endpoint | Method | Purpose | Access |
|---|---|---|---|
| `/api/characters` | GET / POST | List / create (`assignToUser: true` makes you the owner); rows never include `sheet` | public / player+ |
| `/api/characters/[id]` | GET / PUT, DELETE | Read / update, delete. `sheet` holds only its public part unless you are the player, DM or admin. Changing the D&D Beyond URL clears `sheet` | public / player+ and owner |
| `/api/characters/available` | GET | Characters not assigned to another user (Profile page) | login |
| `/api/characters/dndbeyond` | POST `{url}` | Read a D&D Beyond character (auto-fill in the form) | player+ |
| `/api/characters/sync` | POST `{characterId}` | Full sync from D&D Beyond (the truth): level, HP, ability scores, `sheet` | player+ and owner |
| `/api/characters/sync-hp` | POST `{characterId}` | HP and death saves only | player+ and owner |
| `/api/characters/sync-all` | POST | Full sync of every active party character with a D&D Beyond link (3 at a time, no throttle) and the HP of their tracker entries; answers `{synced, failed: [{id, name, error}], results, syncedAt}` | DM |
| `/api/characters/auto-sync` | POST `{characterId}` | The same full sync, at most once per 15 min per character; answers only `{success, updated}` | public |

See [D&D Beyond sync](DnD-Beyond-Sync.md).

## Combat and DM tools

| Endpoint | Method | Purpose | Access |
|---|---|---|---|
| `/api/initiative` | GET / POST, DELETE | Combatants in turn order / add one, clear all (also stops combat). Non-DMs get a `health` band instead of HP, and exact HP only for their own characters | public / DM |
| `/api/initiative/[id]` | GET / PUT, DELETE | One combatant (redacted the same way for non-DMs) | login / DM |
| `/api/initiative/[id]` | PATCH | Quick edit: only the fields sent change (`initiative`, `hp`, `maxHp`, `tempHp`, `ac`, `notes`, `isActive`, `conditions` (conditions, effects and own tags, see `lib/conditions.ts`), `creatureId`); checked, readable `error` on 400; a new initiative or in-combat flag keeps the turn | DM |
| `/api/initiative/[id]/hp` | POST | `{ kind: 'damage' \| 'heal', amount }`: damage (temp HP first, down to 0) or heal (up to max HP, clears death saves); a character's record follows | DM, or login and owner |
| `/api/creatures` | GET / POST | Bestiary: summaries by name (`?full=1`: whole stat blocks) / new creature (checked, readable `error` on 400) | DM |
| `/api/creatures/from-srd` | POST | `{ key }`: the DM's own copy of an SRD 5.2 creature (existing or new) | DM |
| `/api/creatures/[id]` | GET / PUT, DELETE | One stat block / replace, delete (combatants keep their place, without the link) | DM |
| `/api/initiative/update-hp` | PUT | A player updates HP, temp HP and death saves of **their own** character's entry | login and owner |
| `/api/initiative/sync-hp` | POST | Sync HP from D&D Beyond for every character in the tracker. Calls within 8 s share one sync; `?force=1` always fetches | DM |
| `/api/initiative/reset-combat` | POST | Keep player characters (initiative 10), remove everyone else, round 1 | DM |
| `/api/combat-state` | GET / PUT, POST | Round, turn, status / set them, or move the turn with `{ action: 'start' \| 'next' \| 'prev' \| 'new-fight' }` (only `new-fight` resets the round) | public / DM |
| `/api/npcs/[id]` | PATCH | An NPC's status on the DM screen: `hp`, `maxHp` (0–10000 or null), `conditions` (checked like a combatant's). Only the fields sent change; HP stays within max HP | DM |
| `/api/npcs/[id]/hp` | POST | `{ kind: 'damage' \| 'heal', amount }` for an NPC outside the fight; without HP of its own it starts from its stat block's | DM |
| `/api/dm-screen` | GET / PUT | DM screen settings, including hidden items (`locationHidden`, `hiddenNpcIds`, `npcsHidden`). PUT takes `timerAction: 'start' \| 'pause' \| 'resume' \| 'reset'`, stamped with the server clock; `screenMode: 'off' \| 'start' \| 'live' \| 'pause'` and `startScreen: { title, session, date (YYYY-MM-DD), recap, showRecap, diaryEntryId }` (checked, readable `error` on 400). The legacy `screenVisible` still works (`true` = live, `false` = pause) and always follows the mode | DM |
| `/api/dm-screen/start-defaults` | GET | Pre-filled start screen: `{ session, date, recap, diaryEntryId, diary }` (next session number, last recap and newest entry from the diary, today); `diary` lists every entry newest first as `{ id, session, title, excerpt, imageUrl }` | DM |
| `/api/scenes` | GET / POST | Saved scenes in the DM's order, as cards with `setup`, `location`, `locationMissing` and `portraits` (`missing` for deleted references) / save one: `{ name, setup }` or `{ name, fromCurrent: true }` (snapshot of the DM screen), 201 | DM |
| `/api/scenes/[id]` | PUT, DELETE | Rename or change a scene `{ name, setup }` / delete it (204) | DM |
| `/api/scenes/[id]/apply` | POST | Put a scene on the DM screen: replaces location and spotlight only (timer, initiative, wallpaper and screen mode stay); deleted references are dropped. Answers the new DM screen state | DM |
| `/api/scenes/order` | PUT | `{ ids }` front to back; unknown or duplicate ids are a 400; 204 | DM |
| `/api/display` | GET | Everything `/display` shows in one small response (health bands, no HP/AC, nothing hidden on the DM screen); supports ETag / 304. `mode` (`off`/`start`/`live`/`pause`), `startScreen` (only in `start`; with `lastSession: { session, title, excerpt, imageUrl }` when it shows a diary entry, `null` if that entry was deleted), `nextSession` (`{ date, time }` from the calendar, only in `off`). The stage fields `location`, `npcs`, `initiative` and `timer` are empty (`null` / `[]`) unless the mode is `live` | public |
| `/api/display/wallpaper` | GET | A wallpaper stored inline as a `data:` URL, served as a cacheable image | public |

The public reads exist for the player display (`/display`), which runs without a login. They
never include exact HP, AC or notes of combatants.

## Calendar

| Endpoint | Method | Purpose | Access |
|---|---|---|---|
| `/api/events`, `/api/events/[id]` | GET / POST, PUT, DELETE | Calendar events | public / login |
| `/api/calendar/ics.ics` | GET | iCal feed of all events (`text/calendar`, cached 5 min) | public |

## Music

Playlists of uploaded audio files and YouTube links. A playlist is **visible** to its owner, to
admins, to every logged-in user when it is *public*, and to everyone (even without a login) when
it is the site playlist. It can be **edited** by its owner and by admins; the site playlist can
also be edited by DMs. A playlist you may not see answers 404, one you may see but not edit 403.
All bodies are JSON unless noted; errors are `{ "error": "…" }`.

| Endpoint | Method | Purpose | Access |
|---|---|---|---|
| `/api/music/site` | GET | `{ playlist }`: the site playlist with its tracks (`null` if none), for the dashboard | public |
| `/api/music/playlists` | GET | Playlists you may see (site playlist first, then yours, then the rest by name): `[{ id, name, visibility, isSiteDefault, ownerId, ownerName, trackCount, canEdit }]` | login |
| `/api/music/playlists` | POST `{name, visibility?}` | New playlist; name 1–80 characters, `visibility` `public` or `private` (default `private`). `201` with the playlist | login |
| `/api/music/playlists/[id]` | GET | The playlist with its `tracks` (by position) and `canEdit` | login, may view |
| `/api/music/playlists/[id]` | PATCH `{name?, visibility?, showOnDashboard?}` | Rename, change visibility, or (site playlist only) show/hide its dashboard panel. 400 for an empty change, a bad name, `private` on the site playlist, a non-boolean `showOnDashboard`, or `showOnDashboard` on another playlist | login, may edit |
| `/api/music/playlists/[id]` | DELETE | Removes the playlist, its tracks and their uploaded files. `{ok: true}`. The site playlist answers 409 (choose another one first) | login, may edit |
| `/api/music/playlists/[id]/tracks` | POST, multipart field `file` (one or more) | Upload audio. Per file: allowed type (see below) and at most 50 MB, checked before the file is read. Returns `{ results: [{ name, ok, track?, error? }] }`: `201` if at least one file was saved, otherwise `400` | login, may edit |
| `/api/music/playlists/[id]/tracks` | POST `{youtubeUrl, mode?, title?}` | Add a YouTube link as one track. A video link becomes a `youtube_video` track, a list link a `youtube_playlist` track. A link with both a video and a list needs `mode: "video" \| "playlist"`, otherwise `409 {needsMode: true}`. `title` (max 200) skips the title lookup (YouTube oEmbed, link text as fallback). `201` with the track; `400` for anything that is not a YouTube link | login, may edit |
| `/api/music/playlists/[id]/import` | POST `{videoIds, titles?}` | Adds YouTube videos as separate `youtube_video` tracks at the end, in order. 1–200 ids of 11 characters (`[A-Za-z0-9_-]`); duplicates are dropped. Titles come from YouTube oEmbed (at most 6 lookups at once), with `https://youtu.be/<id>` as fallback; `titles` (id → title) skips the lookup. Returns `201 {added, tracks}` | login, may edit |
| `/api/music/playlists/[id]/order` | PUT `{trackIds}` | Sets the order. `trackIds` must list every track of the playlist exactly once, else 400. `{ok: true}` | login, may edit |
| `/api/music/playlists/[id]/site-default` | POST | Makes this playlist the site playlist (the previous one stops being it). It becomes public. Returns the playlist | admin (403 for others); 404 if missing |
| `/api/music/tracks/[id]` | PATCH `{title}` | Rename a track (1–200 characters) | login, may edit its playlist |
| `/api/music/tracks/[id]` | DELETE | Removes the track, then its uploaded file. `{ok: true}` | login, may edit its playlist |

All routes except `/api/music/site` answer `401` without a login.

**Audio files:** `mp3`, `mpga`, `mpeg` (all `audio/mpeg`), `m4a`, `aac` (`audio/mp4`), `ogg`, `opus`
(`audio/ogg`), `webm`, `flac`, `wav`; at most 50 MB each (`52428800` bytes). `.mp2` is not
supported. Files are stored in `<uploads>/music/<uuid>.<ext>` and served at
`/uploads/music/<uuid>.<ext>` with HTTP range support (needed for seeking), like other uploads;
the track's `ref` is that URL. A track's `ref` is the video id or list id for YouTube tracks.
The format list lives in `src/lib/music/formats.ts`.

The browser reads the video ids of a YouTube playlist with a temporary, visible IFrame player
(`src/lib/music/youtube-list.ts`), so no API key is needed. The import is a snapshot: later
changes to the YouTube list do not reach the tracks. *Expand into tracks* in the editor imports
the list, deletes the list track and puts the new tracks at its place (`/import`, `DELETE
/api/music/tracks/[id]`, `PUT …/order`). The editor imports at most 200 videos of a list.

## Files

| Endpoint | Method | Purpose | Access |
|---|---|---|---|
| `/api/upload` | POST, multipart field `file` | Image or video, max 5 MB. Returns `{url: "/uploads/<uuid>.<ext>"}` | player+ |
| `/uploads/<file>` | GET | Serves uploads, with HTTP range support for video and a 1-year cache | public |

Uploads are stored in `UPLOAD_DIR` (production) or `public/uploads/` (dev). Files get a random
name; there is no resizing.

## Example

```bash
# log in and keep the cookie
curl -c jar -H 'Content-Type: application/json' \
  -d '{"username":"dm","password":"dm123"}' https://localhost:4321/api/auth/login -k

# create a quest (DM)
curl -b jar -H 'Content-Type: application/json' -k \
  -d '{"title":"Find the lost tome","description":"…","status":"active","priority":"high"}' \
  https://localhost:4321/api/quests
```
