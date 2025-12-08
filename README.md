# Arandor Companion App

A modern D&D companion app built with Astro.js and Tailwind CSS for tracking your D&D adventures, characters, NPCs, locations, and more.

## Features

### Core Features

- **Dashboard** - Overview of campaign progress, faction standings, active quests, party members, latest diary entries, and library entries
- **Adventure Diary** - Document your campaign sessions with:
  - Markdown formatting support
  - Cover image uploads
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

### Additional Features

- **Authentication** - Login system to protect editing functionality
- **Dark Mode** - Toggle between light and dark themes
- **Image Uploads** - Upload cover images for diary entries
- **Markdown Support** - Rich text formatting in diary and library entries
- **Mobile Responsive** - Optimized for all screen sizes
- **Progressive Web App (PWA)** - Install as a native app on mobile and desktop devices
  - Offline support with service worker caching
  - App installation on home screen
  - Standalone app experience
  - Automatic updates

## Tech Stack

- **Astro.js 5.x** - Modern web framework with island architecture and server-side rendering
- **Astro DB** - Built-in SQLite database with type-safe schema
- **Tailwind CSS v3** - Utility-first CSS framework for rapid UI development
- **TypeScript** - Type-safe development with strict mode
- **Node.js Adapter** - Standalone server deployment
- **marked** - Markdown parsing for rich text content
- **@vite-pwa/astro** - PWA support with service worker and offline capabilities

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

## Progressive Web App (PWA)

The Arandor Companion App is a fully featured Progressive Web App that can be installed on your device for a native app-like experience:

### PWA Features

- **Installable**: Add the app to your home screen on mobile devices or desktop
- **Offline Support**: Service worker caches essential resources for offline access
- **Automatic Updates**: The app automatically updates when new versions are available
- **Standalone Mode**: Runs in its own window without browser UI
- **Fast Loading**: Cached resources load instantly on repeat visits

### How to Install

**On Mobile (iOS/Android):**
1. Open the app in your browser
2. Tap the "Share" button (iOS) or menu button (Android)
3. Select "Add to Home Screen"
4. Confirm the installation

**On Desktop (Chrome/Edge):**
1. Look for the install icon in the address bar
2. Click "Install" in the prompt
3. The app will open in its own window

**On Desktop (Firefox):**
1. Click the three dots menu
2. Select "Install Arandor Companion App"
3. Confirm the installation

### Offline Functionality

The PWA caches:
- Static assets (CSS, JavaScript, images)
- App shell for basic navigation
- API responses (with a 5-minute expiration)
- Map and favicon resources

This ensures the app remains functional even with poor or no internet connectivity.

## Deployment

For production deployment instructions (including Uberspace deployment), see [DEPLOYMENT.md](DEPLOYMENT.md) for:
- **Native Node.js deployment** instructions
- Port configuration and data persistence
- Production deployment best practices

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
- **User** - Authentication credentials

### Features

✅ **Full CRUD Operations** - Create, read, update, and delete all content types
✅ **Persistent Database** - Astro DB with SQLite
✅ **RESTful API** - Complete API endpoints for all entities
✅ **Interactive Forms** - Modal-based forms for adding and editing content
✅ **Real-time Updates** - Changes are immediately reflected in the UI
✅ **Markdown Support** - Rich text formatting for diary and library entries
✅ **Image Uploads** - Upload and store images for diary entries

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

### API Endpoints

The following REST API endpoints are available:

**Authentication:**
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

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
- [x] Progressive Web App (PWA) support with offline functionality
- [ ] D&D Beyond API integration (currently URL links only)
- [ ] Character import/export
- [ ] Image uploads for characters/NPCs
- [ ] Multi-user support with role-based permissions
- [ ] Session scheduling and reminders
- [ ] Dice roller integration
- [ ] Initiative tracker

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Acknowledgments

- Inspired by [arandor.info](https://arandor.info/)
- Built for tabletop RPG enthusiasts
