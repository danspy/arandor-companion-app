# Production Deployment Guide

## Prerequisites

Before the deployment workflow can run, you need to configure the following GitHub secrets in your repository settings (`Settings` > `Secrets and variables` > `Actions`):

### Required Secrets

1. **SERVER_HOST** - Your Hetzner server's IP address or hostname
   - Example: `123.45.67.89` or `server.example.com`

2. **SERVER_USER** - SSH username for your Hetzner server
   - Example: `deploy` or `ubuntu`

3. **SERVER_SSH_PRIVATE_KEY** - Private SSH key for authentication
   - Generate on your local machine if you don't have one:
     ```bash
     ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/hetzner_deploy
     ```
   - Copy the public key to your server:
     ```bash
     ssh-copy-id -i ~/.ssh/hetzner_deploy.pub user@server
     ```
   - Copy the **private key** contents to the GitHub secret:
     ```bash
     cat ~/.ssh/hetzner_deploy
     ```

## How the Deployment Works

The workflow automatically deploys to your Hetzner server when you push to the `main` branch or manually trigger it.

### Deployment Process

1. **Build** - Builds the Astro application in server mode using `npm run build`
2. **Upload Artifact** - Uploads the built `dist/` folder as a GitHub artifact
3. **Download Artifact** - Downloads the artifact in the deploy job
4. **Sync** - Uses rsync to sync only the `dist/` directory to `/srv/arandor/dist/` on the server
5. **Restart** - Restarts the systemd service to apply the new code

### Data Preservation

The deployment **preserves your database and data** by:
- Only syncing the `dist/` folder containing application code
- The database file (`.astro/content.db`) is stored outside the `dist/` directory
- rsync's `--delete` flag only affects files within `/srv/arandor/dist/`, not the database location
- The systemd service should be configured to use a database path outside `/srv/arandor/dist/`

**Important:** Ensure your systemd service sets the `ASTRO_DATABASE_FILE` environment variable to a location outside `/srv/arandor/dist/`, such as `/srv/arandor/data/.astro/content.db` or `/var/lib/arandor/.astro/content.db`.

### Server Setup (First Time Only)

On your Hetzner server, you need to set up the systemd service and directory structure.

#### 1. Create Application Directory

```bash
sudo mkdir -p /srv/arandor/dist
sudo mkdir -p /srv/arandor/data/.astro
sudo chown -R deploy:deploy /srv/arandor
```

#### 2. Create Systemd Service

Create `/etc/systemd/system/arandor.service`:

```ini
[Unit]
Description=Arandor Companion App
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/srv/arandor/dist/server
Environment="NODE_ENV=production"
Environment="HOST=0.0.0.0"
Environment="PORT=4321"
Environment="ASTRO_DATABASE_FILE=/srv/arandor/data/.astro/content.db"
ExecStart=/usr/bin/node /srv/arandor/dist/server/entry.mjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 3. Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable arandor.service
sudo systemctl start arandor.service
sudo systemctl status arandor.service
```

#### 4. Configure Sudo for Service Restart

The deploy user needs permission to restart the service without a password. Add to `/etc/sudoers.d/arandor`:

```
deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart arandor.service
deploy ALL=(ALL) NOPASSWD: /bin/systemctl status arandor.service
```

## Manual Deployment

You can also trigger the deployment manually:
1. Go to the `Actions` tab in your GitHub repository
2. Select the "Build and Deploy (Node server)" workflow
3. Click "Run workflow"
4. Select the `main` branch
5. Click "Run workflow"

## Monitoring Deployment

After deployment, you can check the application status:

```bash
ssh user@server
sudo systemctl status arandor.service
sudo journalctl -u arandor.service -f
```

## Troubleshooting

### SSH Connection Issues
- Verify your SSH key is correctly added to GitHub secrets
- Ensure the public key is in `~/.ssh/authorized_keys` on your server
- Check that SERVER_HOST and SERVER_USER are correct

### Service Not Starting
- Check logs: `sudo journalctl -u arandor.service -n 50`
- Verify the database directory exists and is writable
- Ensure Node.js 20+ is installed on the server

### Database Issues
- The database is stored at the path specified in `ASTRO_DATABASE_FILE`
- To backup: `cp /srv/arandor/data/.astro/content.db ~/backup.db`
- To restore: `cp ~/backup.db /srv/arandor/data/.astro/content.db`
- Ensure the directory exists: `mkdir -p /srv/arandor/data/.astro`

## Port Configuration

By default, the application runs on port 4321. To make it accessible:

### Option 1: Reverse Proxy (Recommended)
Set up Nginx or Apache to proxy requests to port 4321:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:4321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 2: Direct Port Access
Open port 4321 in your firewall:
```bash
sudo ufw allow 4321/tcp
```

Then access via: `http://your-server-ip:4321`

## Security Recommendations

1. **Use HTTPS** - Set up SSL/TLS with Let's Encrypt
2. **Firewall** - Configure UFW to only allow necessary ports
3. **SSH Security** - Use SSH keys only, disable password authentication
4. **Regular Updates** - Keep Node.js and the server OS updated
5. **Backups** - Regularly backup the database file
6. **Service User** - Run the service as a non-root user (e.g., `deploy`)

## Rollback

If a deployment fails, you can rollback by redeploying a previous version:

```bash
# On your local machine, checkout the previous commit
git checkout <previous-commit-hash>

# Manually trigger the workflow or push to a branch and merge to main
```

Alternatively, if you have a backup of the dist folder:
```bash
ssh user@server
sudo systemctl stop arandor.service
# Restore previous dist folder
sudo systemctl start arandor.service
```
