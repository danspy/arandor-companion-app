# Deployment Instructions

This guide explains how to deploy the Arandor Companion App on a production server using systemd.

## 🔒 Database Safety First

**IMPORTANT:** This deployment approach **NEVER touches your database automatically**. Your data is completely safe during deployments.

- ✅ Deployments only update code and rebuild the application
- ✅ Database schema updates are **manual and explicit** 
- ✅ You have full control over when and how database changes are applied
- ✅ No surprises, no automatic migrations, no data loss

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

# Initialize database (ONLY on first deployment)
./scripts/update-database.sh

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
        
        # Required for video streaming on mobile devices
        proxy_set_header Range $http_range;
        proxy_set_header If-Range $http_if_range;
        proxy_no_cache $http_range $http_if_range;
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

**Automatic Updates (Recommended - Uses GitHub Actions):**
The GitHub Actions workflow automatically handles code updates when you push to main:
- ✅ Syncs code to server 
- ✅ Builds in isolation (using temporary database, never touches production data)
- ✅ Restarts service
- ❌ **NEVER touches your production database**

**Manual Updates (If not using GitHub Actions):**
```bash
# As deploy user
cd /srv/arandor

# Pull latest changes
git pull

# Install any new dependencies
npm install

# Rebuild the application
# Note: This builds using a temporary database (/tmp/astro-build.db)
# Your production database is NEVER touched during build
npm run build

# Restart the service
sudo systemctl restart arandor.service

# Check status
sudo systemctl status arandor.service
```

**Important Notes:**
- ✅ **Your production data is completely safe** - deployments never touch the database
- ✅ The database file at `/srv/arandor/data/content.db` persists across all updates
- ✅ Database schema updates are manual and explicit (see Database Management section below)

## Automated Deployment with GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/deploy-production.yml`) that automates code deployment.

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
3. Builds the application in a temporary directory to avoid touching the production database
   - Creates a temporary build directory (`/tmp/arandor-build-*`)
   - Copies source files to the temp directory
   - Runs `npm install` and `npm run build` in the temp directory with `ASTRO_DATABASE_FILE=/tmp/astro-build.db`
   - Copies only the `dist/` folder and `node_modules/` back to production
   - Deletes the temporary build directory
4. Ensures database directory exists (but never touches the database itself)
5. Restarts the systemd service
6. Verifies the deployment with a smoke test

### Database Safety During Deployment

**The deployment workflow NEVER modifies your production database:**
- ✅ The `.astro/` directory (containing the production database) is excluded from rsync
- ✅ The build happens in a temporary directory with a temporary database
- ✅ Only compiled code (`dist/`) is copied to production
- ✅ **No automatic migrations** - all database changes are manual
- ✅ **No automatic seeding** - your data is never touched

## Database Management

### Initial Database Setup (First Deployment Only)

On your first deployment, you need to create the database:

```bash
# As deploy user on the server
cd /srv/arandor
./scripts/update-database.sh
```

This will:
- Create the database at `/srv/arandor/data/content.db`
- Create all required tables (empty, no seed data)
- You can then add your data through the application UI

### Updating Database Schema

**When to update:** Only when you pull code that includes database schema changes (new tables or columns).

**How to update:**

1. **Check the release notes or commit messages** to see if database changes are needed
2. **Backup your database first:**
   ```bash
   cd /srv/arandor
   cp .astro/content.db .astro/backups/content.db.backup.$(date +%Y%m%d_%H%M%S)
   ```

3. **Run the update script:**
   ```bash
   # Preview what will happen (dry run)
   ./scripts/update-database.sh --dry-run
   
   # Apply the migration
   ./scripts/update-database.sh
   ```

4. **Restart the application:**
   ```bash
   sudo systemctl restart arandor.service
   ```

The update script will:
- Show you the current database state
- Create a timestamped backup
- Apply the migration (uses `CREATE TABLE IF NOT EXISTS`, safe for existing data)
- Verify your data is still intact
- Show you the updated state

### Manual Database Operations

**View database tables:**
```bash
sqlite3 /srv/arandor/data/content.db ".tables"
```

**View table schema:**
```bash
sqlite3 /srv/arandor/data/content.db ".schema User"
```

**Check data:**
```bash
sqlite3 /srv/arandor/data/content.db "SELECT COUNT(*) FROM User;"
```

**Backup database:**
```bash
mkdir -p /srv/arandor/.astro/backups
cp /srv/arandor/data/content.db /srv/arandor/.astro/backups/content.db.backup.$(date +%Y%m%d_%H%M%S)
```

**Restore from backup:**
```bash
# Stop the service first
sudo systemctl stop arandor.service

# Restore the backup
cp /srv/arandor/.astro/backups/content.db.backup.YYYYMMDD_HHMMSS /srv/arandor/data/content.db

# Start the service
sudo systemctl start arandor.service
```

## Data Persistence

### Database
- Database is stored at `/srv/arandor/data/content.db`
- Data persists across application restarts and deployments
- **Recommended:** Set up automated daily backups:
  ```bash
  # Add to crontab (crontab -e)
  0 2 * * * cp /srv/arandor/data/content.db /srv/arandor/.astro/backups/content.db.daily.$(date +\%Y\%m\%d).db
  ```

### Uploaded Files (Images and Videos)
- Uploaded files are stored at `/srv/arandor/uploads/`
- Files persist across application restarts and deployments
- The uploads directory is created automatically during deployment
- Files are served through the `/uploads/` endpoint
- **Note:** The uploads directory is separate from the `dist/` folder, which is rebuilt on every deployment
- **Recommended:** Include uploads in your backup strategy:
  ```bash
  # Add to crontab (crontab -e)
  0 2 * * * rsync -a /srv/arandor/uploads/ /srv/arandor/backups/uploads.$(date +\%Y\%m\%d)/
  ```

## Environment Variables

### Built-in Environment Variables

The systemd service sets these environment variables:
- `HOST=0.0.0.0` - Listen on all interfaces
- `PORT=4321` - Application port
- `ASTRO_DATABASE_FILE=/srv/arandor/data/content.db` - Database location

### Custom Environment Variables (Optional)

For features requiring API keys (like the AI podcast feature), create a `.env` file at `/srv/arandor/.env`:

```bash
# On your server
cd /srv/arandor
nano .env
```

Add your environment variables in systemd EnvironmentFile format (no quotes):

```
# Example: OpenAI API key for podcast generation
OPENAI_API_KEY=sk-proj-abc123xyz...

# Optional: Custom uploads directory
UPLOADS_DIR=/custom/path/to/uploads
```

**Important**: 
- No quotes around values (systemd format)
- No spaces around the `=` sign
- Set proper permissions: `chmod 600 /srv/arandor/.env && chown deploy:deploy /srv/arandor/.env`

The systemd service automatically loads this file via the `EnvironmentFile` directive.

### Updating Environment Variables

After creating or modifying environment variables, restart the service:
```bash
sudo systemctl restart arandor.service
```

You can also customize the built-in variables by editing `/etc/systemd/system/arandor.service` and running:
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

**Database Not Created on First Deployment:**

If the database doesn't exist after deployment:
```bash
# Create it manually using the update script
cd /srv/arandor
./scripts/update-database.sh
```

**Need to Update Database Schema:**

When you pull new code that includes database schema changes:
```bash
# Use the update script
cd /srv/arandor
./scripts/update-database.sh

# Restart the service
sudo systemctl restart arandor.service
```

**Database File Permissions:**

If you get permission errors:
```bash
# Ensure correct ownership
sudo chown -R deploy:deploy /srv/arandor/.astro

# Ensure directory is writable
chmod 755 /srv/arandor/.astro
chmod 644 /srv/arandor/data/content.db
```

**Verify Database State:**

Check if database exists and has data:
```bash
# Check if database file exists
ls -lh /srv/arandor/data/content.db

# View tables
sqlite3 /srv/arandor/data/content.db ".tables"

# Check user count
sqlite3 /srv/arandor/data/content.db "SELECT COUNT(*) FROM User;"
```

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
