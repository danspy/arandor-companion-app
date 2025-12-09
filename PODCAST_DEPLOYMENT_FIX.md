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

### Step 2: Install Dependencies

**CRITICAL**: The podcast feature requires the `openai` npm package. You must install dependencies:

```bash
cd /srv/arandor
npm install
```

This will install the `openai` package and any other new dependencies.

### Step 3: Build the Application

```bash
cd /srv/arandor
npm run build
```

This compiles the application with the new dependencies.

### Step 4: Create the `.env` File

The systemd service now looks for environment variables in `/srv/arandor/.env`.

```bash
cd /srv/arandor

# Copy the template
cp .env.production .env

# Edit the file
nano .env
```

### Step 5: Add Your OpenAI API Key

In the `.env` file, replace `REPLACE_WITH_YOUR_ACTUAL_OPENAI_API_KEY` with your actual API key:

```
OPENAI_API_KEY=sk-proj-abc123xyz...
```

**CRITICAL FORMAT RULES:**
- ✅ No quotes: `OPENAI_API_KEY=sk-proj-abc123`
- ❌ Wrong: `OPENAI_API_KEY="sk-proj-abc123"` (has quotes)
- ❌ Wrong: `OPENAI_API_KEY = sk-proj-abc123` (has spaces)

Save and exit (Ctrl+X, then Y, then Enter in nano).

### Step 6: Set Proper File Permissions

```bash
chmod 600 /srv/arandor/.env
chown deploy:deploy /srv/arandor/.env
```

This ensures only the deploy user can read your API key.

### Step 7: Update the Systemd Service File

```bash
# Copy the updated service file
sudo cp /srv/arandor/arandor.service /etc/systemd/system/arandor.service

# Reload systemd to recognize the changes
sudo systemctl daemon-reload
```

### Step 8: Restart the Service

```bash
sudo systemctl restart arandor.service
```

### Step 9: Verify the Service is Running

```bash
sudo systemctl status arandor.service
```

You should see "Active: active (running)".

### Step 10: Check the Logs

```bash
sudo journalctl -u arandor.service -n 50 --no-pager
```

Look for any errors:
- If you see "Cannot find package 'openai'", you need to run `npm install` (Step 2)
- If you see "OpenAI API key not found", double-check your `.env` file (Step 4-6)

### Step 11: Test the Podcast Feature

1. Go to your website
2. Log in
3. Navigate to a diary entry
4. Click "Generate Podcast"
5. Wait for generation (typically 5-10 seconds)
6. The page should reload with an audio player

## Verification Checklist

- [ ] Code pulled from repository
- [ ] **Dependencies installed with `npm install`** ← CRITICAL!
- [ ] **Application rebuilt with `npm run build`** ← CRITICAL!
- [ ] `.env` file created at `/srv/arandor/.env`
- [ ] OpenAI API key added (without quotes)
- [ ] File permissions set to 600
- [ ] File owned by deploy:deploy
- [ ] Systemd service file updated
- [ ] Systemd daemon reloaded
- [ ] Service restarted
- [ ] Service is running (check with `systemctl status`)
- [ ] Logs show no "Cannot find package 'openai'" errors
- [ ] Logs show no "OpenAI API key not found" errors
- [ ] Podcast generation works in browser

## What Changed

1. **`arandor.service`**: Added `EnvironmentFile=-/srv/arandor/.env` to load environment variables
2. **Error handling**: Improved to show better error messages if something goes wrong
3. **Documentation**: Updated with clearer instructions

## Troubleshooting

### Getting "Cannot find package 'openai'" error?

**This means you didn't install the dependencies!**

The podcast feature requires the `openai` npm package. You MUST run:

```bash
cd /srv/arandor
npm install
npm run build
sudo systemctl restart arandor.service
```

**Why this happens:**
- The `openai` package was added in this update
- `npm install` downloads and installs it to `node_modules/`
- Without it, the server crashes when trying to import the package

After running these commands, check the logs again:
```bash
sudo journalctl -u arandor.service -n 20
```

The "Cannot find package 'openai'" error should be gone.

### Still getting "OpenAI API key not configured" error?

**This means the environment variable is NOT being loaded by systemd.**

1. **Verify the .env file exists:**
   ```bash
   ls -la /srv/arandor/.env
   ```
   If it doesn't exist, you skipped Step 4. Create it now.

2. **Check the .env file content:**
   ```bash
   cat /srv/arandor/.env
   ```
   Should show something like:
   ```
   OPENAI_API_KEY=sk-proj-abc123...
   ```
   
   **Common mistakes:**
   - ❌ File is empty or has placeholder text
   - ❌ Has quotes: `OPENAI_API_KEY="sk-proj..."` (REMOVE QUOTES!)
   - ❌ Has spaces: `OPENAI_API_KEY = sk-proj...` (REMOVE SPACES!)
   - ❌ Has export: `export OPENAI_API_KEY=...` (REMOVE export!)

3. **Verify file permissions:**
   ```bash
   ls -l /srv/arandor/.env
   ```
   Should show: `-rw------- 1 deploy deploy` (600 permissions)

4. **Verify the systemd service file is updated:**
   ```bash
   grep EnvironmentFile /etc/systemd/system/arandor.service
   ```
   Should show: `EnvironmentFile=-/srv/arandor/.env`
   
   If NOT shown, run Step 7 again to copy the service file.

5. **Verify systemd was reloaded:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart arandor.service
   ```

6. **Test if environment variable is visible to the service:**
   ```bash
   # Check what environment variables the service can see
   sudo systemctl show arandor.service | grep -i environment
   ```
   
   If the .env file is correctly formatted, you should see your OPENAI_API_KEY listed.

7. **Check the service logs:**
   ```bash
   sudo journalctl -u arandor.service -n 50
   ```
   Look for the debug output showing where it checked for the API key.

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
