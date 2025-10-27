# Deployment Instructions

This guide explains how to deploy the Arandor Companion App on a production server or Uberspace.

## Quick Start

**Uberspace deployment:**
```bash
ssh <username>@<username>.uber.space
cd ~ && git clone https://github.com/danspy/arandor-companion-app.git
cd arandor-companion-app
npm install
npm run build
# Set up as service (see below)
uberspace web backend set / --http --port 4321
# Access at https://<username>.uber.space
```

## Prerequisites

- An active Uberspace account (https://uberspace.de/) or any Node.js hosting server
- SSH access to your server
- Node.js 20.x or higher

## Deployment Steps

### Native Node.js Deployment

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

### Application Management Commands

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

- Database is stored at `~/.astro/content.db` or in the app directory
- Data persists across application restarts
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
If port 4321 is already in use, you can change it by updating the PORT environment variable in `start.sh` and then running: `uberspace web backend set / --http --port <new-port>`

### Application Not Starting
Check logs for errors: `supervisorctl tail arandor-app`

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
