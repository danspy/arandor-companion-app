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
| `/api/npcs`, `/api/npcs/[id]` | public | player+ |
| `/api/locations`, `/api/locations/[id]` (incl. map pin `mapX`, `mapY`, `visibleOnMap`) | public | player+ |
| `/api/library`, `/api/library/[id]` | public | player+ |
| `/api/timeline`, `/api/timeline/[id]` | public | player+ |
| `/api/quests`, `/api/quests/[id]` | public | DM |
| `/api/factions`, `/api/factions/[id]` | public | DM |
| `/api/campaign-progress`, `/api/campaign-progress/[id]` | public | PUT: DM |
| `/api/page-settings/[pageName]` (hero banner per page) | public | PUT: DM |

`index` routes take POST (create) and GET (list); `[id]` routes take GET, PUT and DELETE.

## Characters and D&D Beyond

| Endpoint | Method | Purpose | Access |
|---|---|---|---|
| `/api/characters` | GET / POST | List / create (`assignToUser: true` makes you the owner) | public / player+ |
| `/api/characters/[id]` | GET / PUT, DELETE | Read / update, delete. Changing ability scores sets `statsManuallyEdited` | public / player+ and owner |
| `/api/characters/available` | GET | Characters not assigned to another user (Profile page) | login |
| `/api/characters/dndbeyond` | POST `{url}` | Read a D&D Beyond character (auto-fill in the form) | player+ |
| `/api/characters/sync` | POST `{characterId}` | Full sync: level, HP, ability scores (unless edited by hand) | player+ and owner |
| `/api/characters/sync-hp` | POST `{characterId}` | HP and death saves only | player+ and owner |
| `/api/characters/auto-sync` | POST `{characterId}` | Light sync (name, level, class, race), at most once per 24 h | public |

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
| `/api/dm-screen` | GET / PUT | DM screen settings, including hidden items (`locationHidden`, `hiddenNpcIds`, `npcsHidden`). PUT takes `timerAction: 'start' \| 'pause' \| 'resume' \| 'reset'`, stamped with the server clock | DM |
| `/api/display` | GET | Everything `/display` shows in one small response (health bands, no HP/AC, nothing hidden on the DM screen); supports ETag / 304 | public |
| `/api/display/wallpaper` | GET | A wallpaper stored inline as a `data:` URL, served as a cacheable image | public |

The public reads exist for the player display (`/display`), which runs without a login. They
never include exact HP, AC or notes of combatants.

## Calendar

| Endpoint | Method | Purpose | Access |
|---|---|---|---|
| `/api/events`, `/api/events/[id]` | GET / POST, PUT, DELETE | Calendar events | public / login |
| `/api/calendar/ics.ics` | GET | iCal feed of all events (`text/calendar`, cached 5 min) | public |

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
