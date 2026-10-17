# User guide

A tour of the app, page by page. What you may change depends on your role; see
[Roles and permissions](Roles-and-Permissions.md).

## Navigation

- **Top bar:** Diary, Library, Characters, NPCs, Locations, Map, Quests, and **Tools** when
  logged in. The key icon opens log in, or Profile / Users / Log out.
- On phones the links move into the ☰ menu. In the [installed app](Installed-App.md) a bottom
  bar replaces the top bar: your favourite pages, the dice in the middle and Menu.
- The **dice button** (bottom right; in the installed app the gold hexagon in the bottom bar) is
  on every page; see [Dice](#dice).
- Most pages have a large header image. DMs and admins can change it with the image button in
  the header.

## Dashboard (`/`)

From top to bottom:

1. **Welcome header** with the last session, the party level and its progress bar
   (DM: edit level/progress and the header image), and the **next session** with a countdown.
   *Add to my calendar* downloads the session for your calendar app.
2. **Combat active** banner while a fight runs (logged in), linking to the initiative tracker.
3. **Previously on Arandor…**: the latest session's summary and cover image. Next to it,
   **Do you remember…?** brings back a random NPC, place, older session or library document
   every 10 seconds (↻ for the next one).
4. **The Party**: a card per active character with portrait, level and HP; tap to flip for
   the ability scores. Your own characters come first (*That's you*).
5. **The Chronicle**: earlier sessions to swipe through.
6. **Quest board** (active quests by urgency) and **From the Library** (newest documents).
7. **Faction standings**: the party's reputation with each faction (DM: add, edit, delete;
   this is the only place factions are managed).
8. **The tale so far**: sessions played, NPCs met (allies/foes), places discovered, quests
   completed. Each tile links to its page.

## Diary (`/diary`)

The session reports, newest first, with search and a tag filter.

An entry has: title, date, session number, the report (Markdown), an optional **summary**
(used for the dashboard recap and the map's speech bubbles), cover image or video, a gallery,
tags, and links to the **NPCs met, locations visited, party members** and **quests** of that
session. Linked locations place the session on the [world map](World-Map.md).

The entry page shows everything with a gallery viewer, previous/next session buttons, and
**My notes**: private notes only you can see.

## Library (`/library`)

- **Docs** (`/library/docs`): lore documents in Markdown with tags and an optional linked
  location; search and tag filter.
- **Timeline** (`/library/timeline`): the history of the world by year. *Events* have a
  headline, short and full description, image, and links to sessions, documents, NPCs, places,
  characters and quests. *Labels* mark eras or jumps ("100 years later").

## Characters (`/characters`)

The party's characters with ability scores, filterable by active/inactive and searchable.

Create a character with name, player, race, class, level, portrait, ability scores and details
(background, alignment, appearance …). With a D&D Beyond link, **Auto-fill** reads most of it
from the sheet, and the character stays in sync; see [D&D Beyond sync](DnD-Beyond-Sync.md).
Tick *assign to me* to make it yours. Mark characters who left the party as inactive: they
disappear from the dashboard, and on the map they part ways after the last session they
appear in.

## NPCs (`/npcs`)

Everyone the party has met: race, occupation, home location, portrait, relationship (ally,
neutral, enemy), description (Markdown) and notes. Filter by relationship. The NPC page lists
the sessions the NPC appeared in.

## Locations (`/locations`)

Places with type (city, dungeon, wilderness, building, other), region, image, description and
notes. Filter by visited/unvisited and type. A location page shows its **inhabitants** (NPCs),
**lore** (library documents) and the sessions that took place there. Map pins are set here or
on the map; see [World map](World-Map.md).

## Map (`/map`)

The pixel-art world with the party's journey replayed session by session. See
[World map](World-Map.md).

## Quests (`/quests`)

Active quests first, sorted by priority; filter by status. DMs add and edit quests (title,
description, priority, status active/completed/failed).

## Tools (`/tools`, logged in)

- **Calendar**: game sessions and the calendar subscription; see [Calendar](Calendar.md).
- **Dice roller**: see [Dice](#dice).
- **Initiative tracker** and, for DMs, the **DM screen**: see
  [Combat and DM tools](DM-Tools.md).

## Dice

**Dice button** (every page, bottom right):

- Tap to open the panel: quick **d20**, **Advantage**, **Disadvantage**, or pick dice
  (d4–d100; tap adds, right-click removes), set a modifier, **Roll**. The panel closes while
  the dice roll; your selection stays for the next roll.
- **Reset** clears the dice, the modifier, and any dice still on screen.
- **Press and hold** the button to roll a d20 straight away.
- 3D dice tumble across the page; the result card shows the total, each die, and highlights a
  natural 20 or a critical fail. Tap the card to close it.

**Dice roller page** (`/tools/dice-roller`): the same with more room, and a history of your
last rolls (kept in your browser; *Clear history* empties it).

With *reduce motion* switched on in your device settings, dice are rolled without animation.

## Profile (`/profile`)

Your first name, profile picture, **my characters**, **bottom bar pages** for the installed
app, and password change. Links to the **changelog**.
