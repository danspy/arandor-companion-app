# Deployment Instructions

This guide explains how to deploy the Arandor Companion App on a production server using systemd.

## Quick Start

**Production server deployment (systemd):**
```bash
ssh deploy@your-server.com
cd /srv
sudo mkdir -p arandor
sudo chown deploy:deploy arandor
cd arandor
git clone https://github.com/danspy/arandor-companion-app.git .
npm install
npm run build

# Set up systemd service (requires root/sudo)
sudo cp arandor.service /etc/systemd/system/arandor.service
sudo systemctl daemon-reload
sudo systemctl enable arandor.service
sudo systemctl start arandor.service
sudo systemctl status arandor.service
```

## Prerequisites

- A Linux server with systemd (Ubuntu 20.04+, Debian 11+, etc.)
- SSH access to your server with sudo privileges
- Node.js 20.x or higher
- SQLite3

## Deployment Steps

### Initial Server Setup

#### 1. Create Deployment User (if not exists)

```bash
# On server as root or sudo user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG sudo deploy  # Optional: if you want deploy user to have sudo
```

#### 2. Create Application Directory

```bash
sudo mkdir -p /srv/arandor
sudo chown deploy:deploy /srv/arandor
```

#### 3. Clone and Build

```bash
# As deploy user
ssh deploy@your-server.com
cd /srv/arandor
git clone https://github.com/danspy/arandor-companion-app.git .
npm install
npm run build
```

#### 4. Set Up Systemd Service

The repository includes a systemd service file at `arandor.service`. Install it:

```bash
# Copy service file to systemd directory
sudo cp /srv/arandor/arandor.service /etc/systemd/system/arandor.service

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable arandor.service

# Start the service
sudo systemctl start arandor.service

# Check service status
sudo systemctl status arandor.service
```

#### 5. Configure Firewall (if applicable)

```bash
# Allow HTTP/HTTPS traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Or allow specific port (e.g., 4321)
sudo ufw allow 4321/tcp
```

#### 6. Set Up Reverse Proxy (Optional but Recommended)

For production, it's recommended to use nginx or Apache as a reverse proxy:

**Nginx example:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then enable SSL with Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Managing Your Deployment

### Application Management Commands

**View service status:**
```bash
sudo systemctl status arandor.service
```

**View logs:**
```bash
sudo journalctl -u arandor.service -f
```

**View recent logs:**
```bash
sudo journalctl -u arandor.service -n 100 --no-pager
```

**Restart the application:**
```bash
sudo systemctl restart arandor.service
```

**Stop the application:**
```bash
sudo systemctl stop arandor.service
```

**Start the application:**
```bash
sudo systemctl start arandor.service
```

**Disable service from starting on boot:**
```bash
sudo systemctl disable arandor.service
```

### Update the Application

```bash
# As deploy user
cd /srv/arandor

# Pull latest changes
git pull

# Install any new dependencies
npm install

# Rebuild the application
# Note: This builds using a temporary database and won't affect your production data
npm run build

# Run database migration if schema changed
# This safely adds new tables/columns without affecting existing data
sqlite3 /srv/arandor/.astro/content.db < scripts/migrate-db.sql

# Restart the service
sudo systemctl restart arandor.service

# Check status
sudo systemctl status arandor.service
```

## Automated Deployment with GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/deploy-production.yml`) that automates deployment.

### Setup Requirements

1. **Server Setup:**
   - Set up SSH key-based authentication for the deploy user
   - Ensure deploy user can run `sudo systemctl` commands without password

2. **Configure sudoers for deploy user:**
   ```bash
   # On server as root
   sudo visudo -f /etc/sudoers.d/arandor-deploy
   
   # Add these lines:
   deploy ALL=(ALL) NOPASSWD: /bin/systemctl daemon-reload
   deploy ALL=(ALL) NOPASSWD: /bin/systemctl enable arandor.service
   deploy ALL=(ALL) NOPASSWD: /bin/systemctl start arandor.service
   deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart arandor.service
   deploy ALL=(ALL) NOPASSWD: /bin/systemctl stop arandor.service
   deploy ALL=(ALL) NOPASSWD: /bin/systemctl status arandor.service
   deploy ALL=(ALL) NOPASSWD: /usr/bin/cp /srv/arandor/arandor.service /etc/systemd/system/arandor.service
   ```

3. **GitHub Secrets:**
   Add these secrets to your GitHub repository settings:
   - `SERVER_HOST`: Your server's hostname or IP address
   - `SERVER_USER`: The deployment user (e.g., `deploy`)
   - `SERVER_SSH_PRIVATE_KEY`: The private SSH key for authentication
   - `DEPLOY_DOMAIN`: Your domain name (optional, defaults to `arandor.app`)

### How the Workflow Works

1. Checks out the repository
2. Syncs the complete repository to the server (excluding build artifacts and database)
3. Runs `npm install` on the server
4. Runs `npm run build` on the server
5. Runs database migrations
6. Copies the systemd service file and restarts the service
7. Verifies the deployment with a smoke test

### Database Preservation

The workflow is designed to preserve existing database data during deployments:

**Build-time vs Runtime Database Separation:**
- During `npm run build`, a temporary database (`/tmp/astro-build.db`) is created for schema validation
- The actual production database (`/srv/arandor/.astro/content.db`) is only used at runtime
- This ensures builds never overwrite production data

**Additional Safety Measures:**
- The `.astro/` directory (containing the production database) is excluded from rsync
- The seed script (`db/seed.ts`) only populates data if the database is completely empty
- Database migrations use `CREATE TABLE IF NOT EXISTS` statements to add new schema elements
- A timestamped backup is created before each migration runs

This approach ensures:
- ✅ Existing data is preserved across all deployments
- ✅ Schema updates are applied safely via migrations
- ✅ Fresh installations get seeded with initial data automatically
- ✅ No data loss during the build process

## Data Persistence

- Database is stored at `/srv/arandor/.astro/content.db`
- Data persists across application restarts and deployments
- Backup regularly: `cp /srv/arandor/.astro/content.db ~/backup-$(date +%Y%m%d).db`

## Database Migrations

When updating to a new version that includes database schema changes:

1. **Backup your database first:**
   ```bash
   cp /srv/arandor/.astro/content.db ~/backup-$(date +%Y%m%d).db
   ```

2. **Run the migration script:**
   ```bash
   cd /srv/arandor
   sqlite3 /srv/arandor/.astro/content.db < scripts/migrate-db.sql
   ```

3. **Verify the migration:**
   ```bash
   sqlite3 /srv/arandor/.astro/content.db "SELECT name FROM sqlite_master WHERE type='table';"
   ```

The migration scripts are designed to be idempotent (safe to run multiple times) and will not affect existing data.

## Environment Variables

The systemd service sets these environment variables:
- `HOST=0.0.0.0` - Listen on all interfaces
- `PORT=4321` - Application port
- `ASTRO_DATABASE_FILE=/srv/arandor/.astro/content.db` - Database location

You can customize these by editing `/etc/systemd/system/arandor.service` and running:
```bash
sudo systemctl daemon-reload
sudo systemctl restart arandor.service
```

## Troubleshooting

### Service Not Starting

Check logs for errors:
```bash
sudo journalctl -u arandor.service -n 100 --no-pager
```

Common issues:
- Node.js not installed or wrong version
- Missing dependencies (run `npm install`)
- Port already in use (change PORT in service file)
- Database directory not writable

### Database Issues

If the database isn't being created properly, ensure:
- The `.astro` directory exists and is writable: `mkdir -p /srv/arandor/.astro`
- The deploy user owns the directory: `sudo chown -R deploy:deploy /srv/arandor/.astro`
- The `ASTRO_DATABASE_FILE` environment variable is set correctly in the service file

### Permission Issues

If you get permission errors:
```bash
# Ensure correct ownership
sudo chown -R deploy:deploy /srv/arandor

# Ensure service file is readable
sudo chmod 644 /etc/systemd/system/arandor.service
```

## Security Notes

- The application runs as the `deploy` user (not root)
- Database is stored locally and not exposed externally
- Use a reverse proxy (nginx/Apache) with SSL in production
- Consider adding authentication middleware for sensitive deployments
- Regularly update dependencies: `npm update`
- Keep your server updated: `sudo apt update && sudo apt upgrade`

## Support

For application issues:
- GitHub Issues: https://github.com/danspy/arandor-companion-app/issues
