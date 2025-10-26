# Deployment Guide

This guide provides detailed instructions for deploying the Arandor Companion App to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Methods](#deployment-methods)
  - [Node.js Deployment](#nodejs-deployment)
  - [Docker Deployment](#docker-deployment)
  - [Platform-Specific Deployments](#platform-specific-deployments)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [Process Management](#process-management)
- [Monitoring and Maintenance](#monitoring-and-maintenance)

## Prerequisites

Before deploying, ensure you have:

- Node.js 20.x or higher
- npm 10.x or higher
- (Optional) Docker and Docker Compose
- A server or hosting platform with at least 512MB RAM
- Domain name (optional but recommended)

## Deployment Methods

### Node.js Deployment

#### Quick Start

1. **Build the application locally or on your server:**

```bash
git clone https://github.com/danspy/arandor-companion-app.git
cd arandor-companion-app
npm install
ASTRO_DATABASE_FILE=./.astro/content.db npm run build
```

2. **Transfer to your production server:**

If building locally, copy these to your server:
- `dist/` directory
- `.astro/` directory
- `package.json`
- `package-lock.json`

3. **Install production dependencies on the server:**

```bash
npm install --production
```

4. **Set environment variables:**

```bash
export ASTRO_DATABASE_FILE=./.astro/content.db
export HOST=0.0.0.0
export PORT=4321
export NODE_ENV=production
```

5. **Start the application:**

```bash
npm start
```

#### Using systemd (Recommended for Linux servers)

Create a systemd service file at `/etc/systemd/system/arandor-companion.service`:

```ini
[Unit]
Description=Arandor Companion App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/arandor-companion-app
Environment=NODE_ENV=production
Environment=ASTRO_DATABASE_FILE=/var/www/arandor-companion-app/.astro/content.db
Environment=HOST=0.0.0.0
Environment=PORT=4321
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable arandor-companion
sudo systemctl start arandor-companion
sudo systemctl status arandor-companion
```

### Docker Deployment

#### Using Docker

1. **Build the Docker image:**

```bash
docker build -t arandor-companion:latest .
```

2. **Run the container:**

```bash
docker run -d \
  -p 4321:4321 \
  -v arandor-data:/app/data \
  -e ASTRO_DATABASE_FILE=/app/data/content.db \
  -e HOST=0.0.0.0 \
  -e PORT=4321 \
  --name arandor-companion \
  --restart unless-stopped \
  arandor-companion:latest
```

#### Using Docker Compose

1. **Start the application:**

```bash
docker-compose up -d
```

2. **View logs:**

```bash
docker-compose logs -f
```

3. **Stop the application:**

```bash
docker-compose down
```

### Platform-Specific Deployments

#### Railway

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard:
   - `ASTRO_DATABASE_FILE`: `./.astro/content.db`
3. Railway will automatically detect and deploy

#### Render

1. Create a new Web Service
2. Connect your GitHub repository
3. Configure:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment Variables:
     - `ASTRO_DATABASE_FILE`: `./.astro/content.db`
     - `NODE_ENV`: `production`

#### DigitalOcean App Platform

1. Create a new App
2. Connect your GitHub repository
3. Configure:
   - Build Command: `npm install && npm run build`
   - Run Command: `npm start`
   - HTTP Port: `4321`

#### AWS EC2

Follow the Node.js deployment steps above, then:

1. Configure security group to allow traffic on port 4321 (or use reverse proxy)
2. Set up an Elastic IP for a static IP address
3. Consider using AWS Systems Manager for easier management
4. Set up CloudWatch for monitoring

## Environment Configuration

### Required Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ASTRO_DATABASE_FILE` | Path to SQLite database | `./.astro/content.db` | Yes |
| `HOST` | Host to bind to | `0.0.0.0` | No |
| `PORT` | Port to listen on | `4321` | No |
| `NODE_ENV` | Node environment | `production` | No |

### Setting Environment Variables

#### Using .env file (Development)

```bash
cp .env.example .env
# Edit .env with your values
```

#### Using export (Linux/macOS)

```bash
export ASTRO_DATABASE_FILE=./.astro/content.db
export HOST=0.0.0.0
export PORT=4321
```

#### Using systemd service file

Add to the `[Service]` section:

```ini
Environment=ASTRO_DATABASE_FILE=/path/to/content.db
Environment=HOST=0.0.0.0
Environment=PORT=4321
```

## Database Setup

### Initial Setup

The database is automatically initialized on first build with seed data. To customize:

1. Edit `db/seed.ts` with your initial data
2. Rebuild the application

### Backup Database

#### Manual Backup

```bash
# Backup the database file
cp .astro/content.db backups/content-$(date +%Y%m%d-%H%M%S).db
```

#### Automated Backup Script

Create a backup script `backup-db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/arandor-db"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_FILE="./.astro/content.db"

mkdir -p $BACKUP_DIR
cp $DB_FILE $BACKUP_DIR/content-$TIMESTAMP.db

# Keep only last 30 backups
ls -t $BACKUP_DIR/content-*.db | tail -n +31 | xargs -r rm
```

Add to cron for daily backups:

```bash
0 2 * * * /path/to/backup-db.sh
```

### Restore Database

```bash
# Stop the application
sudo systemctl stop arandor-companion

# Restore from backup
cp backups/content-YYYYMMDD.db .astro/content.db

# Start the application
sudo systemctl start arandor-companion
```

## Reverse Proxy Setup

### Nginx

Create `/etc/nginx/sites-available/arandor-companion`:

```nginx
server {
    listen 80;
    server_name arandor.example.com;

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

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/arandor-companion /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d arandor.example.com
```

### Apache

Create `/etc/apache2/sites-available/arandor-companion.conf`:

```apache
<VirtualHost *:80>
    ServerName arandor.example.com

    ProxyPreserveHost On
    ProxyPass / http://localhost:4321/
    ProxyPassReverse / http://localhost:4321/

    ErrorLog ${APACHE_LOG_DIR}/arandor-error.log
    CustomLog ${APACHE_LOG_DIR}/arandor-access.log combined
</VirtualHost>
```

Enable required modules and site:

```bash
sudo a2enmod proxy proxy_http
sudo a2ensite arandor-companion
sudo systemctl reload apache2
```

## Process Management

### Using PM2 (Recommended for Node.js deployments)

1. **Install PM2:**

```bash
npm install -g pm2
```

2. **Create ecosystem file `ecosystem.config.js`:**

```javascript
module.exports = {
  apps: [{
    name: 'arandor-companion',
    script: 'dist/server/entry.mjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      ASTRO_DATABASE_FILE: './.astro/content.db',
      HOST: '0.0.0.0',
      PORT: 4321
    }
  }]
};
```

3. **Start with PM2:**

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

4. **Manage the application:**

```bash
pm2 status
pm2 logs arandor-companion
pm2 restart arandor-companion
pm2 stop arandor-companion
```

## Monitoring and Maintenance

### Health Checks

The application includes a health check endpoint:

```bash
curl http://localhost:4321/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-26T16:00:00.000Z",
  "version": "1.0.0",
  "service": "arandor-companion-app"
}
```

### Monitoring Tools

#### PM2 Monitoring

```bash
pm2 monit
```

#### System Monitoring

For system-level monitoring, consider:

- **Prometheus + Grafana**: For metrics and dashboards
- **UptimeRobot**: For uptime monitoring
- **CloudWatch** (AWS): If deployed on AWS
- **Datadog**: For comprehensive monitoring

### Log Management

#### View Logs

```bash
# systemd
sudo journalctl -u arandor-companion -f

# PM2
pm2 logs arandor-companion

# Docker
docker logs -f arandor-companion
```

#### Log Rotation

For systemd, logs are automatically rotated. For PM2:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Updates and Maintenance

#### Updating the Application

1. **Backup the database:**

```bash
cp .astro/content.db backups/content-$(date +%Y%m%d).db
```

2. **Pull latest changes:**

```bash
git pull origin main
```

3. **Install dependencies:**

```bash
npm install
```

4. **Rebuild:**

```bash
ASTRO_DATABASE_FILE=./.astro/content.db npm run build
```

5. **Restart the application:**

```bash
# systemd
sudo systemctl restart arandor-companion

# PM2
pm2 restart arandor-companion

# Docker
docker-compose down && docker-compose up -d
```

### Security Best Practices

1. **Keep Node.js and dependencies updated:**

```bash
npm audit
npm update
```

2. **Use a firewall:**

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

3. **Regular backups:** Set up automated daily backups

4. **Monitor logs:** Check for suspicious activity regularly

5. **Use HTTPS:** Always use SSL/TLS in production

6. **Limit file permissions:**

```bash
chmod 750 /path/to/app
chown -R www-data:www-data /path/to/app
```

## Troubleshooting

### Application won't start

1. Check logs for error messages
2. Verify environment variables are set correctly
3. Ensure database file exists and is writable
4. Check port 4321 is not already in use: `lsof -i :4321`

### Database issues

1. Verify database file exists
2. Check file permissions
3. Restore from backup if corrupted

### High memory usage

1. Check for memory leaks in logs
2. Restart the application
3. Consider increasing available memory

## Support

For issues and questions:
- GitHub Issues: https://github.com/danspy/arandor-companion-app/issues
- Documentation: See README.md
