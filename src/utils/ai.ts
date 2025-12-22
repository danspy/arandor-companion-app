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
 * Sanitize text for use in image prompts to reduce safety system rejections
 * @param text - The text to sanitize
 * @returns Sanitized text
 */
function sanitizeForImagePrompt(text: string): string {
  // Remove potentially problematic content while preserving the essence
  let sanitized = text
    // Remove explicit violence or graphic descriptions
    .replace(/\b(kill|murder|death|dead|dying|blood|gore|torture|weapon)\b/gi, 'encounter')
    .replace(/\b(attack|fight|battle|combat)\b/gi, 'challenge')
    // Keep fantasy-appropriate terms general
    .replace(/\b(sword|axe|dagger|blade)\b/gi, 'equipment')
    // Remove any potentially problematic character descriptions
    .replace(/\b(naked|nude|undressed)\b/gi, 'unarmored');
  
  // Trim to reasonable length
  return sanitized.substring(0, 800).trim();
}

/**
 * Create a safe image prompt optimized for fantasy D&D content
 * @param title - The title of the diary entry
 * @param contextText - Summary or content excerpt
 * @param detectedLang - Language code
 * @returns A sanitized prompt string
 */
function createSafeImagePrompt(title: string, contextText: string, detectedLang: string): string {
  const sanitizedContext = sanitizeForImagePrompt(contextText);
  const sanitizedTitle = sanitizeForImagePrompt(title);
  
  // Create a more descriptive, artistic prompt that's less likely to trigger safety filters
  // IMPORTANT: Explicitly instruct NO TEXT in the image
  return `A fantasy RPG illustration in the style of tabletop game artwork. Scene: ${sanitizedTitle}. The image should depict a heroic fantasy setting with adventurers in a mystical environment. Artistic style: painted fantasy illustration with dramatic lighting and atmospheric details. Content: ${sanitizedContext}. IMPORTANT: Do not include any text, words, letters, titles, captions, or writing in the image. Pure visual artwork only, no text overlays.`;
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
      // Add a small delay between retries to give the API a moment
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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
    error: `${lastError}. The image generation was attempted ${maxRetries + 1} times. Please try rephrasing your diary entry or try again later.`,
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
  
  // Detect the language of the content
  const detectedLang = detectLanguage(`${title} ${cleanContent}`);

  // Create a prompt for image generation
  // Use summary if available, otherwise use a truncated version of the content
  const contextText = summary || cleanContent.substring(0, 500);
  
  const imagePrompt = createSafeImagePrompt(title, contextText, detectedLang);

  return attemptImageGeneration(
    apiBase,
    apiKey,
    imageModel,
    imageSize,
    imageQuality,
    imagePrompt,
    2 // Retry up to 2 times (3 total attempts)
  );
}
