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
  const apiKey = import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const apiBase = import.meta.env.OPENAI_API_BASE || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  const model = import.meta.env.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

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
            content: 'You are a helpful assistant that creates concise summaries of D&D session diary entries. Your summaries should be 2-3 sentences long, capturing the key events, characters met, locations visited, and any major plot developments. Write in an engaging narrative style.',
          },
          {
            role: 'user',
            content: `Please create a concise 2-3 sentence summary of this D&D session diary entry:\n\nTitle: ${title}\n\nContent:\n${cleanContent}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 150,
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
    const summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      return {
        success: false,
        error: 'No summary generated from API response',
      };
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
