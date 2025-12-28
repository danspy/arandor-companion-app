# Arandor Companion App

A modern D&D companion app built with Astro.js and Tailwind CSS for tracking your D&D adventures, characters, NPCs, locations, and more.

## Features

### Core Features

- **Dashboard** - Overview of campaign progress, faction standings, active quests, party members, latest diary entries, and library entries
- **Adventure Diary** - Document your campaign sessions with:
  - Markdown formatting support
  - Cover image uploads
  - AI-powered summaries (optional, requires OpenAI API key or compatible service)
  - AI-powered image generation (optional, requires OpenAI API key with DALL-E access)
  - AI-powered podcast narration with realistic voices (optional, requires OpenAI API key)
  - Automatically detects language and selects appropriate voice (German/English)
  - Tags for organization
  - Session numbers
  - Links to NPCs, locations, characters, and quests mentioned
- **Library** - Store campaign lore, notes, and knowledge with:
  - Markdown content support
  - Tag-based organization and filtering
  - Location associations
- **Player Characters** - Track party members with:
  - Character stats (STR, DEX, CON, INT, WIS, CHA)
  - Levels, classes, races, and backgrounds
  - Physical attributes (age, height, weight, eyes, skin, hair)
  - D&D Beyond URL integration
  - Avatar images
- **NPCs** - Manage non-player characters with:
  - Relationships (ally/neutral/enemy)
  - Occupation and race
  - Location associations
  - Notes and avatar images
- **Locations** - Catalog places with:
  - Types (city, dungeon, wilderness, building, other)
  - Regions and visit tracking
  - Map coordinates for interactive map
  - Notes
- **Quests** - Organize quests with:
  - Status tracking (active, completed, failed)
  - Priority levels (high, medium, low)
- **Interactive Map** - Visual map interface with:
  - Draggable location pins with tooltips
  - Hero path showing journey progression
  - Zoom and pan controls (mouse wheel, buttons, touch gestures)
  - Edit mode for placing and moving pins
  - Color-coded legend by location type
- **Faction Standings** - Track relationships with factions:
  - Status levels (enemy, suspicious, neutral, friendly, respectful)
  - Progress bars for each faction
- **Campaign Progress** - Track party level progression:
  - Current party level
  - Progress percentage to next level
- **Tools** - Game master utilities and player aids:
  - **Initiative Tracker** - Track combat initiative order for characters, NPCs, and monsters
    - Initiative order with HP, AC, and notes
    - Type badges (character, NPC, monster, other)
    - **D&D Beyond HP Sync** - Automatically sync character HP from D&D Beyond in real-time
    - Editable by DM/admin only, viewable by all logged-in users
    - Quick add/edit/delete functionality
  - **DM Screen** - Control what players see on a second display (DM/admin only)
    - Select locations to display mood images
    - Add NPCs to spotlight for player view
    - Toggle initiative tracker visibility for players
    - Generate shareable link for player display screen
    - Real-time synchronization between DM control and player display
  - Coming soon: Dice Roller, Session Timer

### Additional Features

- **Authentication** - Login system to protect editing functionality
  - Role-based permissions (admin, dungeonmaster, player)
- **Dark Mode** - Toggle between light and dark themes
- **Image Uploads** - Upload cover images for diary entries
- **Markdown Support** - Rich text formatting in diary and library entries
- **Mobile Responsive** - Optimized for all screen sizes

## Tech Stack

- **Astro.js 5.x** - Modern web framework with island architecture and server-side rendering
- **Astro DB** - Built-in SQLite database with type-safe schema
- **Tailwind CSS v3** - Utility-first CSS framework for rapid UI development
- **TypeScript** - Type-safe development with strict mode
- **Node.js Adapter** - Standalone server deployment
- **marked** - Markdown parsing for rich text content

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher

### Installation

1. Clone the repository:
```bash
git clone https://github.com/danspy/arandor-companion-app.git
cd arandor-companion-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to [http://localhost:4321](http://localhost:4321)

### Build for Production

```bash
npm run build
```

The built site will be in the `dist/` directory.

**Note:** The build process uses a temporary database for build-time operations. Your production database (when deployed) is kept separate and is never modified during builds, ensuring data preservation across deployments.

### Preview Production Build

```bash
npm run preview
```

## Configuration

### AI Features (Optional)

The app includes optional AI-powered features for diary entries. These features require an OpenAI API key (or compatible service).

**Available AI Features:**
- **AI Summaries** - Generate concise summaries of diary entries (2-3 sentences)
- **AI Image Generation** - Create fantasy D&D scene illustrations using DALL-E
- **AI Podcast Narration** - Generate narration with realistic AI voices, automatically adapting to your language (German/English)

**Setup:**

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your OpenAI API key:
```bash
OPENAI_API_KEY=your-api-key-here
```

3. (Optional) Configure AI models and settings:
```bash
# Text generation model (default: gpt-3.5-turbo)
OPENAI_MODEL=gpt-3.5-turbo

# Image generation model (default: dall-e-3)
OPENAI_IMAGE_MODEL=dall-e-3

# Image size (default: 1024x1024)
# DALL-E 2: 256x256, 512x512, 1024x1024
# DALL-E 3: 1024x1024, 1792x1024, 1024x1792
OPENAI_IMAGE_SIZE=1024x1024

# Image quality (default: standard)
# Options: standard, hd (DALL-E 3 only)
OPENAI_IMAGE_QUALITY=standard

# Text-to-Speech model (default: tts-1-hd)
OPENAI_TTS_MODEL=tts-1-hd

# TTS voice (auto-detected by default based on language)
# If not set, voice is automatically selected:
#   - German content: alloy (clear, neutral)
#   - English content: onyx (deep, epic)
# Options: alloy, echo, fable, onyx, nova, shimmer
# Recommended for English D&D: onyx (deep), fable (storytelling)
# Recommended for German: alloy (clear), echo (balanced)
# OPENAI_TTS_VOICE=onyx

# TTS speed (default: 1.0)
OPENAI_TTS_SPEED=1.0
```

**Permissions:**
- AI summaries, image generation, and podcast narration are restricted to **Admin** and **Dungeon Master** roles
- Generated content (summaries, images, and podcasts) is visible to all users, including logged-out visitors

**Alternative Providers:**
You can use OpenRouter, local LLMs, or other OpenAI-compatible services by setting `OPENAI_API_BASE`. See `.env.example` for examples.

## Deployment

For production deployment instructions (including Uberspace deployment), see [DEPLOYMENT.md](DEPLOYMENT.md) for:
- **Native Node.js deployment** instructions
- Port configuration and data persistence
- Production deployment best practices

**Note:** In production, uploaded images and videos are stored in `/srv/arandor/uploads/` (outside the `dist/` folder) to ensure they persist across deployments.

## Project Structure

```
./
├── public/              # Static assets (map image, favicon)
├── db/                  # Database configuration
│   ├── config.ts        # Astro DB schema definitions
│   └── seed.ts          # Database seeding script
├── src/
│   ├── layouts/         # Page layouts (main layout with navigation)
│   ├── lib/             # Authentication utilities
│   │   ├── auth.ts      # Authentication helpers
│   │   └── middleware.ts # Auth middleware
│   ├── pages/           # Route pages
│   │   ├── api/         # REST API endpoints
│   │   │   ├── auth/        # Authentication endpoints
│   │   │   ├── diary/       # Diary entry endpoints
│   │   │   ├── quests/      # Quest endpoints
│   │   │   ├── characters/  # Character endpoints
│   │   │   ├── npcs/        # NPC endpoints
│   │   │   ├── locations/   # Location endpoints
│   │   │   ├── library/     # Library entry endpoints
│   │   │   ├── factions/    # Faction endpoints
│   │   │   └── campaign-progress/ # Campaign progress endpoints
│   │   ├── characters/  # Character detail pages
│   │   ├── diary/       # Diary entry detail pages
│   │   ├── library/     # Library entry detail pages
│   │   ├── locations/   # Location detail pages
│   │   └── npcs/        # NPC detail pages
│   ├── styles/          # Global CSS
│   ├── utils/           # Utility functions (markdown rendering)
│   └── types.ts         # TypeScript type definitions
├── astro.config.mjs     # Astro configuration
├── tailwind.config.mjs  # Tailwind configuration
└── tsconfig.json        # TypeScript configuration
```

## Data Management

The app uses **Astro DB** for persistent data storage with a local SQLite database. All content is fully editable through the web interface (when logged in).

### Database Schema

The database includes the following tables:
- **DiaryEntry** - Session notes with markdown content, tags, and entity references
- **Quest** - Quest tracking with status and priority
- **Character** - Player characters with stats and details
- **NPC** - Non-player characters with relationships
- **Location** - Places with map coordinates
- **LibraryEntry** - Lore and knowledge entries
- **Faction** - Faction standings and progress
- **CampaignProgress** - Party level tracking
- **InitiativeTracker** - Combat initiative tracking with HP, AC, and notes
- **DMScreenState** - DM Screen state management for player display
- **User** - Authentication credentials with role-based permissions

### Features

✅ **Full CRUD Operations** - Create, read, update, and delete all content types
✅ **Persistent Database** - Astro DB with SQLite
✅ **RESTful API** - Complete API endpoints for all entities
✅ **Interactive Forms** - Modal-based forms for adding and editing content
✅ **Real-time Updates** - Changes are immediately reflected in the UI
✅ **Markdown Support** - Rich text formatting for diary and library entries
✅ **Image Uploads** - Upload and store images for diary entries

### User Management

The app uses a role-based authentication system with three roles:
- **Admin** - Full access including user management
- **Dungeon Master** - Can edit all content (currently same as Player)
- **Player** - Can edit diary, library, characters, NPCs, locations, and quests

You can add new users in two ways:

**Method 1: Web Interface (Recommended)**
1. Login to the app at `/login` (default user: `admin` / password: `admin`)
2. Navigate to the **Users** page in the navigation menu (admin only)
3. Click "Add User" and enter username, password, and role
4. The new user can now login with their credentials

**Method 2: Command Line**
```bash
# Add a new user with role
node scripts/add-user.mjs <username> <password> [role]

# Examples
node scripts/add-user.mjs john secretpassword player
node scripts/add-user.mjs dm_alice dmpass dungeonmaster
node scripts/add-user.mjs superadmin adminpass admin

# Using custom database location
ASTRO_DATABASE_FILE=/path/to/db.db node scripts/add-user.mjs jane mypass player
```

**Update User Roles:**
```bash
# Update an existing user's role
node scripts/update-user-role.mjs <username> <role>

# Example: Update admin user to have admin role
node scripts/update-user-role.mjs admin admin
```

**Default User:**
- Username: `admin`
- Password: `admin`
- Role: `admin` (for new installations)
- ⚠️ **Important:** Change the default admin password after first login for security

**Migration Note:** If you created your admin user before the role system was added, see [docs/MIGRATION_GUIDE_role_system.md](docs/MIGRATION_GUIDE_role_system.md) for instructions on updating the role.

### Managing Content

All content can be managed directly from the web interface (login required for editing):

1. **Dashboard** - View campaign overview with faction standings and progress
2. **Adventure Diary** - Add/edit/delete session notes with markdown, images, and entity links
3. **Library** - Create/edit/delete lore entries with tags and location associations
4. **Quests** - Track active, completed, and failed quests
5. **Characters** - Manage party members with full stats and details
6. **NPCs** - Organize non-player characters by relationship
7. **Locations** - Catalog places and set map coordinates
8. **Map** - Interactive map with draggable pins and hero path visualization
9. **Users** - Add new users to the app (admin-only)

### API Endpoints

The following REST API endpoints are available:

**Authentication:**
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

**Users:**
- `GET /api/users` - List all users (admin-only)
- `POST /api/users` - Create new user (admin-only)

**Diary:**
- `GET/POST /api/diary` - Diary entries
- `GET/PUT/DELETE /api/diary/[id]` - Single diary entry

**Library:**
- `GET/POST /api/library` - Library entries
- `GET/PUT/DELETE /api/library/[id]` - Single library entry

**Quests:**
- `GET/POST /api/quests` - Quests
- `GET/PUT/DELETE /api/quests/[id]` - Single quest

**Characters:**
- `GET/POST /api/characters` - Characters
- `GET/PUT/DELETE /api/characters/[id]` - Single character

**NPCs:**
- `GET/POST /api/npcs` - NPCs
- `GET/PUT/DELETE /api/npcs/[id]` - Single NPC

**Locations:**
- `GET/POST /api/locations` - Locations
- `GET/PUT/DELETE /api/locations/[id]` - Single location

**Factions:**
- `GET/POST /api/factions` - Factions
- `GET/PUT/DELETE /api/factions/[id]` - Single faction

**Campaign Progress:**
- `GET/PUT /api/campaign-progress/[id]` - Campaign progress

**Initiative Tracker:**
- `GET/POST /api/initiative` - Initiative entries (GET: all users, POST: DM/admin only)
- `GET/PUT/DELETE /api/initiative/[id]` - Single initiative entry (GET: all users, PUT/DELETE: DM/admin only)

**DM Screen:**
- `GET /api/dm-screen` - Get current DM Screen state (all logged-in users)
- `PUT /api/dm-screen` - Update DM Screen state (DM/admin only)

**File Upload:**
- `POST /api/upload` - Upload images (multipart/form-data, max 5MB, accepts image/* files)

## Customization

### Colors

The app uses a D&D/fantasy-themed color scheme inspired by [arandor.info](https://arandor.info/) (a D&D campaign resource):

```javascript
colors: {
  primary: {
    DEFAULT: '#8b4545', // Burgundy/Maroon
    dark: '#5f2f2f',
    // Full palette: 50, 100, 200, ..., 900, 950
  },
  secondary: {
    DEFAULT: '#d97706', // Gold/Amber
    dark: '#92400e',
    // Full palette: 50, 100, 200, ..., 900, 950
  },
  accent: {
    DEFAULT: '#475569', // Slate
    dark: '#1e293b',
    // Full palette: 50, 100, 200, ..., 900, 950
  },
}
```

Each color includes a complete range of shades (50-950) following Tailwind's color system conventions. Edit `tailwind.config.mjs` to customize the color scheme further.

## Future Enhancements

- [x] Full CRUD operations via forms
- [x] Data persistence with database
- [x] Interactive map with location pins
- [x] Session notes with markdown support
- [x] Mobile-responsive design
- [x] Dark mode theme toggle
- [x] Tag-based filtering (Library)
- [x] Faction tracking system
- [x] Campaign level progress tracking
- [x] Image uploads for diary entries
- [x] Multi-user support with role-based permissions
- [x] Initiative tracker (DM/admin can edit, players can view)
- [x] DM Screen prototype (control panel and player display)
- [x] D&D Beyond API integration for HP sync (real-time combat tracking)
- [ ] Custom asset upload for DM Screen
- [ ] Full D&D Beyond character import/export
- [ ] Image uploads for characters/NPCs
- [ ] Session scheduling and reminders
- [ ] Dice roller integration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Acknowledgments

- Inspired by [arandor.info](https://arandor.info/)
- Built for tabletop RPG enthusiasts
