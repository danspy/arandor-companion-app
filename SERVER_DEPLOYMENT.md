# Server Deployment Instructions for AI Podcast Feature

This guide will help you deploy the new AI-powered podcast feature to your production server.

## ⚠️ IMPORTANT SECURITY NOTE

**NEVER commit your OpenAI API key to the repository!** Always use environment variables.

The API key you shared earlier has been exposed in this conversation. **You MUST revoke it immediately:**

1. Go to https://platform.openai.com/api-keys
2. Find the key that was shared in this session
3. Click "Revoke" to deactivate it
4. Create a new API key that you keep private

## Prerequisites

- Access to your server (e.g., via SSH)
- An OpenAI API account with credits
- The new code pulled from the `copilot/improve-german-voice-podcast` branch

## Step 1: Pull the Latest Code

SSH into your server and navigate to your project directory:

```bash
cd /path/to/arandor-companion-app

# If you're deploying from this branch directly:
git fetch origin
git checkout copilot/improve-german-voice-podcast
git pull origin copilot/improve-german-voice-podcast

# OR if the PR has been merged to main:
git checkout main
git pull origin main
```

## Step 2: Install Dependencies

The new code requires the `openai` npm package:

```bash
npm install
```

This will install all dependencies including the OpenAI SDK.

## Step 3: Set Up Environment Variables

Create or edit your `.env` file in the project root (this file should NEVER be committed to git):

```bash
nano .env  # or use your preferred editor
```

Add your OpenAI API key:

```
# OpenAI API Key for podcast generation
OPENAI_API_KEY=your-new-api-key-here

# Optional: Custom uploads directory (defaults to /srv/arandor/uploads in production)
# UPLOADS_DIR=/custom/path/to/uploads
```

**Important**: Replace `your-new-api-key-here` with your actual API key from https://platform.openai.com/api-keys

Save and exit the editor.

## Step 4: Set File Permissions

Make sure the .env file is readable only by your application user:

```bash
chmod 600 .env
chown $(whoami):$(whoami) .env
```

## Step 5: Ensure Uploads Directory Exists

The podcast audio files will be stored in `/srv/arandor/uploads/` by default:

```bash
sudo mkdir -p /srv/arandor/uploads
sudo chown $(whoami):$(whoami) /srv/arandor/uploads
sudo chmod 755 /srv/arandor/uploads
```

If you want to use a different directory, set the `UPLOADS_DIR` environment variable in your `.env` file.

## Step 6: Update Database Schema

The new feature adds a `podcastAudioUrl` column to the `DiaryEntry` table. This should be handled automatically by Astro DB during the build, but you can verify:

```bash
# Check if the column exists
sqlite3 /srv/arandor/data/content.db ".schema DiaryEntry"
```

You should see `podcastAudioUrl` in the column list. If not, Astro DB will add it during the next build.

## Step 7: Build the Application

Build the application with the database migration:

```bash
# If using the build script:
./astro-db-migrate-build.sh

# OR manually:
ASTRO_DATABASE_FILE=/srv/arandor/data/content.db npm run build
```

## Step 8: Restart the Service

Restart your Astro application service:

```bash
# If using systemd:
sudo systemctl restart arandor.service

# Verify it's running:
sudo systemctl status arandor.service

# Check logs for any errors:
sudo journalctl -u arandor.service -n 50 -f
```

## Step 9: Test the Feature

1. Open your app in a browser
2. Log in with your admin credentials
3. Navigate to any diary entry (e.g., http://yourdomain.com/diary/1)
4. You should see a "Generate Podcast" button
5. Click it and wait for generation (typically 5-10 seconds)
6. The page will reload and show an audio player

## Verification Checklist

- [ ] Code pulled from repository
- [ ] Dependencies installed (`npm install` completed)
- [ ] `.env` file created with OpenAI API key
- [ ] Uploads directory exists with proper permissions
- [ ] Application built successfully
- [ ] Service restarted without errors
- [ ] Can access the app in browser
- [ ] "Generate Podcast" button appears on diary entries (when logged in)
- [ ] Podcast generation works (audio player appears after generation)
- [ ] Generated audio file exists in uploads directory

## Troubleshooting

### "OpenAI API key not configured" Error

**Cause**: The API key environment variable is not set or not being read.

**Solution**:
```bash
# Verify the .env file exists and contains the key:
cat .env | grep OPENAI_API_KEY

# For PRODUCTION - make sure the service is restarted after creating/updating .env:
sudo systemctl restart arandor.service

# For DEVELOPMENT - stop and restart the dev server:
# Press Ctrl+C to stop, then run:
npm run dev
```

**Important Notes:**
- The `.env` file must exist BEFORE starting the server
- Changes to `.env` require a server restart to take effect
- The dev server does NOT automatically reload when `.env` changes
- Check server logs for "OpenAI API key not found" debug messages

### "Failed to generate podcast" Error

**Possible Causes**:
1. Invalid or expired API key
2. No OpenAI credits remaining
3. Network connectivity issues

**Solution**:
```bash
# Check OpenAI API key validity:
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"

# Check application logs:
sudo journalctl -u arandor.service -n 100

# Verify network connectivity:
ping -c 3 api.openai.com
```

### Audio File Not Playing

**Possible Causes**:
1. File wasn't saved to uploads directory
2. Web server can't serve files from uploads directory
3. Incorrect file path in database

**Solution**:
```bash
# Check if audio files are being created:
ls -lh /srv/arandor/uploads/

# Verify database has the URL:
sqlite3 /srv/arandor/data/content.db "SELECT id, title, podcastAudioUrl FROM DiaryEntry WHERE podcastAudioUrl IS NOT NULL;"

# Check web server configuration serves /uploads correctly
```

### Permissions Error

**Cause**: Application doesn't have write access to uploads directory.

**Solution**:
```bash
# Fix permissions:
sudo chown -R $(whoami):$(whoami) /srv/arandor/uploads
sudo chmod -R 755 /srv/arandor/uploads
```

## Cost Management

### Understanding Costs

OpenAI TTS pricing (as of December 2024):
- **tts-1** (standard): $0.015 per 1,000 characters
- **tts-1-hd** (HD quality): $0.030 per 1,000 characters

Current implementation uses `tts-1` (standard quality).

### Example Costs

- 500-word diary entry (~3,000 characters): **$0.045**
- 1,000-word diary entry (~6,000 characters): **$0.09**
- 50 diary entries (avg 500 words each): **~$2.25**

### Monitoring Usage

1. Check your OpenAI dashboard: https://platform.openai.com/usage
2. Set up billing alerts in your OpenAI account
3. Generated audio is cached, so regeneration is only needed if entry changes

### Cost Optimization Tips

1. **Don't regenerate unnecessarily**: Audio is stored and reused
2. **Set usage limits**: Configure spending limits in OpenAI dashboard
3. **Use standard quality**: `tts-1` is half the price of `tts-1-hd`
4. **Be selective**: Only generate podcasts for important entries

## Upgrading Voice Quality

If you want better voice quality, edit `/home/runner/work/arandor-companion-app/arandor-companion-app/src/pages/api/diary/[id]/generate-podcast.ts`:

```typescript
// Change from:
model: 'tts-1',

// To:
model: 'tts-1-hd',
```

This will double the cost but provide HD quality audio.

## Changing Voice

To use a different voice, edit the same file:

```typescript
// Change from:
voice: 'alloy',

// To one of:
voice: 'echo',    // Male voice
voice: 'fable',   // British accent
voice: 'onyx',    // Deep male voice
voice: 'nova',    // Female voice
voice: 'shimmer', // Softer female voice
```

After making changes, rebuild and restart:

```bash
npm run build
sudo systemctl restart arandor.service
```

## Alternative TTS Providers

If you prefer a different TTS provider, see `PODCAST_FEATURE.md` for information about:
- **ElevenLabs**: Highest quality, more expensive
- **Google Cloud TTS**: WaveNet voices, competitive pricing
- **Azure TTS**: Neural voices, Microsoft ecosystem

## Security Best Practices

1. ✅ **Never commit `.env` to git** (already in `.gitignore`)
2. ✅ **Restrict `.env` file permissions** (`chmod 600`)
3. ✅ **Use service-specific API keys** (don't reuse keys)
4. ✅ **Set OpenAI spending limits**
5. ✅ **Monitor API usage regularly**
6. ✅ **Rotate API keys periodically**

## Support

If you encounter issues:

1. Check the logs: `sudo journalctl -u arandor.service -n 100`
2. Review `PODCAST_FEATURE.md` for detailed troubleshooting
3. Verify environment variables are set correctly
4. Check OpenAI API status: https://status.openai.com/

## Rollback Plan

If you need to rollback:

```bash
# Go back to previous code version:
git checkout main  # or previous branch
git pull

# Reinstall dependencies:
npm install

# Rebuild:
npm run build

# Restart service:
sudo systemctl restart arandor.service
```

The `podcastAudioUrl` column will remain in the database but won't be used.
