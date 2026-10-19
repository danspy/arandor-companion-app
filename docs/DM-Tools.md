# Combat and DM tools

Three tools work together at the table:

| Tool | URL | Who |
|---|---|---|
| Initiative tracker | `/tools/initiative` | Everyone logged in; only DM/admin can run combat |
| DM screen (control panel) | `/tools/dm-screen` | DM and admin |
| Player display | `/display` | Anyone with the link, no login (meant for a TV or second screen) |

All three are reached through **Tools** in the menu (shown when logged in).

## Initiative tracker

### For the DM

- **Run combat:** Start, Pause, Stop; Previous/Next turn. *Next* past the last combatant starts
  the next round. The server moves the turn, so the tracker and the DM screen always agree.
- **The round is never reset on its own.** Start (after Pause *or* Stop) carries on at the
  stored round and turn, so a fight can span several sessions: pause at round 3, come back next
  week, press Start, and it is still round 3. To begin a fresh fight at round 1, press
  **New fight** next to the round counter (tracker or DM screen). *Reset combat* and *Clear all*
  also go back to round 1.
- Adding, removing or deactivating a combatant mid-fight keeps the turn with whoever has it.
- **Add combatants:** name, initiative, type (character, NPC, monster, other), linked character
  or NPC, HP / max HP / temp HP, AC, notes, active flag. For monsters you can enter a **count**:
  each monster gets its own entry with its own rolled initiative.
- **Sync HP** from D&D Beyond for all characters. While combat is active this also happens
  automatically every 10 seconds; see [D&D Beyond sync](DnD-Beyond-Sync.md). With the tracker
  and the DM screen both open, they share one sync instead of each asking D&D Beyond.
- **Reset combat:** player characters stay (initiative set to 10), everyone else is removed,
  the round goes back to 1. **Clear all** empties the tracker and stops combat.

### For players

- See the turn order, the round and whose turn it is.
- Your own character shows exact HP, and you can update its **HP, temp HP and death saves**
  yourself. The change is saved to your character too.
- Other combatants only show a health status. Exact HP, AC and DM notes of others are never
  sent to players' browsers:

| Status | HP left |
|---|---|
| Healthy | more than 75 % |
| Injured | 51–75 % |
| Hurt | 26–50 % |
| Bloodied | 25 % or less |
| Unconscious | 0, player characters (death saves) |
| Dead | 0, everyone else |

The tracker refreshes every 2 seconds for everyone. While combat runs, logged-in users also see
a **Combat active** banner on the dashboard that links to the tracker.

## DM screen

The control panel decides what the player display shows. Changes reach the display within
about 2 seconds.

- **Player display link** with *Copy* and *Open* buttons. Open it on the screen your players
  see.
- **Location:** pick a location to show its image and name full screen.
- **NPC spotlight:** add one or more NPCs to show their portraits; remove them with ×.
- **Initiative:** show the turn order on the display, with combat controls (start/pause/stop,
  previous/next turn, sync HP) and the current and next combatant right in the panel.
- **Timer:** show a countdown on the display; set minutes, start, pause, reset. The server
  sets the start time, so the countdown matches on every device even if their clocks differ.
- **Hide screen:** shows a wallpaper (upload an image or give a URL) instead of the content,
  e.g. during breaks. Uploaded wallpapers are saved as files (older ones were stored inside the
  screen settings, which made every display refresh download them again).
- **Clear player display** removes location, NPCs and initiative at once.

## Player display

`/display` is a full-screen page without menus. It needs no login, so you can open it on any
device (TV browser, tablet, old laptop) without signing in there. On small phone screens it
asks for a larger screen.

The layout adapts to what is shown:

| Shown | Layout |
|---|---|
| One thing (location, NPCs or initiative) | Full screen |
| Location + NPCs | Stacked, half each |
| Location or NPCs + initiative | Content left (60 %), initiative right (40 %) |
| All three | Location and NPCs stacked left (60 %), initiative right (40 %) |

Players never see exact HP of others on the display, only the health status above. With
nothing selected it shows *Awaiting DM…*.

The display checks `/api/display` every 2 seconds. That one response holds everything it shows
and is about 1–2 KB, or an empty *304 Not Modified* when nothing changed, so a display can run
all evening on a phone hotspot. If the server can't be reached it retries with growing pauses
and picks up again on its own.

## Tips

- Add location images and NPC portraits before the session.
- Open the display on its screen before the players arrive, and use the browser's full-screen
  mode (F11 on most computers).
- Start combat in the tracker first, then switch on *Initiative* in the DM screen.
- Use *Hide screen* for breaks, and *Clear player display* between scenes.

## Troubleshooting

| Problem | Check |
|---|---|
| Display does not change | Reload it; make sure it shows the URL from the *Copy* button |
| Location shows no picture | The location needs an image (Locations page → edit) |
| Initiative missing on the display | *Initiative* switched on in the DM screen, entries exist, combat not stopped |
| Redirected to login on the DM screen | Your account needs the DM or admin role |

## Dice

The dice button (bottom right on every page) and the full dice roller at `/tools/dice-roller`
are described in the [User guide](User-Guide.md#dice).
