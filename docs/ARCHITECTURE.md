# Arandor Companion App - Architecture Deep Dive

This document explains how the app actually works, which files are needed, and how data storage functions.

## Table of Contents
1. [How the App Works](#how-the-app-works)
2. [Essential Files](#essential-files)
3. [How Astro DB Really Works](#how-astro-db-really-works)
4. [Files That Can Be Removed](#files-that-can-be-removed)
5. [Database Setup Guide](#database-setup-guide)
6. [Understanding the Build Process](#understanding-the-build-process)

---

## How the App Works

The Arandor Companion App is a **server-rendered Astro application** that uses Astro DB (SQLite) for data persistence. Here's the key insight:

### The Database Path is BAKED INTO the Build

When you run `npm run build`, the `ASTRO_DATABASE_FILE` environment variable value is **compiled into** the JavaScript output. This means:

```bash
# During build:
ASTRO_DATABASE_FILE=/tmp/astro-build.db astro build
```

The path `/tmp/astro-build.db` gets embedded in `dist/server/*.mjs` files. At runtime, the app reads from THAT path.

### Why Your App Works Without `.astro/content.db`

Because the build script in `package.json` sets:
```json
"build": "ASTRO_DATABASE_FILE=/tmp/astro-build.db astro build"
```

The built app uses `/tmp/astro-build.db` (or whatever path was set during build), NOT the local `.astro/content.db` file.

---

## Essential Files

### Source Code (Required for Building)

```
├── astro.config.mjs      # Astro configuration (integrations, adapter)
├── package.json          # Dependencies and scripts
├── tailwind.config.mjs   # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
├── db/
│   ├── config.ts         # Database schema definitions
│   └── seed.ts           # Initial data seeding (runs at build time)
├── src/
│   ├── layouts/          # Page layouts
│   ├── lib/              # Auth utilities, middleware
│   ├── pages/            # Routes and API endpoints
│   │   └── api/          # REST API (diary, quests, characters, etc.)
│   ├── styles/           # Global CSS
│   └── types.ts          # TypeScript type definitions
└── public/               # Static assets (map images, favicon)
```

### Runtime Files (Required for Production)

```
├── dist/                 # Built application
│   ├── client/           # Static assets (JS, CSS)
│   └── server/           # Node.js server code
│       └── entry.mjs     # Server entry point
├── node_modules/         # Dependencies (only @astrojs/* needed at runtime)
└── [DATABASE FILE]       # SQLite database (path set during build)
```

### Server Management (Optional)

```
├── arandor.service       # Systemd service file
└── scripts/
    ├── update-database.sh  # Manual migration script
    └── migrate-db.sql      # SQL schema for migrations
```

---

## How Astro DB Really Works

### Build Time vs Runtime

| Phase | Database Location | What Happens |
|-------|-------------------|--------------|
| **Build** | `ASTRO_DATABASE_FILE` env var (e.g., `/tmp/astro-build.db`) | Tables created, seed.ts runs, data inserted |
| **Runtime** | Same path (baked into dist/) | App reads/writes to that database |

### The `normalizeDatabaseUrl` Function

In the built code (`dist/server/chunks/*.mjs`), you'll find:

```javascript
const dbUrl = normalizeDatabaseUrl(
  "/tmp/astro-build.db",                                                    // Build-time ASTRO_DATABASE_FILE
  "file:///home/runner/work/arandor-companion-app/arandor-companion-app/.astro/content.db"  // Fallback (project path)
);
```

This function works as follows:
1. First argument: the value of `ASTRO_DATABASE_FILE` at build time
2. Second argument: fallback URL (absolute path to project's `.astro/content.db`)

At runtime, the first argument (build-time path) is used as the database location.

### Important Implication

**The database file MUST exist where the build expects it.** If you build with `ASTRO_DATABASE_FILE=/tmp/astro-build.db`, that file must exist at runtime for the app to work.

---

## Files That Can Be Removed

### 1. `src/data/mockData.ts` - UNUSED

This file contains hardcoded mock data that was used during early development before Astro DB was integrated. **It is not imported anywhere** and can be safely deleted.

```bash
rm src/data/mockData.ts
rmdir src/data  # Remove empty directory
```

### 2. Documentation Files (Keep What You Need)

These files are documentation/summaries that are not required for the app to run:

| File | Description | Can Remove? |
|------|-------------|-------------|
| `README.md` | Main readme | Keep |
| `DEPLOYMENT.md` | Deployment guide | Optional |
| `ARCHITECTURE.md` | This file | Optional |
| `DATABASE_FIX_SUMMARY.md` | Historical issue summary | Yes |
| `HOW_THIS_FIXES_YOUR_ISSUE.md` | Historical fix explanation | Yes |
| `SECURITY_SUMMARY.md` | Security notes | Optional |
| `SOLUTION_SUMMARY.txt` | Historical solution notes | Yes |

### 3. GitHub Workflows (Keep for CI/CD)

The `.github/` folder contains deployment workflows. Keep if using automated deployments.

### 4. Scripts Directory

- `scripts/update-database.sh` - Useful for manual migrations
- `scripts/migrate-db.sql` - Schema for manual DB setup
- `scripts/README.md` - Documentation
- `scripts/arandor-deploy-*` - Deployment helpers

These are useful for server management but not required for the app to run.

---

## Database Setup Guide

### For Fresh Deployment

**Step 1: Build with correct database path**

```bash
cd /srv/arandor
git clone https://github.com/danspy/arandor-companion-app.git .
npm install

# Build with your production database path
ASTRO_DATABASE_FILE=/srv/arandor/data/arandor.db npm run build
```

This will:
1. Create `/srv/arandor/data/arandor.db`
2. Create all tables
3. Run `seed.ts` to populate initial data
4. Bake the database path into `dist/`

**Step 2: Run the server**

```bash
node dist/server/entry.mjs
# OR use systemd
sudo systemctl start arandor
```

### For Existing Deployment

If you already have data and need to preserve it:

**Option A: Use existing database**
```bash
# Build pointing to your existing database
ASTRO_DATABASE_FILE=/path/to/your/existing.db npm run build
```

**Option B: Create new database manually**
```bash
# Create database using migration script
sqlite3 /srv/arandor/data/arandor.db < scripts/migrate-db.sql

# Then build pointing to it
ASTRO_DATABASE_FILE=/srv/arandor/data/arandor.db npm run build
```

---

## Understanding the Build Process

### What `npm run build` Does

1. **Astro compiles** all `.astro` and `.ts` files to JavaScript
2. **Astro DB creates** the database at `ASTRO_DATABASE_FILE` path
3. **Schema applied** from `db/config.ts`
4. **Seeding runs** from `db/seed.ts` (if database is empty)
5. **Database path baked** into `dist/server/*.mjs` files
6. **Client assets built** to `dist/client/`

### Environment Variables

| Variable | When | Purpose |
|----------|------|---------|
| `ASTRO_DATABASE_FILE` | Build & Runtime | Path to SQLite database |
| `HOST` | Runtime | Server listen address (default: localhost) |
| `PORT` | Runtime | Server port (default: 4321) |

### The `astro.config.mjs` `storage` Option

```javascript
db({
  storage: '/srv/arandor/data/content.db',
})
```

This option sets a default storage path, but it's primarily used as documentation for where you intend to put the database in production. **The actual database path used is determined by `ASTRO_DATABASE_FILE`** at build time, which is then baked into the compiled output.

---

## Summary: What You Actually Need

### Minimum Files for Production

```
dist/                     # Built application
├── client/               # Static assets
└── server/               # Server code
    └── entry.mjs         # Entry point
node_modules/             # Dependencies
[your-database.db]        # SQLite database (path from build)
```

### Source Files for Development/Building

```
src/                      # Source code
db/                       # Database schema and seed
public/                   # Static assets
astro.config.mjs          # Configuration
package.json              # Dependencies
tailwind.config.mjs       # Styles
tsconfig.json             # TypeScript
```

### Optional (Can Delete)

```
src/data/mockData.ts      # Unused mock data (DELETE)
DATABASE_FIX_SUMMARY.md   # Historical documentation
HOW_THIS_FIXES_YOUR_ISSUE.md  # Historical documentation  
SOLUTION_SUMMARY.txt      # Historical documentation
```

---

## Quick Reference

### Build Commands

```bash
# Development
npm run dev

# Production build (customize database path)
ASTRO_DATABASE_FILE=/path/to/database.db npm run build

# Preview production build
npm run preview
```

### Database Commands

```bash
# View tables
sqlite3 /path/to/database.db ".tables"

# View schema
sqlite3 /path/to/database.db ".schema"

# Count records
sqlite3 /path/to/database.db "SELECT COUNT(*) FROM Character;"

# Backup
cp /path/to/database.db /path/to/database.db.backup
```

### Server Commands

```bash
# Run directly
node dist/server/entry.mjs

# With custom port
HOST=0.0.0.0 PORT=3000 node dist/server/entry.mjs

# Via systemd
sudo systemctl start arandor
sudo systemctl status arandor
sudo journalctl -u arandor -f
```
