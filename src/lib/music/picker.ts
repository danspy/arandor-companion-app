// DM screen music panel: pick a playlist, see its tracks, play from a row, transport controls.
// Reads the playlist API and drives the global store (player.ts); writes nothing to /api/dm-screen.
import { music, MUSIC_STATE_EVENT, fmtTime, type MusicState, type QueueTrack, type RepeatMode } from './player';

type Summary = { id: string; name: string; visibility: string; isSiteDefault: boolean; ownerId: string; ownerName: string; trackCount: number; canEdit: boolean };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> = {}, ...children: (Node | string)[]) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  node.append(...children);
  return node;
}
const icon = (path: string, fill = true) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('aria-hidden', 'true');
  if (fill) s.setAttribute('fill', 'currentColor');
  else { s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); }
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  s.append(p);
  return s;
};
const PLAY = 'M7 4v16l13-8z', PAUSE = 'M6 4h4v16H6zM14 4h4v16h-4z';
const PREV = 'M6 5v14M20 5v14l-11-7z', NEXT = 'M18 5v14M4 5v14l11-7z';
const SHUFFLE = 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5';
const REPEAT = 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3';

const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'one', one: 'off' };
const REPEAT_LABEL: Record<RepeatMode, string> = { off: 'Repeat: off', all: 'Repeat: all', one: 'Repeat: one track' };

async function getJson(url: string): Promise<{ ok: boolean; data: any }> {
  try {
    const res = await fetch(url);
    return { ok: res.ok, data: await res.json().catch(() => null) };
  } catch {
    return { ok: false, data: { error: 'No connection to the server' } };
  }
}
const fail = (r: { data: any }) => window.alert(r.data?.error || 'Something went wrong. Try again.');

export function mountMusicPicker(host: HTMLElement): void {
  if (host.dataset.musicMounted === '1') return;
  host.dataset.musicMounted = '1';

  const me = host.dataset.me ?? '';
  let tracks: QueueTrack[] = [];
  let selected: { id: string; name: string } | null = null;

  const select = el('select', { id: 'dmm-select', class: 't-input w-full px-3 py-2 text-sm', 'aria-label': 'Playlist' });
  const ctl = (id: string, label: string, path: string, fill = true) =>
    el('button', { type: 'button', id, class: 't-icon-btn', 'aria-label': label, title: label }, icon(path, fill));
  const prevBtn = ctl('dmm-prev', 'Previous', PREV, false);
  const toggleBtn = ctl('dmm-toggle', 'Play', PLAY);
  const nextBtn = ctl('dmm-next', 'Next', NEXT, false);
  const shuffleBtn = ctl('dmm-shuffle', 'Shuffle', SHUFFLE, false);
  const repeatBtn = ctl('dmm-repeat', REPEAT_LABEL.off, REPEAT, false);
  const list = el('ul', { id: 'dmm-tracks', class: 'space-y-1 max-h-64 overflow-y-auto' });
  const empty = el('p', { class: 't-faint text-xs', text: 'Pick a playlist to see its tracks.' });
  const controls = el('div', { class: 'flex items-center gap-2' }, prevBtn, toggleBtn, nextBtn, shuffleBtn, repeatBtn);
  const posLabel = el('span', { id: 'dmm-pos', class: 't-faint text-xs tabular-nums', text: '0:00' });
  const durLabel = el('span', { id: 'dmm-dur', class: 't-faint text-xs tabular-nums', text: '0:00' });
  const seek = el('input', { id: 'dmm-seek', type: 'range', min: '0', max: '0', step: '0.1', value: '0', 'aria-label': 'Seek', class: 'flex-1 min-w-0', style: 'accent-color: var(--gold)' }) as HTMLInputElement;
  const seekRow = el('div', { id: 'dmm-seek-row', class: 'flex items-center gap-2' }, posLabel, seek, durLabel);
  seekRow.hidden = true;
  let seeking = false;
  host.replaceChildren(select, controls, seekRow, empty, list);

  function renderRows() {
    list.replaceChildren();
    empty.hidden = tracks.length > 0 || !selected;
    if (selected && !tracks.length) empty.textContent = 'No tracks in this playlist.';
    tracks.forEach((t, i) => {
      const btn = el('button', { type: 'button', 'data-dmm-play': '', class: 't-icon-btn', 'aria-label': `Play ${t.title}`, title: 'Play from here' }, icon(PLAY));
      btn.addEventListener('click', () => {
        if (selected) music.playPlaylist({ id: selected.id, name: selected.name, tracks }, i);
      });
      list.append(el('li', { 'data-dmm-row': '', class: 'flex items-center gap-2 t-inset px-2 py-1 rounded-xs text-sm' }, btn, el('span', { class: 't-body-text truncate', text: t.title })));
    });
    sync(music.getState());
  }

  function sync(s: MusicState) {
    const here = !!selected && s.source?.playlistId === selected.id;
    list.querySelectorAll<HTMLElement>('[data-dmm-row]').forEach((row, i) => {
      const cur = here && s.queue[s.index]?.id === tracks[i]?.id;
      if (cur) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
      row.style.outline = cur ? '1px solid var(--accent, currentColor)' : '';
    });
    // Seek row: only while the playing source is the selected playlist and the duration is known
    const showSeek = here && s.duration > 0;
    if (seekRow.hidden === showSeek) seekRow.hidden = !showSeek;
    if (showSeek) {
      const max = String(s.duration);
      if (seek.max !== max) seek.max = max;
      if (!seeking) {
        const v = String(s.position);
        if (seek.value !== v) seek.value = v;
        const p = fmtTime(s.position);
        if (posLabel.textContent !== p) posLabel.textContent = p;
      }
      const d = fmtTime(s.duration);
      if (durLabel.textContent !== d) durLabel.textContent = d;
    }
    const label = s.playing ? 'Pause' : 'Play';
    toggleBtn.setAttribute('aria-label', label); toggleBtn.title = label;
    toggleBtn.replaceChildren(icon(s.playing ? PAUSE : PLAY));
    shuffleBtn.setAttribute('aria-pressed', String(s.shuffle));
    shuffleBtn.style.opacity = s.shuffle ? '1' : '0.5';
    repeatBtn.dataset.mode = s.repeat;
    repeatBtn.setAttribute('aria-label', REPEAT_LABEL[s.repeat]); repeatBtn.title = REPEAT_LABEL[s.repeat];
    repeatBtn.style.opacity = s.repeat === 'off' ? '0.5' : '1';
  }

  toggleBtn.addEventListener('click', () => {
    const s = music.getState();
    // Nothing queued yet: start the selected playlist instead
    if (!s.queue.length && selected && tracks.length) music.playPlaylist({ id: selected.id, name: selected.name, tracks }, 0);
    else music.toggle();
  });
  seek.addEventListener('input', () => { seeking = true; posLabel.textContent = fmtTime(Number(seek.value)); });
  seek.addEventListener('change', () => { seeking = false; music.seek(Number(seek.value)); });
  prevBtn.addEventListener('click', () => music.prev());
  nextBtn.addEventListener('click', () => music.next());
  shuffleBtn.addEventListener('click', () => music.setShuffle(!music.getState().shuffle));
  repeatBtn.addEventListener('click', () => music.setRepeat(NEXT_REPEAT[music.getState().repeat]));

  select.addEventListener('change', async () => {
    if (!select.value) { selected = null; tracks = []; empty.textContent = 'Pick a playlist to see its tracks.'; renderRows(); empty.hidden = false; return; }
    const r = await getJson(`/api/music/playlists/${encodeURIComponent(select.value)}`);
    if (!r.ok) { fail(r); return; }
    const pl = r.data?.playlist ?? r.data;
    selected = { id: pl.id, name: pl.name };
    tracks = (pl.tracks ?? []).map((t: any) => ({ id: t.id, kind: t.kind, title: t.title, ref: t.ref }));
    renderRows();
  });

  const onState = (e: Event) => sync((e as CustomEvent<MusicState>).detail ?? music.getState());
  document.addEventListener(MUSIC_STATE_EVENT, onState);
  document.addEventListener('astro:before-swap', () => document.removeEventListener(MUSIC_STATE_EVENT, onState), { once: true });

  (async () => {
    const r = await getJson('/api/music/playlists');
    if (!r.ok) { fail(r); return; }
    const all: Summary[] = (Array.isArray(r.data) ? r.data : r.data?.playlists) ?? [];
    const group = (label: string, items: Summary[]) => {
      if (!items.length) return;
      select.append(el('optgroup', { label }, ...items.map((p) => el('option', { value: p.id, text: `${p.name} (${p.trackCount})` }))));
    };
    select.append(el('option', { value: '', text: 'Choose a playlist...' }));
    group('Site', all.filter((p) => p.isSiteDefault));
    group('Mine', all.filter((p) => !p.isSiteDefault && p.ownerId === me));
    group('Public', all.filter((p) => !p.isSiteDefault && p.visibility === 'public' && p.ownerId !== me));
    sync(music.getState());
  })();
}
