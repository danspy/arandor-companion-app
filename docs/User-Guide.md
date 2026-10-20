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
   Below it, the **Tavern music** strip (see [Music](#music)); anyone can press Play.
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

- **Docs** (`/library/docs`): lore documents in Markdown with tags, an optional linked
  location and linked quests; search and tag filter. Linked quests show on the document and
  under **From the Library** on each quest's page.
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

**A character's page** works as a sheet at the table. Everyone sees HP, AC, initiative, speed,
proficiency bonus, passive Perception, the ability scores and saving throws. Tap a modifier to
roll a check, a *Save* to roll the saving throw, or the initiative to roll initiative. The rolls
use the 3D dice and show up in the roll history. *Adv* / *Dis* applies to the next d20 roll only.
The character's player, the DM and admins also see the skills, the attacks and the spellbook.
An attack's *to hit* button rolls the attack and its damage together, and a critical hit doubles
the dice. The spellbook shows the spell slots left (as of the last D&D Beyond sync) and every
spell by level; tap a spell to read its description, or its buttons to roll the attack, damage
or healing. These numbers come from D&D Beyond, so a character without a
D&D Beyond link shows only the ability checks and plain saves.

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

Each quest has its own page (`/quests/<id>`): description, the diary entries that list the
quest, and the NPCs, locations and party members of those sessions (with how many sessions
each appears in), plus timeline events linked to the quest. Quests are linked from a diary
entry's or timeline event's **Quests** field; NPC and location pages list the quests of their
diary appearances. DMs can complete, fail, reactivate, edit and delete a quest from its page.

## Tools (`/tools`, logged in)

- **Calendar**: game sessions and the calendar subscription; see [Calendar](Calendar.md).
- **Dice roller**: see [Dice](#dice).
- **Music**: playlists for the table; see [Music](#music).
- **Initiative tracker** and, for DMs, the **DM screen** and the **Bestiary**: see
  [Combat and DM tools](DM-Tools.md).

## Music

**Tavern music** on the dashboard plays the site playlist. It works without a login. It appears
only while the site playlist has tracks and is switched on for the dashboard. Press
**Play** (or **Shuffle**) to start; open **Tracks** to start from a song. While it plays the
strip glows softly, an equalizer moves next to the current title, and the button reads
**Pause**; when you pause it, it reads **Resume** and a thin line shows how far the song is.

**The mini bar** appears at the bottom left of every page once music plays, and keeps playing
while you move between pages: previous / play-pause / next, volume (wider screens), a thin
progress line along its bottom edge, and the arrow for the queue (seek, shuffle, repeat, jump
to a track). The × stops the music and closes the bar. After a full reload (or after reopening
the app) the bar comes back **paused**; the music never starts by itself.

**Tools → Music** (`/tools/music`, logged in) is where you make playlists:

- Create a playlist ("Only me" or "Everyone logged in"). Public playlists of others are listed
  too and can be played, but only edited by their owner.
- **Add music:** drop audio files on the box or choose them (mp3, m4a, ogg, flac, wav and a few
  more, up to 50 MB each), or paste a **YouTube link**. A link to a whole YouTube playlist can
  be added as one entry, or imported as separate tracks (up to 200).
- Drag tracks to reorder, click a title to rename, × removes. **Play** and **Shuffle** start the
  playlist; the DM screen has its own small music panel ([DM tools](DM-Tools.md#music)).
- **YouTube tracks** show a small video window next to the bar while they play. That is
  required by YouTube. It disappears while the music is paused.
- Admins can make any playlist the **site playlist** that the dashboard plays.

## Dice

**Dice button** (every page, bottom right):

- Tap to open the panel: quick **d20**, **Advantage**, **Disadvantage**, or pick dice
  (d4–d100; tap adds, right-click removes), set a modifier, **Roll**. The panel closes while
  the dice roll; your selection stays for the next roll.
- **Reset** clears the dice, the modifier, and any dice still on screen.
- **Press and hold** the button to roll a d20 straight away.
- **Type a roll** at the bottom of the panel: `1d20+5`, `2d6+1d4+3`, `1d20-1d4`, or German
  `1W20+5`. Dice d4, d6, d8, d10, d12, d20 and d100, up to 50 per roll. A typo is explained
  instead of rolled.
- **My rolls** (when logged in): your saved rolls, one tap each. The **Normal / Adv / Dis**
  switch above them gives the next roll advantage or disadvantage on its d20 and then goes back
  to *Normal*.
- 3D dice tumble across the page; the result card shows the total, each die, and highlights a
  natural 20 or a critical fail. A saved roll with several parts shows each part on its own
  line ("To hit 17", "Slashing 9"). Tap the card to close it.

**Dice roller page** (`/tools/dice-roller`): the same with more room, and a history of your
last rolls (kept in your browser; *Clear history* empties it).

**My rolls** (dice roller page, logged in): save the rolls you make all the time, kept on your
account so they are on every device. *New roll* opens the editor: a name and 1–4 rolls, each
with a label, e.g. **Longsword**: *To hit* `1d20+5`, *Slashing* `1d8+3`. Each roll is checked
as you type. Edit (✎), move (↑ ↓) and delete (✕) them in the list; *Save as preset* next to the
current dice selection starts a new one from it. Up to 30 per person.

- All dice of a saved roll are thrown at once.
- Advantage/disadvantage applies to the first part that is a single d20 (the attack or check).
- When that d20 shows a natural 20, the dice of the parts after it are rolled once more and
  added (critical hit; the extra dice are shown in green). Bonuses are not doubled.

With *reduce motion* switched on in your device settings, dice are rolled without animation.

## Profile (`/profile`)

Your first name, profile picture, **my characters**, **bottom bar pages** for the installed
app, and password change. Links to the **changelog**.
