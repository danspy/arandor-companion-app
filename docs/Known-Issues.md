# Known issues

Found while writing this documentation (October 2026). None of them affects the data.

## Bugs

### Calendar feed shows sessions at the wrong time

Event times are typed in as local time (e.g. 18:00) but the iCal feed treats them as the
server's time zone, which is UTC. Session 83 (18:00) is published as `18:00Z`, so a calendar
in Germany shows it at 20:00 in summer and 19:00 in winter. The calendar page and the
dashboard countdown are not affected.
*Fix idea:* a fixed campaign time zone (e.g. `Europe/Berlin`) used by `src/utils/ical.ts`
(`DTSTART;TZID=…`).

### "Delete summary" on a diary entry does nothing

The button on the entry page (DM/admin) calls `DELETE /api/diary/<id>/summary`, which does
not exist (404). Workaround: edit the entry and empty the summary field.

### Browser tests are out of date

Fixed in the same change as this documentation: the tests for the removed light/dark switch
were replaced by a test that the page is always dark.

## Security notes

The group trusts its players, so these are low risk, but worth knowing:

- **Markdown is not sanitised.** Diary entries, library documents, NPC descriptions etc. are
  rendered as HTML without filtering, so any logged-in user could embed scripts that run for
  everyone viewing the page.
- **`/api/characters/auto-sync` needs no login**, so anyone can trigger a (rate-limited, once
  per 24 h) D&D Beyond refresh of a character. This is intentional for the public Characters
  page.
- **Calendar events** can be edited and deleted by every logged-in user, not only the host.
- Astro's own origin check is off (`checkOrigin: false`); cross-site requests are blocked by the
  `SameSite=Strict` session cookie instead.

## Leftovers and inconsistencies

- `src/pages/api/factions/index.ts` prints two debug lines to the server log on every request.
- `public/manifest.webmanifest` still uses the old burgundy `#8b4545` as theme and background
  colour; the app itself is dark (`#080603`). Android shows the burgundy colour while the app
  starts.
- The light-mode colour values in `src/styles/global.css` (`:root`) and the light iOS splash
  images are unused since the app became dark-only.
- `CHANGELOG.md`, which the app shows at `/changelog`, is outdated: it still lists the removed
  AI features and old versions.
- `scripts/add-user.mjs` stores passwords in the older, weaker format (upgraded at first
  login).
- The campaign name "Ex Arena" is fixed in `src/components/dashboard/DashboardHero.astro`.
- `DMScreenState.customAssets` exists but is not used.
- `.env.example` was outdated (fixed with this documentation).
