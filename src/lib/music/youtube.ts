// YouTube link parsing and title lookup. Pure: no DB imports.
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]+$/;

export function parseYouTubeUrl(input: string): { videoId?: string; listId?: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  let videoId: string | undefined;
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') {
    videoId = parts[0];
  } else if (parts[0] === 'watch') {
    videoId = url.searchParams.get('v') ?? undefined;
  } else if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
    videoId = parts[1];
  }
  const list = url.searchParams.get('list') ?? undefined;

  const out: { videoId?: string; listId?: string } = {};
  if (videoId !== undefined) {
    if (!VIDEO_ID.test(videoId)) return null;
    out.videoId = videoId;
  }
  if (list !== undefined && LIST_ID.test(list)) out.listId = list;
  return out.videoId || out.listId ? out : null;
}

export async function fetchYouTubeTitle(url: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.title === 'string' && data.title ? data.title : null;
  } catch {
    return null;
  }
}
