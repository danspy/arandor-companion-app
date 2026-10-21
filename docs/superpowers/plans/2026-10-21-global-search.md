# Global Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ⌘K / Ctrl+K / `/` opens a palette that searches campaign content, pages and (DM/admin) the bestiary, role-filtered on the server.

**Architecture:** Pure ranking in `src/lib/search/index.ts`; `sources.ts` turns DB rows + SRD JSON into records with allowed roles; `/api/search` filters by the session role and ranks; `SearchPalette.astro` is a persisted `<dialog>` in `Layout.astro`.

**Tech Stack:** Astro 7, Drizzle/SQLite, Tailwind v4 tokens, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-global-search-design.md`

## Global Constraints

- No migration, no new dependency.
- `CharacterNote` / `DiaryNote` are never read by search code.
- Bestiary records (own + SRD) only for roles `dungeonmaster`, `admin`; calendar only when logged in.
- Response contains only the spec's listed fields; snippets escape text before adding `<mark>`.
- Not mounted on `/display`. Colours from `src/styles/global.css` tokens; 16px gutters on phones.

## Review Focus

- Query with regex/HTML characters (`<b>`, `(`, `*`) → literal match, escaped output, no throw. (Task 1 test)
- Very long body text / Markdown images and links → snippet is plain text ≤ ~120 chars. (Task 1 test)
- Typing fast → older responses never overwrite newer results. (Task 3: AbortController + sequence id)
- `/` pressed inside the DiceFab expression input or any field → types `/`, palette stays closed. (Task 4 e2e)
- Logged-out request → 200 with public groups, not 401. (Task 2 test)

---

### Task 1: Pure search core

**Files:**
- Create: `src/lib/search/index.ts`, `src/lib/search/commands.ts`
- Test: `e2e/search.spec.ts` (describe "Search core", skipped on mobile like `e2e/dice.spec.ts`)

**Interfaces — Produces:**
```ts
export type Role = 'admin' | 'dungeonmaster' | 'player';
export type Viewer = Role | null; // null = logged out
export type Group = 'pages' | 'npcs' | 'locations' | 'quests' | 'characters' | 'factions'
  | 'diary' | 'timeline' | 'library' | 'calendar' | 'bestiary';
export const GROUP_ORDER: Group[]; export const GROUP_LABELS: Record<Group, string>;
export interface SearchRecord { group: Group; id: string; title: string; subtitle?: string; body?: string; href: string;
  access: 'public' | 'user' | 'dm' | 'admin'; }
export interface SearchResult { group: Group; id: string; title: string; subtitle?: string; snippet?: string; href: string; score: number; }
export function normalize(s: string): string;            // NFD, strip \p{M}, lower-case
export function canSee(access: SearchRecord['access'], viewer: Viewer): boolean;
export function plainText(markdown: string): string;     // strip images, links→text, tags, md punctuation, collapse spaces
export function snippet(body: string, terms: string[], width = 120): string | undefined; // escaped, <mark>…</mark>
export function search(query: string, records: SearchRecord[], viewer: Viewer): { group: Group; label: string; results: SearchResult[] }[];
// commands.ts
export const COMMANDS: SearchRecord[]; // group 'pages', body = keywords
export function diceAction(query: string): { label: string; notation: string } | null; // parseRoll ok → 'Roll ' + formatRoll
```
Scores (spec): equals 100 · title starts with query 80 · a title word starts with a term 60 · title contains a term 40 · body only 10. Every term must appear in normalized `title + subtitle + body`. Query < 2 chars → `[]`. Max 8 per group, 40 total; groups in `GROUP_ORDER`; ties by title A–Z.

`COMMANDS` access (copied from page guards): public — `/` Home, `/diary`, `/library`, `/library/docs`, `/library/timeline`, `/characters`, `/npcs`, `/locations`, `/map`, `/quests`, `/changelog`, `/tools/dice-roller`; user — `/tools`, `/calendar`, `/profile`, `/tools/music`, `/tools/initiative`; dm — `/tools/dm-screen`, `/tools/bestiary`, `/tools/bestiary/new`, `/tools/bestiary/generate`; admin — `/users`.

- [ ] **Step 1: Write failing tests** — `normalize('Úlfgar')==='ulfgar'`; AND matching (`'red dragon'` finds "Young Red Dragon", not "Red Wizard"); ranking order for titles "Goblin", "Goblin Boss", "Hobgoblin", body-only "…goblins…" for query `goblin` → `[Goblin, Goblin Boss, Hobgoblin, body-only]`; `snippet('<script>x</script> the goblin', ['goblin'])` contains `&lt;script&gt;` and `<mark>goblin</mark>`; query `a(` and `*` do not throw; 5 000-char Markdown body with `![img](u)` yields snippet without `![` and length ≤ 140; `canSee('dm','player')===false`, `canSee('user',null)===false`, `canSee('public',null)===true`; `search('dm screen', COMMANDS, 'player')` empty, for `'dungeonmaster'` has `/tools/dm-screen`; `diceAction('2d6+3')?.label==='Roll 2d6+3'`, `diceAction('goblin')===null`; 9 matching NPC records → 8 results.
- [ ] **Step 2: Run** `npx playwright test e2e/search.spec.ts -g "Search core" --project=chromium` → FAIL (module not found).
- [ ] **Step 3: Implement** both files. Escape (`& < > " '`) before inserting `<mark>`; build marks by index on the normalized string mapped back to the original (normalize per char so indices align).
- [ ] **Step 4: Run** same command → PASS.
- [ ] **Step 5: Commit** `Search: ranking, snippets and page list`.

### Task 2: Sources + API

**Files:**
- Create: `src/lib/search/sources.ts`, `src/pages/api/search.ts`
- Test: `e2e/search.spec.ts` (describe "Search API", uses `request` fixture; logged-in parts use `E2E_USER`/`E2E_PASSWORD` like `dice.spec.ts`, skipped when unset)

**Interfaces:** Consumes Task 1. Produces `loadRecords(viewer: Viewer): Promise<SearchRecord[]>` (only queries `Event`/`Creature`/SRD when `canSee` allows) and `GET /api/search?q=` → `{ groups }` with `Cache-Control: no-store`.

Fields/links/subtitles per spec table. Subtitles: NPC `race · occupation`, Location `type · region`, Quest `status`, Character `race class level` + ` · inactive`, Faction `status`, Diary `Session N`, Timeline `Year N`, Event `date time`, Creature/SRD `CR x · typeLine` (srd href `/tools/bestiary/srd/{key}`). Timeline: only `entryType === 'event'`. Select explicit columns (no `select()` of whole rows for Character).

- [ ] **Step 1: Failing tests** — logged out `GET /api/search?q=goblin` → 200, no `bestiary`/`calendar` group; `q=x` → `{groups:[]}`; with E2E player login, no `bestiary` group for an SRD name (`'Goblin'`); response JSON never has keys outside `group,label,results,id,title,subtitle,snippet,href,score`.
- [ ] **Step 2: Build + run** `npm run build && npx playwright test e2e/search.spec.ts -g "Search API" --project=chromium` against the isolated test server (deploy-workflow memory) → FAIL 404.
- [ ] **Step 3: Implement**; viewer from `getUserRole(cookies)` (null when logged out); 500 → `{ error }` logged like `dice-presets.ts`.
- [ ] **Step 4: Run** → PASS. Check DM login manually with curl: `q=goblin` includes bestiary.
- [ ] **Step 5: Commit** `Search: /api/search with role filtering`.

### Task 3: Palette UI

**Files:**
- Create: `src/components/SearchPalette.astro`
- Modify: `src/layouts/Layout.astro` (include after `<DiceFab />` with `transition:persist`; nav search button beside the user menu on desktop and next to `#mobileMenuBtn` on mobile, `data-testid="search-btn"`, `aria-keyshortcuts="Meta+K Control+K"`, label ⌘K on Apple platforms else Ctrl K), `src/components/DiceFab.astro` (listen `window` `'dice:roll'` → `doRollParts([{ label: '', expr: detail }])`), `src/components/dashboard/FactionCrests.astro` (`id="factions"` on root)

**Interfaces:** Consumes `/api/search`, `COMMANDS`, `canSee`, `search`, `diceAction` (client imports; page list filtered client-side with viewer from `data-viewer` on the palette root, server-rendered).

Behaviour per spec "Palette behaviour". Keys: ⌘/Ctrl+K toggles anywhere (preventDefault); `/` only when `document.activeElement` is not input/textarea/select/contenteditable; hidden and inert on `/display` (check `location.pathname` on `astro:page-load`). Debounce 150 ms, `AbortController`, request sequence id. Recent: `localStorage['arandor.search.recent']` (≤5 `{title,href,group}`), try/catch. Result `snippet` inserted with `innerHTML` (server-escaped); everything else `textContent`. `data-testid`: `search-dialog`, `search-input`, `search-result`.

- [ ] **Step 1:** Implement; `npm run build` passes with no type errors.
- [ ] **Step 2:** Check on dev.arandor.app by hand: open with Ctrl+K, `/`, button; arrows/Enter/Ctrl+Enter; Esc returns focus; phone width (Playwright mobile screenshot); `2d6` rolls in DiceFab.
- [ ] **Step 3: Commit** `Search: ⌘K palette on every page`.

### Task 4: E2E + docs

**Files:** Modify `e2e/search.spec.ts` (describe "Search palette"), `docs/User-Guide.md` (section `## Search`), `docs/API-Reference.md` (`GET /api/search`).

- [ ] **Step 1: Tests** — Ctrl+K opens `search-dialog`; type a seeded NPC name → `search-result` with its name; Enter → URL `/npcs/{id}`; focusing a page input and pressing `/` leaves the dialog closed and the input contains `/`; type `2d6` → first result text `Roll 2d6`; mobile project: `search-btn` opens it; dialog not present/openable on `/display`.
- [ ] **Step 2: Run** `npx playwright test e2e/search.spec.ts` (both projects) → PASS. Also run `e2e/dice.spec.ts` (DiceFab change) → PASS.
- [ ] **Step 3:** Write docs.
- [ ] **Step 4: Commit** `Search: e2e tests and docs`; push branch, open PR (unmerged, per dev-before-main).
