# World map

`/map` shows the world of Arandor as a pixel-art tile world, drawn in the browser. No map image
is downloaded; the world comes from `src/data/arandor-world.json`.

## What you see

- **Location pins** for places that are switched on for the map.
- **The party** as small pixel heroes, generated from each character's appearance.
- **The journey:** the diary entries in session order, each placed at the location(s) linked
  to it. The party walks the route between them; sea crossings are drawn separately.
- **Story bubbles** at each stop: session number, title, the summary (or the first sentences of
  the entry), who joined or left the party, and a *Read entry* link.

## Controls

| Control | What it does |
|---|---|
| Zoom in/out, *whole world*, *find the party* | Map navigation (top left). Drag to pan, scroll or pinch to zoom |
| Timeline bar | Previous / play-pause / next stop, slider, playback speed |
| **Journey** | Journey log in a side panel; click a stop to travel there |
| **Hide path** / **Hide story** | Toggle the travelled path and the speech bubbles |
| **Show legend** | Explains the pin types |
| Click a location | Side panel with its NPCs, diary entries and library documents |
| Click a hero | That character's journey |

Music from the [music player](User-Guide.md#music) keeps playing while you visit the map.

## Getting a place onto the map

On **Locations**, edit the place:

| Setting | Effect |
|---|---|
| *Show pin on map* off (default for new places) | Not on the map at all. Use it for places the players don't know yet |
| *Show pin on map* on, *visited* off | Pin is shown faded |
| *Show pin on map* on, *visited* on | Pin is shown normally |

The pin also needs a position (X and Y, 0–100). The easiest way: on the map, DM and admin can
switch on **Edit mode**, drag pins and save.

For the journey, link the locations in each diary entry (*Locations visited*). Places without a
pin are skipped in the journey.

## Changing the world itself

The world is traced from a hand-drawn political map:

1. Replace `scripts/map-source/map.png` (keep 1920×1006 so existing pin positions still fit).
2. Run `node scripts/trace-world.mjs`. It writes `src/data/arandor-world.json`: coastlines,
   regions, mountains, rivers and lakes, plus generated forests, hills and beaches.
3. Check `/map` on dev, then open a PR.

Pin positions are percentages of a square box around the map image, so they stay valid as long
as the image size and framing stay the same.

## Code

| File | Role |
|---|---|
| `src/pages/map.astro` | Page, side panels, timeline bar, edit mode |
| `src/lib/worldmap/engine.ts` | Camera, input, pins, party sprites, journey, speech bubbles |
| `src/lib/worldmap/world.ts` | Tile grid, coordinate conversion, route finding (A*) |
| `src/lib/worldmap/sprites.ts`, `heroes.ts` | Pixel sprites and hero figures |
| `scripts/trace-world.mjs` | Builds the tile data from the source image |
