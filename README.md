# Arandor Companion App

A modern D&D companion app built with Astro.js and Tailwind CSS for tracking your D&D adventures, characters, NPCs, locations, and more.

## Features

- **Dashboard** - Overview of active quests, party members, latest diary entries, and campaign progress
- **Adventure Diary** - Document your campaign sessions in a journal format with tags and session numbers
- **Player Characters** - Track party members with stats, levels, classes, and D&D Beyond integration
- **NPCs** - Manage non-player characters with relationships (ally/neutral/enemy), locations, and notes
- **Locations** - Catalog cities, dungeons, and other places with visit tracking
- **Quests** - Organize active, completed, and failed quests with priority levels

## Tech Stack

- **Astro.js** - Modern static site generator with island architecture
- **Tailwind CSS v3** - Utility-first CSS framework for rapid UI development
- **TypeScript** - Type-safe development with strict mode

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

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
./
├── public/              # Static assets
├── db/                  # Database configuration
│   ├── config.ts        # Astro DB schema definitions
│   └── seed.ts          # Database seeding script
├── src/
│   ├── components/      # Reusable components (future)
│   ├── data/           # Mock data (deprecated, using DB now)
│   ├── layouts/        # Page layouts
│   ├── pages/          # Route pages
│   │   └── api/        # REST API endpoints
│   │       ├── diary/      # Diary entry endpoints
│   │       ├── quests/     # Quest endpoints
│   │       ├── characters/ # Character endpoints
│   │       ├── npcs/       # NPC endpoints
│   │       └── locations/  # Location endpoints
│   ├── styles/         # Global CSS
│   └── types.ts        # TypeScript type definitions
├── astro.config.mjs    # Astro configuration
├── tailwind.config.mjs # Tailwind configuration
└── tsconfig.json       # TypeScript configuration
```

## Data Management

The app uses **Astro DB** for persistent data storage with a local SQLite database in development. All content is fully editable through the web interface.

### Features

✅ **Full CRUD Operations** - Create, read, update, and delete all content types
✅ **Persistent Database** - Astro DB with SQLite for local development
✅ **RESTful API** - Complete API endpoints for all entities
✅ **Interactive Forms** - Modal-based forms for adding and editing content
✅ **Real-time Updates** - Changes are immediately reflected in the UI

### Managing Content

All content can be managed directly from the web interface:

1. **Dashboard** - View overview of your campaign
2. **Adventure Diary** - Add/edit/delete session notes with tags
3. **Quests** - Track active, completed, and failed quests
4. **Characters** - Manage party members with full stats
5. **NPCs** - Organize non-player characters by relationship
6. **Locations** - Catalog visited and unexplored places

### API Endpoints

The following REST API endpoints are available:

- `GET/POST /api/diary` - Diary entries
- `GET/PUT/DELETE /api/diary/[id]` - Single diary entry
- `GET/POST /api/quests` - Quests
- `GET/PUT/DELETE /api/quests/[id]` - Single quest
- `GET/POST /api/characters` - Characters
- `GET/PUT/DELETE /api/characters/[id]` - Single character
- `GET/POST /api/npcs` - NPCs
- `GET/PUT/DELETE /api/npcs/[id]` - Single NPC
- `GET/POST /api/locations` - Locations
- `GET/PUT/DELETE /api/locations/[id]` - Single location

## Customization

### Colors

The app uses a D&D/fantasy-themed color scheme inspired by arandor.info:

```javascript
colors: {
  primary: {
    DEFAULT: '#8b4545', // Burgundy/Maroon
    dark: '#5f2f2f',
  },
  secondary: {
    DEFAULT: '#d97706', // Gold/Amber
    dark: '#92400e',
  },
  accent: {
    DEFAULT: '#475569', // Slate
    dark: '#1e293b',
  },
  // ... includes full 50-950 shade ranges
}
```

Edit `tailwind.config.mjs` to customize the color scheme further.

## Future Enhancements

- [x] Full CRUD operations via forms
- [x] Data persistence with database
- [ ] D&D Beyond API integration
- [ ] Character import/export
- [ ] Search and filtering
- [ ] Mobile-responsive improvements
- [ ] Image uploads for characters/NPCs
- [ ] Interactive maps
- [ ] Session notes with rich text editor
- [ ] Multi-user support with authentication

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Acknowledgments

- Inspired by [arandor.info](https://arandor.info/)
- Built for tabletop RPG enthusiasts
