# User guide

A tour of the app, page by page. What you may change depends on your role; see
[Roles and permissions](Roles-and-Permissions.md).

## Navigation

- **Top bar:** Diary, Library, Characters, NPCs, Locations, Map, Quests, and **Tools** when
  logged in. The key icon opens log in, or Profile / Users / Log out.
- On phones the links move into the ☰ menu. In the [installed app](Installed-App.md) a bottom
  bar replaces the top bar: your favourite pages, the dice in the middle and Menu.
- **Search** (magnifier in the top bar, ⌘K on a Mac, Ctrl+K elsewhere, or `/`): see [Search](#search).
- The **dice button** (bottom right; in the installed app the gold hexagon in the bottom bar) is
  on every page; see [Dice](#dice).
- Most pages have a large header image. DMs and admins can change it with the image button in
  the header.

## Search

Press **⌘K** (Mac) or **Ctrl+K** anywhere, or **/** when you are not typing in a field. On a
phone tap the magnifier in the top bar; in the installed app it is under **Menu → Search**.

- Finds NPCs, locations, quests, characters, factions, diary entries, timeline events, library
  documents and pages, by name and by the text inside them. Upper/lower case and accents do not
  matter ("ulfgar" finds "Úlfgar"); with several words, all of them must appear.
- Logged in, it also finds calendar events. DMs and admins also find their bestiary and the SRD
  creatures. Private notes (on characters and diary entries) are never searched.
- Type a roll such as `2d6+3` to roll it with the dice button.
- ↑/↓ choose, Enter opens, ⌘/Ctrl+Enter opens in a new tab, Esc closes. With nothing typed
  it shows the pages you can open and the last results you opened (kept in this browser only).
- Not on the display screen (`/display`).

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

- **Docs** (`/library/docs`): lore documents in Markdown with tags, an optional linked
  location and linked quests; search and tag filter. Linked quests show on the document and
  under **From the Library** on each quest's page.
- **Timeline** (`/library/timeline`): the history of the world as a chronicle, top to bottom.
  *Events* are cards (headline, short and full description, image, and links to sessions,
  documents, NPCs, places, characters and quests); each has its own page
  (`/library/timeline/<id>`) with *previous / next* to read on in story order and *Show on
  timeline*. *Notes* (entry type `label`) are a short line next to their year, e.g. "Anvil
  brennt". Stretches of more than 50 years without entries shrink to a "· 273 years ·" marker;
  the bar at the top shows every entry on a true scale and jumps to it.
  `/library/timeline#<id>` scrolls to an entry and highlights it.

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
The character's player, the DM and admins also see the skills (tap one to roll it) and the
passive Investigation and Insight. These numbers come from D&D Beyond, so a character without a
D&D Beyond link shows only the ability checks and plain saves.

**In the campaign**, further down the page, lists the sessions the character was in (from the
diary), the quests and NPCs of those sessions, and the timeline events linked to the character (each links to its event page).
Long lists show the newest few; *Show all* opens the rest. The character's player, the DM and
admins also get a **Notes** box there for debts, promises and plans; nobody else sees it.

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
each appears in), plus timeline events linked to the quest (linking to their event pages). Quests are linked from a diary
entry's or timeline event's **Quests** field; NPC and location pages list the quests of their
diary appearances. DMs can complete, fail, reactivate, edit and delete a quest from its page.

## Tools (`/tools`, logged in)

- **Calendar**: game sessions and the calendar subscription; see [Calendar](Calendar.md).
- **Dice roller**: see [Dice](#dice).
- **Music**: playlists for the table; see [Music](#music).
- **Initiative tracker** and, for DMs, the **DM screen** and the **Bestiary**: see
  [Combat and DM tools](DM-Tools.md).

## Music

**The music button** sits at the bottom left of every page (the dice button's twin on the
other side), for everyone, also without a login, as long as there is something to play. Tap it
to slide the mini bar out to its right (or back in); the app remembers which you chose. When nothing else is
loaded, the player holds the **Tavern music** site playlist, paused: one tap on Play starts it.
If the site playlist is empty and nothing else is loaded, there is no button.

**The player** (the mini bar next to the button) has previous / play-pause / next, volume (wider
screens), a thin progress line along its bottom edge, and the arrow that opens the queue above
it (seek, shuffle, repeat, jump to a track). On a phone the bar fills the space up to the dice
button and keeps the title, play/pause, next and the arrow; previous and × are at the top of the
queue. Music keeps playing while you move between pages. Starting
music anywhere (Tools → Music, the DM screen, your headset's play key) slides the player open;
you can shut it again while it plays, and the button then shows a moving **equaliser**. The ×
stops the music and shuts the player (Tavern music is ready again). After a full reload (or
after reopening the app) the music comes back **paused**; it never starts by itself.

**Tools → Music** (`/tools/music`, logged in) is where you make playlists:

- Create a playlist ("Only me" or "Everyone logged in"). Public playlists of others are listed
  too and can be played, but only edited by their owner.
- **Add music:** drop audio files on the box or choose them (mp3, m4a, ogg, flac, wav and a few
  more, up to 50 MB each), or paste a **YouTube link**. A link to a whole YouTube playlist can
  be added as one entry, or imported as separate tracks (up to 200).
- Drag tracks to reorder, click a title to rename, × removes. **Play** and **Shuffle** start the
  playlist; the DM screen has its own small music panel ([DM tools](DM-Tools.md#music)).
- **YouTube tracks** show a small video window above the music button while they play, whether
  the player is open or shut. That is required by YouTube. It disappears
  while the music is paused.
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
