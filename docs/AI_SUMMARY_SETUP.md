# AI-Powered Diary Summary Setup Guide

This guide explains how to set up and use the AI-powered automatic summary feature for diary entries.

## Overview

The AI summary feature automatically generates concise 2-3 sentence summaries of your D&D session diary entries using AI. These summaries capture:
- Key events and plot developments
- Characters met
- Locations visited
- Major accomplishments or challenges

## Features

- ✅ **On-demand generation**: Click a button to generate or regenerate summaries
- ✅ **Persistent storage**: Summaries are saved in the database
- ✅ **Flexible AI provider**: Works with OpenAI, OpenRouter, local LLMs, or any OpenAI-compatible API
- ✅ **Optional feature**: Works without configuration; generates summaries when API is configured

## Setup Instructions

### Option 1: OpenAI (Recommended for Best Quality)

1. **Get an API key** from OpenAI:
   - Go to https://platform.openai.com/api-keys
   - Sign up or log in
   - Create a new API key
   - Copy the key (starts with `sk-...`)

2. **Add to your server environment**:
   ```bash
   # On your production server
   cd /srv/arandor
   
   # Create or edit .env file
   nano .env
   
   # Add this line:
   OPENAI_API_KEY=sk-your-actual-api-key-here
   
   # Save and exit (Ctrl+X, Y, Enter)
   ```

3. **Update systemd service** to load environment variables:
   ```bash
   # Edit the service file
   sudo nano /etc/systemd/system/arandor.service
   ```
   
   Add this line in the `[Service]` section:
   ```ini
   EnvironmentFile=/srv/arandor/.env
   ```
   
   Your service file should look like:
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
   ```

4. **Restart the service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart arandor.service
   ```

5. **Test it**:
   - Open any diary entry
   - Click the "Generate" button next to "AI Summary"
   - The summary should appear in a few seconds

### Option 2: OpenRouter (Cost-Effective Alternative)

OpenRouter provides access to multiple AI models at competitive prices.

1. **Get an API key** from OpenRouter:
   - Go to https://openrouter.ai/keys
   - Sign up or log in
   - Create a new API key
   - Add credits to your account

2. **Configure environment variables**:
   ```bash
   cd /srv/arandor
   nano .env
   ```
   
   Add these lines:
   ```bash
   OPENAI_API_KEY=sk-or-v1-your-openrouter-key
   OPENAI_API_BASE=https://openrouter.ai/api/v1
   OPENAI_MODEL=openai/gpt-3.5-turbo
   ```
   
   Available models on OpenRouter:
   - `openai/gpt-3.5-turbo` (fast, cheap)
   - `openai/gpt-4` (better quality, more expensive)
   - `anthropic/claude-2` (alternative, good quality)
   - `google/palm-2-chat-bison` (Google's model)
   - Many more: https://openrouter.ai/models

3. **Restart the service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart arandor.service
   ```

### Option 3: Local LLM (Self-Hosted, Free)

Run AI models locally using Ollama (requires GPU or powerful CPU).

1. **Install Ollama** on your server:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Pull a model**:
   ```bash
   # Fast, small model (4GB RAM)
   ollama pull llama2
   
   # Or larger, better model (8GB RAM)
   ollama pull llama2:13b
   ```

3. **Start Ollama**:
   ```bash
   ollama serve
   ```
   
   Or set it up as a systemd service (recommended).

4. **Configure environment variables**:
   ```bash
   cd /srv/arandor
   nano .env
   ```
   
   Add these lines:
   ```bash
   OPENAI_API_KEY=dummy
   OPENAI_API_BASE=http://localhost:11434/v1
   OPENAI_MODEL=llama2
   ```

5. **Restart the service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart arandor.service
   ```

## Step-by-Step Production Deployment

Here's a complete guide to update your existing production server:

### Step 1: Update the Code

```bash
# SSH to your server
ssh deploy@your-server.com

# Navigate to app directory
cd /srv/arandor

# Pull the latest changes
git pull

# Install any new dependencies
npm install

# Rebuild the application
npm run build
```

### Step 2: Update the Database Schema

The summary feature adds a new `summary` column to the `DiaryEntry` table.

```bash
# Run the database update script
./scripts/update-database.sh

# This will:
# - Create a backup of your database
# - Add the new 'summary' column (safe, won't delete existing data)
# - Show you the updated schema
```

### Step 3: Configure AI API (Choose One Option)

Follow one of the setup options above (OpenAI, OpenRouter, or Local LLM).

Example for OpenAI:
```bash
# Create .env file
cd /srv/arandor
nano .env

# Add your API key
OPENAI_API_KEY=sk-your-actual-key

# Save and exit (Ctrl+X, Y, Enter)

# Secure the file
chmod 600 .env
```

### Step 4: Update Systemd Service

```bash
# Edit the service file
sudo nano /etc/systemd/system/arandor.service
```

Add the `EnvironmentFile` line:
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

### Step 5: Restart the Service

```bash
# Reload systemd to recognize changes
sudo systemctl daemon-reload

# Restart the application
sudo systemctl restart arandor.service

# Check status
sudo systemctl status arandor.service

# Check logs for any errors
sudo journalctl -u arandor.service -n 50 --no-pager
```

### Step 6: Test the Feature

1. Open your app in a browser
2. Navigate to any diary entry
3. Look for the "AI Summary" section
4. Click the "Generate" button
5. Wait a few seconds for the summary to appear

If you see an error, check:
- API key is correct in `.env`
- Service was restarted after adding `.env`
- Check logs: `sudo journalctl -u arandor.service -f`

## Usage

### Generating Summaries

1. **Open a diary entry**: Navigate to any diary entry detail page
2. **Click "Generate"**: In the "AI Summary" section, click the "Generate" button
3. **Wait**: The summary will appear in a few seconds
4. **Regenerate anytime**: Click "Regenerate" to create a new summary

### Manual Summaries

You can also add or edit summaries manually when creating/editing diary entries (future feature).

## Costs

### OpenAI Pricing (as of 2024)
- **GPT-3.5-Turbo**: ~$0.001 per summary (very cheap)
- **GPT-4**: ~$0.03 per summary (better quality)

For a typical campaign:
- 50 sessions × $0.001 = **$0.05 total** (GPT-3.5)
- 50 sessions × $0.03 = **$1.50 total** (GPT-4)

### OpenRouter Pricing
- Similar to OpenAI, sometimes cheaper
- Pay-as-you-go, no subscription required

### Local LLM
- **Free** (after initial setup)
- Requires decent hardware (GPU recommended)

## Troubleshooting

### "OpenAI API key not configured" Error

**Solution**: Add API key to `.env` file and restart service:
```bash
echo "OPENAI_API_KEY=your-key-here" > /srv/arandor/.env
chmod 600 /srv/arandor/.env
sudo systemctl restart arandor.service
```

### API Errors (401, 403)

**Cause**: Invalid or expired API key

**Solution**: 
1. Check your API key is correct
2. Verify you have credits/billing enabled (OpenAI)
3. Test the key: 
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

### Summary Not Appearing

**Cause**: JavaScript error or network issue

**Solution**:
1. Open browser developer console (F12)
2. Look for errors
3. Check network tab for failed requests
4. Verify service is running: `sudo systemctl status arandor.service`

### Slow Generation

**Cause**: 
- Slow API response
- Large diary entries
- Overloaded model

**Solution**:
- Use GPT-3.5-Turbo instead of GPT-4 (faster)
- For local LLMs: Use smaller models or add GPU
- Be patient (can take 5-10 seconds)

### Service Won't Start After Update

**Cause**: Syntax error in `.env` or service file

**Solution**:
```bash
# Check service status
sudo systemctl status arandor.service

# View detailed logs
sudo journalctl -u arandor.service -n 100 --no-pager

# Verify .env file format (no spaces around =)
cat /srv/arandor/.env
```

## Security Notes

- ✅ **API keys are server-side only**: Never exposed to browser
- ✅ **Secure .env file**: Run `chmod 600 .env` to protect the file
- ✅ **Authentication required**: Only logged-in users can generate summaries
- ⚠️ **Diary content sent to AI**: Content is sent to OpenAI/chosen provider
  - If your campaign has sensitive info, use a local LLM instead
  - Or don't use the summary feature for sensitive entries

## Alternative Configuration (Environment Variables)

Instead of `.env` file, you can add environment variables directly to the service file:

```bash
sudo nano /etc/systemd/system/arandor.service
```

Add in the `[Service]` section:
```ini
Environment="OPENAI_API_KEY=your-key-here"
Environment="OPENAI_API_BASE=https://api.openai.com/v1"
Environment="OPENAI_MODEL=gpt-3.5-turbo"
```

Then restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart arandor.service
```

## FAQ

**Q: Is this feature required?**  
A: No, it's optional. The app works fine without AI configuration. You just won't be able to generate summaries.

**Q: Can I use a different AI provider?**  
A: Yes! Any OpenAI-compatible API works. Set `OPENAI_API_BASE` to the provider's URL.

**Q: Will this work with my existing diary entries?**  
A: Yes! You can generate summaries for any existing entry.

**Q: Do I need to regenerate summaries if I edit an entry?**  
A: Summaries don't auto-update. Click "Regenerate" if you want a new summary after editing.

**Q: Can I edit the AI-generated summaries?**  
A: Not directly in the UI yet, but you can edit them via database or future updates will add this feature.

**Q: What data is sent to the AI provider?**  
A: Only the diary entry title and content. No usernames, passwords, or other sensitive data.

## Support

For issues or questions:
- GitHub Issues: https://github.com/danspy/arandor-companion-app/issues
- Check logs: `sudo journalctl -u arandor.service -f`
