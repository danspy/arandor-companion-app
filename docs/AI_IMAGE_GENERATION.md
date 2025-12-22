# AI Image Generation for Diary Entries

## Overview

This feature enables administrators and dungeon masters to generate fantasy D&D scene illustrations for diary entries using OpenAI's DALL-E API. Generated images are displayed alongside manually uploaded cover images and videos.

## Features

- **Automatic Prompt Generation**: Creates contextual prompts based on diary entry title, content, and optional AI summary
- **Language Detection**: Supports both English and German content with automatic language detection
- **Visual Distinction**: AI-generated images are marked with a purple "AI Generated" badge
- **Permission Control**: Only admin and dungeon master roles can generate or delete AI images
- **Public Visibility**: Everyone can view AI-generated images, including logged-out users

## How It Works

### Image Generation Flow

1. **User clicks "Generate" button** in the diary entry detail page
2. **System processes the entry**:
   - Extracts and cleans the title and content
   - Detects the language (English or German)
   - Creates a fantasy-themed prompt for DALL-E
3. **API call to OpenAI**:
   - Sends prompt to DALL-E (default: dall-e-3)
   - Receives generated image URL
4. **Database update**:
   - Stores image URL in `aiGeneratedImageUrl` field
   - Updates the entry's `updatedAt` timestamp
5. **UI updates**:
   - Displays the new image
   - Shows the delete button
   - Changes generate button to "Regenerate"

### Image Display Priority

When displaying diary entries, the system prioritizes media in this order:
1. Cover video (if present)
2. AI-generated image (if present)
3. Manually uploaded cover image (if present)

This means AI-generated images take precedence over manually uploaded images but not over videos.

## Configuration

### Required Environment Variables

```bash
# OpenAI API key (required)
OPENAI_API_KEY=your-api-key-here
```

### Optional Environment Variables

```bash
# API Base URL (default: https://api.openai.com/v1)
OPENAI_API_BASE=https://api.openai.com/v1

# Image generation model (default: dall-e-3)
# Options: dall-e-2, dall-e-3
OPENAI_IMAGE_MODEL=dall-e-3

# Image size (default: 1024x1024)
# DALL-E 2 options: 256x256, 512x512, 1024x1024
# DALL-E 3 options: 1024x1024, 1792x1024, 1024x1792
OPENAI_IMAGE_SIZE=1024x1024

# Image quality (default: standard)
# Options: standard, hd (DALL-E 3 only, increases cost)
OPENAI_IMAGE_QUALITY=standard
```

## API Endpoints

### Generate Image

```http
POST /api/diary/[id]/generate-image
```

**Authorization**: Requires admin or dungeonmaster role

**Response**:
```json
{
  "success": true,
  "imageUrl": "https://...",
  "entry": { ... }
}
```

**Error Response**:
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

### Delete AI-Generated Image

```http
DELETE /api/diary/[id]/generate-image
```

**Authorization**: Requires admin or dungeonmaster role

**Response**:
```json
{
  "success": true,
  "entry": { ... }
}
```

## Database Schema

### DiaryEntry Table

Added field:
```typescript
aiGeneratedImageUrl: column.text({ optional: true })
```

This field stores the URL of the AI-generated image. It's separate from `coverImageUrl` to distinguish between manually uploaded and AI-generated content.

## User Interface

### Diary Detail Page

**AI Image Generation Section** (visible to admin/DM only):
- Located after the AI Summary section
- Shows current status ("No AI-generated image yet" or "AI-generated image is displayed above")
- **Generate Button**: Creates a new AI-generated image
  - Disabled during generation with "Generating..." text
  - Changes to "Regenerate" after first generation
- **Delete Button**: Removes the AI-generated image
  - Only visible when an AI image exists
  - Requires confirmation before deletion

### Diary List Page

**Entry Cards**:
- Display AI-generated images with a purple "AI" badge in the top-right corner
- Badge helps users quickly identify AI-generated vs. manually uploaded images

## Permissions

| Action | Admin | Dungeon Master | Player | Public |
|--------|-------|----------------|--------|--------|
| Generate Image | ✅ | ✅ | ❌ | ❌ |
| Delete AI Image | ✅ | ✅ | ❌ | ❌ |
| View AI Image | ✅ | ✅ | ✅ | ✅ |

## Cost Considerations

- **DALL-E 3 Standard**: ~$0.04 per image (1024x1024)
- **DALL-E 3 HD**: ~$0.08 per image (1024x1024)
- **DALL-E 2**: ~$0.02 per image (1024x1024)

Images are generated on-demand and stored as URLs. The URLs are temporary (expire after ~1 hour), so you may want to:
1. Download and re-upload important images
2. Use the cover image upload feature for permanent storage

## Error Handling

The system handles various error scenarios:

- **Missing API Key**: Returns error message with setup instructions
- **API Errors**: Displays OpenAI API error messages to the user
- **Network Errors**: Shows connection error with retry suggestion
- **Invalid Entry**: Returns 404 if diary entry doesn't exist

## Implementation Details

### Language Detection

The system uses a simple word-frequency based approach:
- Counts occurrences of common German vs. English words
- Defaults to English if unclear
- Ensures prompt is generated in the appropriate language

### Prompt Engineering

Generated prompts follow this structure:
```
Create a fantasy D&D scene illustration for a session diary entry 
titled "[TITLE]". [Context in detected language]: [SUMMARY or CONTENT]. 
Style: Fantasy art, dramatic lighting, detailed environment, atmospheric. 
Focus on the key moment or location described.
```

This provides DALL-E with sufficient context while maintaining creative flexibility.

## Alternative AI Providers

The system supports OpenAI-compatible APIs through the `OPENAI_API_BASE` variable:

### OpenRouter
```bash
OPENAI_API_KEY=your-openrouter-key
OPENAI_API_BASE=https://openrouter.ai/api/v1
```

### Local Image Generation
For local solutions, you would need to set up an OpenAI-compatible API wrapper around your local image generation model (e.g., Stable Diffusion with an API layer).

## Future Enhancements

Potential improvements:
- Store generated images permanently instead of using temporary URLs
- Support for custom prompt templates
- Batch generation for multiple entries
- Image style preferences (realistic, cartoon, painterly, etc.)
- Integration with other image generation models
- Image editing/refinement capabilities
