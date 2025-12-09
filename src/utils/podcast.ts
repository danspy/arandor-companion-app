/**
 * Podcast generation utilities using Web Speech API
 * Provides text-to-speech functionality for diary entries
 */

export interface PodcastOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
}

/**
 * Prepares diary entry content for podcast narration
 * Strips markdown formatting and adds natural pauses
 */
export function preparePodcastText(title: string, content: string): string {
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

  // Add natural introduction and pauses
  const intro = `Session recording: ${title}.`;
  const outro = 'End of session recording.';
  
  // Add pauses between paragraphs (split by double line breaks)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const narration = paragraphs.join('... ');
  
  return `${intro} ${narration} ${outro}`;
}

/**
 * Note: The Web Speech API doesn't provide direct audio file generation.
 * For actual audio file generation, a server-side TTS service would be needed.
 * The functions below provide real-time speech synthesis instead.
 */

/**
 * Play podcast audio using Web Speech API
 */
export function playPodcast(
  text: string,
  options: PodcastOptions = {}
): void {
  if (!('speechSynthesis' in window)) {
    throw new Error('Text-to-speech is not supported in this browser');
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 0.9;
  utterance.pitch = options.pitch ?? 1.0;
  utterance.volume = options.volume ?? 1.0;
  
  if (options.voice) {
    utterance.voice = options.voice;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Stop currently playing podcast
 */
export function stopPodcast(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Pause currently playing podcast
 */
export function pausePodcast(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.pause();
  }
}

/**
 * Resume paused podcast
 */
export function resumePodcast(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.resume();
  }
}

/**
 * Get available voices for podcast generation
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) {
    return [];
  }
  return window.speechSynthesis.getVoices();
}

/**
 * Check if podcast is currently playing
 */
export function isPodcastPlaying(): boolean {
  if (!('speechSynthesis' in window)) {
    return false;
  }
  return window.speechSynthesis.speaking;
}
