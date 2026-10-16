# D&D Beyond sync

Characters can be linked to their D&D Beyond sheet, so level, ability scores and hit points
don't have to be typed in twice.

## Setup

1. On dndbeyond.com, make the character sheet **public**: open the sheet → *Manage Character*
   → *Privacy* → *Public*.
2. In the app, open **Characters**, edit the character, and paste the sheet URL
   (e.g. `https://www.dndbeyond.com/characters/123456`).
   When creating a character, **Auto-fill** reads name, race, class, level, ability scores and
   details from the sheet.

## What gets synced, and when

| Sync | What | Triggered by | Who |
|---|---|---|---|
| Automatic light sync | Name, level, class, race | Opening the Characters page or a character page, at most once per 24 hours per character | Anyone |
| **Sync from D&D Beyond** button | Level, HP, max HP, ability scores | Character page | Owner or admin |
| HP sync | Current, max and temp HP, death saves | **Sync HP** in the initiative tracker or DM screen; automatically every 10 s while combat is active | DM or admin |

Ability scores you edited by hand in the app are not overwritten by a sync.

HP synced during combat is stored on the character as well, so the dashboard's party cards
show it too.

## How HP is calculated

The app reads D&D Beyond's character data and calculates like the sheet does:

- If the sheet has a **max HP override**: max = override; current = override − damage taken.
- Otherwise: max = base HP + CON modifier × level + bonus HP + HP bonuses from items and
  features (per level or flat) + Tough feat (2 × level); current = max − damage taken.
- Current HP never goes below 0. Temp HP and death saves are taken as they are.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Character not found or not public" | Set the sheet to public; check the number in the URL |
| HP differs from the website | D&D Beyond sometimes serves cached data. Save the sheet once on D&D Beyond, wait 2–3 minutes, sync again |
| Nothing syncs in combat | The character needs a D&D Beyond URL, the tracker entry must be linked to the character (or have the same name), and combat must be *active* |

The sync uses D&D Beyond's unofficial character endpoint
(`character-service.dndbeyond.com`). If D&D Beyond changes it, syncing stops working until
`src/lib/dndbeyond.ts` is adapted.
