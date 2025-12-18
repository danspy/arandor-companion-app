# Step-by-Step Deployment Guide: AI Summary Feature

This guide provides complete instructions for updating your production server with the AI-powered diary summary feature.

## Prerequisites

Before starting, ensure you have:
- SSH access to your production server
- The app running at `/srv/arandor` (or know your installation path)
- Sudo privileges (for restarting the service)
- An OpenAI API key (or plan to use an alternative provider)

## Overview

This update adds:
1. A new `summary` field to the DiaryEntry database table
2. An AI integration that generates concise summaries of diary entries
3. A UI button to generate/regenerate summaries on demand
4. Support for multiple AI providers (OpenAI, OpenRouter, local LLMs)

## Step-by-Step Instructions

### Step 1: Backup Your Current System

Always start with a backup!

```bash
# SSH into your server
ssh deploy@your-server.com

# Navigate to app directory
cd /srv/arandor

# Create a backup of your current database
mkdir -p backups
cp data/content.db backups/content.db.before-ai-summary-$(date +%Y%m%d_%H%M%S)

# Verify backup was created
ls -lh backups/
```

**Why?** In case anything goes wrong, you can restore from this backup.

### Step 2: Pull the Latest Code

```bash
# Make sure you're in the right directory
cd /srv/arandor

# Stash any local changes (if you have any)
git stash

# Pull the latest code from the repository
git pull origin main
# Or if you're on a different branch:
# git pull origin your-branch-name

# Check what changed
git log --oneline -5
```

**What this does:** Downloads the latest code including the AI summary feature.

### Step 3: Install Dependencies

The new feature doesn't require any new npm packages, but let's make sure everything is up to date:

```bash
# Install/update dependencies
npm install

# This should complete in a few seconds
# You should see: "up to date, audited XXX packages"
```

**Why?** Ensures all dependencies are correctly installed.

### Step 4: Update the Database Schema

The new feature adds a `summary` column to the DiaryEntry table. We have a safe migration script for this:

```bash
# Run the migration script
chmod +x scripts/add-summary-column.sh
./scripts/add-summary-column.sh
```

**What happens:**
1. Script checks if the column already exists (safe to run multiple times)
2. Shows you current database state
3. Creates a timestamped backup automatically
4. Adds the new `summary` column
5. Verifies your data is still intact

**Expected output:**
```
Arandor Database Migration: Add Summary Column
==============================================

Database path: /srv/arandor/data/content.db

Current DiaryEntry table schema:
-------------------------------
[shows current columns]

Diary entries in database: X

Do you want to add the summary column? (y/N) 
```

Type `y` and press Enter.

**If something goes wrong:** The script creates a backup before making changes. Restore with:
```bash
cp backups/content.db.backup.TIMESTAMP data/content.db
```

### Step 5: Configure AI API (OpenAI)

Now configure the AI provider. We'll use OpenAI in this example:

#### 5a. Get an OpenAI API Key

1. Visit https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Give it a name like "Arandor Companion App"
5. Copy the key (starts with `sk-...`)
6. **Important:** Save it somewhere safe - you can't see it again!

#### 5b. Add the API Key to Your Server

```bash
# Create or edit the .env file
nano .env

# Add this line (replace with your actual key):
OPENAI_API_KEY=sk-your-actual-api-key-here

# Optional: Customize the model (default is gpt-3.5-turbo)
# OPENAI_MODEL=gpt-4

# Save and exit
# Press: Ctrl+X, then Y, then Enter
```

#### 5c. Secure the .env File

```bash
# Make sure only you can read it
chmod 600 .env

# Verify the permissions
ls -l .env
# Should show: -rw------- (only owner can read/write)
```

**Cost Note:** GPT-3.5-Turbo costs about $0.001 per summary (~50 summaries = $0.05).

### Step 6: Update the Systemd Service

The service needs to load environment variables from the .env file:

```bash
# Edit the service file
sudo nano /etc/systemd/system/arandor.service
```

Find the `[Service]` section and add this line:
```ini
EnvironmentFile=/srv/arandor/.env
```

Your complete `[Service]` section should look like:
```ini
[Service]
Type=simple
User=deploy
WorkingDirectory=/srv/arandor
EnvironmentFile=/srv/arandor/.env
Environment="HOST=0.0.0.0"
Environment="PORT=4321"
Environment="ASTRO_DATABASE_FILE=/srv/arandor/data/content.db"
ExecStart=/usr/bin/node /srv/arandor/dist/server/entry.mjs
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=arandor

[Install]
WantedBy=multi-user.target
```

Save and exit (Ctrl+X, Y, Enter).

### Step 7: Rebuild the Application

```bash
# Build the updated application
npm run build

# This takes 30-60 seconds
# You should see: "Complete!" at the end
```

**What this does:** Compiles your updated code into the production-ready version.

**If build fails:** Check the error message. Common issues:
- Database file not found → Make sure data/content.db exists
- Permission issues → Check file permissions

### Step 8: Restart the Service

```bash
# Reload systemd to recognize the updated service file
sudo systemctl daemon-reload

# Restart the application
sudo systemctl restart arandor.service

# Check the status
sudo systemctl status arandor.service
```

**Expected output:**
```
● arandor.service - Arandor Companion App
   Loaded: loaded (/etc/systemd/system/arandor.service; enabled)
   Active: active (running) since [timestamp]
   ...
```

Look for:
- ✅ `Active: active (running)` - Good!
- ❌ `Active: failed` - Check logs (see Step 9)

### Step 9: Verify the Deployment

#### Check Application Logs

```bash
# View recent logs
sudo journalctl -u arandor.service -n 50 --no-pager

# Watch live logs (Ctrl+C to exit)
sudo journalctl -u arandor.service -f
```

**Look for:**
- ✅ Server started successfully
- ✅ No error messages
- ❌ Connection errors → Check database path
- ❌ API key errors → Check .env file

#### Test in Browser

1. Open your app in a web browser
2. Log in (if not already logged in)
3. Navigate to any diary entry
4. Look for the "AI Summary" section
5. Click the "Generate" button
6. Wait 3-5 seconds
7. Summary should appear!

**Expected result:**
```
✨ AI Summary
The party explored the ancient ruins of Darkwood Forest, 
encountering a mysterious elven ranger named Sylara. After 
defeating a group of goblins, they discovered a magical 
artifact that hints at a larger conspiracy.
```

### Step 10: Test with an Existing Entry

If you have existing diary entries:

1. Open one of your existing entries
2. Click "Generate" in the AI Summary section
3. A summary should be generated from the existing content
4. Click "Regenerate" to create a new summary

**The summary will:**
- Capture key events
- Mention important NPCs and locations
- Summarize plot developments
- Be 2-3 sentences long

## Troubleshooting

### "OpenAI API key not configured" Error

**Problem:** API key not loaded

**Solution:**
```bash
# Check if .env file exists and has the key
cat .env
# Should show: OPENAI_API_KEY=sk-...

# Make sure service is loading it
sudo systemctl status arandor.service | grep Environment

# Restart the service
sudo systemctl restart arandor.service
```

### 401 Unauthorized / 403 Forbidden Error

**Problem:** Invalid API key

**Solution:**
1. Verify your API key at https://platform.openai.com/api-keys
2. Check you have billing enabled (OpenAI requires payment method)
3. Test the key manually:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Button Does Nothing

**Problem:** JavaScript error

**Solution:**
```bash
# Clear browser cache
# Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

# Check browser console (F12) for errors

# Verify the service is running
sudo systemctl status arandor.service
```

### Slow Generation (>30 seconds)

**Problem:** API timeout or slow model

**Solution:**
- Use gpt-3.5-turbo instead of gpt-4 (faster)
- Check your internet connection
- Consider using a local LLM for faster response

### Database Error After Migration

**Problem:** Migration didn't complete successfully

**Solution:**
```bash
# Check database schema
sqlite3 data/content.db "PRAGMA table_info(DiaryEntry);"

# Should show 'summary' column
# If not, restore backup and try again:
sudo systemctl stop arandor.service
cp backups/content.db.backup.TIMESTAMP data/content.db
./scripts/add-summary-column.sh
sudo systemctl start arandor.service
```

## Alternative: Use OpenRouter (Cheaper)

Instead of OpenAI, you can use OpenRouter for potentially lower costs:

```bash
# Edit .env
nano .env

# Add these lines:
OPENAI_API_KEY=sk-or-v1-YOUR-OPENROUTER-KEY
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-3.5-turbo

# Save and restart
sudo systemctl restart arandor.service
```

Get your OpenRouter key at: https://openrouter.ai/keys

## Alternative: Use Local LLM (Free)

For completely free operation, use a local LLM with Ollama:

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama2

# Start Ollama (in a separate terminal or as a service)
ollama serve

# Configure the app
nano .env

# Add these lines:
OPENAI_API_KEY=dummy
OPENAI_API_BASE=http://localhost:11434/v1
OPENAI_MODEL=llama2

# Save and restart
sudo systemctl restart arandor.service
```

## Rollback Instructions

If you need to revert to the previous version:

```bash
# Stop the service
sudo systemctl stop arandor.service

# Restore database backup
cp backups/content.db.before-ai-summary-TIMESTAMP data/content.db

# Go back to previous git commit
git log --oneline -10  # Find the commit before AI summary
git checkout COMMIT_HASH

# Rebuild
npm install
npm run build

# Remove .env file (optional)
rm .env

# Remove EnvironmentFile line from service file
sudo nano /etc/systemd/system/arandor.service
# Delete the line: EnvironmentFile=/srv/arandor/.env

# Restart
sudo systemctl daemon-reload
sudo systemctl start arandor.service
```

## Monitoring Costs

### OpenAI

Check your usage at: https://platform.openai.com/usage

**Typical costs:**
- 10 summaries/month: ~$0.01
- 50 summaries/month: ~$0.05
- 100 summaries/month: ~$0.10

### Setting Spending Limits

In OpenAI dashboard:
1. Go to Settings → Limits
2. Set a monthly budget (e.g., $5)
3. Enable email notifications

## Next Steps

Now that the AI summary feature is deployed:

1. **Generate summaries for existing entries:** Go through your old diary entries and click "Generate"
2. **Test with new entries:** Create a new diary entry and generate a summary
3. **Share with players:** Let your players know about the new feature
4. **Provide feedback:** Report any issues or suggestions

## Support & Help

If you encounter issues:

1. **Check logs:** `sudo journalctl -u arandor.service -f`
2. **Review setup guide:** See `docs/AI_SUMMARY_SETUP.md` for detailed configuration
3. **GitHub Issues:** https://github.com/danspy/arandor-companion-app/issues
4. **Test database:** `sqlite3 data/content.db .tables`

## Summary Checklist

Use this checklist to verify your deployment:

- [ ] Backed up database
- [ ] Pulled latest code
- [ ] Installed dependencies
- [ ] Ran database migration script
- [ ] Added OpenAI API key to .env file
- [ ] Secured .env file (chmod 600)
- [ ] Updated systemd service file
- [ ] Rebuilt the application
- [ ] Reloaded and restarted service
- [ ] Tested in browser - summary generates successfully
- [ ] Checked logs for errors
- [ ] Set up cost monitoring (if using OpenAI)

## Estimated Time

- **Experienced users:** 10-15 minutes
- **First-time deployments:** 20-30 minutes
- **With troubleshooting:** 30-45 minutes

## Questions?

For more details on:
- **AI configuration options:** See `docs/AI_SUMMARY_SETUP.md`
- **General deployment:** See `docs/DEPLOYMENT.md`
- **Database management:** See `docs/DEPLOYMENT.md` - Database Management section

---

**Congratulations!** 🎉 Your Arandor Companion App now has AI-powered diary summaries!
