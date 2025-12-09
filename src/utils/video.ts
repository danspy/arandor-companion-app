/**
 * Get video MIME type from URL based on file extension
 * @param url - The video URL
 * @returns The appropriate MIME type for the video format
 */
export function getVideoMimeType(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase();
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
