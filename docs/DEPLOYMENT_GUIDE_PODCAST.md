# AI Podcast Narration Feature - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the AI-powered podcast narration feature to your production server. The feature generates epic D&D narrations using OpenAI's Text-to-Speech API with realistic, professional voices.

## Prerequisites

- Access to production server via SSH
- OpenAI API key (get from https://platform.openai.com/api-keys)
- Existing Arandor Companion App installation
- SQLite3 installed on server
- Admin or Dungeon Master role in the app

## Feature Details

**What it does:**
- Generates high-quality podcast narrations for diary entries
- Automatically detects language (English/German) and selects appropriate voice
- Uses OpenAI's TTS API with professional voices (auto-detected: "alloy" for German, "onyx" for English)
- Stores audio as base64 data in database (no separate file storage needed)
- Provides HTML5 audio player for playback
- Automatically truncates long entries with localized messages
- Restricted to DM/admin roles for generation

**Recommended voices for different languages:**
- **German**: `alloy` (clear, neutral - auto-selected), `echo` (balanced)
- **English**: `onyx` (deep, epic - auto-selected), `fable` (storytelling)

## Step-by-Step Deployment

### 1. Backup Current Database

```bash
# SSH into your server
ssh your-server

# Create backup
cd /srv/arandor
mkdir -p data/backups
cp data/content.db data/backups/content.db.backup.$(date +%Y%m%d_%H%M%S)
```

### 2. Pull Latest Code

```bash
cd /srv/arandor
git pull origin main
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Database Migration

The migration script will add the `podcastAudioUrl` column to the DiaryEntry table.

```bash
# Make script executable (if not already)
chmod +x scripts/add-podcast-column.sh

# Run migration
./scripts/add-podcast-column.sh
```

The script will:
- Check if the column already exists
- Create a backup before making changes
- Add the `podcastAudioUrl` column
- Verify data integrity

### 5. Configure OpenAI API Key

Add your OpenAI API key to the `.env` file:

```bash
# Edit .env file
nano .env

# Add or update these lines:
OPENAI_API_KEY=your-api-key-here

# Optional: Configure TTS settings
OPENAI_TTS_MODEL=tts-1-hd          # Options: tts-1, tts-1-hd

# Voice selection (optional - auto-detected by default):
# If not set, voice is automatically selected based on detected language:
#   - German content: alloy (clear, neutral)
#   - English content: onyx (deep, epic)
# Options: alloy, echo, fable, onyx, nova, shimmer
# OPENAI_TTS_VOICE=onyx

OPENAI_TTS_SPEED=1.0               # Range: 0.25 to 4.0

# Save and exit (Ctrl+X, then Y, then Enter)
```

### 6. Update Service Configuration

Ensure the systemd service file loads environment variables:

```bash
# Edit service file
sudo nano /etc/systemd/system/arandor.service

# Ensure it has:
[Service]
EnvironmentFile=/srv/arandor/.env

# If you made changes, reload systemd
sudo systemctl daemon-reload
```

### 7. Rebuild Application

```bash
cd /srv/arandor
npm run build
```

### 8. Restart Service

```bash
sudo systemctl restart arandor.service
```

### 9. Verify Deployment

```bash
# Check service status
sudo systemctl status arandor.service

# Check logs for errors
sudo journalctl -u arandor.service -f -n 50
```

### 10. Test Feature

1. Open your Arandor app in browser
2. Login as admin or dungeon master
3. Open any diary entry
4. Look for "AI Podcast Narration" section
5. Click "Generate" button
6. Wait 10-30 seconds for generation
7. Audio player should appear with the podcast

## Configuration Options

### TTS Models

**tts-1** (default for OPENAI_TTS_MODEL if not set to tts-1-hd):
- Faster generation
- Lower cost (~$0.015 per 1,000 characters)
- Good quality

**tts-1-hd** (recommended):
- Higher quality audio
- Slower generation
- Higher cost (~$0.030 per 1,000 characters)
- Better for narrative content

### Voices

**Language-specific recommendations:**

The system automatically detects the language of your diary entries (currently supports English and German) and selects an appropriate voice:
- **German content**: Uses `alloy` by default (clear, neutral voice that works well for German)
- **English content**: Uses `onyx` by default (deep, epic voice)
- **Other languages**: Will default to English voice selection

You can override this automatic selection by setting `OPENAI_TTS_VOICE` in your `.env` file.

**onyx** (recommended for English D&D):
- Deep, epic voice
- Perfect for heroic fantasy narration
- Male voice
- Default for English content

**fable** (good for English storytelling):
- Storytelling voice
- Engaging and dramatic
- Neutral/male voice

**alloy** (recommended for German narration):
- Clear, neutral voice
- Works well for German language
- Balanced tone
- Default for German content

**echo** (alternative for German):
- Balanced, clear voice
- Good alternative for German content
- Neutral tone

**nova**, **shimmer**:
- Various voice options
- Female voices
- Experiment to find your preference

### Speed

- Default: 1.0 (normal speed)
- Range: 0.25 to 4.0
- 0.9 = slightly slower (more dramatic)
- 1.1 = slightly faster (more energetic)

## Cost Estimates

Based on OpenAI pricing:

**Example diary entry (2,000 characters):**
- With tts-1: ~$0.03
- With tts-1-hd: ~$0.06

**Typical campaign (50 entries):**
- With tts-1: ~$1.50
- With tts-1-hd: ~$3.00

## Troubleshooting

### "OpenAI API key not configured" error

**Solution:**
```bash
# Verify .env file has API key
cat /srv/arandor/.env | grep OPENAI_API_KEY

# Ensure service loads .env
sudo systemctl cat arandor.service | grep EnvironmentFile

# Restart service
sudo systemctl restart arandor.service
```

### "Failed to generate podcast" error

**Check logs:**
```bash
sudo journalctl -u arandor.service -f
```

**Common causes:**
- Invalid API key
- Insufficient OpenAI credits
- Network connectivity issues
- Content too long (exceeds 4,000 characters)

### Podcast button not visible

**Possible causes:**
- User doesn't have admin/DM role
- Not logged in
- JavaScript error (check browser console)

**Solution:**
```bash
# Check user role
node scripts/update-user-role.mjs username admin
```

### Database migration fails

**Restore from backup:**
```bash
cd /srv/arandor/data
cp backups/content.db.backup.YYYYMMDD_HHMMSS content.db
sudo systemctl restart arandor.service
```

## Rollback Procedure

If you need to rollback the feature:

1. **Restore database backup:**
```bash
cd /srv/arandor/data
cp backups/content.db.backup.YYYYMMDD_HHMMSS content.db
```

2. **Checkout previous version:**
```bash
cd /srv/arandor
git checkout <previous-commit-hash>
npm install
npm run build
```

3. **Restart service:**
```bash
sudo systemctl restart arandor.service
```

## Performance Notes

- Audio generation takes 10-30 seconds per entry
- Podcasts are stored as base64 in database
- Database size increases by ~100-300KB per podcast
- No separate file storage infrastructure needed
- Consider file-based storage for very large campaigns (hundreds of entries)

## Security Notes

- API keys are stored server-side only
- Never exposed to browser/client
- Generation restricted to admin/DM roles
- Podcasts visible to all users (including logged-out)
- Content is sent to OpenAI API (consider privacy implications)

## Maintenance

### Monitor Database Size

```bash
# Check database size
du -h /srv/arandor/data/content.db

# If database grows too large, consider:
# 1. Deleting old podcasts
# 2. Moving to file-based storage
# 3. Implementing podcast expiration
```

### Monitor API Usage

- Check OpenAI dashboard for usage
- Set spending limits in OpenAI account
- Monitor logs for generation frequency

## Support

If you encounter issues:

1. Check logs: `sudo journalctl -u arandor.service -f`
2. Verify database schema: `sqlite3 /srv/arandor/data/content.db "PRAGMA table_info(DiaryEntry);"`
3. Test API key: Try generating in web UI
4. Create backup before troubleshooting
5. Check GitHub issues: https://github.com/danspy/arandor-companion-app/issues

## Additional Resources

- OpenAI TTS Documentation: https://platform.openai.com/docs/guides/text-to-speech
- OpenAI Pricing: https://openai.com/pricing
- Voice Samples: https://platform.openai.com/docs/guides/text-to-speech/voice-options

---

**Version:** 1.0.0
**Last Updated:** December 2024
