# Scenes & quick actions on the DM screen: design (2026-10-21)

Agreed with the user in chat. User-facing behaviour will be documented in `docs/DM-Tools.md#scenes`.

## Goal

A strip directly below the party panel on the DM screen with two halves:

- **Quick actions**: *Start session* puts a start screen on the player display, *Pause* puts up
  the pause screen.
- **Scenes**: saved display setups (location, spotlight NPCs/characters and their marks) that the
  DM prepares before a session and puts on the display with one click.

## Decisions

| Question | Decision |
|---|---|
| Start screen content | DM chooses per start: **Title card** (campaign name "Arandor", "Session N", title, date) or **Title + recap** (adds a "Previously…" panel) |
| Start screen defaults | Session = highest `DiaryEntry.session` + 1; date = today; recap = `summary` of the diary entry with the highest session. All editable before showing |
| Applying a scene | **Replaces** location + spotlight (incl. hidden/focus marks and the hide-all flags). Initiative tracker and timer are untouched. Display switches to live |
| Creating scenes | Both: **Save current as scene** (snapshot of the live setup) and **build/edit in a dialog** |
| Music in scenes | **No.** Scenes are display-only; music can be a later addition |
| Pause vs. existing "Hide screen" | Pause **replaces** Hide screen. The wallpaper upload stays; the old *Quick Actions* panel is renamed **Pause screen** |
| Missing references | NPCs/characters/location deleted after a scene was saved are skipped silently on apply and shown as gone in the card |

## Data

Migration `db/migrations/2026-10-21_scenes.sql`:

- `DMScreenState`
  - `screenMode TEXT NOT NULL DEFAULT 'live'`: `'live' | 'start' | 'pause'`.
    Backfill: `UPDATE DMScreenState SET screenMode = 'pause' WHERE screenVisible = 0`.
  - `startScreen TEXT` (JSON, nullable): `{ title: string, session: number | null, date: string, recap: string, showRecap: boolean }`.
    Kept after going live so the dialog re-opens with the last values on the same evening.
  - `screenVisible` stays in the schema for this release (read by nothing new, written as
    `screenMode !== 'pause'` for compatibility) and is dropped in a later cleanup.
- New table `Scene`

  | column | type | notes |
  |---|---|---|
  | id | text pk | |
  | name | text not null | |
  | sortOrder | integer not null | drag order |
  | locationId | text null | |
  | locationHidden | bool not null default 0 | |
  | spotlightIds | json array | same keys as the live spotlight: NPC id or `character:<id>` (`lib/spotlight.ts`) |
  | hiddenIds | json array | subset of spotlightIds |
  | focusIds | json array | subset of spotlightIds |
  | npcsHidden | bool not null default 0 | |
  | createdAt / updatedAt | | |

There is no "active scene" column: the active scene is derived on the client by comparing the
live setup with each scene (same location + same ordered spotlight + same marks), so it stays
correct when the DM edits the live setup by hand after applying.

## API

All write routes require the DM/admin role, like `/api/dm-screen`.

- `GET /api/scenes`: list, ordered by `sortOrder`, with resolved location name/thumbnail and
  spotlight portraits (missing references flagged `missing: true`).
- `POST /api/scenes`: create. Body is either a full scene, or `{ name, fromCurrent: true }`, which
  snapshots the live `DMScreenState`.
- `PUT /api/scenes/:id`: update name/setup.
- `DELETE /api/scenes/:id`.
- `PUT /api/scenes/order`: `{ ids: string[] }`.
- `POST /api/scenes/:id/apply`: copies the scene into `DMScreenState` (dropping ids that no
  longer exist, re-filtering hidden/focus to the spotlight like the PUT in `api/dm-screen.ts`) and
  sets `screenMode = 'live'`.
- `PUT /api/dm-screen` accepts `screenMode` and `startScreen`.
- `GET /api/dm-screen/start-defaults`: `{ session, date, recap }` from the diary.
- `GET /api/display` adds `mode` and `startScreen` (only when mode is `start`). `screenVisible` keeps
  being returned as `mode !== 'pause'` for an already-open display tab.

The shared logic (snapshot, apply, filtering missing ids) lives in `src/lib/scenes.ts` so it can be
unit-tested without HTTP.

## Display (`src/pages/display.astro`)

- `mode === 'pause'`: today's behaviour unchanged (wallpaper if set, otherwise "Short break").
- `mode === 'start'`: new `data-mode="start"` layer over the backdrop: "Arandor", "Session N"
  (omitted when empty), title, formatted date; with `showRecap` a "Previously…" panel underneath
  (plain text, line breaks kept, long recaps scroll slowly or are clamped to fit the screen).
  Same fade transition as the other modes; styled with the existing theme tokens.
- `mode === 'live'`: unchanged stage rendering.

## DM screen UI (`src/pages/tools/dm-screen.astro`)

New component `src/components/SceneStrip.astro` rendered right after `<PartyPanel>`; two columns
on `lg`, stacked on phones.

**Quick actions half**
- *Start session* opens a dialog: session number, title, date, recap (textarea, pre-filled from
  start-defaults or the last saved `startScreen`), and a two-option choice **Title card / Title +
  recap**. *Show* sets `screenMode = 'start'` + `startScreen`.
- While mode is `start`, the button reads **Go live** (sets `screenMode = 'live'`).
- *Pause / Resume* toggle (`pause` ↔ `live`). Shows the current mode as a small status badge.
- The old *Quick Actions* panel loses its Hide-screen toggle and becomes **Pause screen** (wallpaper
  URL/upload only).

**Scenes half**
- Compact cards: location thumbnail, name, up to ~5 spotlight portraits (+N), missing references
  shown greyed out. The scene matching the live setup is highlighted as active.
- Card actions: **Apply**, edit, delete (via `ConfirmDialog`). Drag to reorder.
- **Save current as scene** asks for a name.
- **New / Edit** dialog: name, location select, spotlight picker with hide/focus marks, reusing the
  existing pickers from the DM screen.
- Empty state: one line explaining scenes + the two create buttons.

The DM screen reads the mode on load and after its own actions; it does not poll (a second DM tab shows a stale badge until reloaded, as with the rest of the DM screen today).

## Error handling

- Apply/save failures show an `alert` like the rest of the DM screen and leave the live state as
  it was (apply is a single DB update).
- Applying a scene whose every reference is gone still applies (empty display) and the card shows
  why.
- Start-defaults with no diary entries: session empty, recap empty, Title + recap still selectable.

## Testing

- Pure-logic tests inside `e2e/scenes.spec.ts` importing `src/lib/scenes.ts` directly (the repo pattern, as in `e2e/dice.spec.ts`; there is no separate unit runner): snapshot from state; apply replaces location/spotlight/marks,
  keeps initiative + timer, drops missing ids, re-filters hidden/focus; active-scene matching.
- Same file: start-defaults from diary rows (none / several sessions).
- Browser flows in `e2e/scenes.spec.ts`: save current display as a scene → change display → apply → display
  shows the scene; start session with recap → display shows title + recap → Go live; pause →
  display shows pause screen → resume.
- Migration applied to dev first; preview/live only after the user approves the merge.

## Out of scope

Music in scenes, scene folders/groups per adventure, scheduled/automatic scene changes, a
"previously on" built from several diary entries.
