# Arandor Companion App

The web app of our D&D campaign in the world of Arandor: session diary, characters, NPCs,
places, quests and lore, a pixel-art world map that replays the party's journey, 3D dice on
every page, and tools for the game table.

**Live:** https://arandor.app · **Documentation:** [`docs/`](docs/Home.md)

## Features

- **Dashboard** – last session recap, the party, next session countdown, quest board,
  faction standings, campaign stats
- **Adventure diary** – session reports in Markdown with cover image or video, gallery,
  summary, linked NPCs, places, characters and quests, and private notes per player
- **Characters** – party members with ability scores and appearance, synced from
  [D&D Beyond](docs/DnD-Beyond-Sync.md)
- **NPCs, locations, quests, factions** – everything the party met, visited and promised
- **Library** – lore documents and a timeline of the world's history
- **World map** – the world drawn in the browser as pixel art; the party walks its journey
  session by session with story bubbles ([details](docs/World-Map.md))
- **Dice** – a dice button on every page and a full dice roller, with 3D dice, advantage and
  disadvantage
- **Game table tools** – initiative tracker with live HP, DM screen, and a player display for a
  TV or second screen ([details](docs/DM-Tools.md))
- **Calendar** – game sessions, subscribable in Google, Apple or Outlook calendars
- **Installable** – works as an app on phones, with a favourites bar ([details](docs/Installed-App.md))
- **Roles** – player, dungeonmaster and admin ([details](docs/Roles-and-Permissions.md)).
  Reading is public; changing things needs a login.

## Tech stack

Astro 7 (server-rendered, `@astrojs/node`) · SQLite with Drizzle ORM · Tailwind CSS 4 ·
TypeScript 7 · `@3d-dice/dice-box` · Playwright. Dark theme only.

## Quick start

Requires Node.js 22.22 or newer.

```bash
npm install
npm run db:dev    # creates ./data/dev.db with demo data
npm run dev       # https://localhost:4321  (log in as admin / admin)
```

More in [Getting started](docs/Getting-Started.md): demo accounts, environment variables,
production build, tests.

## Documentation

| Using the app | Developing |
|---|---|
| [User guide](docs/User-Guide.md) | [Getting started](docs/Getting-Started.md) |
| [Roles and permissions](docs/Roles-and-Permissions.md) | [Architecture](docs/Architecture.md) |
| [Combat and DM tools](docs/DM-Tools.md) | [Database](docs/Database.md) |
| [World map](docs/World-Map.md) | [API reference](docs/API-Reference.md) |
| [D&D Beyond sync](docs/DnD-Beyond-Sync.md) | [Deployment and operations](docs/Deployment.md) |
| [Calendar](docs/Calendar.md) | [Known issues](docs/Known-Issues.md) |
| [Installed app](docs/Installed-App.md) | Server runbook: [`deploy/README.md`](deploy/README.md) |

## Contributing

Work on a branch and open a pull request; never commit to `main` directly. Merging to `main`
deploys to the preview site (https://future.arandor.app); a manual *Promote* workflow takes the
tested release live. Database schema changes need a reviewed SQL migration, see
[Database](docs/Database.md#changing-the-schema).

## License

ISC

## Acknowledgments

Inspired by [arandor.info](https://arandor.info/). Built for our table.

## Credits

The bestiary's SRD library (`src/data/srd-2024-creatures.json`) includes material from the
System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at
https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution
4.0 International License (https://creativecommons.org/licenses/by/4.0/legalcode). The data was
taken from the Open5e API and converted (`scripts/import-srd.mjs`).
