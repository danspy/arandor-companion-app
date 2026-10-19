# Architecture

## Stack

| Part | Technology |
|---|---|
| Framework | [Astro 7](https://astro.build) with server-side rendering (`output: 'server'`) |
| Server | `@astrojs/node` in standalone mode (one Node process per environment) |
| Database | SQLite via Drizzle ORM and `@libsql/client`, see [Database](Database.md) |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`, `@tailwindcss/typography`) plus design tokens in `src/styles/global.css` |
| Language | TypeScript 7 |
| Markdown | `marked` |
| 3D dice | `@3d-dice/dice-box` |
| Tests | Playwright |
| Hosting | One Linux server behind Caddy; see [Deployment](Deployment.md) |

There is no client framework (React, Vue …): pages are `.astro` files rendered on the server,
with small `<script>` blocks for interactivity.

## Folders

```
src/
  pages/            one file per URL (Astro file routing)
    api/            JSON endpoints, see API-Reference.md
    tools/          dice roller, initiative tracker, DM screen, music
    library/        docs, timeline, single document
    diary/ characters/ npcs/ locations/   detail pages ([id].astro)
    uploads/        serves uploaded files
    display.astro   full-screen player display (no main layout)
  layouts/
    Layout.astro    page shell: head, nav, footer, page transitions, dice button, installed-app bottom bar
  components/
    dashboard/      the dashboard sections (hero, recap, party, chronicle, quests, factions, stats)
    DiceFab.astro   floating dice button and result banner
    MusicPlayer.astro  audio element, YouTube tile and mini bar (persisted across pages)
    PWADock.astro   bottom bar and menu of the installed app
    PageHero.astro, SceneBackdrop.astro            page header images
    ConfirmDialog.astro, Button.astro
  db/               schema.ts (tables), index.ts (connection)
  lib/
    auth.ts         passwords, signed session cookie, current user/role
    middleware.ts   role checks for API routes
    dice.ts         dice engine shared by the dice button and the dice roller page
    music/          music player: store (player.ts), audio and YouTube backends, editor, DM picker, server helpers
    dndbeyond.ts    reads characters from D&D Beyond
    worldmap/       pixel-art world map: engine, tile world, sprites, heroes
    sparks.ts       ember animation
  utils/            markdown, iCal feed, video helpers
  data/arandor-world.json   tile data of the world map
  styles/global.css         Tailwind setup, colour tokens, shared component classes
db/seed.ts          demo data
deploy/             server setup: systemd units, Caddy, deploy scripts (see deploy/README.md)
e2e/                Playwright tests
public/             static files: icons, splash screens, manifest, demo images, dice assets
scripts/            asset generators, world-map tracer, user scripts
```

## Request flow

1. Caddy terminates HTTPS and forwards to the Node process on localhost.
2. Astro renders the page. The page frontmatter loads its data straight from the database
   with Drizzle (`import { db } from '@/db'`), and checks the session where needed.
3. Forms and buttons in the browser call the JSON API (`fetch('/api/…')`), then update the
   page or reload it.

`security.allowedDomains` in `astro.config.mjs` lists the public hostnames, so Astro trusts the
`Host`/`X-Forwarded-*` headers from Caddy and builds correct absolute URLs (e.g. the player
display link).

## Authentication

- Passwords: PBKDF2-SHA512 with 210,000 iterations and a random salt
  (`pbkdf2_sha512$<iterations>$<salt>$<hash>`). Older hashes still work and are upgraded at the
  next successful login.
- Session: a cookie `session` = `v1.<username>.<expiry>.<HMAC-SHA256>`, signed with
  `SESSION_SECRET`, valid 7 days, `HttpOnly`, `SameSite=Strict`, `Secure` in production.
  There is no server-side session store: changing `SESSION_SECRET` logs everyone out.
- Pages read the user with `getCurrentUser()` / `getUserRole()`; API routes use the helpers in
  `src/lib/middleware.ts`. See [Roles and permissions](Roles-and-Permissions.md).

## Live updates

There are no websockets. Pages that must stay current poll the API:

| Page | Polls | Interval |
|---|---|---|
| Initiative tracker | initiative + combat state | 2 s |
| Player display | DM screen state, initiative, combat state | 2 s |
| Dashboard | combat state (combat banner) | 5 s |
| Initiative tracker, DM screen (DM, during combat) | D&D Beyond HP sync | 10 s |

## Page transitions

`<ClientRouter />` (Astro view transitions) swaps pages without a full reload. List → detail
zooms in, detail → list zooms out, moving between main sections slides, everything else fades.
The nav, footer and the dice button persist across pages (`transition:persist`). Page scripts
therefore run on `astro:page-load`, not only once. The music player (`#music-root`) persists
as well, so playback continues across pages, including the map.

## Design system

- **Dark only.** `<html class="dark">` is rendered on the server; there is no theme switch.
- Colours are CSS variables in `src/styles/global.css` (`--bg-page`, `--bg-surface`,
  `--text-strong`, `--text-muted`, `--gold`, `--border-gold`, …). Use them instead of fixed
  colours, so contrast stays right. The light-mode values in `:root` are no longer used.
- Shared classes: `t-panel`, `t-inset`, `t-section-h`, `t-label`, `t-num`, `t-btn-primary`,
  `t-input`, `t-link`, `t-muted`, `t-faint`.
- Fonts: Cormorant Garamond (headings, numbers) and Outfit (text).
- Corners are square (2 px); only avatars are round.
- Pages respect `prefers-reduced-motion`.

## The dice roller

`src/lib/dice.ts` owns one full-screen 3D dice overlay for the whole site. Both the floating
button (`DiceFab.astro`) and `/tools/dice-roller` call `roll()`; each finished roll is stored in
the browser (last 20) and announced as a `arandor:dice-roll` event, which the result banner
shows. Without WebGL or with reduced motion, rolls fall back to plain random numbers.

Written rolls and presets: `src/lib/dice-notation.ts` (pure, used in the browser and by
`/api/dice-presets`) parses `2d6+1d4+3` and checks preset lists. `rollParts()` in `dice.ts`
rolls one or more labelled parts in a single throw, applies advantage to the first lone-d20 part
and, on a natural 20 there, throws the later parts' dice again (`box.add`, so the first dice stay
on the table). Results carry `parts`; dice are handed back to the parts by type. Presets live in
`User.dicePresets`; the dice button loads them each time its panel opens, and the roller page
announces changes with `arandor:dice-presets-changed`.

## The music player

One store per browser tab (`src/lib/music/player.ts`) owns the queue and all playback. The
views (mini bar in `MusicPlayer.astro`, Tools → Music, the dashboard strip, the DM screen panel)
only call its methods and listen for the `music:state` event. Two backends sit behind it: an
`<audio>` element for uploaded files (`audio-backend.ts`) and the YouTube IFrame player
(`youtube-backend.ts`). `#music-root` is `transition:persist`, and the map page is an ordinary
client-side navigation too, so nothing is interrupted. After a full page load the store is
rebuilt from `localStorage` (`arandor.music`) and comes back paused; it never autoplays.
Playlist rules (who may view or edit) are in `lib/music/access.ts`, uploads and their limits in
`lib/music/formats.ts`; see the [API reference](API-Reference.md#music).

## The world map

See [World map](World-Map.md).
