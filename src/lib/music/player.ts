// The site-wide music player: one store per browser tab, shared by every view (mini bar,
// Tools → Music, dashboard, DM screen). Views call the methods below and listen for
// `music:state` on `document`; none of them touch the <audio> element directly.
//
// The store lives as long as the page does. Thanks to ClientRouter and the persisted
// #music-root it survives page changes; after a full page load it is rebuilt from
// localStorage `arandor.music` and comes back paused (never autoplays).
//
// With nothing else in the queue, the site playlist ("Tavern music") is cued: loaded paused,
// so one press on play starts it. A cued queue is never saved; it is cued afresh on each load.
import { createAudioBackend, type MusicBackend } from './audio-backend';
import { createYouTubeBackend } from './youtube-backend';

export type QueueTrack = { id: string; kind: 'file' | 'youtube_video' | 'youtube_playlist'; title: string; ref: string };

export type MusicState = {
  source: { playlistId: string; name: string } | null;
  queue: QueueTrack[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  /** True while the current track is a YouTube one that plays or is about to play (loading
   *  after a play request, buffering, playing): its video tile is shown. False while paused,
   *  cued after a restore, ended or stopped, and for file tracks. Set before any YouTube play. */
  youtubeVisible: boolean;
  /** Inside a YouTube playlist track: the title of the video playing now, else null. */
  videoTitle: string | null;
  /** The queue is the site playlist, cued automatically while nothing else was loaded and not
   *  played yet. Views treat it as "nothing chosen"; it is never saved. */
  cued: boolean;
};

export type RepeatMode = MusicState['repeat'];

export interface MusicStore {
  getState(): MusicState;
  /** Replaces the queue with a playlist and starts playing it.
   *  With `opts.shuffle` the whole list is shuffled (startIndex is ignored) and shuffle mode is
   *  switched on. If shuffle mode is already on, the track at startIndex plays first and the
   *  rest follows in random order. */
  playPlaylist(p: { id: string; name: string; tracks: QueueTrack[] }, startIndex?: number, opts?: { shuffle?: boolean }): void;
  play(): void;
  pause(): void;
  toggle(): void;
  next(): void;
  prev(): void;
  /** Jumps to a queue entry and plays it (used by queue lists). */
  jump(index: number): void;
  seek(sec: number): void;
  setVolume(v: number): void;
  setShuffle(b: boolean): void;
  setRepeat(m: RepeatMode): void;
  /** Stops playback and clears the queue; the site playlist is then cued again (paused). */
  stop(): void;
}

declare global {
  interface Window {
    __music: MusicStore;
  }
}

/** m:ss (h:mm:ss from an hour up) */
export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const MUSIC_STATE_EVENT = 'music:state';
/** Dispatched on `document` whenever someone asks for playback (play, a playlist, a queue entry,
 *  media keys), wherever it came from; the player opens on it. Not for automatic track changes. */
export const MUSIC_PLAY_EVENT = 'music:play';
const STORAGE_KEY = 'arandor.music';
const TIME_EMIT_MS = 250; // time updates: at most 4 events per second
const SAVE_TIME_MS = 5000; // position-only changes: saved at most every 5 seconds
const PREV_RESTARTS_AFTER = 3; // seconds: "previous" restarts the track when past this point

type Saved = Partial<Pick<MusicState, 'volume' | 'shuffle' | 'repeat' | 'source' | 'queue' | 'index' | 'position'>>;

function readSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function shuffled<T>(list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isTrack = (t: any): t is QueueTrack =>
  t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.ref === 'string' &&
  (t.kind === 'file' || t.kind === 'youtube_video' || t.kind === 'youtube_playlist');

const pickTracks = (p: any): QueueTrack[] =>
  (Array.isArray(p?.tracks) ? p.tracks : []).filter(isTrack).map(({ id, kind, title, ref }: QueueTrack) => ({ id, kind, title, ref }));

function createStore(): MusicStore {
  const saved = readSaved();
  const state: MusicState = {
    source: null,
    queue: [],
    index: 0,
    playing: false,
    position: 0,
    duration: 0,
    volume: typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : 0.8,
    shuffle: saved.shuffle === true,
    repeat: saved.repeat === 'all' || saved.repeat === 'one' ? saved.repeat : 'off',
    youtubeVisible: false,
    videoTitle: null,
    cued: false,
  };

  let original: QueueTrack[] = []; // the playlist's own order, for switching shuffle off
  let failed = new Set<string>(); // tracks that could not be played since the last playPlaylist
  let wantPlay = false; // what the user asked for; survives track changes
  // The loadSeq of the track whose load() is under way (0: none): play/pause/time events of the
  // element are ignored then. Reset by stop()/dropBackend(), so a load that never settles can't
  // block those events for good.
  let loadingSeq = 0;
  let loadSeq = 0;
  let touched = false; // set by any user action; a late restore must not overwrite it
  let restorePending = true; // until the saved state is checked, don't overwrite it
  let backend: MusicBackend | null = null;
  let backendKind: 'file' | 'youtube' | null = null;

  // ── Events + persistence ──
  let lastTimeEmit = 0;
  let lastSave = 0;
  let timeTimer: ReturnType<typeof setTimeout> | null = null;

  function save() {
    lastSave = Date.now();
    try {
      const { volume, shuffle, repeat, source, queue, index, position } = state;
      // Until the saved queue has been checked (or while that check could not reach the server),
      // keep it as it is and only update the settings.
      const data = restorePending && !touched
        ? { ...saved, volume, shuffle, repeat }
        : state.cued
          ? { volume, shuffle, repeat, source: null, queue: [], index: 0, position: 0 }
          : { volume, shuffle, repeat, source, queue, index, position };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* storage full or blocked: the player still works */ }
  }

  /** `timeOnly`: only the position moved; the state is then saved at most every SAVE_TIME_MS
   *  (the whole queue is written each time; pagehide saves the latest position anyway). */
  function emit(timeOnly = false) {
    if (timeTimer) { clearTimeout(timeTimer); timeTimer = null; }
    lastTimeEmit = Date.now();
    if (!timeOnly || lastTimeEmit - lastSave >= SAVE_TIME_MS) save();
    playbackState();
    document.dispatchEvent(new CustomEvent(MUSIC_STATE_EVENT, { detail: getState() }));
  }

  function emitTime() {
    const wait = TIME_EMIT_MS - (Date.now() - lastTimeEmit);
    if (wait <= 0) emit(true);
    else if (!timeTimer) timeTimer = setTimeout(() => emit(true), wait);
  }

  function getState(): MusicState {
    return { ...state, source: state.source && { ...state.source }, queue: state.queue.map((t) => ({ ...t })) };
  }

  // ── Backend ──
  const kindOf = (t: QueueTrack): 'file' | 'youtube' => (t.kind === 'file' ? 'file' : 'youtube');

  /** The backend for a track: reuses the current one if it plays this kind, else drops it
   *  (so an <audio> never keeps playing under a YouTube video, or the other way round). */
  function backendFor(t: QueueTrack): MusicBackend | null {
    const kind = kindOf(t);
    if (backend && backendKind === kind) return backend;
    dropBackend();
    const el = document.getElementById(kind === 'file' ? 'music-audio' : 'music-yt-frame');
    if (!el) return null;
    const b = kind === 'file' ? createAudioBackend(el as HTMLAudioElement) : createYouTubeBackend(el);
    b.setVolume(state.volume);
    b.onTime = (pos, dur) => {
      if (b !== backend || loadingSeq) return;
      const durChanged = dur !== state.duration;
      state.position = pos;
      state.duration = dur;
      if (durChanged) emit(); else emitTime();
    };
    b.onEnded = () => { if (b === backend) ended(); };
    b.onError = () => { if (b === backend) skipBroken(); };
    b.onPlaying = (p) => {
      if (b !== backend || loadingSeq) return;
      if (p) playedOk();
      if (state.playing === p) return;
      state.playing = p;
      wantPlay = p;
      emit();
    };
    b.onActive = (active) => {
      if (b !== backend) return;
      // Safety net: a playing YouTube player is never hidden, whatever path started it
      if (active) { playedOk(); showVideo(); }
      // Idle (paused, cued, ended) and nobody asked for playback: hide the tile
      // (not while an autoplay load is still under way: YouTube would start it right after)
      else if (!wantPlay && state.youtubeVisible && !b.isActive?.()) { state.youtubeVisible = false; emit(); }
    };
    b.onTitle = (title) => {
      if (b !== backend || state.videoTitle === title) return;
      state.videoTitle = title;
      const t = state.queue[state.index];
      if (t) mediaSession(t);
      emit();
    };
    backend = b;
    backendKind = kind;
    return b;
  }

  /** The current track plays: it is no longer counted as broken. */
  function playedOk() {
    const t = state.queue[state.index];
    if (t) failed.delete(t.id);
  }

  function showVideo() {
    if (backendKind !== 'youtube' || state.youtubeVisible) return;
    state.youtubeVisible = true;
    emit();
  }

  function dropBackend() {
    const b = backend;
    backend = null;
    backendKind = null;
    loadingSeq = 0;
    b?.destroy();
  }

  // ── Loading tracks ──
  async function loadCurrent(autoplay: boolean, at = 0) {
    const t = state.queue[state.index];
    if (!t) return stop();
    const seq = ++loadSeq;
    wantPlay = autoplay;
    state.playing = autoplay;
    state.position = at;
    state.duration = 0;
    state.videoTitle = null;
    // Shown (and emitted) before the player is built and told to play; a paused load (restore,
    // next while paused) builds the player in the hidden tile.
    state.youtubeVisible = kindOf(t) === 'youtube' && autoplay;
    mediaSession(t);
    emit();
    const b = backendFor(t);
    if (!b) { // no player element on this page
      queueMicrotask(() => { if (seq === loadSeq) skipBroken(); });
      return;
    }
    loadingSeq = seq;
    try {
      await b.load(t, at, autoplay);
    } finally {
      if (loadingSeq === seq) loadingSeq = 0;
    }
    if (seq !== loadSeq || b !== backend) return;
    if (wantPlay) await b.play();
    else if (autoplay) store.pause(); // paused while loading: YouTube started anyway, stop it
  }

  function skipBroken() {
    const t = state.queue[state.index];
    if (!t) return;
    window.alert(`Skipped: ${t.title} (not playable)`);
    failed.add(t.id);
    if (state.queue.every((q) => failed.has(q.id))) return stop();
    state.index = (state.index + 1) % state.queue.length;
    void loadCurrent(wantPlay);
  }

  function ended() {
    if (state.repeat === 'one') {
      backend?.seek(0);
      void backend?.play();
      return;
    }
    if (backend?.nextInList?.()) return;
    if (state.index + 1 < state.queue.length) {
      state.index++;
      void loadCurrent(true);
    } else if (state.repeat === 'all') {
      state.index = 0;
      void loadCurrent(true);
    } else {
      // End of the queue: stay on the last track, paused at its start.
      wantPlay = false;
      state.playing = false;
      state.youtubeVisible = false;
      state.position = 0;
      backend?.seek(0);
      emit();
    }
  }

  // ── Media Session (lock screen, headset buttons) ──
  function mediaSession(t: QueueTrack) {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    try {
      ms.metadata = new MediaMetadata({
        title: state.videoTitle ?? t.title,
        artist: state.source?.name ?? 'Arandor',
        album: 'Arandor',
        artwork: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      });
      ms.setActionHandler('play', () => store.play());
      ms.setActionHandler('pause', () => store.pause());
      ms.setActionHandler('nexttrack', () => store.next());
      ms.setActionHandler('previoustrack', () => store.prev());
    } catch { /* not supported here */ }
  }

  // YouTube has no media element the browser could read play/pause from, so say it directly.
  function playbackState() {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    try {
      ms.playbackState = !state.queue.length ? 'none' : state.playing ? 'playing' : 'paused';
    } catch { /* ignore */ }
  }

  function clearMediaSession() {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    try {
      ms.metadata = null;
      for (const a of ['play', 'pause', 'nexttrack', 'previoustrack'] as const) ms.setActionHandler(a, null);
    } catch { /* ignore */ }
  }

  // ── Public API ──
  function stop() {
    touched = true;
    state.cued = false;
    loadSeq++;
    loadingSeq = 0;
    wantPlay = false;
    dropBackend();
    failed = new Set();
    original = [];
    Object.assign(state, { source: null, queue: [], index: 0, playing: false, position: 0, duration: 0, youtubeVisible: false, videoTitle: null });
    clearMediaSession();
    emit();
    void cueSite();
  }

  /** The user asks for playback: the queue is theirs now (saved), and the player opens. */
  function requested() {
    touched = true;
    state.cued = false;
    document.dispatchEvent(new CustomEvent(MUSIC_PLAY_EVENT));
  }

  const store: MusicStore = {
    getState,
    playPlaylist(p, startIndex = 0, opts) {
      const tracks = (p.tracks ?? []).filter(isTrack).map(({ id, kind, title, ref }) => ({ id, kind, title, ref }));
      if (!tracks.length) return;
      requested();
      const start = Math.min(Math.max(0, Math.floor(startIndex) || 0), tracks.length - 1);
      original = tracks;
      failed = new Set();
      state.source = { playlistId: p.id, name: p.name };
      if (opts?.shuffle) {
        state.shuffle = true;
        state.queue = shuffled(tracks);
        state.index = 0;
      } else if (state.shuffle && opts?.shuffle !== false) {
        state.queue = [tracks[start], ...shuffled(tracks.filter((_, i) => i !== start))];
        state.index = 0;
      } else {
        if (opts?.shuffle === false) state.shuffle = false;
        state.queue = tracks;
        state.index = start;
      }
      void loadCurrent(true);
    },
    play() {
      if (!state.queue.length) return;
      requested();
      const cur = state.queue[state.index];
      const b = backend && cur && backendKind === kindOf(cur) ? backend : null;
      if (!b) return void loadCurrent(true, state.position);
      wantPlay = true;
      state.playing = true;
      if (backendKind === 'youtube') state.youtubeVisible = true; // visible before it plays
      emit();
      void b.play();
    },
    pause() {
      touched = true;
      wantPlay = false;
      backend?.pause();
      let changed = state.playing;
      state.playing = false;
      // Hide the video only once it has stopped; while it still plays, onActive(false) hides it
      if (state.youtubeVisible && !backend?.isActive?.()) { state.youtubeVisible = false; changed = true; }
      if (changed) emit();
    },
    toggle() { state.playing ? store.pause() : store.play(); },
    next() {
      if (!state.queue.length) return;
      touched = true;
      state.cued = false;
      if (backend?.nextInList?.()) return;
      state.index = (state.index + 1) % state.queue.length;
      void loadCurrent(wantPlay);
    },
    prev() {
      if (!state.queue.length) return;
      touched = true;
      state.cued = false;
      if (backend?.prevInList?.()) return;
      if (state.position > PREV_RESTARTS_AFTER) return store.seek(0);
      state.index = state.index > 0 ? state.index - 1 : state.repeat === 'all' ? state.queue.length - 1 : 0;
      void loadCurrent(wantPlay);
    },
    jump(index) {
      if (!state.queue[index]) return;
      requested();
      state.index = index;
      void loadCurrent(true);
    },
    seek(sec) {
      if (!state.queue.length || !Number.isFinite(sec)) return;
      const s = Math.max(0, state.duration ? Math.min(sec, state.duration) : sec);
      backend?.seek(s);
      state.position = s;
      emit();
    },
    setVolume(v) {
      if (!Number.isFinite(v)) return;
      state.volume = Math.min(1, Math.max(0, v));
      backend?.setVolume(state.volume);
      emit();
    },
    setShuffle(b) {
      b = !!b;
      if (b === state.shuffle) return;
      state.shuffle = b;
      const cur = state.queue[state.index];
      if (cur) {
        if (b) {
          state.queue = [cur, ...shuffled(state.queue.filter((_, i) => i !== state.index))];
          state.index = 0;
        } else if (original.length) {
          const known = new Set(state.queue.map((t) => t.id));
          state.queue = original.filter((t) => known.has(t.id));
          state.index = Math.max(0, state.queue.findIndex((t) => t.id === cur.id));
        }
      }
      emit();
    },
    setRepeat(m) {
      if (m !== 'off' && m !== 'all' && m !== 'one') return;
      state.repeat = m;
      emit();
    },
    stop,
  };

  // ── Restore after a full page load (paused, never autoplay) ──
  async function restore() {
    let keep = false;
    try {
      keep = (await restoreSaved()) === 'offline';
    } catch { /* unexpected: fall through */ }
    // Offline: the saved state stays as it is (save() keeps it) for the next page load.
    if (!keep) {
      restorePending = false;
      await cueSite(siteOnce);
    }
    siteOnce = null;
  }

  // The site playlist as GET /api/music/site answers it (playlist or null); throws when offline.
  async function fetchSite(): Promise<any> {
    const res = await fetch('/api/music/site', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`site ${res.status}`);
    return (await res.json())?.playlist ?? null;
  }
  let siteOnce: Promise<any> | null = null; // the restore's request, reused by the first cue

  /** With an empty queue, loads the site playlist paused (no player is built until play). */
  async function cueSite(site?: Promise<any> | null) {
    if (state.queue.length) return;
    const seq = loadSeq;
    let p: any;
    try {
      p = await (site ?? fetchSite());
    } catch {
      return; // offline: nothing to cue
    }
    // Something else was loaded (or stopped again) meanwhile
    if (state.queue.length || seq !== loadSeq || !p || typeof p.id !== 'string') return;
    const tracks = pickTracks(p);
    if (!tracks.length) return;
    state.cued = true;
    original = tracks;
    failed = new Set();
    state.source = { playlistId: p.id, name: typeof p.name === 'string' ? p.name : '' };
    state.queue = state.shuffle ? shuffled(tracks) : tracks;
    Object.assign(state, { index: 0, playing: false, position: 0, duration: 0, youtubeVisible: false, videoTitle: null });
    emit();
  }

  async function restoreSaved(): Promise<'offline' | void> {
    const queue = Array.isArray(saved.queue) ? saved.queue.filter(isTrack) : [];
    const src = saved.source;
    const idx = typeof saved.index === 'number' ? saved.index : 0;
    const current = queue[idx];
    if (!src || typeof src.playlistId !== 'string' || !current) return;
    let tracks: QueueTrack[] | null = null;
    try {
      tracks = await fetchPlaylistTracks(src.playlistId);
    } catch {
      return 'offline'; // offline or server trouble: keep the saved state for next time, show nothing now
    }
    if (touched) return;
    const fresh = tracks && new Map(tracks.map((t) => [t.id, t]));
    if (!fresh || !fresh.has(current.id)) {
      // Deleted playlist or track, or no longer visible: drop the saved state silently.
      state.source = null; state.queue = []; state.index = 0; state.position = 0;
      restorePending = false;
      save();
      return;
    }
    restorePending = false;
    original = tracks!;
    state.source = { playlistId: src.playlistId, name: typeof src.name === 'string' ? src.name : '' };
    state.queue = queue.filter((t) => fresh.has(t.id)).map((t) => fresh.get(t.id)!);
    state.index = state.queue.findIndex((t) => t.id === current.id);
    const at = typeof saved.position === 'number' && saved.position > 0 ? saved.position : 0;
    void loadCurrent(false, at);
  }

  // Which tracks a saved playlist has now, or null when it is gone or not visible.
  // Checks without requests that fail (no 401/404 noise in the console): site playlist first,
  // then the viewer's list, then the playlist itself.
  async function fetchPlaylistTracks(id: string): Promise<QueueTrack[] | null> {
    const pick = pickTracks;
    const sitePl = await (siteOnce ??= fetchSite());
    if (sitePl?.id === id) return pick(sitePl);
    if (!document.getElementById('logoutBtn')) return null; // visitor: only the site playlist
    const list = await fetch('/api/music/playlists', { headers: { Accept: 'application/json' } });
    if (list.status === 401) return null;
    if (!list.ok) throw new Error(`list ${list.status}`);
    const rows = await list.json();
    if (!Array.isArray(rows) || !rows.some((r: any) => r?.id === id)) return null;
    const one = await fetch(`/api/music/playlists/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
    if (one.status === 401 || one.status === 404) return null;
    if (!one.ok) throw new Error(`playlist ${one.status}`);
    return pick(await one.json());
  }

  window.addEventListener('pagehide', save);
  void restore();
  return store;
}

function getStore(): MusicStore {
  if (typeof window === 'undefined') throw new Error('The music player only runs in the browser');
  return (window.__music ??= createStore());
}

/** The player store (created on first use in the browser). */
export const music: MusicStore = typeof window === 'undefined'
  ? (new Proxy({}, { get: () => () => { throw new Error('The music player only runs in the browser'); } }) as MusicStore)
  : getStore();
