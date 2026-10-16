# Server setup: live + preview

One server runs two copies of the app. Both run the same kind of release; each has its own
database and uploads.

| | Live | Preview |
|---|---|---|
| URL | https://arandor.app | https://future.arandor.app (password protected, `noindex`) |
| systemd unit | `arandor` | `arandor-preview` |
| Runs as | `arandor` | `arandor-preview` |
| Port (localhost only) | 4321 | 4322 |
| Directory | `/srv/arandor` | `/srv/arandor-preview` |
| Database | `/srv/arandor/data/content.db` | `/srv/arandor-preview/data/content.db` (copy of a live backup) |
| Uploads | `/srv/arandor/uploads` | `/srv/arandor-preview/uploads` |
| Updated by | **Promote preview to live** workflow (manual) | every push to `main` |

```
/srv/arandor/                 root:root
  data/content.db             arandor   - only the live app writes here
  uploads/                    arandor
  app/                        deploy    - CI uploads releases here, cannot touch data/
    releases/<date>-<sha>/    dist/ + package.json + package-lock.json + node_modules/
    current -> releases/…     what the service runs
/srv/arandor-preview/         same layout, owned by arandor-preview
/var/backups/arandor/         root only
  db/content.<ts>.<reason>.db live database backups (read-only, never pruned), SHA256SUMS
  uploads/<ts>/               upload snapshots (unchanged files are hard links)
```

## Data safety rules

- Builds happen in CI only. A build does not open any database; `drizzle-kit` (local dev only)
  refuses any database path under `/srv/`.
- The release opens its database as `./data/content.db` relative to the unit's
  `WorkingDirectory`; `arandor-activate` refuses a release that contains an absolute `/srv/…/*.db` path.
- The CI user (`deploy`) owns only `app/`. It cannot write either database or uploads.
- The preview service cannot see live data or backups (`InaccessiblePaths=`), even if its code is wrong.
- Every live deploy takes a backup first. A nightly backup (03:15 UTC) is followed by a restore test.
- Schema changes are never applied to live automatically (see below).

## Deploying

1. Merge a PR into `main`. The **Build and deploy to preview** workflow builds a release and
   activates it on preview.
2. Check https://future.arandor.app.
3. Run **Actions → Promote preview to live → Run workflow**. It copies the exact release
   preview runs to live, backs up the database, switches and restarts. If the app does not
   answer within 60 s, the previous release is switched back in automatically.

The last 5 releases per environment are kept (code only).

## Schema changes

`src/db/schema.ts` describes the tables; editing it does not change any database.
To change the schema:

1. Edit `src/db/schema.ts` and write the matching SQL (`ALTER TABLE ... ADD COLUMN ...`) in
   `db/migrations/<date>_<name>.sql`. New columns must be nullable or have a default, so the
   old release keeps working with the new schema (rollback stays possible).
2. In the PR, apply the SQL to preview: `sudo arandor-backup before-migration`, then
   `sudo -u arandor-preview sqlite3 /srv/arandor-preview/data/content.db < file.sql`.
3. After merging and testing on preview, apply the same file to live (backup first,
   with `sudo -u arandor sqlite3 /srv/arandor/data/content.db`), then promote.

## Commands on the server

```bash
sudo arandor-deploy-status                    # both services and the release each runs
sudo arandor-backup manual                    # backup now (live DB + uploads)
sudo arandor-backup-verify                    # restore test of the newest backup
sudo arandor-preview-refresh                  # reset preview data from the newest live backup
sudo arandor-activate live <release-id>       # roll live back to an older release
ls /srv/arandor/app/releases                  # available releases
cat /var/log/arandor-deploy.log               # deploy history
```

### Restoring the live database from a backup

```bash
sudo arandor-backup before-restore            # keep a copy of the current state too
sudo systemctl stop arandor
sudo install -o arandor -g arandor -m 0600 /var/backups/arandor/db/<backup>.db /srv/arandor/data/content.db
sudo systemctl start arandor
```

## Files in this directory

| File | Installed at |
|---|---|
| `server/arandor-*` | `/usr/local/sbin/` (root:root 0755) |
| `systemd/*.service`, `systemd/*.timer` | `/etc/systemd/system/` |
| `sudoers/arandor-deploy` | `/etc/sudoers.d/arandor-deploy` (root:root 0440) |
| `caddy/Caddyfile` | `/etc/caddy/Caddyfile` (preview password hash filled in on the server) |

GitHub secrets used by the workflows: `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_PRIVATE_KEY`,
`SERVER_KNOWN_HOSTS` (the server's host keys), `PREVIEW_BASIC_AUTH` (`user:password` for the smoke test).
