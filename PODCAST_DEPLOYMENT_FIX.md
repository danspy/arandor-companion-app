# Quick Fix: Podcast Generation Error on Server

## Problem
The podcast generation feature shows "Error: Failed to generate podcast. Please try again." on your production server, even though it works locally.

## Root Cause
The systemd service wasn't loading the `.env` file containing your OpenAI API key. The service runs the compiled server directly, which doesn't automatically load environment variables like the development server does.

## Solution Steps

Follow these steps on your server at `/srv/arandor`:

### Step 1: Pull the Latest Code

```bash
cd /srv/arandor
git pull origin main  # or the branch name
```

### Step 2: Create the `.env` File

The systemd service now looks for environment variables in `/srv/arandor/.env`.

```bash
cd /srv/arandor

# Copy the template
cp .env.production .env

# Edit the file
nano .env
```

### Step 3: Add Your OpenAI API Key

In the `.env` file, replace `REPLACE_WITH_YOUR_ACTUAL_OPENAI_API_KEY` with your actual API key:

```
OPENAI_API_KEY=sk-proj-abc123xyz...
```

**CRITICAL FORMAT RULES:**
- ✅ No quotes: `OPENAI_API_KEY=sk-proj-abc123`
- ❌ Wrong: `OPENAI_API_KEY="sk-proj-abc123"` (has quotes)
- ❌ Wrong: `OPENAI_API_KEY = sk-proj-abc123` (has spaces)

Save and exit (Ctrl+X, then Y, then Enter in nano).

### Step 4: Set Proper File Permissions

```bash
chmod 600 /srv/arandor/.env
chown deploy:deploy /srv/arandor/.env
```

This ensures only the deploy user can read your API key.

### Step 5: Update the Systemd Service File

```bash
# Copy the updated service file
sudo cp /srv/arandor/arandor.service /etc/systemd/system/arandor.service

# Reload systemd to recognize the changes
sudo systemctl daemon-reload
```

### Step 6: Restart the Service

```bash
sudo systemctl restart arandor.service
```

### Step 7: Verify the Service is Running

```bash
sudo systemctl status arandor.service
```

You should see "Active: active (running)".

### Step 8: Check the Logs

```bash
sudo journalctl -u arandor.service -n 50 --no-pager
```

Look for any errors. If you see "OpenAI API key not found", double-check your `.env` file.

### Step 9: Test the Podcast Feature

1. Go to your website
2. Log in
3. Navigate to a diary entry
4. Click "Generate Podcast"
5. Wait for generation (typically 5-10 seconds)
6. The page should reload with an audio player

## Verification Checklist

- [ ] Code pulled from repository
- [ ] `.env` file created at `/srv/arandor/.env`
- [ ] OpenAI API key added (without quotes)
- [ ] File permissions set to 600
- [ ] File owned by deploy:deploy
- [ ] Systemd service file updated
- [ ] Systemd daemon reloaded
- [ ] Service restarted
- [ ] Service is running (check with `systemctl status`)
- [ ] Logs show no "OpenAI API key not found" errors
- [ ] Podcast generation works in browser

## What Changed

1. **`arandor.service`**: Added `EnvironmentFile=-/srv/arandor/.env` to load environment variables
2. **Error handling**: Improved to show better error messages if something goes wrong
3. **Documentation**: Updated with clearer instructions

## Troubleshooting

### Still getting "OpenAI API key not configured" error?

1. Verify the file exists:
   ```bash
   ls -la /srv/arandor/.env
   ```

2. Check the content:
   ```bash
   cat /srv/arandor/.env
   ```

3. Verify the systemd service file has the EnvironmentFile line:
   ```bash
   grep EnvironmentFile /etc/systemd/system/arandor.service
   ```
   Should show: `EnvironmentFile=-/srv/arandor/.env`

4. Check the service logs for detailed error messages:
   ```bash
   sudo journalctl -u arandor.service -f
   ```
   Then try generating a podcast again and watch the logs.

### Getting "Failed to generate podcast with OpenAI" error?

This means the API key is loaded but the OpenAI API call is failing. Check:

1. **API key is valid**: Log into https://platform.openai.com/api-keys and verify your key exists
2. **API key has correct format**: Should start with `sk-proj-` or `sk-`
3. **Account has credits**: Check https://platform.openai.com/usage
4. **Network connectivity**: From your server, test: `ping api.openai.com`

### Error shows in browser with details?

The error messages now include details. Common ones:

- "OpenAI API key not configured": The `.env` file isn't being loaded
- "Failed to generate podcast with OpenAI": The API call failed (check API key and credits)
- "Diary entry not found": Wrong entry ID (shouldn't happen in normal use)
- "Unauthorized": Not logged in

## Need More Help?

1. Check the full documentation: `SERVER_DEPLOYMENT.md`
2. Review the podcast feature documentation: `PODCAST_FEATURE.md`
3. Check server logs: `sudo journalctl -u arandor.service -n 100`
4. Check OpenAI API status: https://status.openai.com/

## Security Note

**NEVER commit your `.env` file to git!** It contains your API key. The file is already in `.gitignore` to prevent this, but always double-check before committing.
