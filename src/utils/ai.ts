/**
 * AI Utility for generating diary entry summaries
 * 
 * Uses OpenAI API (or compatible alternatives like OpenRouter, Anthropic, etc.)
 * Configure via environment variables:
 * - OPENAI_API_KEY: Your API key
 * - OPENAI_API_BASE: Optional custom base URL (default: https://api.openai.com/v1)
 * - OPENAI_MODEL: Optional model name (default: gpt-3.5-turbo)
 */

export interface SummaryResult {
  success: boolean;
  summary?: string;
  error?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export interface PodcastGenerationResult {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

// Supported languages for podcast generation
type SupportedLanguage = 'en' | 'de';

// Localized podcast truncation messages
const PODCAST_TRUNCATION_MESSAGES: Record<SupportedLanguage, string> = {
  en: '... The full session continues in the written entry.',
  de: '... Der vollständige Eintrag kann im Text nachgelesen werden.',
};

/**
 * Detect the primary language of the text
 * @param text - The text to analyze
 * @returns Language code ('de' for German, 'en' for English). Defaults to 'en' if unclear.
 */
function detectLanguage(text: string): SupportedLanguage {
  const cleanText = text.toLowerCase();
  
  // Common German words and patterns
  const germanIndicators = [
    'und', 'der', 'die', 'das', 'ist', 'ein', 'eine', 'nicht', 'mit', 'auf',
    'von', 'zu', 'für', 'den', 'dem', 'des', 'sich', 'bei', 'auch', 'nach',
    'wird', 'als', 'noch', 'über', 'wenn', 'durch', 'können', 'während'
  ];
  
  // Common English words and patterns
  const englishIndicators = [
    'the', 'and', 'was', 'that', 'with', 'they', 'were', 'have', 'this',
    'from', 'but', 'what', 'there', 'been', 'more', 'when', 'who', 'will',
    'would', 'about', 'into', 'through', 'during', 'their', 'which'
  ];
  
  let germanScore = 0;
  let englishScore = 0;
  
  // Count occurrences of language-specific words
  germanIndicators.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = cleanText.match(regex);
    if (matches) germanScore += matches.length;
  });
  
  englishIndicators.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = cleanText.match(regex);
    if (matches) englishScore += matches.length;
  });
  
  // Return language based on score (prefer German if clearly German, otherwise English)
  // This handles the user's case where they want German for production content
  return germanScore > englishScore ? 'de' : 'en';
}

/**
 * Generate a concise summary of a diary entry
 * @param title - The title of the diary entry
 * @param content - The full content of the diary entry (markdown)
 * @returns A summary of the diary entry (2-3 sentences)
 */
export async function generateDiarySummary(
  title: string,
  content: string
): Promise<SummaryResult> {
  // Use process.env for server-side API routes (import.meta.env is for build-time only)
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
  const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '150', 10);

  // Check if API key is configured
  if (!apiKey) {
    return {
      success: false,
      error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.',
    };
  }

  // Remove markdown formatting for cleaner summary
  const cleanContent = content
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/__([^_]+)__/g, '$1') // Remove bold
    .replace(/_([^_]+)_/g, '$1') // Remove italic
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
    .replace(/`([^`]+)`/g, '$1') // Remove code
    .replace(/---+/g, '') // Remove horizontal rules
    .replace(/>\s+/g, '') // Remove blockquotes
    .trim();
  
  // Detect the language of the content
  const detectedLang = detectLanguage(`${title} ${cleanContent}`);
  const languageName = detectedLang === 'de' ? 'German' : 'English';

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that creates concise summaries of D&D session diary entries. Your summaries should be 2-3 sentences long, capturing the key events, characters met, locations visited, and any major plot developments. Write in an engaging narrative style. CRITICAL: You must write your response ONLY in ${languageName}. Do not include any prefixes like "Summary:" or "Zusammenfassung:" - just write the summary text directly.`,
          },
          {
            role: 'user',
            content: `Create a 2-3 sentence summary in ${languageName} for this D&D session. Write only the summary text without any labels or prefixes:\n\nTitle: ${title}\n\nContent:\n${cleanContent}`,
          },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `API error: ${response.status} ${response.statusText}${errorData.error?.message ? ' - ' + errorData.error.message : ''}`,
      };
    }

    const data = await response.json();
    let summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      return {
        success: false,
        error: 'No summary generated from API response',
      };
    }

    // Remove common prefixes that AI might add despite instructions
    const prefixPatterns = [
      /^Summary:\s*/i,
      /^Zusammenfassung:\s*/i,
      /^Here is (?:a|the) summary:\s*/i,
      /^Hier ist (?:eine|die) Zusammenfassung:\s*/i,
    ];
    
    for (const pattern of prefixPatterns) {
      summary = summary.replace(pattern, '');
    }
    
    // Clean up and ensure it starts with capital letter
    summary = summary.trim();
    if (summary.length > 0) {
      summary = summary.charAt(0).toUpperCase() + summary.slice(1);
    }

    return {
      success: true,
      summary: summary,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Extract safe themes and elements from D&D diary content
 * Supports both English and German content
 * @param text - The text to analyze
 * @returns A list of safe, artistic themes
 */
function extractSafeThemes(text: string): string[] {
  const themes: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Location themes (safe) - English and German keywords
  if (lowerText.match(/\b(forest|wood|tree|grove|wald|baum|hain)\b/)) themes.push('forest setting');
  if (lowerText.match(/\b(mountain|peak|cliff|cave|berg|gipfel|klippe|höhle)\b/)) themes.push('mountain landscape');
  if (lowerText.match(/\b(tavern|inn|bar|taverne|gasthaus|wirtshaus|schenke)\b/)) themes.push('tavern interior');
  if (lowerText.match(/\b(castle|fortress|tower|palace|burg|festung|turm|palast|schloss)\b/)) themes.push('castle architecture');
  if (lowerText.match(/\b(dungeon|underground|crypt|kerker|verlies|gruft|krypta)\b/)) themes.push('underground chamber');
  if (lowerText.match(/\b(city|town|village|street|stadt|dorf|straße|strasse|gasse)\b/)) themes.push('medieval town');
  if (lowerText.match(/\b(temple|shrine|church|tempel|schrein|kirche|kapelle)\b/)) themes.push('temple setting');
  if (lowerText.match(/\b(ruin|ancient|old|ruine|alt|antik)\b/)) themes.push('ancient ruins');
  if (lowerText.match(/\b(ship|boat|sea|ocean|port|schiff|boot|meer|ozean|hafen)\b/)) themes.push('nautical scene');
  if (lowerText.match(/\b(desert|sand|dune|wüste|düne)\b/)) themes.push('desert landscape');
  
  // Atmosphere themes (safe) - English and German keywords
  if (lowerText.match(/\b(night|dark|shadow|moonlight|nacht|dunkel|schatten|mondlicht|mondschein)\b/)) themes.push('nighttime atmosphere');
  if (lowerText.match(/\b(magic|spell|arcane|mystical|magie|zauber|magisch|mystisch|arkane)\b/)) themes.push('magical elements');
  if (lowerText.match(/\b(fog|mist|cloudy|nebel|neblig|wolkig)\b/)) themes.push('misty atmosphere');
  if (lowerText.match(/\b(fire|flame|torch|candle|feuer|flamme|fackel|kerze)\b/)) themes.push('dramatic lighting');
  
  // Character themes (abstract, safe) - English and German keywords
  if (lowerText.match(/\b(wizard|mage|sorcerer|magier|zauberer|hexenmeister)\b/)) themes.push('spellcaster character');
  if (lowerText.match(/\b(warrior|fighter|knight|krieger|kämpfer|ritter)\b/)) themes.push('armored warrior');
  if (lowerText.match(/\b(rogue|thief|scout|schurke|dieb|kundschafter)\b/)) themes.push('stealthy figure');
  if (lowerText.match(/\b(cleric|priest|healer|kleriker|priester|heiler)\b/)) themes.push('holy character');
  if (lowerText.match(/\b(ranger|hunter|waldläufer|jäger)\b/)) themes.push('wilderness explorer');
  if (lowerText.match(/\b(bard|musician|spielmann|musiker)\b/)) themes.push('traveling performer');
  
  // General adventure themes (safe) - English and German keywords
  if (lowerText.match(/\b(journey|travel|road|path|reise|weg|pfad|straße|strasse)\b/)) themes.push('journey scene');
  if (lowerText.match(/\b(treasure|gold|artifact|item|schatz|gold|artefakt|gegenstand)\b/)) themes.push('treasure discovery');
  if (lowerText.match(/\b(map|scroll|book|karte|schriftrolle|buch)\b/)) themes.push('ancient artifacts');
  if (lowerText.match(/\b(meeting|council|gather|treffen|rat|versammlung)\b/)) themes.push('group gathering');
  
  return themes;
}

/**
 * Create a safe, contextual image prompt optimized for fantasy D&D content
 * Uses AI-generated summary when available for better context, supplemented with theme extraction
 * @param title - The title of the diary entry
 * @param contextText - Summary or content excerpt
 * @param useSummary - Whether contextText is an AI-generated summary (already safe)
 * @returns A sanitized prompt string
 */
function createSafeImagePrompt(title: string, contextText: string, useSummary: boolean = false): string {
  let prompt = 'A fantasy tabletop RPG illustration in the style of official D&D artwork. ';
  
  if (useSummary && contextText) {
    // If we have an AI-generated summary, use it directly as it's already clean and contextual
    prompt += `Scene description: ${contextText}. `;
  } else {
    // Otherwise, fall back to theme extraction for safety
    const themes = extractSafeThemes(`${title} ${contextText}`);
    
    if (themes.length > 0) {
      // Use the extracted themes (max 3 for clarity)
      const selectedThemes = themes.slice(0, 3).join(', ');
      prompt += `The scene features: ${selectedThemes}. `;
    } else {
      // Fallback to a generic heroic fantasy scene
      prompt += 'A heroic fantasy adventure scene with adventurers in an epic setting. ';
    }
  }
  
  // Add artistic direction
  prompt += 'Artistic style: professional fantasy illustration with cinematic composition, dramatic lighting, rich colors, and atmospheric depth. ';
  prompt += 'The scene should evoke a sense of adventure, mystery, and heroic fantasy. ';
  
  // Critical: No text in image
  prompt += 'IMPORTANT: Do not include any text, words, letters, numbers, titles, captions, labels, or written language anywhere in the image. Pure visual artwork only, no text overlays or inscriptions.';
  
  return prompt;
}

/**
 * Attempt to generate an image with retry logic for safety system errors
 * @param apiBase - API base URL
 * @param apiKey - API key
 * @param imageModel - Image model to use
 * @param imageSize - Image size
 * @param imageQuality - Image quality
 * @param imagePrompt - Image prompt
 * @param maxRetries - Maximum number of retry attempts
 * @returns ImageGenerationResult
 */
async function attemptImageGeneration(
  apiBase: string,
  apiKey: string,
  imageModel: string,
  imageSize: string,
  imageQuality: string,
  imagePrompt: string,
  maxRetries: number = 2
): Promise<ImageGenerationResult> {
  let lastError = '';
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add exponential backoff delay between retries
      if (attempt > 0) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = await fetch(`${apiBase}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: imagePrompt,
          n: 1,
          size: imageSize,
          quality: imageQuality,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || '';
        lastError = `API error: ${response.status} ${response.statusText}${errorMessage ? ' - ' + errorMessage : ''}`;
        
        // Check if this is a safety system error that can be retried
        const isSafetyError = response.status === 400 && 
          (errorMessage.toLowerCase().includes('safety system') || 
           errorMessage.toLowerCase().includes('content policy'));
        
        if (isSafetyError && attempt < maxRetries) {
          // This is a retryable error, continue to next attempt
          continue;
        }
        
        // Non-retryable error or max retries reached
        return {
          success: false,
          error: lastError,
        };
      }

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url;

      if (!imageUrl) {
        return {
          success: false,
          error: 'No image URL generated from API response',
        };
      }

      return {
        success: true,
        imageUrl: imageUrl,
      };
    } catch (error) {
      lastError = `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      // Network errors might be worth retrying
      if (attempt < maxRetries) {
        continue;
      }
    }
  }
  
  // All retries exhausted
  return {
    success: false,
    error: `${lastError}. The image generation was attempted ${maxRetries + 1} times. This may be due to content restrictions. Please try again later.`,
  };
}

/**
 * Generate an AI image for a diary entry
 * @param title - The title of the diary entry
 * @param content - The full content of the diary entry (markdown)
 * @param summary - Optional AI-generated summary to provide context
 * @returns URL to the generated image
 */
export async function generateDiaryImage(
  title: string,
  content: string,
  summary?: string
): Promise<ImageGenerationResult> {
  // Use process.env for server-side API routes
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  const imageModel = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3';
  const imageSize = process.env.OPENAI_IMAGE_SIZE || '1024x1024';
  const imageQuality = process.env.OPENAI_IMAGE_QUALITY || 'standard';

  // Check if API key is configured
  if (!apiKey) {
    return {
      success: false,
      error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.',
    };
  }

  // Remove markdown formatting for cleaner prompt generation
  const cleanContent = content
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/__([^_]+)__/g, '$1') // Remove bold
    .replace(/_([^_]+)_/g, '$1') // Remove italic
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
    .replace(/`([^`]+)`/g, '$1') // Remove code
    .replace(/---+/g, '') // Remove horizontal rules
    .replace(/>\s+/g, '') // Remove blockquotes
    .trim();

  // Create a prompt for image generation
  // Prefer using the AI-generated summary if available (it's already safe and contextual)
  // Otherwise fall back to truncated content with theme extraction
  const contextText = summary || cleanContent.substring(0, 500);
  const useSummary = !!summary; // Use summary directly if available
  
  const imagePrompt = createSafeImagePrompt(title, contextText, useSummary);

  return attemptImageGeneration(
    apiBase,
    apiKey,
    imageModel,
    imageSize,
    imageQuality,
    imagePrompt,
    2 // Max retries after initial attempt (3 total attempts)
  );
}

/**
 * Prepare diary entry content for podcast narration
 * Strips markdown formatting and creates natural narrative flow
 * @param title - The title of the diary entry
 * @param content - The full content of the diary entry (markdown)
 * @returns Cleaned text suitable for TTS narration
 */
function preparePodcastNarration(title: string, content: string): string {
  // Remove markdown formatting
  let text = content
    // Remove headers
    .replace(/#{1,6}\s+/g, '')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove code blocks
    .replace(/`([^`]+)`/g, '$1')
    // Remove horizontal rules
    .replace(/---+/g, '')
    // Remove blockquotes
    .replace(/>\s+/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Add introductory narration with title
  const narration = `${title}. ${text}`;
  
  return narration;
}

/**
 * Generate an AI-powered narrative summary optimized for podcast narration
 * The narrator recollects what happened in the session and acts out highlights
 * @param title - The title of the diary entry
 * @param content - The full content of the diary entry (markdown)
 * @param targetLanguage - The detected language for the narration
 * @returns AI-generated narrative suitable for podcast TTS
 */
async function generatePodcastNarrative(
  title: string,
  content: string,
  targetLanguage: SupportedLanguage
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

  if (!apiKey) {
    // Fall back to simple narration if no API key
    return null;
  }

  // Clean the content for AI processing
  const cleanContent = preparePodcastNarration(title, content);
  
  // Define language-specific instructions
  const languageName = targetLanguage === 'de' ? 'German' : 'English';
  const languageInstruction = targetLanguage === 'de' 
    ? 'Du MUSST ausschließlich auf Deutsch antworten.'
    : 'You MUST respond exclusively in English.';
  
  // System prompt for creating engaging podcast narration
  const systemPrompt = `You are a skilled D&D storyteller and podcast narrator. Your role is to recollect and narrate what happened in a D&D session in an engaging, dramatic way. 

CRITICAL REQUIREMENTS:
1. ${languageInstruction}
2. You are narrating directly to the audience - speak as if you're recounting the adventure
3. Act out highlights with vivid descriptions and emotional delivery
4. Focus on the key moments: battles, discoveries, character interactions, plot twists
5. Use present tense for immediacy and engagement ("The party enters..." not "The party entered...")
6. Add dramatic pauses with ellipses (...) for effect
7. Keep it engaging but concise - aim for 2-4 minutes of narration (approximately 300-800 words)
8. DO NOT include ANY meta-commentary, labels, or prefixes - dive straight into the narration
9. Make it feel like an epic recap of the adventure

STYLE GUIDELINES:
- Be enthusiastic and dramatic where appropriate
- Vary your pacing - quick for action, slower for tension
- Highlight character names and important locations
- Build suspense and drama
- End with a hook or reflection on what happened

Remember: This will be read aloud by text-to-speech, so write in a natural, spoken style.`;

  const userPrompt = targetLanguage === 'de'
    ? `Erzähle diese D&D-Sitzung als spannende Podcast-Episode nach. Erinnere dich lebhaft daran, was passiert ist, und hebe die wichtigsten Momente hervor:\n\nTitel: ${title}\n\nSession-Details:\n${cleanContent}`
    : `Narrate this D&D session as an engaging podcast episode. Recollect what happened and act out the key highlights:\n\nTitle: ${title}\n\nSession Details:\n${cleanContent}`;

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.8, // Higher temperature for more creative narration
        max_tokens: 2000, // Allow longer narratives
      }),
    });

    if (!response.ok) {
      console.error('Failed to generate podcast narrative:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    const narrative = data.choices?.[0]?.message?.content?.trim();

    if (!narrative) {
      return null;
    }

    return narrative;
  } catch (error) {
    console.error('Error generating podcast narrative:', error);
    return null;
  }
}

// OpenAI TTS API has a maximum limit of 4096 characters per request
// Note: For future enhancement, consider implementing multi-chunk support
// to handle longer texts by splitting into multiple API requests
const TTS_MAX_CHARACTERS = 4096;

/**
 * Generate an AI-powered podcast narration for a diary entry
 * Uses OpenAI's Text-to-Speech API with high-quality voices
 * 
 * The podcast features an AI-generated narrative summary where the narrator
 * recollects what happened in the session and acts out highlights, creating
 * an engaging 2-4 minute recap in the original language of the content.
 * 
 * Note: The audio is returned as a base64 data URL and stored in the database.
 * This approach keeps the implementation simple without requiring file storage infrastructure.
 * For very large campaigns with many podcasts, consider implementing file-based storage.
 * 
 * @param title - The title of the diary entry
 * @param content - The full content of the diary entry (markdown)
 * @returns Base64 data URL of the generated audio (stored in database)
 */
export async function generateDiaryPodcast(
  title: string,
  content: string
): Promise<PodcastGenerationResult> {
  // Use process.env for server-side API routes
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  const ttsModel = process.env.OPENAI_TTS_MODEL || 'tts-1-hd';
  const ttsSpeed = parseFloat(process.env.OPENAI_TTS_SPEED || '1.0');

  // Check if API key is configured
  if (!apiKey) {
    return {
      success: false,
      error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.',
    };
  }
  
  // Detect language for proper voice selection and narrative generation
  const detectedLang = detectLanguage(`${title} ${content}`);

  // Generate an engaging AI narrative for the podcast
  // This creates a dramatic recap where the narrator recollects the session highlights
  let narrationText = await generatePodcastNarrative(title, content, detectedLang);
  
  // Fallback to simple narration if AI generation fails
  if (!narrationText) {
    console.warn('AI narrative generation failed, falling back to simple narration');
    narrationText = preparePodcastNarration(title, content);
  }

  // Select appropriate TTS voice based on language
  // If OPENAI_TTS_VOICE is set, it takes priority; otherwise, auto-detect
  let ttsVoice = process.env.OPENAI_TTS_VOICE;
  if (!ttsVoice) {
    // Auto-select voice based on detected language
    // German content: "alloy" works well for German pronunciation
    // English content: "onyx", "fable", etc. are good choices
    ttsVoice = detectedLang === 'de' ? 'alloy' : 'onyx';
  }

  // Truncate if content exceeds OpenAI TTS character limit
  let finalText = narrationText;
  if (narrationText.length > TTS_MAX_CHARACTERS) {
    // Use localized truncation message based on detected language
    const truncationMessage = PODCAST_TRUNCATION_MESSAGES[detectedLang];
    // Ensure the final text (content + truncation message) doesn't exceed the limit
    const maxContentLength = Math.max(0, TTS_MAX_CHARACTERS - truncationMessage.length);
    finalText = narrationText.substring(0, maxContentLength) + truncationMessage;
  }

  try {
    const response = await fetch(`${apiBase}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ttsModel,
        input: finalText,
        voice: ttsVoice,
        speed: ttsSpeed,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `API error: ${response.status} ${response.statusText}${errorData.error?.message ? ' - ' + errorData.error.message : ''}`,
      };
    }

    // Get the audio data as a buffer
    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64 data URL for storage/playback
    // This keeps the audio in memory without requiring file system storage
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

    return {
      success: true,
      audioUrl: audioDataUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to generate podcast: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
