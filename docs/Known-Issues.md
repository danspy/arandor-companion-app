# Known issues

Found while writing this documentation (October 2026). None of them affects the data.

## Fixed

These were found while writing the documentation and fixed in PR #182:

- **Calendar feed times** were 1–2 hours late in subscribed calendars: times are now read in
  the campaign's time zone (`CAMPAIGN_TIME_ZONE`, default `Europe/Berlin`).
- **"Delete summary"** on a diary entry called a missing endpoint; it exists now.
- The in-app **changelog** listed removed AI features; it is rewritten.
- The app **manifest** used the old burgundy colour; it is dark now.
- Debug log lines in the factions API are removed.
- The browser tests still checked the removed light/dark switch (fixed with this
  documentation).

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

- The light-mode colour values in `src/styles/global.css` (`:root`) and the light iOS splash
  images are unused since the app became dark-only.
- `scripts/add-user.mjs` stores passwords in the older, weaker format (upgraded at first
  login).
- The campaign name "Ex Arena" is fixed in `src/components/dashboard/DashboardHero.astro`.
- `DMScreenState.customAssets` exists but is not used.
