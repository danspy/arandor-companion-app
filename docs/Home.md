# Arandor Companion App

The web app of our D&D campaign in the world of Arandor: session diary, characters, NPCs,
places, quests, a world map that replays the party's journey, a dice roller, and tools for the
game table (initiative tracker, DM screen, player display).

**Live:** https://arandor.app · **Preview:** https://future.arandor.app ·
**Dev:** https://dev.arandor.app

## For players and DMs

- [User guide](User-Guide.md): every page, and the dice
- [Roles and permissions](Roles-and-Permissions.md): who can see and change what
- [Combat and DM tools](DM-Tools.md): initiative tracker, DM screen, music, player display
- [World map](World-Map.md): the journey, and getting places onto the map
- [D&D Beyond sync](DnD-Beyond-Sync.md): linking character sheets
- [Calendar](Calendar.md): sessions and subscribing in your calendar app
- [Installed app](Installed-App.md): using Arandor as an app on your phone

## For developers

- [Getting started](Getting-Started.md): run it locally, commands, environment variables, tests
- [Architecture](Architecture.md): stack, folders, auth, live updates, design system
- [Database](Database.md): tables and how to change the schema safely
- [API reference](API-Reference.md): every endpoint and who may call it
- [Deployment and operations](Deployment.md): live/preview/dev, releases, backups
- [Known issues](Known-Issues.md)

The server runbook with all commands is [`deploy/README.md`](../deploy/README.md).

## Ground rules

- Every change goes through a pull request; merging deploys to preview, promoting goes live.
- The live data is never deleted or edited outside the app. Backups are kept forever.

Older documents (from before the 2026 rebuild) are in [`archive/`](archive/) for reference.
