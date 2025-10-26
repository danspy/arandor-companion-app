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

## Deployment

The app is deployment-ready with multiple deployment options.

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- (Optional) Docker for containerized deployment

### Deployment Options

#### Option 1: Node.js Deployment

1. Build the application:
```bash
npm run build
```

2. Copy the following to your server:
   - `dist/` directory
   - `.astro/` directory
   - `package.json`
   - `package-lock.json`

3. On your server, install production dependencies:
```bash
npm ci --only=production
```

4. Start the server:
```bash
npm start
```

The server will start on port 4321 by default. Configure with environment variables:
- `HOST` - Host to bind to (default: 0.0.0.0)
- `PORT` - Port to listen on (default: 4321)
- `ASTRO_DATABASE_FILE` - Path to SQLite database (default: ./.astro/content.db)

#### Option 2: Docker Deployment

1. Build the Docker image:
```bash
docker build -t arandor-companion:latest .
```

2. Run the container:
```bash
docker run -d \
  -p 4321:4321 \
  -v arandor-data:/app/data \
  -e ASTRO_DATABASE_FILE=/app/data/content.db \
  --name arandor-companion \
  arandor-companion:latest
```

Or use Docker Compose:
```bash
docker-compose up -d
```

The database is stored in a Docker volume for persistence.

#### Option 3: Platform-Specific Deployments

The app can be deployed to various platforms:

- **Vercel/Netlify**: Requires SSR adapter configuration
- **DigitalOcean/AWS/Azure**: Use Docker or Node.js deployment
- **Railway/Render**: Connect your GitHub repo and configure build command
- **VPS**: Use Node.js or Docker deployment with a reverse proxy (nginx/Apache)

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `ASTRO_DATABASE_FILE` - Path to the SQLite database file
- `HOST` - Server host (use 0.0.0.0 for production)
- `PORT` - Server port (default: 4321)
- `NODE_ENV` - Environment (development/production)

### GitHub Actions

The repository includes automated workflows:

#### Preview Deployments
- **Workflow**: `.github/workflows/preview-deploy.yml`
- **Trigger**: Pull requests
- **Purpose**: Creates preview builds and Docker images for testing
- **Artifact**: `preview-build-{sha}` with deployment package

#### Production Deployments
- **Workflow**: `.github/workflows/production-deploy.yml`
- **Trigger**: Push to `main` branch
- **Purpose**: Creates production builds and verified Docker images
- **Artifact**: `production-build-{sha}` with deployment package

To configure automatic deployment to your server:
1. Set up GitHub secrets for your deployment credentials
2. Update the workflow files with your deployment commands
3. Configure environment URLs in repository settings

### Health Checks

After deployment, verify the application:

```bash
# Check if the server is running
curl http://localhost:4321

# Check the API endpoints
curl http://localhost:4321/api/characters
curl http://localhost:4321/api/quests
```

### Database Management

The app uses SQLite for data storage. To backup your database:

```bash
# Copy the database file
cp .astro/content.db backups/content-$(date +%Y%m%d).db
```

For Docker deployments:
```bash
# Backup from Docker volume
docker run --rm -v arandor-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Scaling Considerations

For production use:
- Place a reverse proxy (nginx, Caddy) in front of the Node.js server
- Use PM2 or systemd for process management
- Set up SSL/TLS certificates (Let's Encrypt recommended)
- Configure firewall rules to allow only necessary ports
- Set up monitoring and logging (PM2, Winston, or cloud solutions)
- Consider using a managed database service for multi-instance deployments

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
