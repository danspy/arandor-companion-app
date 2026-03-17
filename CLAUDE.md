# CLAUDE.md — Arandor Companion App

## Project Overview

A D&D companion app built with **Astro 5 + Astro DB + TailwindCSS v3 + Node adapter**.

Tracks adventures, characters, NPCs, locations, quests, factions, and more. Includes optional AI features (OpenAI integration for summaries, image generation, podcast narration).

## Tech Stack

- **Framework**: Astro 5 (SSR, server output)
- **Adapter**: `@astrojs/node` (standalone mode)
- **Database**: `@astrojs/db` (SQLite via libSQL)
- **Styling**: TailwindCSS v3 + `@tailwindcss/typography`
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
