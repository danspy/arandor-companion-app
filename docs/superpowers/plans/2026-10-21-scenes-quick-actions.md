# Scenes & Quick Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A strip under the party panel on the DM screen with *Start session* / *Pause* quick actions and saved, one-click display scenes.

**Architecture:** `DMScreenState` gains `screenMode` (`live|start|pause`) and `startScreen` (JSON); a new `Scene` table stores display setups. Pure logic (snapshot, apply, matching, start defaults) lives in `src/lib/scenes.ts`; thin API routes under `src/pages/api/scenes/`; a new `SceneStrip.astro` component talks to the existing DM screen script through one DOM event. The display gets a `start` mode.

**Tech Stack:** Astro 7 SSR, Drizzle ORM over SQLite, TailwindCSS v4 (theme tokens in `src/styles/global.css`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-scenes-quick-actions-design.md`

## Global Constraints

- Branch `feat/scenes-quick-actions`; one PR, **not merged** until the user has seen it on dev.arandor.app and explicitly says so.
- Schema changes = reviewed SQL migration `db/migrations/2026-10-21_scenes.sql`; on dev apply it to `/srv/arandor-dev/data/dev.db` after copying the db to `/srv/arandor-dev/data/archive/`. Never touch preview/live DBs.
- All scene and dm-screen write routes: `requireDungeonmasterOrAdmin(cookies)` from `src/lib/middleware.ts`.
- Spotlight keys: NPC id or `character:<id>` (`src/lib/spotlight.ts`), never a new format.
- Applying a scene never changes `showInitiativeTracker`, `showTimer`, `timer*`, `placeholderImageUrl`, `customAssets`.
- `screenVisible` is still written, always as `screenMode !== 'pause'`; `/api/display` keeps returning it.
- Campaign name on the start screen: `Arandor`. Recap is plain text (no markdown/HTML injection: set via `textContent`).
- Dark-only app; only colour tokens from `global.css`. Errors on the DM screen use `alert(...)` like the rest of the page.
- Logged-in e2e tests use `E2E_DM` / `E2E_DM_PASSWORD` and skip when unset; they run only against an isolated test server (see memory: deploy-workflow), never dev/preview/live data.

## Review Focus

1. A scene referencing a deleted NPC/character/location → apply still succeeds, missing ids dropped, card shows them greyed (Task 1 test `apply drops missing references`, Task 2 API test).
2. hidden/focus ids not in the spotlight (stale scene data or hand-crafted POST) → filtered on save and on apply (Task 1 test `normalizes marks`).
3. Display tab opened before this release still reads `screenVisible` → pause still shows wallpaper/short break (Task 2 test `display keeps screenVisible`).
4. Long recap (thousands of chars, many line breaks) on a 1080p and a phone display → stays inside the viewport, no page scroll (Task 3 test `long recap fits`).
5. Start screen with no diary entries → session field empty, "Session" line omitted on the display, not "Session NaN" (Task 1 test `startDefaults with no diary`, Task 3 test `no session number`).

---

### Task 1: Schema, migration and `src/lib/scenes.ts`

**Files:**
- Create: `db/migrations/2026-10-21_scenes.sql`
- Modify: `src/db/schema.ts` (DMScreenState at ~252; add `Scene` after it; export it from `@/db` like the other tables)
- Create: `src/lib/scenes.ts`
- Test: `e2e/scenes.spec.ts` (describe `Scenes logic`, skipped on mobile like `e2e/dice.spec.ts`)

**Interfaces:**
- Produces:
  ```ts
  export type ScreenMode = 'live' | 'start' | 'pause';
  export interface StartScreen { title: string; session: number | null; date: string /* YYYY-MM-DD */; recap: string; showRecap: boolean }
  export interface SceneSetup { locationId: string | null; locationHidden: boolean; spotlightIds: string[]; hiddenIds: string[]; focusIds: string[]; npcsHidden: boolean }
  export function normalizeSetup(s: SceneSetup): SceneSetup            // dedupe spotlight, hidden/focus ⊆ spotlight
  export function snapshotSetup(state: DMScreenStateRow): SceneSetup    // from the live row's currentLocationId/spotlightNpcIds/...
  export function setupToStateUpdate(s: SceneSetup, exists: { npcIds: Set<string>; characterIds: Set<string>; locationIds: Set<string> }):
    { currentLocationId: string | null; locationHidden: boolean; spotlightNpcIds: string[]; hiddenNpcIds: string[]; focusNpcIds: string[]; npcsHidden: boolean; screenMode: 'live'; screenVisible: true }
  export function matchesSetup(state: DMScreenStateRow, s: SceneSetup): boolean // same location, same ordered spotlight, same mark sets + flags
  export function validateScene(body: unknown): { ok: true; name: string; setup: SceneSetup } | { ok: false; error: string } // name 1–80 chars trimmed
  export function validateStartScreen(body: unknown): { ok: true; value: StartScreen } | { ok: false; error: string } // title ≤120, recap ≤5000, session int ≥1 or null
  export function startDefaults(diary: { session: number; summary: string | null }[], today: string): { session: number | null; date: string; recap: string }
  ```
  Schema: `DMScreenState.screenMode text notNull default 'live'`, `DMScreenState.startScreen json<StartScreen>` nullable; `Scene` columns exactly as in the spec table (`spotlightIds/hiddenIds/focusIds` via `jsonArray`, `locationHidden/npcsHidden` via `bool(...).notNull().default(false)`, `sortOrder integer notNull`).

- [ ] **Step 1: Write the failing tests** in `e2e/scenes.spec.ts`:
  - `normalizes marks`: `normalizeSetup({spotlightIds:['a','a','b'], hiddenIds:['b','x'], focusIds:['x'], ...})` → spotlight `['a','b']`, hidden `['b']`, focus `[]`.
  - `snapshot then match`: a state row → `snapshotSetup` → `matchesSetup(row, setup) === true`; change spotlight order → `false`; toggle `npcsHidden` → `false`.
  - `apply replaces setup`: `setupToStateUpdate` returns exactly the keys listed in the interface (assert `Object.keys` sorted), `screenMode 'live'`, `screenVisible true` — and no timer/initiative key.
  - `apply drops missing references`: spotlight `['n1','character:c1','n-gone','character:c-gone']`, hidden `['n-gone']`, location `'loc-gone'` with exists `{npcIds:{n1}, characterIds:{c1}, locationIds:{}}` → spotlight `['n1','character:c1']`, hidden `[]`, `currentLocationId null`.
  - `validateScene`: empty name → error; 81-char name → error; good body → ok with normalized setup.
  - `validateStartScreen`: session `0` → error; session `null` → ok; recap 5001 chars → error.
  - `startDefaults with no diary` → `{ session: null, date: today, recap: '' }`; with sessions 3 (summary 'A') and 7 (summary 'B') → `{ session: 8, recap: 'B' }`; highest session with `summary null` → recap `''`.
- [ ] **Step 2:** `npx playwright test e2e/scenes.spec.ts --project=chromium -g "Scenes logic"` → FAIL (module not found).
- [ ] **Step 3:** Implement `src/lib/scenes.ts` and the schema changes. Write the migration:
  ```sql
  -- Display mode replaces the on/off screenVisible switch: live, start screen or pause.
  ALTER TABLE DMScreenState ADD COLUMN screenMode text NOT NULL DEFAULT 'live';
  ALTER TABLE DMScreenState ADD COLUMN startScreen text;
  UPDATE DMScreenState SET screenMode = 'pause' WHERE screenVisible = 0;
  -- Saved display setups on the DM screen (location + spotlight). Keys as in DMScreenState.
  CREATE TABLE Scene (
    id text PRIMARY KEY NOT NULL, name text NOT NULL, sortOrder integer NOT NULL,
    locationId text, locationHidden integer NOT NULL DEFAULT 0,
    spotlightIds text NOT NULL DEFAULT '[]', hiddenIds text NOT NULL DEFAULT '[]', focusIds text NOT NULL DEFAULT '[]',
    npcsHidden integer NOT NULL DEFAULT 0, createdAt integer NOT NULL, updatedAt integer NOT NULL
  );
  ```
  (Match `createdAt/updatedAt` storage to what `now()` in `schema.ts` produces — check an existing CREATE TABLE migration, e.g. `2026-10-19_music.sql`, and copy its column types.)
- [ ] **Step 4:** Re-run → PASS. `npx astro check` → no new errors.
- [ ] **Step 5:** Back up and migrate dev: `cp /srv/arandor-dev/data/dev.db /srv/arandor-dev/data/archive/dev-$(date +%F)-before-scenes.db && sqlite3 /srv/arandor-dev/data/dev.db < db/migrations/2026-10-21_scenes.sql`; `sqlite3 … ".schema Scene"` shows the table.
- [ ] **Step 6:** Commit `feat(scenes): schema, migration and scene logic`.

### Task 2: API routes and display payload

**Files:**
- Create: `src/pages/api/scenes/index.ts` (GET list, POST create), `src/pages/api/scenes/[id].ts` (PUT, DELETE), `src/pages/api/scenes/[id]/apply.ts` (POST), `src/pages/api/scenes/order.ts` (PUT)
- Move: `src/pages/api/dm-screen.ts` → `src/pages/api/dm-screen/index.ts` (`git mv`, fix relative imports `../../lib` → `../../../lib`; URL stays `/api/dm-screen`)
- Create: `src/pages/api/dm-screen/start-defaults.ts`
- Modify: `src/pages/api/dm-screen/index.ts` PUT (accept `screenMode`, `startScreen`; keep `screenVisible` in sync both ways: a legacy `screenVisible:false` sets `screenMode 'pause'`, `true` sets `'live'`)
- Modify: `src/pages/api/display/index.ts` (add `mode`, `startScreen`)
- Test: `e2e/scenes.spec.ts` (describe `Scenes API`, skipped without `E2E_DM`)

**Interfaces:**
- Consumes: everything from Task 1.
- Produces (JSON shapes the UI and display rely on):
  - `GET /api/scenes` → `SceneCard[]`: `{ id, name, sortOrder, setup: SceneSetup, location: { id, name, imageUrl } | null, locationMissing: boolean, portraits: { key, name, avatarUrl, missing: boolean }[] }`
  - `POST /api/scenes` body `{ name, setup }` or `{ name, fromCurrent: true }` → 201 `SceneCard`; new scene gets `sortOrder = max + 1`.
  - `PUT /api/scenes/:id` body `{ name, setup }` → `SceneCard`; 404 unknown id.
  - `DELETE /api/scenes/:id` → 204.
  - `PUT /api/scenes/order` body `{ ids: string[] }` → 204; ids not in the table → 400.
  - `POST /api/scenes/:id/apply` → the updated `DMScreenState` row (same shape as `PUT /api/dm-screen`).
  - `GET /api/dm-screen/start-defaults` → `{ session, date, recap }` (`today` = server local date `YYYY-MM-DD`).
  - `GET /api/display` adds `mode: ScreenMode` and `startScreen: StartScreen | null` (non-null only when `mode === 'start'`). When `mode !== 'live'` the location/npcs/initiative/timer may still be computed as today; the display ignores them.
  - Bad bodies → 400 `{ error }` from `validateScene` / `validateStartScreen`; player → 403.

- [ ] **Step 1: Failing tests** (`Scenes API`, logged in as DM via `context.request.post('/api/auth/login', …)` like `e2e/bestiary.spec.ts`):
  - `save current and apply`: PUT `/api/dm-screen` a known location + 2 spotlight keys → POST `/api/scenes {name:'E2E scene', fromCurrent:true}` → PUT `/api/dm-screen` clears spotlight + sets `showTimer:true` → POST apply → GET `/api/dm-screen` has the 2 keys, the location, `screenMode 'live'`, and `showTimer` still `true`.
  - `apply drops deleted NPC`: create an NPC via its API, put it in a scene's setup, delete the NPC, apply → spotlight lacks it; GET `/api/scenes` card portrait for it has `missing: true` (create via `POST /api/npcs`, delete via `DELETE /api/npcs/:id`).
  - `start mode on display`: PUT `/api/dm-screen {screenMode:'start', startScreen:{title:'The Frozen Pass', session:12, date:'2026-10-21', recap:'They fled.', showRecap:true}}` → GET `/api/display` has `mode 'start'` and that `startScreen`; PUT `{screenMode:'live'}` → `startScreen null` in the display payload.
  - `display keeps screenVisible`: PUT `{screenMode:'pause'}` → display `screenVisible false`, `mode 'pause'`; PUT `{screenVisible:true}` → `mode 'live'`.
  - `players cannot`: as no login, POST `/api/scenes` → 401/403.
  - Clean up: delete every scene named `E2E …` in `afterAll`.
- [ ] **Step 2:** Run against the isolated test server (`DATABASE_FILE=<scratch copy> PORT=4340 node dist/server/entry.mjs` after `npm run build`; `E2E_DM=… E2E_DM_PASSWORD=… npx playwright test e2e/scenes.spec.ts --project=chromium -g "Scenes API"` with `baseURL` overridden or `reuseExistingServer`) → FAIL (404s).
- [ ] **Step 3:** Implement routes (use a local `json()` helper like `src/pages/api/creatures/[id].ts`; ids via `crypto.randomUUID()`; apply = one `db.update(DMScreenState)` with `setupToStateUpdate(...)`; existence sets from three `inArray` selects).
- [ ] **Step 4:** Re-run → PASS. Also `npx playwright test e2e/display.spec.ts` still passes (mocked payload unchanged for live mode).
- [ ] **Step 5:** Commit `feat(scenes): scenes API, screen mode and start screen state`.

### Task 3: Start screen on the player display

**Files:**
- Modify: `src/pages/display.astro` (markup next to `.dsp-idle`; CSS rule `body[data-mode="start"] .dsp-start`; `render()` branches on `s.mode`)
- Test: `e2e/scenes.spec.ts` (describe `Start screen`, mocks `/api/display` like `e2e/display.spec.ts`)

**Interfaces:**
- Consumes: `/api/display` payload from Task 2. Fallback: missing `mode` → `screenVisible === false ? 'pause' : 'live'`.
- Produces: elements `#startScreen` (`.dsp-start`), `#startCampaign` ("Arandor"), `#startSession` ("Session 12", `hidden` when session null), `#startTitle`, `#startDate` (`toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })` of the ISO date, parsed as local date), `#startRecap` (heading "Previously…" + text, `hidden` unless `showRecap && recap`).

- [ ] **Step 1: Failing tests** (desktop and mobile projects):
  - `title card`: mock mode start without recap → `body[data-mode=start]`, `#startTitle` text, `#startSession` "Session 12", `#startDate` "21 October 2026", `#startRecap` hidden.
  - `title and recap`: `showRecap:true` → recap visible, text equals the recap, line breaks preserved (`white-space: pre-line`).
  - `no session number`: `session:null` → `#startSession` hidden.
  - `long recap fits`: 4000-char recap with 40 line breaks → `#startScreen` bounding box within viewport and `document.scrollingElement.scrollHeight <= innerHeight` (recap area clamps/scrolls internally).
  - `recap is text`: recap `'<img src=x onerror=alert(1)>'` → no `img` inside `#startRecap`.
  - `back to live`: switch mock to live with a location → `data-mode=stage`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Look: centred serif title over the backdrop (same backdrop as idle), campaign name small caps in `--accent`, recap panel in a `t-panel`-like surface with max-height and internal scroll, fade-in like the other modes.
- [ ] **Step 4:** Run `e2e/scenes.spec.ts -g "Start screen"` and `e2e/display.spec.ts` → PASS.
- [ ] **Step 5:** Commit `feat(display): start screen with optional recap`.

### Task 4: SceneStrip — quick actions (Start session, Pause) and Pause screen panel

**Files:**
- Create: `src/components/SceneStrip.astro` (props: `locations: {id,name,type,imageUrl}[]`, `party`, `formerParty`, `npcs` — same arrays the DM screen already loads; markup for both halves, script for the quick-actions half in this task)
- Modify: `src/pages/tools/dm-screen.astro`: render `<SceneStrip …/>` right after `<PartyPanel rows={partyRows} />`; old *Quick Actions* panel (~line 391) → heading **Pause screen**, Hide-screen block removed (keep wallpaper URL/upload); remove `toggleScreenBtn` handler and `updateScreenVisibilityUI`; refactor `loadState()` so the part after fetching is `renderState(state)`.
- Test: `e2e/scenes.spec.ts` (describe `DM screen`, logged-in, isolated server)

**Interfaces:**
- Cross-script contract (both directions, on `document`):
  - `dm-screen:state` `CustomEvent<DMScreenStateRow>` — dispatched by `updateState()` and `loadState()` in `dm-screen.astro` after every successful response, and by `SceneStrip` after apply / mode change. `dm-screen.astro` listens and calls `renderState(e.detail)` **only for events it did not dispatch itself** (`e.detail !== currentState`); `SceneStrip` listens to update its badge, buttons and active scene.
- Elements: `#startSessionBtn` (label "Start session", "Go live" while mode is start), `#pauseBtn` ("Pause" / "Resume"), `#screenModeBadge` ("Live" / "Start screen" / "Paused"), `<dialog id="startSessionDialog">` with `#startFormSession`, `#startFormTitle`, `#startFormDate`, `#startFormRecap`, radio `name="startLayout"` values `title` / `recap`, buttons `#startShowBtn`, cancel.
- Dialog prefill: last saved `state.startScreen` if its `date` is today, else `GET /api/dm-screen/start-defaults` (title empty, layout `recap` when recap non-empty else `title`).

- [ ] **Step 1: Failing tests:**
  - `start session flow`: open `/tools/dm-screen` → `#startSessionBtn` → dialog prefilled (`#startFormDate` = today) → fill title, choose recap, Show → badge "Start screen", button "Go live"; a second page on `/display` shows `#startTitle` text → click Go live → badge "Live", display leaves start mode.
  - `pause flow`: Pause → badge "Paused", display shows wallpaper or "Short break" → Resume → "Live".
  - `old hide button gone`: `#toggleScreenBtn` count 0; heading "Pause screen" visible.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Strip layout: `t-panel`, `grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6`, quick actions left; on phones stacked. Use `<dialog>` + existing `Button` component.
- [ ] **Step 4:** Run → PASS; `e2e/display.spec.ts` still PASS.
- [ ] **Step 5:** Commit `feat(dm-screen): start session and pause quick actions`.

### Task 5: SceneStrip — scenes (cards, apply, save current, edit, reorder, delete)

**Files:**
- Modify: `src/components/SceneStrip.astro` (scenes half + script)
- Test: `e2e/scenes.spec.ts` (describe `DM screen`)

**Interfaces:**
- Consumes: `/api/scenes*` (Task 2), `matchesSetup` (Task 1, imported in the component script), `dm-screen:state` (Task 4).
- Elements: `#scenesList` with `[data-scene-id]` cards (`.is-active` on the one where `matchesSetup(currentState, card.setup)`), per card buttons `[data-action=apply|edit|delete]` and a drag handle; `#saveCurrentSceneBtn`; `#newSceneBtn`; `<dialog id="sceneDialog">` with `#sceneName`, `#sceneLocation` (select, "-- None --" + locations), `#sceneLocationHidden` checkbox, `#sceneSpotlightSelect` + `#sceneSpotlightAdd` (options grouped Party / NPCs / Former party members, values = spotlight keys, same as `#npcSelect`), ordered `#sceneSpotlightList` rows with hide / focus toggle buttons and remove, `#sceneNpcsHidden` checkbox, Save / Cancel.
- Card: location thumbnail (or placeholder), name, up to 5 portraits then `+N`, missing location/portraits at 40% opacity with title "Deleted".
- Save current: opens `#sceneDialog` prefilled from the live state (`snapshotSetup`) with an empty, focused name; Save POSTs `{ name, setup }`.
- Reorder: native HTML drag-and-drop on cards (`draggable`), PUT `/api/scenes/order` on drop; on phones up/down buttons instead (`[data-action=up|down]`).
- Delete: `ConfirmDialog` component as used elsewhere.

- [ ] **Step 1: Failing tests:**
  - `save current and apply from the strip`: set location + 2 spotlight entries via the existing panels → Save current → name "E2E Tavern" → card appears and is `.is-active` → Clear spotlight via `#clearNpcsBtn` → card no longer active → Apply → card active again, the Spotlight panel lists the 2 entries again, `/display` shows both portraits.
  - `edit scene`: Edit → add an NPC, mark hidden → Save → card shows 3 portraits; apply → `/api/display` npcs has 2.
  - `reorder and delete`: create "E2E A", "E2E B" → move B up (mobile buttons project or drag on desktop) → reload → B first; delete A via confirm → gone after reload.
  - `empty state`: with no scenes, the explanatory line and both create buttons are visible.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run full `e2e/scenes.spec.ts` (both projects) and `e2e/display.spec.ts` → PASS.
- [ ] **Step 5:** Commit `feat(dm-screen): saved scenes`.

### Task 6: Docs, changelog, dev check, PR

**Files:**
- Modify: `docs/DM-Tools.md` (new `## Scenes and quick actions` section after `## DM screen`, and the `## Player display` section: start screen + pause), `CHANGELOG.md` (October 2026 → `### DM screen: scenes and quick actions`, player-facing bullets)

- [ ] **Step 1:** Write docs + changelog.
- [ ] **Step 2:** `npm run build` → succeeds. Open dev.arandor.app/tools/dm-screen (hot reload, migrated dev db): strip renders under the party panel on desktop and phone width; a scene applies; start screen shows on /display. Delete any test scenes made on dev.
- [ ] **Step 3:** Commit `docs: scenes and quick actions`, push branch, `gh pr create` titled "DM screen: scenes and quick actions (start screen, pause)", body listing the migration `db/migrations/2026-10-21_scenes.sql` (applied to dev only; must run on preview before merge and on live before promote). **Do not merge.**
- [ ] **Step 4:** Update memory (`dm-tools-roadmap.md` or a new memory) with PR number and migration status.
