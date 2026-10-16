# Deployment and operations

The full runbook (server layout, commands, restore, file locations) is
[`deploy/README.md`](../deploy/README.md). This page is the overview.

## Three environments on one server

| | Live | Preview | Dev |
|---|---|---|---|
| URL | https://arandor.app | https://future.arandor.app | https://dev.arandor.app |
| Purpose | The real app | Test the next release with a copy of the real data | Watch work in progress (hot reload) |
| Access | Public | Password protected, not indexed | Password protected, not indexed |
| Runs | A built release | A built release | `astro dev` from a git checkout |
| Data | The real database and uploads | Copy of a live backup | Demo data or a copy of a live backup |
| Updated by | **Promote** workflow (manual) | Every merge to `main` | Whatever branch is checked out |

Each environment runs as its own system user and cannot read the others' data. Caddy
(`deploy/caddy/Caddyfile`) handles HTTPS for all three.

## From code to live

```
branch ──PR──▶ main ──(GitHub Actions: build + deploy)──▶ preview ──(Promote, manual)──▶ live
```

1. **Pull request.** Every change goes through a PR. The build runs on the PR as a check.
2. **Merge to `main`.** The *Build and deploy to preview* workflow
   (`.github/workflows/deploy-preview.yml`) builds a release, uploads it to the server,
   activates it on preview and checks that preview answers.
3. **Test on preview.**
4. **Promote.** *Actions → Promote preview to live → Run workflow*
   (`.github/workflows/promote-live.yml`) copies the exact release that preview runs to live.
   It backs up the live database and uploads first, switches, and switches back automatically
   if live does not answer within 60 seconds.

Builds happen only in GitHub Actions; the server never builds. A release folder contains
`dist/` plus its `node_modules`. The last 5 releases per environment are kept for rollback:
`sudo arandor-activate live <release-id>`.

## Data safety

- The live database and uploads are only ever written by the live app. Builds open no
  database; `drizzle-kit` refuses any path under `/srv/`.
- **Backups:** before every live deploy, and nightly at 03:15 UTC, followed by an automatic
  restore test. Stored in `/var/backups/arandor/` and **never deleted**.
- Schema changes are reviewed SQL, applied to preview first, then live; see
  [Database](Database.md#changing-the-schema).
- Cleanup means moving data into an archive folder, not deleting it.

## Backups

```bash
sudo arandor-backup manual        # backup now (database + uploads)
sudo arandor-backup-verify        # restore test of the newest backup
ls /var/backups/arandor/db/       # database backups
```

Restoring is described in [`deploy/README.md`](../deploy/README.md#restoring-the-live-database-from-a-backup).

## Secrets

| Secret | Where |
|---|---|
| `SESSION_SECRET` per environment | `/etc/arandor/{live,preview,dev}.env` on the server (root only), loaded by systemd. Changing it logs everyone out |
| Preview/dev password | Caddy config on the server |
| `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_PRIVATE_KEY`, `SERVER_KNOWN_HOSTS`, `PREVIEW_BASIC_AUTH` | GitHub repository secrets, used by the workflows |

None of these are in git.

## The dev environment

https://dev.arandor.app runs `astro dev` from `/srv/arandor-dev/repo`, so changes on a branch
show up immediately. Its data:

- `sudo arandor-dev-reseed`: fresh demo data
- `sudo arandor-dev-refresh`: copy of the newest live backup

If a page on dev fails with *504 Outdated Optimize Dep*, a client library is missing from
`optimizeDeps.include` in `astro.config.mjs`; add it and restart `arandor-dev`.

## Status and logs

```bash
sudo arandor-deploy-status            # which release each environment runs
journalctl -u arandor -f              # live log (arandor-preview, arandor-dev likewise)
cat /var/log/arandor-deploy.log       # deploy history
```
