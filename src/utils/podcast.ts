/**
 * Podcast generation utilities using Web Speech API
 * Provides text-to-speech functionality for diary entries
 * 
 * IMPORTANT: This implementation generates audio ON-DEMAND in real-time.
 * - NO audio files are created or stored
 * - NO database fields needed for storing audio URLs
 * - NO server-side processing required
 * - Audio is synthesized by the browser each time the user clicks "Play"
 * 
 * For future enhancement: If you want to pre-generate and store audio files,
 * you would need to:
 * 1. Add a podcastAudioUrl column to the DiaryEntry table
 * 2. Implement a server-side TTS service to generate audio files
 * 3. Store generated files and save their URLs to the database
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

  // Add pauses between paragraphs (split by double line breaks)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const narration = paragraphs.join('... ');
  
  return narration;
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
 * Get the best German voice available
 * Prioritizes: Google voices > Microsoft voices > other German voices
 */
export function getBestGermanVoice(): SpeechSynthesisVoice | undefined {
  if (!('speechSynthesis' in window)) {
    return undefined;
  }
  
  const voices = window.speechSynthesis.getVoices();
  
  // Filter for German voices (de-DE, de-AT, de-CH)
  const germanVoices = voices.filter(voice => 
    voice.lang.startsWith('de-') || voice.lang === 'de'
  );
  
  if (germanVoices.length === 0) {
    return undefined;
  }
  
  // Prioritize Google voices (typically higher quality)
  const googleVoice = germanVoices.find(voice => 
    voice.name.toLowerCase().includes('google')
  );
  if (googleVoice) {
    return googleVoice;
  }
  
  // Then Microsoft voices
  const microsoftVoice = germanVoices.find(voice => 
    voice.name.toLowerCase().includes('microsoft')
  );
  if (microsoftVoice) {
    return microsoftVoice;
  }
  
  // Otherwise, prefer voices that are not marked as 'local' (usually better quality)
  const nonLocalVoice = germanVoices.find(voice => 
    !voice.localService
  );
  if (nonLocalVoice) {
    return nonLocalVoice;
  }
  
  // Fall back to first available German voice
  return germanVoices[0];
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
