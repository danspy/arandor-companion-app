# Roles and permissions

Every account has one of three roles: **player** (default), **dungeonmaster** (DM) or
**admin**. Admins create accounts and set roles on the **Users** page.

Reading the campaign is **public on purpose**: diary, characters, NPCs, locations, library,
map, quests and the dashboard can be viewed without logging in. Logging in is needed to change
things, and for the calendar, tools, profile and private notes.

## Who can do what

| | Not logged in | Player | DM | Admin |
|---|:-:|:-:|:-:|:-:|
| View the campaign (dashboard, diary, characters, NPCs, locations, library, map, quests) | ✓ | ✓ | ✓ | ✓ |
| Player display (`/display`), dice roller | ✓ | ✓ | ✓ | ✓ |
| Diary entries: add, edit, delete | | ✓ | ✓ | ✓ |
| Private notes on diary entries (only you see them) | | ✓ | ✓ | ✓ |
| NPCs, locations, library documents, timeline: add, edit, delete | | ✓ | ✓ | ✓ |
| Calendar: view, add, edit, delete events | | ✓ | ✓ | ✓ |
| Upload images and videos | | ✓ | ✓ | ✓ |
| Music: play the site playlist ("Tavern music" on the dashboard) | ✓ | ✓ | ✓ | ✓ |
| Music: see and play public playlists, create own playlists, edit them | | ✓ | ✓ | ✓ |
| Music: edit the site playlist | | | ✓ | ✓ |
| Music: see and edit every playlist, including private ones of others | | | | ✓ |
| Music: choose which playlist is the site playlist | | | | ✓ |
| Create characters | | ✓ | ✓ | ✓ |
| Edit, delete, sync a character | | own or unowned | own or unowned | all |
| Initiative tracker: view; update own character's HP and death saves | | ✓ | ✓ | ✓ |
| Initiative tracker: damage/heal own character | | ✓ | ✓ | ✓ |
| Run combat (initiative tracker), DM screen, bestiary (stat blocks) | | | ✓ | ✓ |
| Quests, factions, campaign level/progress | | | ✓ | ✓ |
| Change page header images | | | ✓ | ✓ |
| Map edit mode (drag pins) | | | ✓ | ✓ |
| Manage users | | | | ✓ |

Notes:

- A character is **yours** when you created it with *assign to me*, or picked it in
  **Profile → My characters**. Characters without an owner can be edited by any logged-in
  user.
- Players can also set pin coordinates through the Locations form; the map's edit mode is just
  the more convenient way.
- **Music:** a playlist is private (only you and admins) or public (everyone logged in). You edit
  your own playlists; the site playlist can be edited by DMs and admins and is always public.
  It is the one place where visitors without a login can play music (dashboard). The site
  playlist cannot be deleted; make another playlist the site playlist first.
- The account named `admin` cannot be deleted.

## Accounts

- **Log in** with the key icon in the navigation.
- **Profile** (`/profile`): first name (shown as player name), profile picture, your
  characters, favourite pages for the installed app, password change.
- **Users** (`/users`, admins): add users, change name/role, reset passwords, delete users.
- Logins last 7 days. Usernames can only be changed by deleting and recreating the account.

For how this is enforced in code, see [Architecture](Architecture.md#authentication) and the
access column in the [API reference](API-Reference.md).
