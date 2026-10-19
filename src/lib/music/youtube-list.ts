// Imports a YouTube playlist as separate tracks, without an API key: a temporary IFrame player
// cues the list (never plays it) and reports its video ids; the server then adds one
// youtube_video track per id (POST /api/music/playlists/:id/import). The import is a snapshot.
// YouTube's terms: the temporary player is visible (at least 200×200) while it exists.
import { loadYouTubeApi, type YTPlayer } from './youtube-backend';

export const IMPORT_LIMIT = 200; // videos per import (the server enforces it too)
// Also shown for a truncated link (the list id cut short): ids vary in length (PL…, OLAK5uy_…,
// UU…), so there is no length check; the reader just times out or gets an empty list.
const READ_ERROR = 'Could not read this YouTube playlist. Check that the link is complete (copy it via Share → Copy link) ' +
  "and that the playlist is public or unlisted — private playlists and YouTube Mixes can't be read.";
const TIMEOUT_MS = 10_000; // whole read
const LIST_WAIT_MS = 5_000; // after the first state change, wait this long for a non-empty list
const POLL_MS = 250;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Reads the video ids of a YouTube playlist with a temporary, visible player inside `host`. */
export function readYouTubePlaylistIds(listId: string, host: HTMLElement = document.body): Promise<string[]> {
  const box = document.createElement('div');
  box.className = 'mp-yt-reader';
  box.style.cssText = 'width:240px;min-width:200px;height:200px;margin-top:0.75rem;background:#000';
  const slot = document.createElement('div');
  box.append(slot);
  host.append(box);

  return new Promise((resolve, reject) => {
    let player: YTPlayer | null = null;
    let done = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    const finish = (ids: string[] | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(poll);
      try { player?.destroy(); } catch { /* already gone */ }
      box.remove();
      if (ids) resolve(ids); else reject(new Error(READ_ERROR));
    };
    const timer = setTimeout(() => finish(null), TIMEOUT_MS);
    const read = () => (player?.getPlaylist?.() ?? []).filter((id) => typeof id === 'string' && VIDEO_ID.test(id));
    const startPolling = () => {
      if (poll !== undefined || done) return;
      const until = Date.now() + LIST_WAIT_MS;
      const check = () => {
        const ids = read();
        if (ids.length) finish(ids);
        else if (Date.now() > until) finish(null);
      };
      poll = setInterval(check, POLL_MS);
      check();
    };

    loadYouTubeApi().then((YT) => {
      if (done) return;
      player = new YT.Player(slot, {
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => { if (!done) player!.cuePlaylist({ list: listId, listType: 'playlist' }); },
          onStateChange: startPolling, // the first one (normally CUED) starts reading
          onError: () => finish(null),
        },
      });
    }, () => finish(null));
  });
}

async function send(url: string, method: string, body?: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('No connection to the server');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Something went wrong. Try again.');
  return data;
}

/**
 * Imports the videos of YouTube list `listId` into playlist `playlistId` as separate tracks
 * (appended). With `replace` (a track id), that track is deleted and the new tracks take its
 * place. Returns the message for the toast;
 * throws an Error with a readable message.
 */
export async function importYouTubeList(o: {
  playlistId: string;
  listId: string;
  host: HTMLElement;
  status: (text: string) => void;
  replace?: string;
}): Promise<string> {
  o.status('Reading playlist…');
  const all = [...new Set(await readYouTubePlaylistIds(o.listId, o.host))];
  if (!all.length) throw new Error(READ_ERROR);
  const ids = all.slice(0, IMPORT_LIMIT);
  o.status(`Adding ${ids.length} ${ids.length === 1 ? 'track' : 'tracks'}…`);
  const base = `/api/music/playlists/${o.playlistId}`;
  const r = await send(`${base}/import`, 'POST', { videoIds: ids });
  if (o.replace) {
    // The new tracks were appended: move them to the old entry's place, then drop the entry
    const added = new Set<string>(r.tracks.map((t: { id: string }) => t.id));
    const order: string[] = (await send(base, 'GET')).tracks.map((t: { id: string }) => t.id).filter((id: string) => !added.has(id));
    const at = order.indexOf(o.replace);
    await send(`/api/music/tracks/${o.replace}`, 'DELETE');
    if (at >= 0) await send(`${base}/order`, 'PUT', { trackIds: [...order.slice(0, at), ...added, ...order.slice(at + 1)] });
  }
  return all.length > ids.length ? `Imported ${r.added} of ${all.length} tracks (limit ${IMPORT_LIMIT})` : `Imported ${r.added} ${r.added === 1 ? 'track' : 'tracks'}`;
}
