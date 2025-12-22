# AI Image Generation for Diary Entries

## Overview

This feature enables administrators and dungeon masters to generate fantasy D&D scene illustrations for diary entries using OpenAI's DALL-E API. The system uses a **preview/approval workflow** where users can review and regenerate images before accepting them.

## Features

- **Preview Before Saving**: Generated images are shown in a modal for review before being saved
- **Regenerate Option**: Don't like the result? Generate a new version instantly
- **Automatic Prompt Generation**: Creates contextual prompts based on diary entry title, content, and optional AI summary
- **Language Detection**: Supports both English and German content with automatic language detection
- **Permission Control**: Only admin and dungeon master roles can generate images
- **Public Visibility**: Everyone can view saved images, including logged-out users

## How It Works

### Image Generation Flow

1. **User clicks "Generate Preview"** in the diary entry detail page
2. **System processes the entry**:
   - Extracts and cleans the title and content
   - Detects the language (English or German)
   - Creates a fantasy-themed prompt for DALL-E
3. **API call to OpenAI**:
   - Sends prompt to DALL-E (default: dall-e-3)
   - Receives generated image URL
4. **Preview modal opens**:
   - Shows the generated image in a full-screen modal
   - User can **Accept & Save**, **Regenerate**, or **Cancel**
5. **On Accept**:
   - Image URL is saved to `coverImageUrl` field
   - Page reloads to show the new cover image
   - Image is now visible to all users

### Image Display

AI-generated images are saved to the same `coverImageUrl` field as manually uploaded images. The system displays media in this priority:
1. Cover video (if present)
2. Cover image (manual or AI-generated)

This means AI-generated images replace any existing cover images when accepted.

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

### Generate Image Preview

```http
POST /api/diary/[id]/generate-image
```

**Authorization**: Requires admin or dungeonmaster role

**Description**: Generates an AI image preview without saving to database

**Response**:
```json
{
  "success": true,
  "imageUrl": "https://...",
  "preview": true
}
```

**Error Response**:
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

### Accept and Save Image

```http
PUT /api/diary/[id]/generate-image
```

**Authorization**: Requires admin or dungeonmaster role

**Description**: Accepts the preview and saves image URL to `coverImageUrl`

**Request Body**:
```json
{
  "imageUrl": "https://..."
}
```

**Response**:
```json
{
  "success": true,
  "entry": { ... }
}
```

## Database Schema

### DiaryEntry Table

Uses existing field:
```typescript
coverImageUrl: column.text({ optional: true })
```

AI-generated images are saved to the same field as manually uploaded images. This simplifies the data model and treats both types of images equally.

## User Interface

### Diary Detail Page

**AI Image Generation Section** (visible to admin/DM only):
- Located after the AI Summary section
- Purple-themed section with lightbulb icon
- **Generate Preview Button**: Starts the image generation process
  - Disabled during generation with "Generating..." text
  - Takes 10-30 seconds to generate

**Preview Modal**:
- Full-screen modal displaying the generated image
- Three action buttons:
  - **Accept & Save** (green): Saves image to `coverImageUrl` and reloads page
  - **Regenerate** (purple): Generates a new version
  - **Cancel** (gray): Closes modal without saving
- Click outside modal or press Cancel to dismiss

### Diary List Page

**Entry Cards**:
- Display cover images (whether manually uploaded or AI-generated)
- No visual distinction between AI-generated and manual images

## Permissions

| Action | Admin | Dungeon Master | Player | Public |
|--------|-------|----------------|--------|--------|
| Generate Preview | ✅ | ✅ | ❌ | ❌ |
| Accept Image | ✅ | ✅ | ❌ | ❌ |
| View Saved Image | ✅ | ✅ | ✅ | ✅ |

## Cost Considerations

- **DALL-E 3 Standard**: ~$0.04 per image (1024x1024)
- **DALL-E 3 HD**: ~$0.08 per image (1024x1024)
- **DALL-E 2**: ~$0.02 per image (1024x1024)

**Important Notes**:
- Each "Generate" or "Regenerate" click costs one API call
- Preview URLs from DALL-E are temporary (expire after ~1 hour)
- **✅ Images are automatically downloaded and stored permanently** when accepted
- Images are saved to the uploads folder alongside manually uploaded images
- Stored images remain accessible indefinitely

## Image Storage

When you accept an AI-generated image:
1. The system downloads the image from the temporary DALL-E URL
2. Saves it to the persistent uploads folder (`/srv/arandor/uploads` in production, `public/uploads` in development)
3. Stores the permanent local URL (`/uploads/ai-*.png`) in the database
4. The image is now stored permanently, just like manually uploaded images

This ensures:
- ✅ Images don't expire after 1 hour
- ✅ Images are reliable and always accessible
- ✅ Consistent storage for all images (manual and AI-generated)
- ✅ No dependency on external temporary URLs

## Error Handling

The system handles various error scenarios:

- **Missing API Key**: Returns error message with setup instructions
- **API Errors**: Displays OpenAI API error messages to the user
- **Network Errors**: Shows connection error with retry suggestion
- **Invalid Entry**: Returns 404 if diary entry doesn't exist
- **Download Failures**: Returns error if image cannot be downloaded or saved

## Data Integrity

### Summary and Podcast Preservation

AI-generated summaries and podcasts are **independent** of images and other diary entry fields:
- Deleting or changing an image does **not** affect the summary or podcast
- Editing a diary entry via the form preserves existing summary and podcast data
- Summary and podcast can only be deleted using their dedicated delete buttons
- This ensures your AI-generated content remains safe during other edits

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
- ~~Store generated images permanently instead of using temporary URLs~~ ✅ **Implemented**
- Support for custom prompt templates
- Batch generation for multiple entries
- Image style preferences (realistic, cartoon, painterly, etc.)
- Integration with other image generation models
- Image editing/refinement capabilities
