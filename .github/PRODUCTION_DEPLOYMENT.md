# Production Deployment Guide

## Prerequisites

Before the deployment workflow can run, you need to configure the following GitHub secrets in your repository settings (`Settings` > `Secrets and variables` > `Actions`):

### Required Secrets

1. **HETZNER_HOST** - Your Hetzner server's IP address or hostname
   - Example: `123.45.67.89` or `server.example.com`

2. **HETZNER_USERNAME** - SSH username for your Hetzner server
   - Example: `root` or `ubuntu`

3. **HETZNER_SSH_KEY** - Private SSH key for authentication
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

4. **HETZNER_PORT** (Optional) - SSH port, defaults to 22 if not set
   - Example: `22` or `2222`

## How the Deployment Works

The workflow automatically deploys to your Hetzner server when you push to the `main` branch or manually trigger it.

### Deployment Process

1. **Build** - Builds the Docker image from the Dockerfile
2. **Transfer** - Copies the image and docker-compose.yml to the server
3. **Deploy** - Stops the old container, loads the new image, and starts the updated application
4. **Persist Data** - Database is stored in a Docker volume (`arandor-data`) that persists across deployments

### Data Preservation

The deployment **preserves your database and data** by:
- Using a Docker volume (`arandor-data`) defined in `docker-compose.yml`
- The volume persists across container restarts and updates
- Only the application code is updated, not the database

### Server Setup (First Time Only)

On your Hetzner server, ensure Docker and Docker Compose are installed:

```bash
# Install Docker (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose (if not already installed)
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Add your user to the docker group (to run without sudo)
sudo usermod -aG docker $USER
# Log out and back in for this to take effect
```

## Manual Deployment

You can also trigger the deployment manually:
1. Go to the `Actions` tab in your GitHub repository
2. Select the "Deploy to Hetzner Production" workflow
3. Click "Run workflow"
4. Select the `main` branch
5. Click "Run workflow"

## Monitoring Deployment

After deployment, you can check the application status:

```bash
ssh user@server
cd ~/arandor-companion-app
docker-compose ps
docker-compose logs -f
```

## Troubleshooting

### SSH Connection Issues
- Verify your SSH key is correctly added to GitHub secrets
- Ensure the public key is in `~/.ssh/authorized_keys` on your server
- Check that the HETZNER_HOST and HETZNER_PORT are correct

### Docker Issues
- Ensure Docker is running: `sudo systemctl status docker`
- Check available disk space: `df -h`
- View container logs: `docker-compose logs`

### Database Issues
- The database is stored in the `arandor-data` volume
- To backup: `docker cp arandor-companion-app:/app/.astro/content.db ./backup.db`
- To restore: `docker cp ./backup.db arandor-companion-app:/app/.astro/content.db`

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
4. **Regular Updates** - Keep Docker and the server OS updated
5. **Backups** - Regularly backup the database volume

## Rollback

If a deployment fails, you can rollback:

```bash
ssh user@server
cd ~/arandor-companion-app

# View available images
docker images | grep arandor

# If you have an old image, update docker-compose.yml to use it
# Then restart
docker-compose down
docker-compose up -d
```
