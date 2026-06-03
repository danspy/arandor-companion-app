/**
 * Get video MIME type from URL based on file extension
 * @param url - The video URL
 * @returns The appropriate MIME type for the video format
 */
export function getVideoMimeType(url: string): string {
  if (!url) {
    return 'video/mp4'; // Default for empty/null URLs
  }

  // Remove query parameters and fragments to get clean file path
  const cleanUrl = url.split('?')[0].split('#')[0];
  const extension = cleanUrl.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'ogv': 'video/ogg',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'm4v': 'video/x-m4v',
  };
  
  return mimeTypes[extension || ''] || 'video/mp4'; // Default to mp4 if unknown
}

/**
 * Determine whether a media URL points to a video based on its file extension.
 * Reuses the same extension set as getVideoMimeType.
 * @param url - The media URL
 * @returns true if the URL has a known video extension
 */
export function isVideoUrl(url: string): boolean {
  if (!url) {
    return false;
  }

  const cleanUrl = url.split('?')[0].split('#')[0];
  const extension = cleanUrl.split('.').pop()?.toLowerCase();

  const videoExtensions = ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'm4v'];
  return videoExtensions.includes(extension || '');
}

/**
 * Initialize video autoplay for all videos on the page
 * This is needed for Astro View Transitions to ensure videos with the autoplay attribute play after navigation
 * Note: Only reloads videos that aren't already loaded to avoid unnecessary resource reloading
 */
export function initializeVideoAutoplay(): void {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    // Only reload if video hasn't loaded yet (prevents unnecessary resource reloading)
    if (video.readyState === 0) {
      video.load();
    }
    
    // Attempt to play the video (required after View Transitions navigation)
    video.play().catch(error => {
      // Autoplay might be blocked by browser policy, which is expected behavior
      console.debug('Video autoplay prevented:', error);
    });
  });
}
