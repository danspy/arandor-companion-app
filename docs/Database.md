# Database

The app stores everything in one **SQLite** file, accessed through **Drizzle ORM** and
`@libsql/client`.

| File | Contents |
|---|---|
| `src/db/schema.ts` | All tables (Drizzle `sqliteTable` definitions) |
| `src/db/index.ts` | The connection; re-exports the tables and `and`, `eq`, `inArray`, `sql`. Import from `@/db` |
| `drizzle.config.ts` | Config for `drizzle-kit` (local dev databases only) |
| `db/seed.ts` | Demo data for development (`npm run db:dev`) |

```ts
import { db, Character, eq } from '@/db';
const [hero] = await db.select().from(Character).where(eq(Character.id, id));
```

## Which file is opened

- `DATABASE_FILE` if it is set, otherwise
- `./data/dev.db` under `astro dev`, `./data/content.db` in a production build.

Relative paths are resolved from the working directory. On the server, systemd sets the
working directory per environment (`/srv/arandor`, `/srv/arandor-preview`), so each opens its
own `data/content.db`. The build itself never opens a database.

## Column conventions

The schema keeps the encodings of the former Astro DB, so existing databases work unchanged:

- IDs are text primary keys (UUIDs). There are no SQL foreign-key constraints; references
  (e.g. `Character.userId`) are plain text columns.
- Dates are ISO strings (`createdAt`/`updatedAt` default to the insert time).
- Booleans are integers (`0`/`1`).
- Lists (`tags`, `npcIds`, …) are JSON text; most default to `[]`.

## Tables

`*` = required (not null).

| Table | Purpose | Columns |
|---|---|---|
| **DiaryEntry** | One session report | `date*`, `title*`, `content*` (Markdown), `summary`, `session*` (number), `tags*`, `coverImageUrl`, `coverVideoUrl`, `galleryUrls`, `npcIds`, `locationIds`, `characterIds`, `questIds` |
| **DiaryNote** | A user's private note on a diary entry | `diaryEntryId*`, `userId*`, `content*` |
| **Character** | Player characters | `name*`, `class*`, `level*`, `race*`, `player*`, `userId` (owner), `isActive` (default true), `avatarUrl`, `dndbeyondUrl`, `stats` (JSON ability scores), `statsManuallyEdited`, `hp`, `maxHp`, `tempHp`, `deathSaveSuccesses`, `deathSaveFailures`, `isStable`, `gender`, `alignment`, `background`, `age`, `height`, `weight`, `eyes`, `skin`, `hair`, `lastSyncedAt`, `sheet` (JSON `CharacterSheet` from D&D Beyond: AC, saves, skills; see `src/lib/character-sheet.ts`) |
| **CharacterNote** | Private notes on a character (its player, the DM and admins) | `characterId*` (Character.id, primary key), `content*`, `updatedAt`. Separate from Character so no page or API that hands out character rows can leak them |
| **NPC** | Non-player characters | `name*`, `race*`, `occupation`, `locationId`, `location` (legacy text), `description*`, `relationship*` (`ally`/`neutral`/`enemy`), `notes`, `avatarUrl` |
| **Location** | Places, and their map pins | `name*`, `type*` (`city`/`dungeon`/`wilderness`/`building`/`other`), `description*`, `region`, `visited`, `notes`, `imageUrl`, `mapX`, `mapY` (0–100 %), `visibleOnMap` |
| **Quest** | Quests | `title*`, `description*`, `status*` (`active`/`completed`/`failed`), `priority*` (`high`/`medium`/`low`) |
| **Faction** | Reputation with factions | `name*`, `status*` (`enemy`/`suspicious`/`neutral`/`friendly`/`respectful`), `progress` (default 50) |
| **LibraryEntry** | Lore documents | `title*`, `content*` (Markdown), `tags`, `locationId`, `questIds` |
| **TimelineEntry** | World history timeline | `entryType*` (`event` or `label`), `year*`, `month`, `label`, `sortOrder`, `headline`, `shortDescription`, `fullDescription` (Markdown), `imageUrl`, `diaryEntryIds`, `libraryDocsEntryIds`, `npcIds`, `locationIds`, `characterIds`, `questIds` |
| **Event** | Calendar (game sessions) | `title*`, `description`, `date*` (YYYY-MM-DD), `time*` (HH:MM), `duration` (minutes), `hostId` |
| **CampaignProgress** | Party level and progress | `currentLevel*`, `progressPercent*` (0–100), `heroImageUrl` (dashboard banner) |
| **PageSettings** | Hero banner image per page | `pageName*` (unique), `heroImageUrl` |
| **User** | Accounts | `username*` (unique), `passwordHash*`, `role*` (`admin`/`dungeonmaster`/`player`), `firstName`, `profileImageUrl`, `characterIds`, `favoritePages` (up to 4 page paths), `dicePresets` (saved dice rolls, see `lib/dice-notation`) |
| **Playlist** | Music player playlists | `ownerId*` (User), `name*`, `visibility*` (`public`/`private`), `isSiteDefault` (exactly one playlist, "Tavern music", enforced by a partial unique index), `showOnDashboard` (site playlist: show the dashboard panel; default on) |
| **PlaylistTrack** | Tracks of a playlist (deleted with it) | `playlistId*`, `position*`, `kind*` (`file`/`youtube_video`/`youtube_playlist`), `title*`, `ref*` (upload URL such as `/uploads/music/<uuid>.mp3`, or YouTube video/list id), `durationSec` (unused so far) |
| **InitiativeTracker** | Combatants of the current fight | `name*`, `initiative*`, `type*` (`character`/`npc`/`monster`/`other`), `characterId`, `hp`, `maxHp`, `tempHp`, `ac`, `notes`, `creatureId` (stat block it came from; DM only), `conditions` (`["Poisoned", "Exhaustion 2"]`), `isActive`, death-save fields, `isStable` |
| **Creature** | Bestiary stat blocks (DM only) | `name*`, `typeLine`, `ac`, `acNote`, `hp` (average), `hpFormula`, `initiative` (bonus), `speed`, `abilities` (`{ str: { score, mod, save }, … }`), `details` (`[{ label, text }]`), `sections` (`[{ title, intro?, entries: [{ name, text }] }]`), `cr`, `xp`, `npcIds`, `notes`, `sourceText` (as pasted), `srdKey` (copied from the SRD 5.2 library, `src/data/srd-2024-creatures.json`); see `src/lib/statblock.ts` |
| **CombatState** | The current fight | `currentRound`, `currentTurnIndex`, `status` (`active`/`paused`/`stopped`) |
| **DMScreenState** | What the player display shows | `currentLocationId`, `spotlightNpcIds` (the spotlight in order: NPC ids, and party characters as `character:<id>`), `hiddenNpcIds` (spotlight entries hidden from players, same keys), `locationHidden`, `npcsHidden` (Hide all), `focusNpcIds` (spotlight entries shown on their own; empty = no focus), `customAssets` (unused), `showInitiativeTracker`, `screenMode` (`off` no session / `start` title card / `live` the table / `pause` wallpaper or break card; column default `live` for existing rows, the API creates a new row as `off`), `startScreen` (JSON `{ title, session, date, recap, showRecap }`, see `lib/scenes.ts`), `screenVisible` (legacy, kept in sync: true for `live` and `start`), `placeholderImageUrl`, `showTimer`, `timerDuration` (s), `timerStartedAt`, `timerPausedAt` (unix), `timerStatus` |
| **Scene** | Saved display setups on the DM screen (DM only) | `name*`, `sortOrder*`, `locationId`, `locationHidden`, `spotlightIds` (same keys as `spotlightNpcIds`), `hiddenIds`, `focusIds`, `npcsHidden`, `createdAt*`, `updatedAt*`. References are not foreign keys: deleted NPCs, characters and locations stay in the row and are skipped on Apply |

All tables also have `id`; most have `createdAt` and `updatedAt`.

The music tables come from `db/migrations/2026-10-19_music.sql`, which also creates the public
playlist "Tavern music" (owned by the first admin) as the site playlist. Uploaded audio lives
in the `music/` folder inside the uploads directory, not in the database.

## Changing the schema

Editing `src/db/schema.ts` changes the TypeScript types, **not** any existing database. Real
databases (live, preview) are only changed by reviewed SQL, applied by hand, preview first:

1. Edit `src/db/schema.ts`.
2. Write the matching SQL in `db/migrations/<date>_<name>.sql`, e.g.
   `ALTER TABLE NPC ADD COLUMN faction text;`.
   New columns must be nullable or have a default, so the previous release still works with
   the new schema and a rollback stays possible.
3. Locally: `npm run db:dev` updates your `./data/dev.db` (`drizzle-kit push`).
4. In the PR, apply the SQL to **preview** after a backup (commands in
   [`deploy/README.md`](../deploy/README.md#schema-changes)).
5. After merging and testing on preview: back up live, apply the same SQL to **live**, then
   promote.

`drizzle-kit` refuses any database under `/srv/`, so it can never touch the server's
databases.

## Looking into a database

```bash
sqlite3 -readonly ./data/dev.db
sqlite> .tables
sqlite> SELECT session, title FROM DiaryEntry ORDER BY session DESC LIMIT 5;
```

On the server, never open the live or preview database for writing; use the backups
instead (see [Deployment](Deployment.md#backups)).
