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
/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable components (future)
│   ├── data/           # Mock data and data models
│   ├── layouts/        # Page layouts
│   ├── pages/          # Route pages
│   ├── styles/         # Global CSS
│   └── types.ts        # TypeScript type definitions
├── astro.config.mjs    # Astro configuration
├── tailwind.config.mjs # Tailwind configuration
└── tsconfig.json       # TypeScript configuration
```

## Data Management

Currently, the app uses mock data stored in `src/data/mockData.ts`. Future enhancements will include:
- Local storage persistence
- Database integration
- D&D Beyond API integration for character imports

## Customization

### Colors

Edit `tailwind.config.mjs` to customize the color scheme:
```javascript
colors: {
  primary: {
    DEFAULT: '#8b5cf6',
    dark: '#7c3aed',
  },
  // ... more colors
}
```

### Adding New Data

Add entries to the arrays in `src/data/mockData.ts`:
- `diaryEntries` - Adventure log entries
- `quests` - Campaign quests
- `characters` - Player characters
- `npcs` - Non-player characters
- `locations` - World locations

## Future Enhancements

- [ ] Full CRUD operations via forms
- [ ] Data persistence (localStorage/database)
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
