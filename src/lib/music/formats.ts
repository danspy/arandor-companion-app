// Allowed audio uploads for the music player. Pure: no DB imports.
export const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/mp4',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
  flac: 'audio/flac',
  wav: 'audio/wav',
};

export const MAX_AUDIO_BYTES = 52428800;

export function audioFileCheck(
  name: string,
  size: number,
): { ok: true; ext: string; title: string } | { ok: false; error: string } {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  if (!Object.prototype.hasOwnProperty.call(AUDIO_MIME, ext)) {
    return { ok: false, error: `Unsupported format (allowed: ${Object.keys(AUDIO_MIME).join(', ')})` };
  }
  if (size > MAX_AUDIO_BYTES) return { ok: false, error: 'File is larger than 50 MB' };
  return { ok: true, ext, title: name.slice(0, dot).trim() };
}
