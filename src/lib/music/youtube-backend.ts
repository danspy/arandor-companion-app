// Plays YouTube videos and YouTube playlists in a visible player inside #music-yt-tile
// (YouTube's terms forbid hidden audio-only playback: the store shows the tile before any
// play and whenever this backend reports PLAYING, and only hides it while idle). Same MusicBackend interface as the
// <audio> backend; the IFrame Player API script is loaded on the first load().
//
// Page changes: #music-root is persisted by ClientRouter. Chromium moves it with moveBefore()
// and the iframe keeps playing. Browsers without moveBefore() detach and re-attach it, which
// reloads the iframe and cuts the API connection; then the player is rebuilt here and resumes
// the same video at the last known time.
import type { MusicBackend } from './audio-backend';
import type { QueueTrack } from './player';

// ── Minimal typings for the parts of the IFrame Player API used here ──
interface YTPlayer {
  loadVideoById(videoId: string, startSeconds?: number): void;
  cueVideoById(videoId: string, startSeconds?: number): void;
  loadPlaylist(o: { list: string; listType: 'playlist'; index?: number; startSeconds?: number }): void;
  cuePlaylist(o: { list: string; listType: 'playlist'; index?: number; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  nextVideo(): void;
  previousVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;
  getVideoData(): { title?: string; video_id?: string };
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}
type YTNamespace = {
  Player: new (el: HTMLElement, opts: {
    width?: string | number;
    height?: string | number;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: () => void;
      onStateChange?: (e: { data: number }) => void;
      onError?: (e: { data: number }) => void;
    };
  }) => YTPlayer;
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_URL = 'https://www.youtube.com/iframe_api';
const S = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;
const UNPLAYABLE = new Set([2, 5, 100, 101, 150, 152, 153]); // bad id, HTML5 error, removed/private, no embedding
const LOAD_TIMEOUT_MS = 15_000; // load() never hangs the queue
const MAX_LIST_ERRORS = 5; // broken entries in a row inside a YouTube playlist before giving up on it
const POLL_MS = 500; // the API has no timeupdate event

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads the IFrame Player API once per page (survives page changes like the store). */
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT!);
    };
    const s = document.createElement('script');
    s.src = API_URL;
    s.async = true;
    s.onerror = () => {
      apiPromise = null; // try again on the next YouTube track
      s.remove();
      reject(new Error('YouTube API could not be loaded'));
    };
    document.head.append(s);
  });
  return apiPromise;
}

export function createYouTubeBackend(host: HTMLElement): MusicBackend {
  let alive = true;
  let player: YTPlayer | null = null;
  let ready = false;
  let track: QueueTrack | null = null;
  let volume = 0.8;
  let ytState: number = S.UNSTARTED;
  let lastPos = 0; // last known time, for resuming after an iframe reload
  let lastDur = 0;
  let playing = false; // last reported to onPlaying
  let lastTitle: string | null = null;
  let pendingLoad: (() => void) | null = null; // resolves the running load()
  let autoplayPending = false; // a load with autoplay runs: YouTube will start playing by itself
  let rebuilding = false; // until the rebuilt player plays/pauses, don't report its time
  let iframeLoads = 0;
  let swapped = false;
  let token = 0;
  let listErrors = 0;

  const isList = () => track?.kind === 'youtube_playlist';

  function finishLoad() {
    const done = pendingLoad;
    pendingLoad = null;
    autoplayPending = false;
    done?.();
  }

  function report(force = false) {
    if (!player || !ready || rebuilding) return;
    if (ytState !== S.PLAYING && ytState !== S.PAUSED && ytState !== S.BUFFERING && ytState !== S.CUED && !force) return;
    const pos = Number(player.getCurrentTime()) || 0;
    const dur = Number(player.getDuration()) || 0;
    if (!force && Math.abs(pos - lastPos) < 0.05 && dur === lastDur) return;
    lastPos = pos;
    lastDur = dur;
    backend.onTime(pos, dur);
  }

  function setPlaying(p: boolean) {
    if (p === playing) return;
    playing = p;
    backend.onPlaying?.(p);
  }

  function reportTitle() {
    if (!player || !isList()) return;
    const title = player.getVideoData?.()?.title || null;
    if (title && title !== lastTitle) {
      lastTitle = title;
      backend.onTitle?.(title);
    }
  }

  function onStateChange(e: { data: number }) {
    if (!alive) return;
    ytState = e.data;
    if (e.data === S.PLAYING || e.data === S.PAUSED || e.data === S.CUED || e.data === S.BUFFERING) {
      reportTitle();
      finishLoad();
    }
    if (e.data === S.PLAYING) {
      rebuilding = false;
      listErrors = 0;
      setPlaying(true);
      report(true);
    } else if (e.data === S.PAUSED) {
      rebuilding = false;
      setPlaying(false);
      report(true);
    } else if (e.data === S.ENDED) {
      playing = false;
      const list = player?.getPlaylist?.();
      const last = !isList() || !list?.length || (player?.getPlaylistIndex() ?? 0) >= list.length - 1;
      if (last) backend.onEnded();
    }
    // Tile visibility: a playing player must be visible; idle states let the store hide it.
    if (alive && e.data !== S.BUFFERING) backend.onActive?.(e.data === S.PLAYING);
  }

  function onError(e: { data: number }) {
    if (!alive || !UNPLAYABLE.has(e.data)) return;
    // YouTube stops at a broken playlist entry: go on inside the list, unless it was the last
    // entry or several failed in a row (then the whole list track is skipped by the queue).
    if (player && isList() && listErrors < MAX_LIST_ERRORS) {
      const list = player.getPlaylist();
      if (list?.length && player.getPlaylistIndex() < list.length - 1) {
        listErrors++;
        player.nextVideo();
        return;
      }
    }
    finishLoad();
    backend.onError();
  }

  /** Starts `t` in the player (which must be ready). */
  function cue(t: QueueTrack, at: number, autoplay: boolean, index = 0) {
    if (!player) return;
    ytState = S.UNSTARTED;
    if (t.kind === 'youtube_playlist') {
      const o = { list: t.ref, listType: 'playlist' as const, index, startSeconds: at };
      autoplay ? player.loadPlaylist(o) : player.cuePlaylist(o);
    } else {
      autoplay ? player.loadVideoById(t.ref, at) : player.cueVideoById(t.ref, at);
    }
  }

  /** Cues another entry of the current list track at its start (stays paused). */
  function cueEntry(index: number) {
    if (!track) return;
    lastPos = 0;
    lastDur = 0;
    cue(track, 0, false, index);
    backend.onTime(0, 0);
  }

  let creating: Promise<void> | null = null;
  /** A ready player, created on first use (one creation at a time). */
  function ensurePlayer(): Promise<void> {
    if (player && ready) return Promise.resolve();
    return (creating ??= createPlayer().finally(() => { creating = null; }));
  }

  /** Creates a player in the host; resolves once it is ready (or replaced by a newer one). */
  async function createPlayer(): Promise<void> {
    const YT = await loadApi();
    if (!alive) return;
    const my = ++token;
    const el = document.createElement('div');
    host.replaceChildren(el);
    ready = false;
    iframeLoads = 0;
    await new Promise<void>((resolve) => {
      player = new YT.Player(el, {
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => {
            if (my !== token) return resolve();
            ready = true;
            player!.setVolume(Math.round(volume * 100));
            resolve();
          },
          onStateChange: (e) => { if (my === token) onStateChange(e); },
          onError: (e) => { if (my === token) onError(e); },
        },
      });
      const iframe = player.getIframe?.() ?? host.querySelector('iframe');
      iframe?.addEventListener('load', () => {
        if (my !== token || !alive) return;
        iframeLoads++;
        if (iframeLoads > 1 && swapped) void rebuild();
      });
    });
  }

  /** The iframe was reloaded (moved without moveBefore): build a new player and resume. */
  async function rebuild() {
    if (!track) return;
    swapped = false;
    const t = track;
    const at = lastPos;
    const wasPlaying = playing;
    let index = 0;
    try { if (isList()) index = Math.max(0, player?.getPlaylistIndex() ?? 0); } catch { /* old player gone */ }
    rebuilding = true;
    try { player?.destroy(); } catch { /* the old iframe is already gone */ }
    player = null;
    ready = false;
    await ensurePlayer();
    if (!alive || track !== t) return;
    cue(t, at, wasPlaying, index);
  }

  const onSwap = () => { swapped = true; };
  document.addEventListener('astro:after-swap', onSwap);
  const poll = setInterval(() => { if (ytState === S.PLAYING) report(); }, POLL_MS);

  const backend: MusicBackend = {
    onEnded: () => {},
    onError: () => {},
    onTime: () => {},
    onPlaying: () => {},
    onTitle: () => {},
    onActive: () => {},
    isActive() {
      return autoplayPending || ytState === S.PLAYING || ytState === S.BUFFERING;
    },
    async load(t, at = 0, autoplay = false) {
      finishLoad();
      track = t;
      lastPos = at;
      lastDur = 0;
      lastTitle = null;
      rebuilding = false;
      listErrors = 0;
      playing = autoplay;
      autoplayPending = autoplay;
      // Settles once YouTube reports the video cued/playing, on an error, when a newer load()
      // or destroy() comes, or after a timeout - never later, so the queue can't get stuck.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          finishLoad();
          // Nothing arrived at all (e.g. an empty or unknown list id gives no event and no error)
          if (alive && track === t && !player?.getVideoData?.()?.video_id) backend.onError();
        }, LOAD_TIMEOUT_MS);
        pendingLoad = () => { clearTimeout(timer); resolve(); };
        ensurePlayer().then(
          () => { if (alive && track === t && pendingLoad) cue(t, Math.max(0, at), autoplay); },
          () => { if (alive && track === t) { finishLoad(); backend.onError(); } }, // YouTube unreachable
        );
      });
    },
    play() {
      if (player && ready) player.playVideo();
    },
    pause() {
      if (player && ready) player.pauseVideo();
    },
    seek(s) {
      if (!Number.isFinite(s)) return;
      lastPos = Math.max(0, s);
      if (!player || !ready) return;
      // seekTo() starts playback from any state except PAUSED (e.g. ENDED at the end of the
      // queue, or CUED after a paused restore). There, cue the track again at the new time.
      if (ytState === S.PLAYING || ytState === S.BUFFERING || ytState === S.PAUSED || !track) {
        player.seekTo(lastPos, true);
        return;
      }
      let index = 0;
      try { if (isList()) index = Math.max(0, player.getPlaylistIndex()); } catch { /* ignore */ }
      cue(track, lastPos, false, index);
    },
    setVolume(v) {
      volume = Math.min(1, Math.max(0, v));
      if (player && ready) player.setVolume(Math.round(volume * 100));
    },
    destroy() {
      alive = false;
      token++;
      finishLoad();
      clearInterval(poll);
      document.removeEventListener('astro:after-swap', onSwap);
      try { player?.destroy(); } catch { /* ignore */ }
      player = null;
      host.replaceChildren();
    },
    // nextVideo()/previousVideo() always start playback. While not playing, cue the entry
    // instead, so a paused list stays paused (and its hidden tile never plays).
    nextInList() {
      if (!player || !ready || !isList()) return false;
      const list = player.getPlaylist();
      const i = player.getPlaylistIndex();
      if (!list?.length || i >= list.length - 1) return false;
      if (backend.isActive!()) player.nextVideo();
      else cueEntry(i + 1);
      return true;
    },
    prevInList() {
      if (!player || !ready || !isList()) return false;
      if ((player.getCurrentTime() || 0) > 3) { // same rule as the queue: restart first
        backend.seek(0); // seekTo() would start playback from CUED/ENDED; seek() re-cues there
        backend.onTime(0, lastDur);
        return true;
      }
      const i = player.getPlaylistIndex();
      if (i <= 0) return false;
      if (backend.isActive!()) player.previousVideo();
      else cueEntry(i - 1);
      return true;
    },
  };
  return backend;
}
