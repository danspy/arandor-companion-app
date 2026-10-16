# Getting started (development)

## Requirements

- **Node.js 22.22 or newer** (Astro 7 requires it; CI builds with Node 22)
- npm (comes with Node)
- `sqlite3` is handy for looking into a database, but not required

## First run

```bash
git clone https://github.com/danspy/arandor-companion-app.git
cd arandor-companion-app
npm install
npm run db:dev     # creates ./data/dev.db and fills it with demo data
npm run dev        # https://localhost:4321
```

The local dev server uses a self-signed HTTPS certificate (`@vitejs/plugin-basic-ssl`), so
your browser asks you to accept it once.

### Demo logins

`npm run db:dev` seeds these users (only when the `User` table is empty):

| Username | Password | Role |
|---|---|---|
| `admin` | `admin` | admin |
| `dm` | `dm123` | dungeonmaster |
| `player1` | `player1` | player |
| `player2` | `player2` | player |

The demo data contains characters, NPCs, locations, quests, factions, diary entries,
library documents, timeline entries, calendar events and a running combat, with images from
`public/demo/`.

To start over, delete `./data/dev.db` and run `npm run db:dev` again.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (uses `./data/dev.db`) |
| `npm run db:dev` | Creates/updates the dev database schema from `src/db/schema.ts` and seeds demo data |
| `npm run build` | Production build into `dist/`. Opens no database |
| `npm run preview` | Runs the production build locally (see below) |
| `npx playwright test` | Browser tests in `e2e/` (see [Testing](#testing)) |
| `npm run generate-all-assets` | Regenerates PWA icons, splash screens and store screenshots (see [Installed app](Installed-App.md)) |

## Environment variables

None are needed for `npm run dev`. A production run needs `SESSION_SECRET`.

| Variable | Used for | Default |
|---|---|---|
| `DATABASE_FILE` | SQLite file the app opens | `./data/dev.db` in dev, `./data/content.db` in production |
| `SESSION_SECRET` | Signs login cookies; at least 32 characters | Dev: a random temporary secret (you are logged out on restart). Production: **required**, otherwise nobody can log in |
| `UPLOAD_DIR` | Where uploaded images/videos are stored in production | `/srv/arandor/uploads`. In dev, uploads go to `public/uploads/` |
| `CAMPAIGN_TIME_ZONE` | Time zone in which calendar event times are entered | `Europe/Berlin` |
| `NODE_ENV` | `production` marks the login cookie `secure` | unset |
| `HOST`, `PORT` | Address of the production server (`@astrojs/node`) | `localhost:4321` |
| `DEV_PUBLIC_HOST` | Only for the dev server behind Caddy (dev.arandor.app): plain HTTP, live reload over `wss` | unset |

A `.env` file in the project root is loaded automatically (`dotenv`); see `.env.example`.

### Running the production build locally

```bash
npm run build
SESSION_SECRET=$(openssl rand -hex 32) DATABASE_FILE=./data/dev.db node dist/server/entry.mjs
```

## Testing

Browser tests live in `e2e/` (Playwright, desktop Chrome and a Pixel 5 profile). They cover
the navigation, the design tokens and that key pages render.

```bash
npx playwright install chromium   # once
npm run build
npx playwright test
```

`playwright.config.ts` starts the built app on port 4323. If something already listens on
4323 (on the server: the dev server), Playwright reuses it instead.

## Working on the code

- **Always work on a branch and open a pull request**; never commit to `main` directly.
  Merging to `main` deploys to preview, see [Deployment](Deployment.md).
- Database changes: see [Database](Database.md#changing-the-schema). Editing
  `src/db/schema.ts` does not change any existing database.
- Where things are: see [Architecture](Architecture.md).

## Useful scripts

| Script | Purpose |
|---|---|
| `scripts/add-user.mjs` | Create a user: `DATABASE_FILE=./data/dev.db node scripts/add-user.mjs <username> <password> [role]`. Stores the older, weaker password format; it is upgraded automatically at the user's first login. Usually easier: the Users page (admin) |
| `scripts/update-user-role.mjs` | Change a role: `node scripts/update-user-role.mjs <username> <role>` |
| `scripts/trace-world.mjs` | Rebuilds `src/data/arandor-world.json` from `scripts/map-source/map.png` (see [World map](World-Map.md)) |
| `scripts/generate-*.mjs` | PWA icons, splash screens, screenshots |

The `*.sh` / `*.sql` files and `MIGRATION_*.md` in `scripts/` are one-off migrations from the
Astro DB era. They are kept for reference only; don't run them against today's databases.
