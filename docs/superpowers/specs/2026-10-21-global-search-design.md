# Global search (⌘K / Ctrl+K): design (2026-10-21)

Agreed with the user in chat. User-facing behaviour will be documented in `docs/User-Guide.md#search`.

## Goal

From any page, one shortcut opens a search palette that finds campaign content, pages/tools and
(for the DM) bestiary creatures, matching names and body text, and jumps there with the keyboard.
Nobody can find anything through search that they could not already open themselves.

## Decisions

| Question | Decision |
|---|---|
| Opening | ⌘K (Mac) / Ctrl+K (others) anywhere; `/` when focus is not in an input, textarea, select or contenteditable; a search button in the nav for touch devices. Esc closes. Not mounted on `/display` |
| Engine | **A: server endpoint, in-memory ranking.** `GET /api/search?q=` loads searchable fields, filters by role, ranks in TypeScript. No FTS5, no migration, no new dependency (data is a few hundred rows + 331 SRD creatures) |
| Matching | Case- and accent-insensitive (`NFD`, strip combining marks). Query split on whitespace; **every** term must appear in the title or body (AND). Minimum query length 2 characters (dice actions excepted) |
| Ranking | Per result: title equals query 100 · title starts with query 80 · a title word starts with a term 60 · title contains a term 40 · only body matches 10. Ties: type order below, then title A–Z. Max 8 per group, 40 total |
| Snippet | For body-only and title matches with a body: ~120 chars of plain text around the first term match, Markdown/HTML stripped, terms wrapped in `<mark>` (text escaped first, so no injected HTML) |
| Private notes | `CharacterNote` and `DiaryNote` are never searched |
| Pages & actions | Static list with allowed roles. Typing dice notation (`parseRoll` succeeds, e.g. `2d6+3`) adds a top action "Roll 2d6+3" that rolls in the DiceFab |
| Recent searches | Last 5 opened results kept per browser in `localStorage` (try/catch, optional); shown with the page list when the query is empty |

## Who sees what

Enforced in `/api/search` from the session role. Mirrors the existing page guards.

| Group | Source | Searched fields | Link | Visible to |
|---|---|---|---|---|
| Pages & tools | `commands.ts` | label, keywords | page URL | per entry (see below) |
| NPCs | `NPC` | name, race, occupation, location, description | `/npcs/{id}` | everyone |
| Locations | `Location` | name, type, region, description | `/locations/{id}` | everyone (incl. pins hidden from the map: their pages are public) |
| Quests | `Quest` | title, description | `/quests/{id}` | everyone |
| Characters | `Character` | name, race, class, player | `/characters/{id}` | everyone (inactive included, marked "inactive") |
| Factions | `Faction` | name, status | `/#factions` (no detail page; `FactionCrests` gets `id="factions"`) | everyone |
| Diary | `DiaryEntry` | title, summary, content, tags | `/diary/{id}` | everyone |
| Timeline | `TimelineEntry` (entryType = 'event') | headline, shortDescription, fullDescription | `/library/timeline/{id}` | everyone |
| Library | `LibraryEntry` | title, content, tags | `/library/{id}` | everyone |
| Calendar | `Event` | title, description | `/calendar` | logged in |
| Bestiary | `Creature` + SRD JSON (`src/lib/srd.ts`) | name, typeLine | `/tools/bestiary/{id}`, `/tools/bestiary/srd/{key}` | dungeonmaster, admin |

Page list: each entry carries the same roles its page guard allows (public: Home, NPCs, Locations,
Quests, Characters, Diary, Library, Timeline, Docs, Map, Changelog; logged in: Calendar, Profile,
Tools, Dice roller, Music; DM/admin: DM screen, Initiative, Bestiary, New creature, NPC
generator; admin: Users). Implementation checks each page's guard and copies it exactly.

Unauthenticated requests are allowed and get the public set. The response never contains fields
outside the table above.

## Units

- `src/lib/search/index.ts` — pure: `normalize`, `rankRecords(query, records)` →
  ranked `SearchResult[]` with `snippet`. Input records are `{ group, id, title, subtitle?, body, href, roles? }`.
- `src/lib/search/sources.ts` — `loadRecords(role)`: reads the tables above (only the listed
  columns) and the SRD list, returns records already filtered by role.
- `src/lib/search/commands.ts` — static page list with roles and keywords; `diceAction(query)`.
- `src/pages/api/search.ts` — `GET ?q=`; returns `{ groups: [{ group, label, results }] }`;
  `Cache-Control: no-store`.
- `src/components/SearchPalette.astro` — `<dialog>` + script, included once in `Layout.astro`
  (`transition:persist`, so it survives view transitions like DiceFab/MusicPlayer). Nav gets a
  search button (magnifier, `aria-keyshortcuts`) showing ⌘K or Ctrl K depending on platform.
- `DiceFab.astro` listens for a `dice:roll` `CustomEvent` (`detail: string` notation) and rolls it
  as if typed; the palette dispatches it.

## Palette behaviour

- Input debounced 150 ms; an in-flight request is aborted when a newer one starts (`AbortController`);
  stale responses are ignored.
- Results grouped in the type order of the table; each row: icon per group, title, subtitle
  (e.g. "Elf · Innkeeper", "Session 12", "CR 1/4"), snippet.
- ↑/↓ moves (wraps), Enter opens, ⌘/Ctrl+Enter opens in a new tab, mouse hover moves the selection.
- Empty query: recent searches (if any), then the page list.
- No results: "Nothing found for “…”". Request error: "Search is unavailable" — the page list
  still works offline because it is filtered client-side from an embedded copy (roles from the
  server-rendered layout).
- Accessible: `role="combobox"` input with `aria-activedescendant`, `role="listbox"` results,
  focus returns to the previously focused element on close. Styled with `global.css` tokens; full
  width with 16px gutters on phones.

## Testing

- Pure-function tests in `e2e/search.spec.ts` (imported directly, as `e2e/dice.spec.ts` does with
  `parseRoll`): normalization (accents, case), AND matching, ranking
  order, snippet escaping (`<script>` in content comes out escaped), `diceAction`.
- Sources: a player/logged-out `loadRecords` contains no `bestiary` or `calendar` records; DM gets both.
- E2E `e2e/search.spec.ts` (isolated test server per `deploy-workflow`): Ctrl+K opens, typing an
  NPC name lists it, Enter navigates to `/npcs/{id}`; as a player, a monster name yields no
  Bestiary group; `/` does not open while typing in an input; `2d6` shows the roll action.

## Out of scope

FTS5/stemming, fuzzy typo matching, searching private notes, server-side recent-search history.
