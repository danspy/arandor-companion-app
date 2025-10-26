# Quick Start: Deployment

## For First-Time Deployment

### Local/VPS Deployment (Recommended)

```bash
# 1. Clone and build
git clone https://github.com/danspy/arandor-companion-app.git
cd arandor-companion-app
npm install
ASTRO_DATABASE_FILE=./.astro/content.db npm run build

# 2. Start the server
npm start
```

The app will be available at http://localhost:4321

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or manually
docker build -t arandor-companion:latest .
docker run -d -p 4321:4321 \
  -v arandor-data:/app/data \
  -e ASTRO_DATABASE_FILE=/app/data/content.db \
  arandor-companion:latest
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
ASTRO_DATABASE_FILE=./.astro/content.db
HOST=0.0.0.0
PORT=4321
NODE_ENV=production
```

## GitHub Actions

### Preview Server Setup

1. Go to your repository Settings > Environments
2. Create environment: `preview-{pr-number}` for each PR
3. Configure environment variables if needed
4. Workflow automatically creates deployment artifacts on PR

### Production Deployment

1. Workflow runs automatically on push to `main`
2. Download artifact from Actions tab
3. Extract and deploy to your server:

```bash
tar -xzf production-deployment.tar.gz
npm install --production
npm start
```

## Health Check

After deployment, verify the app:

```bash
curl http://your-server:4321/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-26T16:00:00.000Z",
  "version": "1.0.0",
  "service": "arandor-companion-app"
}
```

## Production Recommendations

1. **Use a reverse proxy** (nginx, Caddy) in front of Node.js
2. **Enable HTTPS** with Let's Encrypt
3. **Use a process manager** (PM2, systemd) to keep the app running
4. **Set up automated backups** for the database
5. **Monitor logs** for errors

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## Troubleshooting

### App won't start
- Check environment variables are set
- Verify database file exists
- Check port 4321 is not in use: `lsof -i :4321`

### Build fails
- Ensure Node.js 20+ is installed
- Run `npm install` to update dependencies
- Set `ASTRO_DATABASE_FILE` environment variable

### Database issues
- Verify `.astro/content.db` exists
- Check file permissions
- Restore from backup if needed

## Support

- Full documentation: [DEPLOYMENT.md](DEPLOYMENT.md)
- README: [README.md](README.md)
- Issues: https://github.com/danspy/arandor-companion-app/issues
