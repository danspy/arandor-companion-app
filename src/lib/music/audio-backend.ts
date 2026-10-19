// Plays uploaded music files through the persistent <audio id="music-audio"> element.
// The YouTube backend (youtube-backend.ts) implements the same MusicBackend interface.
import type { QueueTrack } from './player';

export interface MusicBackend {
  /** Loads a track (paused) and, once its metadata is known, jumps to `at` seconds. */
  load(t: QueueTrack, at?: number): Promise<void>;
  play(): Promise<void> | void;
  pause(): void;
  seek(s: number): void;
  setVolume(v: number): void;
  /** Stops and unloads; the backend is not used again. */
  destroy(): void;
  /** Called when the current track has played to its end. */
  onEnded: () => void;
  /** Called when the current track cannot be played. */
  onError: () => void;
  /** Called with (position, duration) in seconds whenever either changes. */
  onTime: (position: number, duration: number) => void;
  /** Called when playback starts or stops by itself (e.g. headset button, OS controls). */
  onPlaying?: (playing: boolean) => void;
  /** Within one track that is itself a list (YouTube playlist): go to its next/previous entry.
   *  Returns false when there is none, so the queue moves on instead. */
  nextInList?(): boolean;
  prevInList?(): boolean;
}

export function createAudioBackend(audio: HTMLAudioElement): MusicBackend {
  let alive = true;
  let loadToken = 0;
  const backend: MusicBackend = {
    onEnded: () => {},
    onError: () => {},
    onTime: () => {},
    onPlaying: () => {},
    load(t, at = 0) {
      const token = ++loadToken;
      return new Promise<void>((resolve) => {
        const done = () => {
          audio.removeEventListener('loadedmetadata', onMeta);
          audio.removeEventListener('error', onFail);
          resolve();
        };
        const onMeta = () => {
          if (token === loadToken && at > 0 && Number.isFinite(at)) {
            audio.currentTime = Math.min(at, Math.max(0, (audio.duration || at) - 0.25));
          }
          done();
        };
        const onFail = () => done();
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('error', onFail);
        audio.src = t.ref;
        audio.load();
      });
    },
    play() {
      return audio.play().catch((err: unknown) => {
        // AbortError: a newer load() interrupted this play(); NotAllowedError: autoplay blocked.
        // Neither means the track is broken (that arrives as an 'error' event).
        const name = (err as { name?: string })?.name;
        if (name === 'NotAllowedError') backend.onPlaying?.(false);
      });
    },
    pause() { audio.pause(); },
    seek(s) { if (Number.isFinite(s)) audio.currentTime = Math.max(0, s); },
    setVolume(v) { audio.volume = Math.min(1, Math.max(0, v)); },
    destroy() {
      alive = false;
      loadToken++;
      for (const [ev, fn] of handlers) audio.removeEventListener(ev, fn);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    },
  };
  const time = () => backend.onTime(audio.currentTime || 0, Number.isFinite(audio.duration) ? audio.duration : 0);
  const handlers: [string, () => void][] = [
    ['ended', () => backend.onEnded()],
    ['error', () => { if (alive && audio.getAttribute('src')) backend.onError(); }],
    ['timeupdate', time],
    ['durationchange', time],
    ['seeked', time],
    ['play', () => backend.onPlaying?.(true)],
    ['pause', () => { if (!audio.ended) backend.onPlaying?.(false); }],
  ];
  for (const [ev, fn] of handlers) audio.addEventListener(ev, fn);
  return backend;
}
