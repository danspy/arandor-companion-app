# CLAUDE.md — Arandor Companion App

## Project Overview

A D&D companion app built with **Astro 6 + Astro DB + TailwindCSS v4 + Node adapter**.

Tracks adventures, characters, NPCs, locations, quests, factions, and more. The world map is rendered in the browser as a pixel-art tile world (see `src/lib/worldmap/` and `scripts/trace-world.mjs`). There is no AI integration.

## Tech Stack

- **Framework**: Astro 6 (SSR, server output)
- **Adapter**: `@astrojs/node` (standalone mode)
- **Database**: `@astrojs/db` (SQLite via libSQL)
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
npm run dev
```

## Build

```bash
ASTRO_DATABASE_FILE=./data/content.db astro build
```

## Notes

- The DB storage path in `astro.config.mjs` points to `/srv/arandor/data/content.db` (production path). Use `ASTRO_DATABASE_FILE` env var for local builds.
- HTTPS config should follow project memory: `server: { https: true }` for dev server.
