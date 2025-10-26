# GitHub Pages Preview Setup Guide

## Important Limitation

⚠️ **This application uses Astro DB (SQLite) which requires a server to run.** GitHub Pages only supports static sites, which means:

- **Static previews will NOT have database functionality**
- No characters, quests, NPCs, locations, or diary entries will work
- API endpoints will not be available
- Only the UI/layout can be previewed

If you need full functionality in previews, use one of the server-based deployment options below.

## Option 1: GitHub Pages Static Preview (Limited Functionality)

For UI/layout preview only, without database features.

### Setup Steps

1. **Enable GitHub Pages in your repository:**
   - Go to Settings → Pages
   - Under "Source", select "GitHub Actions"
   - Click Save

2. **The workflow is already configured:**
   - File: `.github/workflows/github-pages-preview.yml`
   - Triggers automatically on PR creation/updates
   - Deploys to: `https://[username].github.io/[repo-name]/pr-preview/pr-[number]`

3. **Preview URL Pattern:**
   ```
   https://danspy.github.io/arandor-companion-app/pr-preview/pr-123
   ```
   (Replace `123` with your PR number)

4. **Automatic Updates:**
   - The preview updates automatically when you push new commits
   - The preview is removed when the PR is closed

### What Works in Static Preview
✅ Page layouts and navigation
✅ UI components and styling
✅ Dark mode toggle
✅ Responsive design
✅ Static content

### What Doesn't Work in Static Preview
❌ Database operations
❌ Adding/editing/deleting entries
❌ API endpoints
❌ Dynamic data loading
❌ Authentication

## Option 2: Full Server Preview (Recommended)

For full functionality including database, use a server-based platform:

### A. Railway (Easiest)

1. Go to [Railway.app](https://railway.app/)
2. Click "Start a New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects and deploys the app
5. Get a URL like: `https://arandor-companion-pr-123.up.railway.app`

**PR Previews on Railway:**
- Enable "PR Deploys" in Railway settings
- Each PR gets its own preview URL automatically
- Full database functionality included

### B. Render

1. Go to [Render.com](https://render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Add environment variable: `ASTRO_DATABASE_FILE=./.astro/content.db`
5. Enable "Pull Request Previews" in settings

### C. Vercel/Netlify (Requires Adapter Change)

To use Vercel or Netlify, you need to change the adapter:

**For Vercel:**
```bash
npm install @astrojs/vercel
```

Update `astro.config.mjs`:
```javascript
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  integrations: [tailwind(), db()],
  output: 'server',
  adapter: vercel(),
});
```

**For Netlify:**
```bash
npm install @astrojs/netlify
```

Update `astro.config.mjs`:
```javascript
import netlify from '@astrojs/netlify/functions';

export default defineConfig({
  integrations: [tailwind(), db()],
  output: 'server',
  adapter: netlify(),
});
```

### D. Self-Hosted Preview Server

If you have a VPS or server:

1. **Set up a subdomain pattern:**
   ```
   pr-123.preview.yourdomain.com
   ```

2. **Use the deployment artifacts:**
   - Download from "Deploy Preview Server" workflow
   - Extract and deploy to subdomain
   - Use nginx/Apache reverse proxy

3. **Automate with GitHub Actions:**
   - Add SSH keys to GitHub Secrets
   - Modify `.github/workflows/preview-deploy.yml` to SSH into your server
   - Deploy automatically on PR

Example automation (add to preview-deploy.yml):
```yaml
- name: Deploy to preview server
  env:
    SSH_PRIVATE_KEY: ${{ secrets.PREVIEW_SERVER_SSH_KEY }}
    SERVER_HOST: ${{ secrets.PREVIEW_SERVER_HOST }}
  run: |
    mkdir -p ~/.ssh
    echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa
    ssh-keyscan -H $SERVER_HOST >> ~/.ssh/known_hosts
    
    scp deployment.tar.gz user@$SERVER_HOST:/tmp/
    ssh user@$SERVER_HOST << 'EOF'
      cd /var/www/preview-pr-${{ github.event.pull_request.number }}
      tar -xzf /tmp/deployment.tar.gz
      npm install --production
      pm2 restart preview-pr-${{ github.event.pull_request.number }}
    EOF
```

## Comparison Table

| Platform | Setup Difficulty | Cost | Database Support | Auto PR Previews | Custom Domain |
|----------|-----------------|------|------------------|------------------|---------------|
| **GitHub Pages** | ⭐ Easy | Free | ❌ No | ✅ Yes | ✅ Yes |
| **Railway** | ⭐ Easy | Free tier + usage | ✅ Yes | ✅ Yes | ✅ Yes |
| **Render** | ⭐⭐ Medium | Free tier | ✅ Yes | ✅ Yes | ✅ Yes |
| **Vercel** | ⭐⭐ Medium | Free tier | ✅ Yes | ✅ Yes | ✅ Yes |
| **Netlify** | ⭐⭐ Medium | Free tier | ✅ Yes | ✅ Yes | ✅ Yes |
| **Self-Hosted** | ⭐⭐⭐ Hard | Server cost | ✅ Yes | ⚠️ Manual setup | ✅ Yes |

## Recommended Workflow

For best preview experience:

1. **Use GitHub Pages for quick UI checks** (static preview)
   - Fast deployment
   - No cost
   - Good for design reviews

2. **Use Railway/Render for functional previews** (full features)
   - Complete database functionality
   - Test actual user flows
   - Validate API integrations

3. **Keep both workflows** so reviewers can choose based on what they need to test

## Troubleshooting

### GitHub Pages Preview Not Working

**Issue:** Workflow fails with build errors
- **Cause:** App requires server features
- **Solution:** This is expected. Use server-based preview instead

**Issue:** Preview URL returns 404
- **Check:** Repository Settings → Pages → Source is set to "GitHub Actions"
- **Check:** Workflow completed successfully
- **Wait:** First deployment can take 5-10 minutes

### Server Preview Issues

**Issue:** Database not persisting
- **Railway/Render:** Check that storage volumes are configured
- **Solution:** Configure persistent storage in platform settings

**Issue:** Environment variables not set
- **Solution:** Add `ASTRO_DATABASE_FILE=./.astro/content.db` in platform dashboard

## Summary

**Quick Answer:** GitHub Pages cannot run your full app because it needs a server for the database. 

**Best Solution:** Use Railway or Render for automatic PR previews with full functionality.

**Alternative:** Keep GitHub Pages workflow for UI-only previews as a quick visual check.

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for each platform.
