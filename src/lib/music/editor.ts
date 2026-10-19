// Client logic for Tools → Music (src/pages/tools/music.astro): playlist list, selection,
// uploads, YouTube links, reorder, rename, delete, visibility and the site playlist.
// Playback always goes through the global store (player.ts).
import { music, MUSIC_STATE_EVENT, type QueueTrack } from './player';
import { audioFileCheck } from './formats';
import { parseYouTubeUrl } from './youtube';
import { importYouTubeList } from './youtube-list';

type Summary = {
  id: string; name: string; visibility: string; isSiteDefault: boolean;
  ownerId: string; ownerName: string; trackCount: number; canEdit: boolean;
};
type Track = QueueTrack & { position: number };
type Detail = { id: string; name: string; visibility: string; isSiteDefault: boolean; showOnDashboard: boolean; ownerId: string; canEdit: boolean; tracks: Track[] };

type Ctx = { root: HTMLElement; me: string; admin: boolean; list: Summary[]; current: Detail | null; uploads: Promise<void> };
let ctx: Ctx | null = null;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const KIND: Record<QueueTrack['kind'], string> = { file: 'File', youtube_video: 'YouTube', youtube_playlist: 'YouTube playlist' };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

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
const svg = (path: string, fill = true) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '14'); s.setAttribute('height', '14'); s.setAttribute('aria-hidden', 'true');
  if (fill) s.setAttribute('fill', 'currentColor');
  else { s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); }
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  s.append(p);
  return s;
};
const ICON_PLAY = 'M7 4v16l13-8z', ICON_PAUSE = 'M6 4h4v16H6zM14 4h4v16h-4z';

async function api(url: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'No connection to the server' } };
  }
}
const fail = (r: { data: any }) => window.alert(r.data?.error || 'Something went wrong. Try again.');

// ── Playlist list ────────────────────────────────────────────────────────────
async function loadList() {
  const r = await api('/api/music/playlists');
  if (!ctx) return;
  if (!r.ok) {
    $('mp-groups').replaceChildren(el('p', { class: 't-faint text-sm', text: 'Could not load the playlists.' }));
    return;
  }
  ctx.list = r.data;
  renderGroups();
}

function renderGroups() {
  if (!ctx) return;
  const { list, me, admin } = ctx;
  const groups: [string, string, Summary[], string?][] = [
    ['site', 'Site', list.filter((p) => p.isSiteDefault)],
    ['mine', 'Mine', list.filter((p) => !p.isSiteDefault && p.ownerId === me), 'Nothing yet. Create your first playlist below.'],
    ['public', 'Public from others', list.filter((p) => !p.isSiteDefault && p.ownerId !== me && p.visibility === 'public')],
  ];
  if (admin) groups.push(['others', 'All others', list.filter((p) => !p.isSiteDefault && p.ownerId !== me && p.visibility !== 'public')]);
  const nodes = groups
    .filter(([, , items, empty]) => items.length || empty)
    .map(([key, label, items, empty]) =>
      el('section', { class: 'mp-group', 'data-group': key },
        el('h3', { text: label }),
        items.length
          ? el('ul', {}, ...items.map((p) => el('li', {},
              el('button', { type: 'button', class: 'mp-item', 'data-id': p.id, 'aria-current': ctx!.current?.id === p.id ? 'true' : null },
                el('span', { class: 'mp-item-name' }, p.name, ...(key === 'mine' ? [] : [el('small', { text: `by ${p.ownerName}` })])),
                el('span', { class: 'mp-item-meta', text: String(p.trackCount), title: plural(p.trackCount, 'track') }),
              ))))
          : el('p', { class: 't-faint text-sm', text: empty! })));
  $('mp-groups').replaceChildren(...nodes);
}

// ── Selected playlist ────────────────────────────────────────────────────────
async function select(id: string | null, scroll = false) {
  if (!ctx) return;
  const url = new URL(location.href);
  if (id) url.searchParams.set('playlist', id); else url.searchParams.delete('playlist');
  history.replaceState(history.state, '', url);
  if (!id) {
    ctx.current = null;
    renderDetail();
    renderGroups();
    return;
  }
  const r = await api(`/api/music/playlists/${id}`);
  if (!ctx) return;
  if (!r.ok) {
    ctx.current = null;
    renderDetail(r.status === 404 ? 'This playlist does not exist or is private.' : r.data?.error);
  } else {
    ctx.current = r.data;
    renderDetail();
    if (scroll && window.matchMedia('(max-width: 1023px)').matches) $('mp-detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  renderGroups();
}

function renderDetail(message?: string) {
  const p = ctx?.current;
  $('mp-empty').hidden = !!p;
  $('mp-view').hidden = !p;
  $('mp-empty').querySelector('p')!.textContent = message || 'Choose a playlist, or create one to start adding music.';
  if (!p) return;
  const summary = ctx!.list.find((s) => s.id === p.id);
  const name = $('mp-name');
  name.textContent = p.name;
  name.classList.toggle('mp-editable', p.canEdit);
  name.tabIndex = p.canEdit ? 0 : -1;
  name.title = p.canEdit ? 'Click to rename' : '';
  renderMeta();
  $('mp-edit').hidden = !p.canEdit;
  const pub = $<HTMLInputElement>('mp-public');
  pub.checked = p.visibility === 'public';
  pub.disabled = p.isSiteDefault;
  $('mp-site-note').hidden = !p.isSiteDefault;
  $('mp-dashboard-row').hidden = !p.isSiteDefault;
  $<HTMLInputElement>('mp-dashboard').checked = p.showOnDashboard;
  $('mp-site').hidden = !ctx!.admin || p.isSiteDefault;
  $('mp-delete').hidden = p.isSiteDefault;
  $('mp-uploads').replaceChildren();
  $('mp-yt-choice').hidden = true;
  if (summary) summary.trackCount = p.tracks.length;
  renderTracks();
}

function renderMeta() {
  const p = ctx?.current;
  if (!p) return;
  const owner = p.ownerId === ctx!.me ? 'you' : ctx!.list.find((s) => s.id === p.id)?.ownerName || 'someone else';
  const where = p.isSiteDefault ? 'Site playlist, plays on the dashboard' : p.visibility === 'public' ? 'Public' : 'Private, only you can see it';
  $('mp-meta').textContent = `By ${owner}. ${plural(p.tracks.length, 'track')}. ${p.ownerId === ctx!.me || p.isSiteDefault ? where : where.split(',')[0]}.`;
}

function renderTracks() {
  const p = ctx!.current!;
  const editable = p.canEdit;
  const rows = p.tracks.map((t, i) => {
    const title = el('span', { class: `mp-title${editable ? ' mp-editable' : ''}`, text: t.title, tabindex: editable ? 0 : null, title: editable ? 'Click to rename' : null });
    const playBtn = el('button', { type: 'button', class: 't-icon-btn mp-play-track', 'aria-label': `Play ${t.title}`, title: 'Play' }, svg(ICON_PLAY));
    const li = el('li', { class: 'mp-track', 'data-id': t.id },
      ...(editable ? [el('button', { type: 'button', class: 'mp-handle', 'aria-label': `Move ${t.title} (drag, or use the arrow keys)`, title: 'Drag to reorder' }, svg('M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01', false))] : []),
      el('span', { class: 'mp-num', text: String(i + 1) }),
      el('span', { class: 'mp-eq', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
      playBtn, title,
      el('span', { class: 'mp-kind', text: KIND[t.kind] }),
      ...(editable && t.kind === 'youtube_playlist' ? [el('button', { type: 'button', class: 't-icon-btn mp-expand', 'aria-label': `Expand ${t.title} into tracks`, title: 'Expand into tracks' }, svg('M4 6h16M4 12h10M4 18h10M18 14v6M15 17h6', false))] : []),
      ...(editable ? [el('button', { type: 'button', class: 't-icon-btn t-icon-btn-danger mp-del', 'aria-label': `Remove ${t.title}`, title: 'Remove' }, svg('M6 6l12 12M18 6 6 18', false))] : []),
    );
    return li;
  });
  $('mp-tracks').replaceChildren(...rows);
  $('mp-no-tracks').hidden = p.tracks.length > 0;
  $('mp-no-tracks').textContent = editable ? 'No tracks yet. Upload files or add a YouTube link below.' : 'No tracks yet.';
  for (const id of ['mp-play', 'mp-shuffle']) $<HTMLButtonElement>(id).disabled = !p.tracks.length;
  markCurrent();
}

const queueOf = (p: Detail) => ({ id: p.id, name: p.name, tracks: p.tracks.map(({ id, kind, title, ref }) => ({ id, kind, title, ref })) });

// Marks the row of the track the global player is on (only when it plays this playlist)
function markCurrent() {
  const p = ctx?.current;
  if (!p) return;
  const s = music.getState();
  const currentId = s.source?.playlistId === p.id ? s.queue[s.index]?.id : undefined;
  $('mp-tracks').querySelectorAll<HTMLLIElement>('li.mp-track').forEach((li) => {
    const on = li.dataset.id === currentId;
    if (on) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current');
    li.classList.toggle('mp-playing', on && s.playing);
    const btn = li.querySelector<HTMLButtonElement>('.mp-play-track');
    const title = li.querySelector('.mp-title')?.textContent ?? '';
    const pause = on && s.playing;
    if (btn && btn.dataset.pause !== String(pause)) {
      btn.dataset.pause = String(pause);
      btn.setAttribute('aria-label', `${pause ? 'Pause' : 'Play'} ${title}`);
      btn.replaceChildren(svg(pause ? ICON_PAUSE : ICON_PLAY));
    }
  });
}

// ── Inline rename ────────────────────────────────────────────────────────────
function inlineEdit(target: HTMLElement, opts: { id?: string; className: string; max: number; save: (v: string) => Promise<boolean> }) {
  if (target.hidden) return;
  const input = el('input', { class: `t-input px-2 py-1 ${opts.className}`, id: opts.id, maxlength: opts.max, 'aria-label': 'New name' }) as HTMLInputElement;
  input.value = target.textContent ?? '';
  target.hidden = true;
  target.after(input);
  input.focus();
  input.select();
  let done = false;
  const finish = async (save: boolean) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    if (save && value && value !== target.textContent && (await opts.save(value))) target.textContent = value;
    input.remove();
    target.hidden = false;
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

async function renamePlaylist() {
  const p = ctx?.current;
  if (!p?.canEdit) return;
  inlineEdit($('mp-name'), {
    id: 'mp-name-input', className: 'text-lg', max: 80,
    save: async (name) => {
      const r = await api(`/api/music/playlists/${p.id}`, 'PATCH', { name });
      if (!r.ok) { fail(r); return false; }
      p.name = name;
      const s = ctx?.list.find((x) => x.id === p.id);
      if (s) s.name = name;
      renderGroups();
      return true;
    },
  });
}

function renameTrack(li: HTMLElement) {
  const t = ctx?.current?.tracks.find((x) => x.id === li.dataset.id);
  if (!t) return;
  inlineEdit(li.querySelector('.mp-title')!, {
    className: 'mp-rename', max: 200,
    save: async (title) => {
      const r = await api(`/api/music/tracks/${t.id}`, 'PATCH', { title });
      if (!r.ok) { fail(r); return false; }
      t.title = title;
      return true;
    },
  });
}

// ── Reorder: drag the handle (pointer events, so touch works too) or arrow keys ─
function startDrag(handle: HTMLElement, e: PointerEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  const li = handle.closest('li')!;
  const list = li.parentElement!;
  const before = trackOrder();
  try { handle.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  li.classList.add('mp-dragging');
  const move = (ev: PointerEvent) => {
    const others = [...list.children].filter((x) => x !== li) as HTMLElement[];
    const target = others.find((s) => { const r = s.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
    if (target) { if (li.nextElementSibling !== target) list.insertBefore(li, target); }
    else if (list.lastElementChild !== li) list.append(li);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    li.classList.remove('mp-dragging');
    if (trackOrder().join() !== before.join()) saveOrder();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function moveByKey(handle: HTMLElement, e: KeyboardEvent) {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const li = handle.closest('li')!;
  const sib = e.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling?.nextElementSibling ?? null;
  if (e.key === 'ArrowDown' && !li.nextElementSibling) return;
  if (e.key === 'ArrowUp' && !sib) return;
  li.parentElement!.insertBefore(li, sib);
  handle.focus();
  saveOrder();
}

const trackOrder = () => [...$('mp-tracks').querySelectorAll<HTMLElement>('li.mp-track')].map((li) => li.dataset.id!);

async function saveOrder() {
  const p = ctx?.current;
  if (!p) return;
  const ids = trackOrder();
  const r = await api(`/api/music/playlists/${p.id}/order`, 'PUT', { trackIds: ids });
  if (!r.ok) { fail(r); return select(p.id); }
  const byId = new Map(p.tracks.map((t) => [t.id, t]));
  p.tracks = ids.map((id) => byId.get(id)!);
  $('mp-tracks').querySelectorAll('.mp-num').forEach((n, i) => (n.textContent = String(i + 1)));
}

// ── Adding tracks ────────────────────────────────────────────────────────────
function trackAdded(playlistId: string, track: Track) {
  const s = ctx?.list.find((x) => x.id === playlistId);
  if (s) s.trackCount++;
  renderGroups();
  if (ctx?.current?.id !== playlistId) return;
  ctx.current.tracks.push(track);
  renderTracks();
  renderMeta();
}

function sendFile(playlistId: string, file: File, onProgress: (f: number) => void): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/music/playlists/${playlistId}/tracks`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.response });
    xhr.onerror = () => resolve({ status: 0, body: null });
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

function uploadFiles(files: File[]) {
  const c = ctx, p = c?.current;
  if (!c || !p?.canEdit || !files.length) return;
  const items = files.map((file) => {
    const fill = el('div', { class: 't-progress-fill', style: 'width:0%' });
    const status = el('span', { class: 'mp-upload-status', text: 'Waiting' });
    const li = el('li', { class: 'mp-upload' },
      el('div', { class: 'mp-upload-line' }, el('span', { class: 'mp-upload-name', text: file.name }), status),
      el('div', { class: 't-progress-track' }, fill));
    $('mp-uploads').append(li);
    return { file, li, fill, status };
  });
  const done = (it: (typeof items)[number], ok: boolean, text: string) => {
    it.li.classList.add(ok ? 'mp-ok' : 'mp-err');
    it.status.textContent = text;
    it.fill.style.width = ok ? '100%' : '0%';
  };
  // One request per file, in sequence, so each file has its own progress and result
  c.uploads = c.uploads.then(async () => {
    for (const it of items) {
      const check = audioFileCheck(it.file.name, it.file.size);
      if (!check.ok) { done(it, false, check.error); continue; }
      it.status.textContent = '0%';
      const r = await sendFile(p.id, it.file, (f) => { it.fill.style.width = `${Math.round(f * 100)}%`; it.status.textContent = `${Math.round(f * 100)}%`; });
      const result = r.body?.results?.[0];
      if (result?.ok) { done(it, true, 'Added'); trackAdded(p.id, result.track); }
      else done(it, false, result?.error || r.body?.error || (r.status === 0 ? 'Upload failed: no connection' : 'Upload failed'));
    }
  });
}

// Shows the choice for links with a list: this video (if any), the list as one entry, or import its videos
function askMode() {
  const choice = $('mp-yt-choice');
  choice.querySelector<HTMLElement>('[data-mode="video"]')!.hidden = !parseYouTubeUrl($<HTMLInputElement>('mp-yt-url').value)?.videoId;
  choice.hidden = false;
  choice.querySelector<HTMLElement>('button:not([hidden])')!.focus();
}

async function addYouTube(mode?: 'video' | 'playlist' | 'import') {
  const p = ctx?.current;
  if (!p) return;
  const url = $<HTMLInputElement>('mp-yt-url'), title = $<HTMLInputElement>('mp-yt-title'), btn = $<HTMLButtonElement>('mp-yt-add');
  const listId = parseYouTubeUrl(url.value)?.listId;
  if (listId && !mode) return askMode();
  if (mode === 'import' && listId) {
    $('mp-yt-choice').hidden = true;
    btn.disabled = true;
    if (await runImport(listId, $('mp-yt'))) { url.value = ''; title.value = ''; }
    btn.disabled = false;
    return;
  }
  btn.disabled = true;
  const r = await api(`/api/music/playlists/${p.id}/tracks`, 'POST', { youtubeUrl: url.value.trim(), title: title.value.trim() || undefined, mode });
  btn.disabled = false;
  if (r.status === 409 && r.data?.needsMode) return askMode();
  $('mp-yt-choice').hidden = true;
  if (!r.ok) return fail(r);
  url.value = '';
  title.value = '';
  trackAdded(p.id, r.data);
}

let importing = false;
/** Imports the videos of a YouTube list with progress in `host`; `replace` = the list track they replace. */
async function runImport(listId: string, host: HTMLElement, replace?: string): Promise<boolean> {
  const p = ctx?.current;
  if (!p || importing) return false;
  importing = true;
  const text = el('p', { class: 'text-sm t-muted' });
  const box = el('div', { class: 'mp-import', role: 'status' }, text);
  host.append(box);
  let ok = false;
  try {
    window.alert(await importYouTubeList({ playlistId: p.id, listId, host: box, replace, status: (s) => (text.textContent = s) }));
    ok = true;
  } catch (e) {
    window.alert((e as Error).message);
  } finally {
    box.remove();
    importing = false;
  }
  await loadList();
  if (ctx?.current?.id === p.id) await select(p.id);
  return ok;
}

// ── Playlist actions ─────────────────────────────────────────────────────────
async function createPlaylist(e: Event) {
  e.preventDefault();
  const name = $<HTMLInputElement>('mp-new-name');
  const r = await api('/api/music/playlists', 'POST', { name: name.value, visibility: $<HTMLSelectElement>('mp-new-visibility').value });
  if (!r.ok) return fail(r);
  name.value = '';
  await loadList();
  await select(r.data.id, true);
}

async function setPublic(input: HTMLInputElement) {
  const p = ctx?.current;
  if (!p) return;
  const visibility = input.checked ? 'public' : 'private';
  const r = await api(`/api/music/playlists/${p.id}`, 'PATCH', { visibility });
  if (!r.ok) { input.checked = !input.checked; return fail(r); }
  p.visibility = visibility;
  const s = ctx?.list.find((x) => x.id === p.id);
  if (s) s.visibility = visibility;
  renderGroups();
  renderMeta();
}

async function setDashboard(input: HTMLInputElement) {
  const p = ctx?.current;
  if (!p) return;
  const r = await api(`/api/music/playlists/${p.id}`, 'PATCH', { showOnDashboard: input.checked });
  if (!r.ok) { input.checked = !input.checked; return fail(r); }
  p.showOnDashboard = input.checked;
}

async function deletePlaylist() {
  const p = ctx?.current;
  if (!p) return;
  const ok = await window.arandorConfirm(`Delete “${p.name}”?`, { detail: `Its ${plural(p.tracks.length, 'track')} and uploaded files are removed for good.`, confirmLabel: 'Delete', danger: true });
  if (!ok) return;
  const r = await api(`/api/music/playlists/${p.id}`, 'DELETE');
  if (!r.ok) return fail(r);
  await loadList();
  await select(null);
}

async function makeSite() {
  const p = ctx?.current;
  if (!p) return;
  const ok = await window.arandorConfirm(`Make “${p.name}” the site playlist?`, { detail: 'It becomes public and plays on the dashboard for everyone, visitors included.', confirmLabel: 'Make site playlist' });
  if (!ok) return;
  const r = await api(`/api/music/playlists/${p.id}/site-default`, 'POST');
  if (!r.ok) return fail(r);
  await loadList();
  await select(p.id);
}

async function deleteTrack(li: HTMLElement) {
  const p = ctx?.current;
  const t = p?.tracks.find((x) => x.id === li.dataset.id);
  if (!p || !t) return;
  if (!(await window.arandorConfirm(`Remove “${t.title}” from this playlist?`, { confirmLabel: 'Remove', danger: true }))) return;
  const r = await api(`/api/music/tracks/${t.id}`, 'DELETE');
  if (!r.ok) return fail(r);
  p.tracks = p.tracks.filter((x) => x.id !== t.id);
  const s = ctx?.list.find((x) => x.id === p.id);
  if (s) s.trackCount = p.tracks.length;
  renderGroups();
  renderTracks();
  renderMeta();
}

function playTrack(li: HTMLElement) {
  const p = ctx?.current;
  if (!p) return;
  const i = p.tracks.findIndex((t) => t.id === li.dataset.id);
  if (li.getAttribute('aria-current') === 'true') music.toggle();
  else if (i >= 0) music.playPlaylist(queueOf(p), i);
}

// ── Wiring ───────────────────────────────────────────────────────────────────
export function initMusicEditor() {
  const root = document.getElementById('mp-root');
  if (!root) { ctx = null; return; }
  if (root.dataset.bound) return;
  root.dataset.bound = '1';
  ctx = { root, me: root.dataset.user!, admin: !!root.dataset.admin, list: [], current: null, uploads: Promise.resolve() };

  $('mp-groups').addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.mp-item');
    if (item) select(item.dataset.id!, true);
  });
  $('mp-new').addEventListener('submit', createPlaylist);
  $('mp-play').addEventListener('click', () => ctx?.current && music.playPlaylist(queueOf(ctx.current), 0));
  $('mp-shuffle').addEventListener('click', () => ctx?.current && music.playPlaylist(queueOf(ctx.current), 0, { shuffle: true }));
  const name = $('mp-name');
  name.addEventListener('click', renamePlaylist);
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); renamePlaylist(); } });

  const tracks = $('mp-tracks');
  tracks.addEventListener('click', (e) => {
    const t = e.target as HTMLElement, li = t.closest<HTMLElement>('li.mp-track');
    if (!li) return;
    if (t.closest('.mp-play-track')) playTrack(li);
    else if (t.closest('.mp-del')) deleteTrack(li);
    else if (t.closest('.mp-expand')) { const tr = ctx?.current?.tracks.find((x) => x.id === li.dataset.id); if (tr) runImport(tr.ref, li, tr.id); }
    else if (t.closest('.mp-title.mp-editable')) renameTrack(li);
  });
  tracks.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.classList.contains('mp-handle')) moveByKey(t, e);
    else if (e.key === 'Enter' && t.matches('.mp-title.mp-editable')) { e.preventDefault(); renameTrack(t.closest('li')!); }
  });
  tracks.addEventListener('pointerdown', (e) => {
    const h = (e.target as HTMLElement).closest<HTMLElement>('.mp-handle');
    if (h) startDrag(h, e);
  });

  const file = $<HTMLInputElement>('mp-file'), drop = $('mp-drop');
  file.addEventListener('change', () => { uploadFiles([...(file.files ?? [])]); file.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('mp-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('mp-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('mp-over'); uploadFiles([...(e.dataTransfer?.files ?? [])]); });

  $('mp-yt').addEventListener('submit', (e) => { e.preventDefault(); addYouTube(); });
  $('mp-yt-choice').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]');
    if (!b) return;
    if (b.dataset.mode) addYouTube(b.dataset.mode as 'video' | 'playlist' | 'import');
    else $('mp-yt-choice').hidden = true;
  });
  $('mp-public').addEventListener('change', (e) => setPublic(e.target as HTMLInputElement));
  $('mp-dashboard').addEventListener('change', (e) => setDashboard(e.target as HTMLInputElement));
  $('mp-delete').addEventListener('click', deletePlaylist);
  $('mp-site').addEventListener('click', makeSite);

  const wanted = root.dataset.selected;
  loadList().then(() => {
    if (ctx?.root !== root) return;
    const id = wanted || ctx.list[0]?.id;
    if (id) select(id); else renderDetail();
  });
}

// One document listener for the module's lifetime; it only acts while the page is shown
document.addEventListener(MUSIC_STATE_EVENT, () => { if (ctx?.root.isConnected) markCurrent(); });
