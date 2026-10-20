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
| Automatic sync | Everything the button syncs | Opening the dashboard, the Characters page or a character page, at most once per 15 minutes per character | Anyone (the visit only triggers it; no data is sent back) |
| **Sync from D&D Beyond** button | Level, HP, max HP, ability scores, the character sheet | Character page | Owner or admin |
| HP sync | Current, max and temp HP, death saves | **Sync HP** in the initiative tracker or DM screen; automatically every 10 s while combat is active | DM or admin |

**D&D Beyond is the truth.** Every sync replaces HP and ability scores, including scores
edited by hand in the app (those edits used to be kept because the import calculated wrong).
For characters without a D&D Beyond link, hand-entered scores stay as they are.

## The character sheet

A full sync also stores the character sheet (`Character.sheet`): proficiency bonus, AC,
initiative, speed, saving throws, skills and passive scores. The character page shows it with
roll buttons. Spells and attacks stay on D&D Beyond, which the table uses for them anyway.

- **Everyone** sees the proficiency bonus, AC, initiative, speed, passive Perception and saving throws.
- **The character's player, the DM and admins** also see the skills and the passive Investigation
  and Insight. Other people get only the public part, from the page and from `/api/characters/<id>`.
  `/api/characters` never includes the sheet.
- The calculation follows the D&D Beyond sheet. It includes manual adjustments made there
  (skill and save overrides or bonuses, AC override), and save proficiencies come only from the
  starting class. `e2e/dndbeyond.spec.ts` checks every number against the party's real sheets.
- Changing or removing the D&D Beyond link clears the stored sheet until the next sync.

HP synced during combat is stored on the character as well, so the dashboard's party cards
show it too.

## How HP is calculated

The app reads D&D Beyond's character data and calculates like the sheet does:

- **Ability scores**: an override on the sheet wins. Otherwise base score + species, feat,
  class and background bonuses + bonuses from equipped (and, where needed, attuned) items,
  capped at 20; raised to any "set" value (Amulet of Health); then the sheet's "Other" bonus,
  which may go past 20.
- If the sheet has a **max HP override**: max = override; current = override − damage taken.
- Otherwise: max = base HP + CON modifier (from the score above) × level + "Max HP modifier" +
  per-level bonuses (Tough, Dwarven Toughness, Draconic Resilience …) + flat bonuses;
  current = max − damage taken. Healing amounts of potions in the pack are not max HP.
- Current HP never goes below 0. Temp HP and death saves are taken as they are.

All of this lives in `src/lib/dndbeyond.ts`; `e2e/dndbeyond.spec.ts` checks it against the
numbers the D&D Beyond sheets of the party show.

A sync never reloads the page in the browser: the page is refreshed through the app's
client-side router, so the music player keeps playing.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Character not found or not public" | Set the sheet to public; check the number in the URL |
| HP differs from the website | D&D Beyond sometimes serves cached data. Save the sheet once on D&D Beyond, wait 2–3 minutes, sync again |
| Nothing syncs in combat | The character needs a D&D Beyond URL, the tracker entry must be linked to the character (or have the same name), and combat must be *active* |

The sync uses D&D Beyond's unofficial character endpoint
(`character-service.dndbeyond.com`). If D&D Beyond changes it, syncing stops working until
`src/lib/dndbeyond.ts` is adapted.
