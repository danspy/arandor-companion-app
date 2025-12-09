# Fix Environment Variable Loading - Step by Step

Your logs show: **"OpenAI API key not found"** - The environment variable is NOT being loaded.

## Run the Diagnostic Script First

```bash
cd /srv/arandor
bash diagnose-env.sh
```

This will tell you exactly what's wrong. Then follow the steps below.

## Step-by-Step Fix (Copy-Paste These Commands)

### Option A: If `.env` file doesn't exist

```bash
# 1. Go to the project directory
cd /srv/arandor

# 2. Create .env from template
cp .env.production .env

# 3. Edit the file
nano .env
```

In nano:
- Find the line: `OPENAI_API_KEY=REPLACE_WITH_YOUR_ACTUAL_OPENAI_API_KEY`
- Replace `REPLACE_WITH_YOUR_ACTUAL_OPENAI_API_KEY` with your actual API key
- **CRITICAL**: Do NOT add quotes! Just the key itself.
- Should look like: `OPENAI_API_KEY=sk-proj-abc123xyz...`
- Press Ctrl+X, then Y, then Enter to save

```bash
# 4. Set correct permissions
chmod 600 .env
chown deploy:deploy .env

# 5. Verify the file was created correctly
ls -l .env
cat .env   # Check the content (will show your API key - that's OK for now)
```

### Option B: If `.env` exists but systemd service not updated

```bash
# 1. Update the systemd service file
sudo cp /srv/arandor/arandor.service /etc/systemd/system/arandor.service

# 2. Verify it was copied
grep EnvironmentFile /etc/systemd/system/arandor.service
# Should show: EnvironmentFile=-/srv/arandor/.env

# 3. Reload systemd
sudo systemctl daemon-reload
```

### Final Step: Restart the Service

```bash
# Restart the service
sudo systemctl restart arandor.service

# Wait 2 seconds
sleep 2

# Check the logs
sudo journalctl -u arandor.service -n 20 --no-pager
```

## What to Look For in Logs

**If it works, you should see:**
- NO "OpenAI API key not found" messages
- Server starts without errors
- When you try to generate a podcast, it should work

**If still broken, look for:**
- "Cannot find package 'openai'" → Run `npm install && npm run build`
- "OpenAI API key not found" → The .env file format is wrong

## Common .env File Format Mistakes

### ❌ WRONG (has quotes):
```
OPENAI_API_KEY="sk-proj-abc123"
```

### ❌ WRONG (has spaces):
```
OPENAI_API_KEY = sk-proj-abc123
```

### ❌ WRONG (has export):
```
export OPENAI_API_KEY=sk-proj-abc123
```

### ❌ WRONG (still placeholder):
```
OPENAI_API_KEY=REPLACE_WITH_YOUR_ACTUAL_OPENAI_API_KEY
```

### ✅ CORRECT:
```
OPENAI_API_KEY=sk-proj-abc123xyz456def789
```

## Verify Environment Variable is Loaded

After restarting, check what environment variables systemd is passing to your app:

```bash
sudo systemctl show arandor.service --property=EnvironmentFiles
```

Should show: `EnvironmentFiles=/srv/arandor/.env (ignore_errors=yes)`

## Still Not Working?

1. **Check the .env file exists and has correct permissions:**
   ```bash
   ls -la /srv/arandor/.env
   # Should show: -rw------- 1 deploy deploy
   ```

2. **Check the content (make sure no quotes or spaces):**
   ```bash
   cat /srv/arandor/.env | grep OPENAI
   # Should show: OPENAI_API_KEY=sk-proj-...
   ```

3. **Make sure you reloaded systemd:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart arandor.service
   ```

4. **Check if the service file was actually updated:**
   ```bash
   cat /etc/systemd/system/arandor.service | grep EnvironmentFile
   # Should show: EnvironmentFile=-/srv/arandor/.env
   ```

## Why This is Different from Local Development

- **Local (works)**: Astro dev server automatically loads `.env` files using Node.js conventions
- **Production (broken)**: The compiled Node.js application doesn't load `.env` files automatically
- **Solution**: systemd's `EnvironmentFile` directive loads the file and passes variables to the process

The `-` prefix in `EnvironmentFile=-/srv/arandor/.env` means "it's OK if the file doesn't exist" - the service will start anyway, but the environment variable won't be available (which causes the podcast error).
