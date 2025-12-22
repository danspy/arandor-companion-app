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

/**
 * Detect the primary language of the text
 * @param text - The text to analyze
 * @returns Language code ('de' for German, 'en' for English). Defaults to 'en' if unclear.
 */
function detectLanguage(text: string): string {
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
 * Create a safe, abstract image prompt optimized for fantasy D&D content
 * This function creates prompts that focus on artistic style and safe themes
 * rather than potentially problematic content details
 * @param title - The title of the diary entry
 * @param contextText - Summary or content excerpt
 * @returns A sanitized prompt string
 */
function createSafeImagePrompt(title: string, contextText: string): string {
  // Extract safe themes from the content
  const themes = extractSafeThemes(`${title} ${contextText}`);
  
  // Build a safe, artistic prompt
  let prompt = 'A fantasy tabletop RPG illustration in the style of official D&D artwork. ';
  
  if (themes.length > 0) {
    // Use the extracted themes (max 3 for clarity)
    const selectedThemes = themes.slice(0, 3).join(', ');
    prompt += `The scene features: ${selectedThemes}. `;
  } else {
    // Fallback to a generic heroic fantasy scene
    prompt += 'A heroic fantasy adventure scene with adventurers in an epic setting. ';
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
  // Use summary if available, otherwise use a truncated version of the content
  const contextText = summary || cleanContent.substring(0, 500);
  
  const imagePrompt = createSafeImagePrompt(title, contextText);

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
