# Arandor Companion App - Complete Architecture Guide

This document provides a comprehensive overview of the Arandor Companion App, explaining how everything works, where data is stored, and how to set up the database on a server.

## Table of Contents

1. [Application Overview](#application-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Architecture](#database-architecture)
5. [Data Storage Locations](#data-storage-locations)
6. [API Architecture](#api-architecture)
7. [Authentication System](#authentication-system)
8. [Server Setup Guide](#server-setup-guide)
9. [Database Setup on Server](#database-setup-on-server)
10. [Configuration Files](#configuration-files)
11. [Troubleshooting](#troubleshooting)

---

## Application Overview

The Arandor Companion App is a D&D (Dungeons & Dragons) campaign companion application that helps players and Dungeon Masters track:

- **Adventure Diary** - Session notes and journal entries
- **Quests** - Active, completed, and failed quests with priority levels
- **Player Characters** - Party members with stats, levels, and D&D Beyond integration
- **NPCs (Non-Player Characters)** - Characters with relationships (ally/neutral/enemy)
- **Locations** - Cities, dungeons, and other places with map coordinates
- **Campaign Progress** - Party level progression tracking
- **Factions** - Track relationships with various factions
- **Library** - Knowledge base with markdown content and tags

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | [Astro.js 5.x](https://astro.build/) | Full-stack web framework with SSR |
| Styling | [Tailwind CSS 3.x](https://tailwindcss.com/) | Utility-first CSS framework |
| Database | [Astro DB](https://docs.astro.build/en/guides/astro-db/) (SQLite) | Embedded SQL database |
| Runtime | [Node.js 20+](https://nodejs.org/) | Server runtime |
| Language | TypeScript | Type-safe development |

---

## Project Structure

```
arandor-companion-app/
├── db/                          # Database configuration
│   ├── config.ts                # Database schema definitions (tables/columns)
│   └── seed.ts                  # Initial data seeding script
├── scripts/                     # Server management scripts
│   ├── update-database.sh       # Manual database migration script
│   ├── migrate-db.sql           # SQL migration definitions
│   ├── arandor-deploy-restart   # Systemd restart helper
│   └── arandor-deploy-status    # Systemd status helper
├── src/
│   ├── layouts/                 # Page layout components
│   │   └── Layout.astro         # Main layout with navigation
│   ├── lib/                     # Shared libraries
│   │   ├── auth.ts              # Authentication utilities
│   │   └── middleware.ts        # API middleware
│   ├── pages/                   # Route pages
│   │   ├── api/                 # REST API endpoints
│   │   │   ├── auth/            # Login/logout endpoints
│   │   │   ├── diary/           # Diary entry CRUD
│   │   │   ├── quests/          # Quest CRUD
│   │   │   ├── characters/      # Character CRUD
│   │   │   ├── npcs/            # NPC CRUD
│   │   │   ├── locations/       # Location CRUD
│   │   │   ├── library/         # Library entry CRUD
│   │   │   ├── factions/        # Faction CRUD
│   │   │   └── campaign-progress/ # Progress CRUD
│   │   ├── characters/          # Character pages
│   │   ├── diary/               # Diary pages
│   │   ├── library/             # Library pages
│   │   ├── locations/           # Location pages
│   │   ├── npcs/                # NPC pages
│   │   ├── index.astro          # Dashboard
│   │   ├── quests.astro         # Quests page
│   │   ├── map.astro            # Interactive map
│   │   └── login.astro          # Login page
│   ├── styles/                  # Global CSS
│   ├── types.ts                 # TypeScript type definitions
│   └── utils/                   # Utility functions
├── public/                      # Static assets (images, map)
├── astro.config.mjs             # Astro configuration
├── tailwind.config.mjs          # Tailwind configuration
├── package.json                 # Dependencies and scripts
├── arandor.service              # Systemd service file
├── DEPLOYMENT.md                # Deployment instructions
└── tsconfig.json                # TypeScript configuration
```

---

## Database Architecture

### Schema Overview

The app uses **Astro DB** which wraps SQLite for data persistence. The schema is defined in `db/config.ts`:

#### Tables

| Table | Description | Key Fields |
|-------|-------------|------------|
| `DiaryEntry` | Session notes and journal entries | id, date, title, content, session, tags, linked entities |
| `Quest` | Campaign quests | id, title, description, status, priority |
| `Character` | Player characters | id, name, class, level, race, player, stats |
| `NPC` | Non-player characters | id, name, race, relationship, location |
| `Location` | Places in the world | id, name, type, region, visited, mapX, mapY |
| `User` | Admin accounts | id, username, passwordHash |
| `CampaignProgress` | Party level tracking | id, currentLevel, progressPercent |
| `LibraryEntry` | Knowledge base entries | id, title, content (markdown), tags |
| `Faction` | Faction relationships | id, name, status, progress |

### Database Schema Details

```typescript
// DiaryEntry - Campaign session notes
{
  id: text (primary key),
  date: text,
  title: text,
  content: text,
  session: number,
  tags: json (array),
  coverImageUrl: text (optional),
  npcIds: json (array),          // Links to NPCs
  locationIds: json (array),     // Links to Locations
  characterIds: json (array),    // Links to Characters
  questIds: json (array),        // Links to Quests
  createdAt: date,
  updatedAt: date
}

// Quest - Campaign objectives
{
  id: text (primary key),
  title: text,
  description: text,
  status: text,    // 'active' | 'completed' | 'failed'
  priority: text,  // 'high' | 'medium' | 'low'
  createdAt: date,
  updatedAt: date
}

// Character - Party members
{
  id: text (primary key),
  name: text,
  class: text,
  level: number,
  race: text,
  player: text,
  avatarUrl: text (optional),
  dndbeyondUrl: text (optional),
  stats: json (optional),        // STR, DEX, CON, INT, WIS, CHA
  gender: text (optional),
  alignment: text (optional),
  background: text (optional),
  age: number (optional),
  height: text (optional),
  weight: number (optional),
  eyes: text (optional),
  skin: text (optional),
  hair: text (optional),
  createdAt: date,
  updatedAt: date
}

// NPC - Non-player characters
{
  id: text (primary key),
  name: text,
  race: text,
  occupation: text (optional),
  location: text (optional),     // Legacy text field
  locationId: text (optional),   // Foreign key to Location
  description: text,
  relationship: text,  // 'ally' | 'neutral' | 'enemy'
  notes: text (optional),
  avatarUrl: text (optional),
  createdAt: date,
  updatedAt: date
}

// Location - Places in the world
{
  id: text (primary key),
  name: text,
  type: text,          // 'city' | 'dungeon' | 'wilderness' | 'building' | 'other'
  description: text,
  region: text (optional),
  visited: boolean,
  notes: text (optional),
  mapX: number (optional),       // Map X coordinate (0-100%)
  mapY: number (optional),       // Map Y coordinate (0-100%)
  visibleOnMap: boolean,
  createdAt: date,
  updatedAt: date
}

// User - Admin accounts
{
  id: text (primary key),
  username: text (unique),
  passwordHash: text,            // PBKDF2 with SHA-512
  createdAt: date
}

// CampaignProgress - Level tracking
{
  id: text (primary key),
  currentLevel: number,
  progressPercent: number,       // 0-100
  createdAt: date,
  updatedAt: date
}

// LibraryEntry - Knowledge base
{
  id: text (primary key),
  title: text,
  content: text,                 // Markdown content
  tags: json (array),
  locationId: text (optional),   // Foreign key to Location
  createdAt: date,
  updatedAt: date
}

// Faction - Faction relationships
{
  id: text (primary key),
  name: text,
  status: text,    // 'enemy' | 'suspicious' | 'neutral' | 'friendly' | 'respectful'
  progress: number,              // 0-100
  createdAt: date,
  updatedAt: date
}
```

---

## Data Storage Locations

### Development Environment

| What | Where | Notes |
|------|-------|-------|
| Database file | `.astro/content.db` | SQLite database in project root |
| Static assets | `public/` | Images, map backgrounds |
| Build output | `dist/` | Generated during `npm run build` |

### Production Environment

| What | Where | Notes |
|------|-------|-------|
| Database file | `/srv/arandor/.astro/content.db` | **PERSISTS across deployments** |
| Application code | `/srv/arandor/dist/` | Compiled Astro output |
| Static assets | `/srv/arandor/dist/client/` | Served by Node.js |
| Backups | `/srv/arandor/.astro/backups/` | Created by update script |
| Node modules | `/srv/arandor/node_modules/` | Dependencies |

### Environment Variables

```bash
# Development (default)
ASTRO_DATABASE_FILE=.astro/content.db

# Production (set in systemd service)
ASTRO_DATABASE_FILE=/srv/arandor/.astro/content.db
HOST=0.0.0.0
PORT=4321

# Build (uses temporary database)
ASTRO_DATABASE_FILE=/tmp/astro-build.db
```

---

## API Architecture

### RESTful Endpoints

All API endpoints are located in `src/pages/api/`:

```
/api/diary          GET, POST           List/create diary entries
/api/diary/[id]     GET, PUT, DELETE    Single diary entry operations
/api/quests         GET, POST           List/create quests
/api/quests/[id]    GET, PUT, DELETE    Single quest operations
/api/characters     GET, POST           List/create characters
/api/characters/[id] GET, PUT, DELETE   Single character operations
/api/npcs           GET, POST           List/create NPCs
/api/npcs/[id]      GET, PUT, DELETE    Single NPC operations
/api/locations      GET, POST           List/create locations
/api/locations/[id] GET, PUT, DELETE    Single location operations
/api/library        GET, POST           List/create library entries
/api/library/[id]   GET, PUT, DELETE    Single library entry operations
/api/factions       GET, POST           List/create factions
/api/factions/[id]  GET, PUT, DELETE    Single faction operations
/api/campaign-progress/[id]  GET, PUT   Campaign progress operations
/api/auth/login     POST                User authentication
/api/auth/logout    POST                Session logout
```

### API Authentication

- **GET** requests are public (read-only access)
- **POST, PUT, DELETE** requests require authentication
- Authentication is cookie-based with HTTP-only session cookies

---

## Authentication System

### How It Works

1. **Password Hashing**: Uses PBKDF2 with SHA-512, 1000 iterations, and random salt
2. **Session Management**: HTTP-only cookies with 7-day expiration
3. **Protected Routes**: Write operations (POST/PUT/DELETE) require valid session

### Default Admin Account

After initial database setup with seed data:
- **Username**: `admin`
- **Password**: `admin`

⚠️ **Change this password immediately in production!**

### Session Cookie Details

```javascript
{
  name: 'session',
  httpOnly: true,
  secure: true,              // In production
  sameSite: 'strict',
  maxAge: 604800             // 7 days in seconds
}
```

---

## Server Setup Guide

### Prerequisites

- Linux server with systemd (Ubuntu 20.04+, Debian 11+)
- Node.js 20.x or higher
- SQLite3
- SSH access with sudo privileges

### Quick Setup Commands

```bash
# 1. Create deployment user (as root)
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG sudo deploy

# 2. Create application directory
sudo mkdir -p /srv/arandor
sudo chown deploy:deploy /srv/arandor

# 3. Clone and build (as deploy user)
su - deploy
cd /srv/arandor
git clone https://github.com/danspy/arandor-companion-app.git .
npm install
npm run build

# 4. Set up systemd service
sudo cp arandor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable arandor.service
sudo systemctl start arandor.service
```

---

## Database Setup on Server

### Initial Setup (First Deployment)

**Step 1: Ensure the application is built**
```bash
cd /srv/arandor
npm run build
```

**Step 2: Create the database directory**
```bash
mkdir -p /srv/arandor/.astro
```

**Step 3: Initialize the database using the migration script**
```bash
# Make the script executable
chmod +x /srv/arandor/scripts/update-database.sh

# Run the database initialization
./scripts/update-database.sh
```

The script will:
1. Check if a database exists (create new if not)
2. Show you the current state
3. Ask for confirmation
4. Create all required tables
5. Verify the setup

**Step 4: Restart the application**
```bash
sudo systemctl restart arandor.service
```

### What the Migration Script Does

The `update-database.sh` script:

1. **Checks for SQLite3** - Ensures sqlite3 is installed
2. **Detects database state** - New or existing database
3. **Shows current state** - Tables, row counts
4. **Creates backup** - Timestamped backup before changes
5. **Runs migration** - Executes `migrate-db.sql`
6. **Verifies integrity** - Confirms data preservation

### Manual Database Commands

```bash
# View all tables
sqlite3 /srv/arandor/.astro/content.db ".tables"

# View table schema
sqlite3 /srv/arandor/.astro/content.db ".schema Character"

# Count records
sqlite3 /srv/arandor/.astro/content.db "SELECT COUNT(*) FROM Character;"

# List all characters
sqlite3 /srv/arandor/.astro/content.db "SELECT name, class, level FROM Character;"

# Backup the database
cp /srv/arandor/.astro/content.db /srv/arandor/.astro/backups/content.db.backup.$(date +%Y%m%d_%H%M%S)
```

### Seeding Initial Data (Optional)

If you want to populate the database with sample data:

```bash
# The seed.ts file will populate sample data when database is empty
# This happens automatically when you run the dev server for the first time
cd /srv/arandor
npm run dev
# Press Ctrl+C after it starts
```

Or manually insert data:

```bash
sqlite3 /srv/arandor/.astro/content.db << 'EOF'
-- Insert a test character
INSERT INTO Character (id, name, class, level, race, player, createdAt, updatedAt)
VALUES ('1', 'Test Hero', 'Fighter', 1, 'Human', 'Player 1', datetime('now'), datetime('now'));
EOF
```

> **Note**: For user creation, use the application's seed functionality or the web interface, as password hashes are generated using PBKDF2 with random salts and cannot be easily created manually.

### Database Schema Updates

When you update the schema (add new tables/columns):

1. **Update `db/config.ts`** with new schema
2. **Update `scripts/migrate-db.sql`** with matching SQL
3. **Deploy code to server**
4. **Run migration manually**:

```bash
cd /srv/arandor
./scripts/update-database.sh
sudo systemctl restart arandor.service
```

### Backup Strategy

**Manual Backup:**
```bash
cp /srv/arandor/.astro/content.db /srv/arandor/.astro/backups/content.db.backup.$(date +%Y%m%d_%H%M%S)
```

**Automated Daily Backup (add to crontab):**
```bash
crontab -e
# Add this line (note: % must be escaped as \% in crontab):
0 2 * * * cp /srv/arandor/.astro/content.db /srv/arandor/.astro/backups/content.db.daily.$(date +\%Y\%m\%d).db
```

> **Note**: In crontab, the `%` character has special meaning and must be escaped with `\`.

**Restore from Backup:**
```bash
# Stop the service
sudo systemctl stop arandor.service

# Restore the backup
cp /srv/arandor/.astro/backups/content.db.backup.YYYYMMDD_HHMMSS /srv/arandor/.astro/content.db

# Start the service
sudo systemctl start arandor.service
```

---

## Configuration Files

### astro.config.mjs

```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import db from '@astrojs/db';
import node from '@astrojs/node';

export default defineConfig({
  integrations: [
    tailwind(), 
    db({
      // Production database path - hardcoded for this deployment
      // The ASTRO_DATABASE_FILE env var in systemd service provides runtime flexibility
      storage: '/srv/arandor/.astro/content.db',
    })
  ],
  output: 'server',              // SSR mode
  adapter: node({
    mode: 'standalone'           // Runs as standalone Node.js server
  }),
});
```

> **Note**: The `storage` path is hardcoded in the config file for production. The `ASTRO_DATABASE_FILE` environment variable in the systemd service provides an additional layer of configuration for the runtime.

### arandor.service (systemd)

```ini
[Unit]
Description=Arandor Companion App - D&D Companion Application
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/srv/arandor
Environment="NODE_ENV=production"
Environment="HOST=0.0.0.0"
Environment="PORT=4321"
Environment="ASTRO_DATABASE_FILE=/srv/arandor/.astro/content.db"
ExecStart=/usr/bin/node /srv/arandor/dist/server/entry.mjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=arandor

[Install]
WantedBy=multi-user.target
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "ASTRO_DATABASE_FILE=/tmp/astro-build.db astro build",
    "preview": "astro preview",
    "astro": "astro"
  }
}
```

> **Note**: The build script uses inline environment variable syntax which works on Unix/Linux/macOS. For Windows compatibility, consider using [cross-env](https://www.npmjs.com/package/cross-env) or setting the variable in your shell before running the command.

The build script uses a temporary database (`/tmp/astro-build.db`) to avoid modifying the production database during builds.

---

## Troubleshooting

### Database Issues

**Database file not found:**
```bash
# Check if file exists
ls -la /srv/arandor/.astro/content.db

# If not, run the update script
./scripts/update-database.sh
```

**Permission denied:**
```bash
# Fix ownership
sudo chown -R deploy:deploy /srv/arandor/.astro
chmod 755 /srv/arandor/.astro
chmod 644 /srv/arandor/.astro/content.db
```

**Tables missing:**
```bash
# Check tables
sqlite3 /srv/arandor/.astro/content.db ".tables"

# Run migration
./scripts/update-database.sh
```

### Application Issues

**Service not starting:**
```bash
# Check logs
sudo journalctl -u arandor.service -n 50 --no-pager

# Common causes:
# - Node.js not installed
# - Missing node_modules (run npm install)
# - Port 4321 in use
# - Database directory not writable
```

**Port already in use:**
```bash
# Find what's using the port
sudo lsof -i :4321

# Change port in service file if needed
sudo vim /etc/systemd/system/arandor.service
sudo systemctl daemon-reload
sudo systemctl restart arandor.service
```

### Useful Commands

```bash
# Service management
sudo systemctl status arandor.service
sudo systemctl restart arandor.service
sudo systemctl stop arandor.service
sudo journalctl -u arandor.service -f  # Live logs

# Database inspection
sqlite3 /srv/arandor/.astro/content.db ".tables"
sqlite3 /srv/arandor/.astro/content.db ".schema"
sqlite3 /srv/arandor/.astro/content.db "SELECT * FROM User;"

# Application
cd /srv/arandor
npm run build
npm run preview  # Test locally before deploying
```

---

## Quick Reference

### Data Flow

```
User Browser
    ↓
Astro Server (Node.js on port 4321)
    ↓
API Routes (src/pages/api/)
    ↓
Astro DB (SQLite at .astro/content.db)
```

### Key Paths

| Purpose | Path |
|---------|------|
| App directory | `/srv/arandor/` |
| Database | `/srv/arandor/.astro/content.db` |
| Compiled app | `/srv/arandor/dist/` |
| Backups | `/srv/arandor/.astro/backups/` |
| Service file | `/etc/systemd/system/arandor.service` |
| Migration script | `/srv/arandor/scripts/update-database.sh` |

### Default Credentials

| Field | Value | Note |
|-------|-------|------|
| Username | `admin` | Change in production |
| Password | `admin` | Change in production |

---

## Support

For issues and contributions:
- GitHub: https://github.com/danspy/arandor-companion-app/issues
- See also: [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions
