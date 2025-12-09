# AI-Powered Podcast Feature

## Overview

The Adventure Diary now supports natural-sounding AI-powered podcast narration using OpenAI's Text-to-Speech (TTS) API. This replaces the previous Web Speech API implementation which produced robotic voices.

## Features

- **Natural German Voice**: Uses OpenAI's TTS with the "alloy" voice model
- **On-Demand Generation**: Podcasts are generated when you click "Generate Podcast"
- **Persistent Storage**: Generated audio files are stored and reused
- **Regeneration**: Ability to regenerate podcast if the entry is updated
- **HTML5 Audio Player**: Standard audio controls for play/pause/seek

## Setup

### 1. Get an OpenAI API Key

1. Sign up or log in at [OpenAI Platform](https://platform.openai.com/)
2. Navigate to [API Keys](https://platform.openai.com/api-keys)
3. Create a new API key
4. Copy the key (it will only be shown once)

### 2. Configure the Application

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key (no quotes):

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
```

**Important formatting:**
- No quotes around the value
- No spaces around the `=` sign
- Key on a single line

### 3. Restart the Application

**CRITICAL:** You must restart the dev server after creating `.env` for changes to take effect.

For development:
```bash
npm run dev
```

For production:
```bash
# Rebuild and restart your service
npm run build
sudo systemctl restart arandor.service
```

## Usage

### Generating a Podcast

1. Log in to the application (podcast generation requires authentication)
2. Navigate to a diary entry detail page
3. Click the "Generate Podcast" button
4. Wait for generation to complete (typically 5-10 seconds)
5. The page will reload automatically and display an audio player

### Playing the Podcast

Once generated, a standard HTML5 audio player will appear with controls to:
- Play/Pause
- Seek to any position
- Adjust volume
- Download the audio file

### Regenerating a Podcast

If you edit a diary entry and want to update the podcast:

1. Log in to the application
2. Navigate to the diary entry detail page
3. Click the "Regenerate Podcast" button
4. Confirm the action
5. Wait for regeneration to complete
6. The page will reload with the updated audio

## Technical Details

### Voice Selection

The implementation uses OpenAI's `tts-1` model with the "alloy" voice. This voice:
- Supports multiple languages including German
- Provides natural-sounding speech
- Has good pronunciation and intonation

You can modify the voice by editing `/src/pages/api/diary/[id]/generate-podcast.ts` and changing the `voice` parameter. Available options:
- `alloy` (default)
- `echo`
- `fable`
- `onyx`
- `nova`
- `shimmer`

### Audio Quality

- **Model**: `tts-1` (standard quality, faster generation)
- **Format**: MP3
- **Speed**: 0.9x (slightly slower for better comprehension)
- **Cost**: Approximately $0.015 per 1000 characters

For higher quality, you can switch to `tts-1-hd` model in the API endpoint, though this will increase costs and generation time.

### Storage Location

Generated audio files are stored in:
- **Development**: `public/uploads/podcast-{entry-id}.mp3`
- **Production**: `/srv/arandor/uploads/podcast-{entry-id}.mp3`

The database stores the URL in the `podcastAudioUrl` field of the `DiaryEntry` table.

### Text Preprocessing

Before sending to the TTS API, the diary entry text is preprocessed to:
1. Remove markdown formatting
2. Remove headers, bold, italic, links, code blocks
3. Add natural pauses between paragraphs
4. Normalize whitespace

This ensures clean, natural-sounding narration.

## Cost Considerations

OpenAI TTS pricing (as of 2024):
- **tts-1**: $0.015 per 1000 characters
- **tts-1-hd**: $0.030 per 1000 characters

Example costs:
- 500-word diary entry (~3000 characters): $0.045
- 1000-word diary entry (~6000 characters): $0.090

Generated audio files are stored and reused, so you only pay once per entry unless you regenerate.

## Troubleshooting

### "OpenAI API key not configured" Error

**This is the most common issue!** The API endpoint now includes automatic `.env` file loading as a fallback.

**Step-by-step solution:**

1. **Verify `.env` file exists and has correct content:**
   ```bash
   cat .env
   ```
   Should show: `OPENAI_API_KEY=sk-proj-...` (no quotes, no extra spaces)

2. **Check file location:**
   The `.env` file MUST be in the project root directory (same folder as `package.json`)

3. **Verify format is correct:**
   - ✅ Correct: `OPENAI_API_KEY=sk-proj-abc123`
   - ❌ Wrong: `OPENAI_API_KEY="sk-proj-abc123"` (has quotes)
   - ❌ Wrong: `OPENAI_API_KEY = sk-proj-abc123` (spaces around =)
   - ❌ Wrong: `export OPENAI_API_KEY=sk-proj-abc123` (has export)

4. **Restart dev server (CRITICAL):**
   ```bash
   # Press Ctrl+C to stop, then:
   npm run dev
   ```

5. **Check server logs for debug info:**
   The API endpoint now logs detailed information about environment variables when the key is not found.

6. **Try explicit environment variable (troubleshooting):**
   ```bash
   OPENAI_API_KEY=your-actual-key npm run dev
   ```
   If this works but `.env` doesn't, there may be a file format issue.

### Generation Takes Too Long

**Possible causes**:
- Large diary entry (over 4000 words)
- OpenAI API rate limits
- Network connectivity issues

**Solutions**:
- Break very long entries into multiple sessions
- Check your OpenAI account for rate limit status
- Verify your internet connection

### "Failed to generate podcast" Error

**Check**:
1. OpenAI API key is valid and not expired
2. Your OpenAI account has available credits
3. Check the server logs for detailed error messages

### Audio File Not Playing

**Check**:
1. The audio file exists in the uploads directory
2. The file path is correct in the database
3. Your browser supports MP3 playback
4. Check browser console for errors

## Alternative Voice Providers

While this implementation uses OpenAI TTS, you can adapt it to use other providers:

### ElevenLabs
- **Pros**: Highest quality voices, excellent emotional range
- **Cons**: More expensive (~$0.30 per 1000 characters)
- **Best for**: Professional-quality narration

### Google Cloud TTS
- **Pros**: WaveNet voices, good German support, competitive pricing
- **Cons**: Requires Google Cloud account setup
- **Best for**: Enterprise deployments

### Azure TTS
- **Pros**: Neural voices, extensive language support
- **Cons**: Complex pricing structure
- **Best for**: Microsoft ecosystem integration

To switch providers, modify `/src/pages/api/diary/[id]/generate-podcast.ts` with the appropriate SDK and API calls.

## Future Enhancements

Potential improvements for the podcast feature:

1. **Voice Selection UI**: Let users choose from multiple voices
2. **Speed Control**: Allow users to adjust playback speed
3. **Background Music**: Add optional ambient music
4. **Batch Generation**: Generate podcasts for multiple entries at once
5. **Preview**: Generate a short preview before full generation
6. **Multi-language Support**: Detect entry language and select appropriate voice
7. **Voice Cloning**: Use ElevenLabs to create custom character voices

## Support

For issues or questions about the podcast feature:
1. Check the troubleshooting section above
2. Review OpenAI API documentation
3. Check application logs for error details
4. Open an issue on GitHub with relevant error messages
