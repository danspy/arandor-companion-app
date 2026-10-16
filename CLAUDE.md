# CLAUDE.md — Arandor Companion App

## Project Overview

A D&D companion app built with **Astro 7 + Drizzle ORM (SQLite) + TailwindCSS v4 + Node adapter**.

Tracks adventures, characters, NPCs, locations, quests, factions, and more. The world map is rendered in the browser as a pixel-art tile world (see `src/lib/worldmap/` and `scripts/trace-world.mjs`). There is no AI integration.

## Tech Stack

- **Framework**: Astro 7 (SSR, server output)
- **Adapter**: `@astrojs/node` (standalone mode)
- **Database**: Drizzle ORM over SQLite (`@libsql/client`). Schema in `src/db/schema.ts`, client and query helpers in `src/db/index.ts` (import from `@/db`)
- **Styling**: TailwindCSS v4 (via `@tailwindcss/vite`; theme tokens live in `src/styles/global.css`) + `@tailwindcss/typography`
- **Testing**: Playwright

## CRITICAL: Git Workflow

**ALWAYS use pull requests for any changes to this repo — features, bug fixes, refactors, everything.**

1. Create a new branch from `main`
2. Make changes on that branch
3. Open a PR via `gh pr create`
4. Never commit directly to `main`

## Development

```bash
npm install
npm run db:dev   # creates and seeds ./data/dev.db
npm run dev
```

## Build

```bash
npm run build   # does not touch any database
```

## Notes

- The app opens `./data/content.db` relative to its working directory in production and `./data/dev.db` in `astro dev`; `DATABASE_FILE` overrides both. Create the dev DB with `npm run db:dev`.
- Changing `src/db/schema.ts` does not change any database. Live schema changes are reviewed SQL migrations applied to preview first (see `deploy/README.md`). `drizzle.config.ts` refuses any database under `/srv/`.
- Deployment (live + preview environments, backups, promote) is described in `deploy/README.md`.
- HTTPS config should follow project memory: `server: { https: true }` for dev server.
