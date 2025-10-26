# Deployment Instructions for Uberspace

This guide explains how to deploy the Arandor Companion App on an Uberspace server using Docker.

## Quick Start

**Local deployment with Docker:**
```bash
docker-compose up -d
# Access at http://localhost:4321
```

**Uberspace deployment:**
```bash
ssh <username>@<username>.uber.space
cd ~ && git clone https://github.com/danspy/arandor-companion-app.git
cd arandor-companion-app
docker-compose up -d
uberspace web backend set / --http --port 4321
# Access at https://<username>.uber.space
```

## Prerequisites

- An active Uberspace account (https://uberspace.de/)
- SSH access to your Uberspace server
- Docker installed on your Uberspace (if not available, see alternative deployment below)

## Deployment Steps

### Option 1: Docker Deployment (Recommended)

#### 1. Connect to Your Uberspace Server

```bash
ssh <username>@<username>.uber.space
```

#### 2. Clone the Repository

```bash
cd ~
git clone https://github.com/danspy/arandor-companion-app.git
cd arandor-companion-app
```

#### 3. Build and Run with Docker Compose

```bash
docker-compose up -d
```

This will:
- Build the Docker image
- Start the container
- Persist data in a Docker volume
- Run the app on port 4321

#### 4. Set Up Port Forwarding

Uberspace requires you to register your application's port. Run:

```bash
uberspace web backend set / --http --port 4321
```

This maps your Uberspace domain to the Docker container's port 4321.

#### 5. Access Your Application

Your app should now be available at:
```
https://<username>.uber.space
```

### Option 2: Native Node.js Deployment (Without Docker)

If Docker is not available on your Uberspace, you can deploy directly:

#### 1. Connect and Clone

```bash
ssh <username>@<username>.uber.space
cd ~
git clone https://github.com/danspy/arandor-companion-app.git
cd arandor-companion-app
```

#### 2. Install Dependencies and Build

```bash
npm install
npm run build
```

#### 3. Create a Startup Script

Create a file `~/arandor-companion-app/start.sh`:

```bash
#!/bin/bash
export HOST=0.0.0.0
export PORT=4321
export ASTRO_DATABASE_FILE=$HOME/arandor-companion-app/.astro/content.db
cd $HOME/arandor-companion-app
node ./dist/server/entry.mjs
```

Make it executable:
```bash
chmod +x start.sh
```

#### 4. Set Up as a Service

Create `~/etc/services.d/arandor-app.ini`:

```ini
[program:arandor-app]
command=%(ENV_HOME)s/arandor-companion-app/start.sh
autostart=yes
autorestart=yes
startsecs=30
```

#### 5. Start the Service

```bash
supervisorctl reread
supervisorctl update
supervisorctl start arandor-app
```

#### 6. Set Up Web Backend

```bash
uberspace web backend set / --http --port 4321
```

#### 7. Access Your Application

```
https://<username>.uber.space
```

## Managing Your Deployment

### Docker Commands

**View logs:**
```bash
docker-compose logs -f
```

**Stop the application:**
```bash
docker-compose down
```

**Restart the application:**
```bash
docker-compose restart
```

**Update the application:**
```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Native Deployment Commands

**View logs:**
```bash
supervisorctl tail -f arandor-app
```

**Restart the application:**
```bash
supervisorctl restart arandor-app
```

**Stop the application:**
```bash
supervisorctl stop arandor-app
```

**Update the application:**
```bash
cd ~/arandor-companion-app
git pull
npm install
npm run build
supervisorctl restart arandor-app
```

## Data Persistence

### Docker Deployment
- Database is stored in a Docker volume named `arandor-data`
- Data persists across container restarts
- To backup: `docker cp arandor-companion-app:/app/.astro/content.db ./backup.db`

### Native Deployment
- Database is stored at `~/.astro/content.db` or in the app directory
- Backup regularly: `cp ~/.astro/content.db ~/backup.db`

## Custom Domain (Optional)

To use a custom domain instead of `<username>.uber.space`:

1. Add your domain to Uberspace:
```bash
uberspace web domain add yourdomain.com
```

2. Update the web backend for your domain:
```bash
uberspace web backend set yourdomain.com / --http --port 4321
```

3. Configure DNS records at your domain registrar to point to your Uberspace server.

## Troubleshooting

### Port Already in Use
If port 4321 is already in use, you can change it:

**Docker:** Edit `docker-compose.yml` and change both port mappings:
```yaml
ports:
  - "4322:4321"  # Change external port to 4322
environment:
  - PORT=4321    # Keep internal port as 4321
```
Then run: `uberspace web backend set / --http --port 4322`

**Native:** Change PORT in `start.sh` and update the web backend accordingly.

### Application Not Starting
Check logs for errors:
- Docker: `docker-compose logs`
- Native: `supervisorctl tail arandor-app`

### Database Issues
If the database isn't being created properly, ensure:
- The `.astro` directory exists and is writable
- The `ASTRO_DATABASE_FILE` environment variable is set correctly

## Security Notes

- The application runs on HTTP internally
- Uberspace provides automatic HTTPS/SSL certificates
- Database is stored locally and not exposed externally
- No authentication is built-in - consider adding access restrictions via Uberspace's web backend settings

## Support

For Uberspace-specific issues, consult:
- Uberspace Manual: https://manual.uberspace.de/
- Uberspace Support: https://uberspace.de/support

For application issues:
- GitHub Issues: https://github.com/danspy/arandor-companion-app/issues
