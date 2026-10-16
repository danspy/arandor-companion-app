/**
 * World map engine: camera, input, terrain blit, location markers, party
 * sprites, journey timeline and speech bubbles.
 *
 * Everything lives inside the `#mapViewport` element; DB-derived data is
 * handed over as a plain object (see map.astro).
 */
import {
  LOCATION_SPRITES, TILE, characterSprites, characterSpritesWithHead, lookFor, rasterize,
} from './sprites';
import {
  WORLD_H, WORLD_W, findRoute, pctToWorld, renderOceanSwatch, renderTerrain, segmentOverWater, world, worldToPct,
} from './world';

export interface MapLocation {
  id: string; name: string; type: string; region?: string | null; visited: boolean;
  visibleOnMap: boolean; mapX?: number | null; mapY?: number | null;
  description: string; notes?: string | null; imageUrl?: string | null;
}
export interface MapCharacter {
  id: string; name: string; class: string; race: string; isActive: boolean;
  hair?: string | null; skin?: string | null; avatarUrl?: string | null;
}
export interface MapEntry {
  id: string; session: number; date: string; title: string; excerpt: string;
  locationIds: string[]; characterIds: string[];
}
export interface MapData {
  locations: MapLocation[];
  characters: MapCharacter[];
  entries: MapEntry[];
  canEdit: boolean;
}

export interface Step {
  index: number;
  entry: MapEntry;
  location: MapLocation;
  members: string[];      // character ids present from this step on
  newMembers: string[];   // characters joining at this step
}

export interface EngineHooks {
  onSelectLocation(loc: MapLocation): void;
  onStepChange(step: Step | null, steps: Step[]): void;
  onLocationMoved(loc: MapLocation): Promise<boolean>;
  onReady(): void;
}

type Pt = { x: number; y: number };

const BUBBLE_DWELL_MS = 4200;
const WALK_PX_PER_SEC = 110;
// idle formation (world px): two rows so the 16×25 portrait sprites don't overlap
const FORMATION: [number, number][] = [[0, 0], [-21, 4], [21, 4], [-11, -27], [11, -27], [0, 29], [-33, -25], [33, -25], [-23, 31], [23, 31]];

function esc(s: string) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }

export function initWorldMap(viewport: HTMLElement, data: MapData, hooks: EngineHooks) {
  const canvas = viewport.querySelector<HTMLCanvasElement>('#worldCanvas')!;
  const spriteLayer = viewport.querySelector<HTMLElement>('#spriteLayer')!;
  const labelLayer = viewport.querySelector<HTMLElement>('#labelLayer')!;
  const bubble = viewport.querySelector<HTMLElement>('#partyBubble')!;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const ac = new AbortController();
  const { signal } = ac;

  /* ── state ─────────────────────────────────────────────────────── */
  const cam = { x: 0, y: 0, s: 1 };
  let vw = 1, vh = 1, dpr = 1;
  let terrain: HTMLCanvasElement | null = null;
  let oceanPattern: CanvasPattern | null = null;
  let dirty = true, raf = 0, destroyed = false;
  let showTrail = true;
  let editMode = false;
  let selectedId: string | null = null;
  let hoveredId: string | null = null;

  const located = () => data.locations.filter((l) => l.visibleOnMap && l.mapX != null && l.mapY != null);
  const locWorld = (l: MapLocation): Pt => pctToWorld(Number(l.mapX), Number(l.mapY));
  /** Where the party stands at a location: just right/below the marker so the marker stays visible. */
  const standAt = (l: MapLocation): Pt => { const p = locWorld(l); return { x: p.x + 9, y: p.y + 7 }; };

  /* ── journey steps ─────────────────────────────────────────────── */
  let steps: Step[] = [];
  function buildSteps() {
    const byId = new Map(data.locations.map((l) => [l.id, l]));
    const entries = [...data.entries].sort((a, b) => (a.session - b.session) || a.date.localeCompare(b.date));
    const raw: { entry: MapEntry; location: MapLocation }[] = [];
    for (const e of entries) {
      let any = false;
      for (const lid of e.locationIds) {
        const loc = byId.get(lid);
        if (loc && loc.visibleOnMap && loc.mapX != null && loc.mapY != null) { raw.push({ entry: e, location: loc }); any = true; }
      }
      // entries without a mapped location still appear at the previous position so their story is told
      if (!any && raw.length) raw.push({ entry: e, location: raw[raw.length - 1].location });
    }
    // membership: join at first appearance, leave after last appearance when inactive
    const first = new Map<string, number>(), last = new Map<string, number>();
    raw.forEach(({ entry }, i) => entry.characterIds.forEach((cid) => { if (!first.has(cid)) first.set(cid, i); last.set(cid, i); }));
    const chars = new Map(data.characters.map((c) => [c.id, c]));
    steps = raw.map((r, i) => {
      const members = data.characters
        .filter((c) => first.has(c.id) && first.get(c.id)! <= i && (c.isActive || last.get(c.id)! >= i))
        .map((c) => c.id);
      const newMembers = members.filter((cid) => first.get(cid) === i && chars.has(cid));
      return { index: i, entry: r.entry, location: r.location, members, newMembers };
    });
  }

  /* ── DOM: location markers ─────────────────────────────────────── */
  const locEls = new Map<string, HTMLElement>();
  const labelEls = new Map<string, HTMLElement>();
  const spriteCache = new Map<string, HTMLCanvasElement>();
  function locSprite(type: string) {
    const key = LOCATION_SPRITES[type] ? type : 'other';
    let c = spriteCache.get(key);
    if (!c) { c = rasterize(LOCATION_SPRITES[key]); spriteCache.set(key, c); }
    return c;
  }

  function buildMarkers() {
    spriteLayer.querySelectorAll('.wm-loc').forEach((e) => e.remove());
    labelLayer.querySelectorAll('.wm-label').forEach((e) => e.remove());
    locEls.clear(); labelEls.clear();
    for (const loc of located()) {
      const p = locWorld(loc);
      const el = document.createElement('div');
      el.className = 'wm-loc' + (loc.visited ? '' : ' wm-loc-unvisited');
      el.dataset.id = loc.id;
      el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
      const sprite = locSprite(loc.type).cloneNode(true) as HTMLCanvasElement;
      (sprite.getContext('2d')!).drawImage(locSprite(loc.type), 0, 0);
      el.appendChild(sprite);
      el.addEventListener('pointerenter', () => { hoveredId = loc.id; markDirty(); });
      el.addEventListener('pointerleave', () => { if (hoveredId === loc.id) hoveredId = null; markDirty(); });
      el.addEventListener('pointerdown', (ev) => onLocPointerDown(ev, loc, el));
      spriteLayer.appendChild(el);
      locEls.set(loc.id, el);

      const label = document.createElement('div');
      label.className = 'wm-label';
      label.textContent = loc.name;
      labelLayer.appendChild(label);
      labelEls.set(loc.id, label);
    }
  }

  const regionLabels: { el: HTMLElement; x: number; y: number }[] = [];
  function buildRegionLabels() {
    for (const r of world.regions) {
      const el = document.createElement('div');
      el.className = 'wm-region';
      el.textContent = r.name;
      labelLayer.appendChild(el);
      regionLabels.push({ el, x: r.x * TILE, y: r.y * TILE });
    }
  }

  /* ── DOM: party ────────────────────────────────────────────────── */
  interface Member { id: string; el: HTMLElement; frames: HTMLCanvasElement[]; name: string }
  const members = new Map<string, Member>();
  const party = { pos: { x: 0, y: 0 } as Pt, facing: 1, frame: 0, frameAt: 0 };
  let moving: { route: Pt[]; lengths: number[]; total: number; start: number; dur: number; target: number } | null = null;
  let stepIdx = -1;
  let playing = false;
  let speed = 1;
  let dwellTimer = 0;
  const routeCache = new Map<string, Pt[]>();
  let routeQueue: [MapLocation, MapLocation][] = [];
  let routeTimer = 0;
  function queueRoutes() {
    routeQueue = [];
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1].location, b = steps[i].location;
      if (a.id !== b.id && !routeCache.has(`${a.id}>${b.id}`)) routeQueue.push([a, b]);
    }
    if (!routeTimer && routeQueue.length) routeTimer = window.setTimeout(drainRoutes, 0);
  }
  function drainRoutes() {
    routeTimer = 0;
    const started = performance.now();
    while (routeQueue.length && performance.now() - started < 12) { const [a, b] = routeQueue.shift()!; routeBetween(a, b); }
    markDirty();
    if (routeQueue.length) routeTimer = window.setTimeout(drainRoutes, 16);
  }

  const headCache = new Map<string, Promise<HTMLImageElement | null>>();
  function loadHead(ch: MapCharacter): Promise<HTMLImageElement | null> {
    if (!ch.avatarUrl) return Promise.resolve(null);
    let p = headCache.get(ch.id);
    if (!p) {
      p = new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = `/api/characters/${encodeURIComponent(ch.id)}/sprite`;
      });
      headCache.set(ch.id, p);
    }
    return p;
  }

  function memberFor(ch: MapCharacter, idx: number): Member {
    let m = members.get(ch.id);
    if (m) return m;
    const look = lookFor(ch, idx);
    const frames = characterSprites(look).map((s) => rasterize(s));
    const el = document.createElement('div');
    el.className = 'wm-char';
    el.title = ch.name;
    el.appendChild(frames[0]);
    spriteLayer.appendChild(el);
    m = { id: ch.id, el, frames, name: ch.name };
    members.set(ch.id, m);
    // swap in the portrait head once the pixelated avatar arrives
    loadHead(ch).then((head) => {
      const cur = members.get(ch.id);
      if (!head || !cur || cur !== m) return;
      cur.frames = characterSpritesWithHead(look, head);
      markDirty();
    });
    return m;
  }

  function syncMembers(step: Step | null) {
    const wanted = new Set(step ? step.members : []);
    for (const [id, m] of members) if (!wanted.has(id)) { m.el.remove(); members.delete(id); }
    if (step) step.members.forEach((cid, i) => {
      const ch = data.characters.find((c) => c.id === cid); if (!ch) return;
      const m = memberFor(ch, i);
      if (step.newMembers.includes(cid)) { m.el.classList.add('wm-char-join'); setTimeout(() => m.el.classList.remove('wm-char-join'), 900); }
    });
  }

  function routeBetween(a: MapLocation, b: MapLocation): Pt[] {
    const key = `${a.id}>${b.id}`;
    let r = routeCache.get(key);
    if (!r) {
      const pa = standAt(a), pb = standAt(b);
      r = findRoute(pa.x, pa.y, pb.x, pb.y);
      routeCache.set(key, r);
    }
    return r;
  }

  function polyLengths(route: Pt[]) {
    const lengths = [0];
    for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y));
    return { lengths, total: lengths[lengths.length - 1] };
  }
  function pointAt(route: Pt[], lengths: number[], d: number): Pt {
    if (d <= 0) return route[0];
    for (let i = 1; i < route.length; i++) {
      if (lengths[i] >= d) {
        const t = (d - lengths[i - 1]) / Math.max(1e-6, lengths[i] - lengths[i - 1]);
        return { x: route[i - 1].x + (route[i].x - route[i - 1].x) * t, y: route[i - 1].y + (route[i].y - route[i - 1].y) * t };
      }
    }
    return route[route.length - 1];
  }

  function goToStep(target: number, animate: boolean) {
    if (!steps.length) return;
    target = Math.max(0, Math.min(steps.length - 1, target));
    clearTimeout(dwellTimer);
    const prev = stepIdx >= 0 ? steps[stepIdx] : null;
    const next = steps[target];
    stepIdx = target;
    hideBubble();
    const sameSpot = prev && prev.location.id === next.location.id;
    if (!animate || !prev || sameSpot) {
      moving = null;
      party.pos = standAt(next.location);
      syncMembers(next);
      arrive();
      if (!animate) centerOn(party.pos, false);
      return;
    }
    // walk from the current position along the routed path
    const wasMoving = !!moving;
    const from = prev.location;
    const dest = standAt(next.location);
    const route = wasMoving
      ? findRoute(party.pos.x, party.pos.y, dest.x, dest.y)
      : target > prev.index ? routeBetween(from, next.location) : [...routeBetween(next.location, from)].reverse();
    const { lengths, total } = polyLengths(route);
    const dur = Math.min(14000, Math.max(900, (total / (WALK_PX_PER_SEC * speed)) * 1000));
    moving = { route, lengths, total, start: performance.now(), dur, target };
    // members that were present at the previous step walk; newcomers appear on arrival
    syncMembers({ ...next, members: next.members.filter((id) => prev.members.includes(id) || members.has(id)), newMembers: [] });
    hooks.onStepChange(next, steps);
    markDirty();
  }

  function arrive() {
    const step = steps[stepIdx];
    syncMembers(step);
    showBubble(step);
    hooks.onStepChange(step, steps);
    if (playing) {
      if (stepIdx < steps.length - 1) dwellTimer = window.setTimeout(() => goToStep(stepIdx + 1, true), BUBBLE_DWELL_MS / speed);
      else setPlaying(false);
    }
    markDirty();
  }

  function setPlaying(on: boolean) {
    playing = on;
    clearTimeout(dwellTimer);
    viewport.dispatchEvent(new CustomEvent('wm:playing', { detail: on }));
    if (on) {
      if (stepIdx >= steps.length - 1) { goToStep(0, false); }
      if (!moving) dwellTimer = window.setTimeout(() => goToStep(stepIdx + 1, true), 900);
    }
    markDirty();
  }

  /* ── speech bubble ─────────────────────────────────────────────── */
  let bubbleVisible = false;
  let bubblesEnabled = true;
  function showBubble(step: Step) {
    if (!bubblesEnabled) { hideBubble(); return; }
    const names = step.newMembers.map((id) => data.characters.find((c) => c.id === id)?.name).filter(Boolean);
    bubble.innerHTML = `
      <div class="wm-bubble-head">Session ${step.entry.session} · ${esc(step.location.name)}</div>
      <div class="wm-bubble-title">${esc(step.entry.title)}</div>
      ${step.entry.excerpt ? `<p class="wm-bubble-text">${esc(step.entry.excerpt)}</p>` : ''}
      ${names.length ? `<div class="wm-bubble-join">✦ ${esc(names.join(', '))} ${names.length > 1 ? 'join' : 'joins'} the party</div>` : ''}
      <a class="wm-bubble-link" href="/diary/${esc(step.entry.id)}">Read entry →</a>
      <button type="button" class="wm-bubble-close" title="Hide" aria-label="Hide speech bubble">×</button>`;
    bubble.querySelector('.wm-bubble-close')?.addEventListener('click', () => hideBubble());
    bubble.classList.add('wm-bubble-visible');
    bubbleVisible = true;
    markDirty();
  }
  function hideBubble() { bubble.classList.remove('wm-bubble-visible'); bubbleVisible = false; markDirty(); }

  /* ── camera ────────────────────────────────────────────────────── */
  let camAnim: { fx: number; fy: number; fs: number; tx: number; ty: number; ts: number; start: number; dur: number } | null = null;
  function minScale() { return Math.min(vw / WORLD_W, vh / WORLD_H) * 0.92; }
  function clampCam() {
    cam.s = Math.max(minScale(), Math.min(8, cam.s));
    const mw = WORLD_W * cam.s, mh = WORLD_H * cam.s;
    const padX = vw * 0.5, padY = vh * 0.5;
    if (mw < vw) cam.x = -(vw - mw) / 2 / cam.s;
    else cam.x = Math.max(-padX / cam.s, Math.min((mw - vw + padX) / cam.s, cam.x));
    if (mh < vh) cam.y = -(vh - mh) / 2 / cam.s;
    else cam.y = Math.max(-padY / cam.s, Math.min((mh - vh + padY) / cam.s, cam.y));
  }
  function zoomAt(sx: number, sy: number, factor: number) {
    const wx = cam.x + sx / cam.s, wy = cam.y + sy / cam.s;
    cam.s = Math.max(minScale(), Math.min(8, cam.s * factor));
    cam.x = wx - sx / cam.s; cam.y = wy - sy / cam.s;
    clampCam(); markDirty();
  }
  function centerOn(p: Pt, animate: boolean, targetScale?: number) {
    const ts = targetScale ?? Math.max(cam.s, 1.6);
    const tx = p.x - vw / 2 / ts, ty = p.y - vh / 2 / ts;
    if (!animate) { cam.x = tx; cam.y = ty; cam.s = ts; clampCam(); markDirty(); return; }
    camAnim = { fx: cam.x, fy: cam.y, fs: cam.s, tx, ty, ts, start: performance.now(), dur: 650 };
    markDirty();
  }
  function fitWorld() {
    cam.s = minScale();
    cam.x = -(vw - WORLD_W * cam.s) / 2 / cam.s;
    cam.y = -(vh - WORLD_H * cam.s) / 2 / cam.s;
    clampCam(); markDirty();
  }
  function resize() {
    const r = viewport.getBoundingClientRect();
    vw = Math.max(1, r.width); vh = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    canvas.style.width = `${vw}px`; canvas.style.height = `${vh}px`;
    clampCam(); markDirty();
  }

  /* ── input ─────────────────────────────────────────────────────── */
  const pointers = new Map<number, Pt>();
  let dragLoc: { loc: MapLocation; el: HTMLElement; moved: boolean; dx: number; dy: number } | null = null;
  let panStart: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  let pinch: { d: number; s: number; mx: number; my: number } | null = null;

  function onLocPointerDown(ev: PointerEvent, loc: MapLocation, el: HTMLElement) {
    if (editMode && data.canEdit) {
      ev.stopPropagation(); ev.preventDefault();
      // keep the grab offset so the marker does not jump to the pointer
      const r = viewport.getBoundingClientRect(), p = locWorld(loc);
      dragLoc = { loc, el, moved: false, dx: p.x - (cam.x + (ev.clientX - r.left) / cam.s), dy: p.y - (cam.y + (ev.clientY - r.top) / cam.s) };
      el.setPointerCapture(ev.pointerId);
      el.addEventListener('pointermove', onLocDrag, { signal });
      el.addEventListener('pointerup', onLocDrop, { signal, once: true });
      return;
    }
    ev.stopPropagation();
    selectLocation(loc);
  }
  function onLocDrag(ev: PointerEvent) {
    if (!dragLoc) return;
    const r = viewport.getBoundingClientRect();
    const wx = cam.x + (ev.clientX - r.left) / cam.s + dragLoc.dx, wy = cam.y + (ev.clientY - r.top) / cam.s + dragLoc.dy;
    const pct = worldToPct(wx, wy);
    dragLoc.loc.mapX = Math.round(pct.mapX * 10) / 10; dragLoc.loc.mapY = Math.round(pct.mapY * 10) / 10;
    dragLoc.moved = true;
    const p = locWorld(dragLoc.loc);
    dragLoc.el.style.left = `${p.x}px`; dragLoc.el.style.top = `${p.y}px`;
    viewport.dispatchEvent(new CustomEvent('wm:coords', { detail: dragLoc.loc }));
    markDirty();
  }
  async function onLocDrop() {
    if (!dragLoc) return;
    const d = dragLoc; dragLoc = null;
    d.el.removeEventListener('pointermove', onLocDrag);
    if (d.moved) { await hooks.onLocationMoved(d.loc); afterLocationsChanged(); }
    else selectLocation(d.loc);
  }

  function selectLocation(loc: MapLocation) {
    selectedId = loc.id;
    hooks.onSelectLocation(loc);
    markDirty();
  }

  viewport.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    // let the speech bubble (and its link) handle its own clicks
    if ((ev.target as HTMLElement).closest('.wm-bubble')) return;
    viewport.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 1) panStart = { x: ev.clientX, y: ev.clientY, cx: cam.x, cy: cam.y, moved: false };
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      panStart = null;
    }
    camAnim = null;
  }, { signal });
  viewport.addEventListener('pointermove', (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = viewport.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      const wx = cam.x + (pinch.mx - r.left) / cam.s, wy = cam.y + (pinch.my - r.top) / cam.s;
      cam.s = Math.max(minScale(), Math.min(8, pinch.s * (d / pinch.d)));
      cam.x = wx - mx / cam.s; cam.y = wy - my / cam.s;
      clampCam(); markDirty();
    } else if (panStart) {
      const dx = ev.clientX - panStart.x, dy = ev.clientY - panStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) panStart.moved = true;
      cam.x = panStart.cx - dx / cam.s; cam.y = panStart.cy - dy / cam.s;
      clampCam(); markDirty();
    }
  }, { signal });
  const endPointer = (ev: PointerEvent) => {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      if (panStart && !panStart.moved && !(ev.target as HTMLElement).closest('.wm-loc, .wm-bubble')) {
        selectedId = null; markDirty();
        viewport.dispatchEvent(new CustomEvent('wm:deselect'));
      }
      panStart = null;
    } else if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      panStart = { x: p.x, y: p.y, cx: cam.x, cy: cam.y, moved: true };
    }
  };
  viewport.addEventListener('pointerup', endPointer, { signal });
  viewport.addEventListener('pointercancel', endPointer, { signal });
  viewport.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const r = viewport.getBoundingClientRect();
    zoomAt(ev.clientX - r.left, ev.clientY - r.top, Math.exp(-ev.deltaY * 0.0015));
  }, { passive: false, signal });
  viewport.addEventListener('dblclick', (ev) => {
    const r = viewport.getBoundingClientRect();
    zoomAt(ev.clientX - r.left, ev.clientY - r.top, 1.8);
  }, { signal });
  window.addEventListener('resize', resize, { signal });

  /* ── render loop ───────────────────────────────────────────────── */
  function markDirty() { dirty = true; if (!raf && !destroyed) raf = requestAnimationFrame(frame); }

  function drawTrail(now: number) {
    if (!showTrail || steps.length < 2) return;
    ctx.save();
    ctx.translate(-cam.x * cam.s, -cam.y * cam.s); ctx.scale(cam.s, cam.s);
    const dot = Math.max(1.5, 3 / cam.s), gap = Math.max(6, 9 / cam.s);
    const seen = new Set<string>();
    for (let i = 1; i < steps.length; i++) {
      const a = steps[i - 1].location, b = steps[i].location;
      if (a.id === b.id) continue;
      const key = `${a.id}>${b.id}`;
      if (seen.has(key)) continue; seen.add(key);
      const route = routeCache.get(key);
      if (!route) continue; // still being computed in the background
      const future = i > stepIdx;
      const partial = moving && moving.target === i;
      const { lengths, total } = polyLengths(route);
      const limit = partial ? (Math.min(1, (now - moving!.start) / moving!.dur)) * total : (future ? total : total);
      ctx.globalAlpha = future && !partial ? 0.28 : 0.95;
      for (let d = 0; d <= limit; d += gap) {
        const p = pointAt(route, lengths, d);
        const idx = lengths.findIndex((l) => l >= d);
        const sea = idx > 0 && segmentOverWater(route[idx - 1], route[idx]);
        const o = dot * 0.35;
        ctx.fillStyle = sea ? '#1e4d8a' : '#4a2410';
        ctx.fillRect(p.x - dot / 2 - o, p.y - dot / 2 - o, dot + 2 * o, dot + 2 * o);
        ctx.fillStyle = sea ? '#eaf4ff' : '#f0a04a';
        ctx.fillRect(p.x - dot / 2, p.y - dot / 2, dot, dot);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function updateParty(now: number) {
    if (moving) {
      const t = Math.min(1, (now - moving.start) / moving.dur);
      const d = t * moving.total;
      const p = pointAt(moving.route, moving.lengths, d);
      if (Math.abs(p.x - party.pos.x) > 0.05) party.facing = p.x >= party.pos.x ? 1 : -1;
      party.pos = p;
      if (now - party.frameAt > 150) { party.frame ^= 1; party.frameAt = now; }
      // camera follow: keep the party inside the inner area
      const sx = (p.x - cam.x) * cam.s, sy = (p.y - cam.y) * cam.s;
      if (!camAnim && (sx < vw * 0.2 || sx > vw * 0.8 || sy < vh * 0.2 || sy > vh * 0.8)) {
        cam.x += (p.x - vw / 2 / cam.s - cam.x) * 0.08; cam.y += (p.y - vh / 2 / cam.s - cam.y) * 0.08; clampCam();
      }
      let i = 0;
      for (const m of members.values()) {
        const q = pointAt(moving.route, moving.lengths, Math.max(0, d - i * 17));
        placeMember(m, q.x, q.y, true, i);
        i++;
      }
      if (t >= 1) { moving = null; arrive(); }
    } else {
      let i = 0;
      for (const m of members.values()) {
        const [ox, oy] = FORMATION[i % FORMATION.length];
        placeMember(m, party.pos.x + ox, party.pos.y + oy, false, i);
        i++;
      }
    }
  }
  function placeMember(m: Member, x: number, y: number, walking: boolean, i: number) {
    m.el.style.left = `${x}px`; m.el.style.top = `${y}px`;
    m.el.style.zIndex = String(1000 + Math.round(y));
    const frame = walking ? m.frames[party.frame] : m.frames[0];
    if (m.el.firstChild !== frame) { m.el.replaceChildren(frame); }
    const k = Math.max(1, 1 / cam.s);
    m.el.style.transform = `translate(-50%, -100%) scale(${k * party.facing}, ${k})`;
    if (!walking) m.el.style.animationDelay = `${(i * 137) % 900}ms`;
  }

  function layoutLabels() {
    const k = Math.max(1, 0.9 / cam.s);
    for (const [id, el] of locEls) {
      el.style.transform = `translate(-50%, -100%) scale(${k})`;
      el.classList.toggle('wm-loc-selected', id === selectedId);
    }
    for (const [id, el] of labelEls) {
      const loc = data.locations.find((l) => l.id === id)!;
      const p = locWorld(loc);
      const sx = (p.x - cam.x) * cam.s, sy = (p.y - cam.y) * cam.s;
      const atParty = bubbleVisible && stepIdx >= 0 && steps[stepIdx]?.location.id === id; // the bubble already names it
      const show = !atParty && sx > -80 && sx < vw + 80 && sy > -40 && sy < vh + 40 &&
        (cam.s >= 1.15 || loc.type === 'city' && cam.s >= 0.55 || id === hoveredId || id === selectedId);
      el.style.display = show ? 'block' : 'none';
      if (show) { el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy + 4)}px) translateX(-50%)`; el.classList.toggle('wm-label-active', id === hoveredId || id === selectedId); }
    }
    for (const r of regionLabels) {
      const sx = (r.x - cam.x) * cam.s, sy = (r.y - cam.y) * cam.s;
      const show = cam.s < 2.6 && cam.s > 0.18;
      r.el.style.display = show ? 'block' : 'none';
      if (show) {
        r.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -50%)`;
        r.el.style.fontSize = `${Math.round(Math.min(34, Math.max(13, 9 + cam.s * 10)))}px`;
        r.el.style.opacity = String(Math.max(0.25, Math.min(0.9, 1.2 - cam.s * 0.3)));
      }
    }
    if (bubbleVisible) {
      const sx = (party.pos.x - cam.x) * cam.s, sy = (party.pos.y - cam.y) * cam.s - 18 * Math.max(1, 1 / cam.s) * cam.s;
      const bw = bubble.offsetWidth || 240;
      const left = Math.max(8, Math.min(vw - bw - 8, sx - bw / 2));
      bubble.style.left = `${Math.round(left)}px`;
      const bh = bubble.offsetHeight || 160;
      const below = sy - bh - 10 < 8;
      bubble.style.top = `${Math.round(below ? sy + 18 : sy)}px`;
      bubble.style.setProperty('--tail-x', `${Math.round(sx - left)}px`);
      bubble.classList.toggle('wm-bubble-below', below);
    }
  }

  function frame(now: number) {
    raf = 0;
    if (destroyed) return;
    if (camAnim) {
      const t = Math.min(1, (now - camAnim.start) / camAnim.dur), e = 1 - Math.pow(1 - t, 3);
      cam.x = camAnim.fx + (camAnim.tx - camAnim.fx) * e; cam.y = camAnim.fy + (camAnim.ty - camAnim.fy) * e; cam.s = camAnim.fs + (camAnim.ts - camAnim.fs) * e;
      if (t >= 1) camAnim = null;
      clampCam(); dirty = true;
    }
    if (moving) dirty = true;
    if (!dirty) return;
    dirty = false;
    updateParty(now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#2b63a8'; ctx.fillRect(0, 0, vw, vh);
    if (oceanPattern) {
      // endless sea around the traced world, drawn in world space so it scrolls and scales with the map
      ctx.save();
      ctx.translate(Math.round(-cam.x * cam.s), Math.round(-cam.y * cam.s)); ctx.scale(cam.s, cam.s);
      ctx.imageSmoothingEnabled = cam.s < 1;
      ctx.fillStyle = oceanPattern;
      ctx.fillRect(cam.x - 2, cam.y - 2, vw / cam.s + 4, vh / cam.s + 4);
      ctx.restore();
    }
    if (terrain) {
      ctx.imageSmoothingEnabled = cam.s < 1;
      ctx.drawImage(terrain, Math.round(-cam.x * cam.s), Math.round(-cam.y * cam.s), Math.round(WORLD_W * cam.s), Math.round(WORLD_H * cam.s));
    }
    drawTrail(now);
    spriteLayer.style.transform = `translate(${Math.round(-cam.x * cam.s)}px, ${Math.round(-cam.y * cam.s)}px) scale(${cam.s})`;
    layoutLabels();
    if (moving || camAnim) markDirty();
  }

  function afterLocationsChanged() {
    routeCache.clear();
    buildSteps();
    queueRoutes();
    buildMarkers();
    if (stepIdx >= 0 && steps.length) { stepIdx = Math.min(stepIdx, steps.length - 1); party.pos = standAt(steps[stepIdx].location); hooks.onStepChange(steps[stepIdx], steps); }
    markDirty();
  }

  /* ── boot ──────────────────────────────────────────────────────── */
  resize();
  fitWorld();
  buildRegionLabels();
  buildSteps();
  buildMarkers();
  // draw the ocean immediately, then the terrain once the sprites are rasterised
  markDirty();
  setTimeout(() => {
    if (destroyed) return;
    terrain = renderTerrain();
    oceanPattern = ctx.createPattern(renderOceanSwatch(), 'repeat');
    queueRoutes();
    if (steps.length) {
      stepIdx = steps.length - 1;
      party.pos = standAt(steps[stepIdx].location);
      syncMembers(steps[stepIdx]);
      showBubble(steps[stepIdx]);
      // phones: start close to the party instead of the whole (tiny) world
      if (vw < 640) centerOn(party.pos, false, 1.3);
      hooks.onStepChange(steps[stepIdx], steps);
    } else hooks.onStepChange(null, steps);
    hooks.onReady();
    markDirty();
  }, 30);

  document.addEventListener('astro:before-swap', () => api.destroy(), { once: true });

  const api = {
    get steps() { return steps; },
    get stepIndex() { return stepIdx; },
    get playing() { return playing; },
    get speed() { return speed; },
    get editMode() { return editMode; },
    get trailVisible() { return showTrail; },
    goToStep: (i: number, animate = true) => goToStep(i, animate),
    next: () => goToStep(stepIdx + 1, true),
    prev: () => goToStep(stepIdx - 1, true),
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    togglePlay: () => setPlaying(!playing),
    setSpeed: (s: number) => { speed = s; },
    zoomIn: () => zoomAt(vw / 2, vh / 2, 1.5),
    zoomOut: () => zoomAt(vw / 2, vh / 2, 1 / 1.5),
    fitWorld,
    centerOnParty: () => centerOn(party.pos, true, Math.max(cam.s, 2)),
    centerOnLocation: (loc: MapLocation) => centerOn(locWorld(loc), true),
    setTrail: (on: boolean) => { showTrail = on; markDirty(); },
    get bubblesEnabled() { return bubblesEnabled; },
    setBubbles: (on: boolean) => { bubblesEnabled = on; if (on && stepIdx >= 0 && !moving) showBubble(steps[stepIdx]); else hideBubble(); },
    setEditMode: (on: boolean) => { editMode = on; viewport.classList.toggle('wm-editing', on); },
    select: (loc: MapLocation) => selectLocation(loc),
    locationsChanged: afterLocationsChanged,
    destroy: () => { destroyed = true; ac.abort(); clearTimeout(dwellTimer); clearTimeout(routeTimer); if (raf) cancelAnimationFrame(raf); },
  };
  return api;
}

export type WorldMapApi = ReturnType<typeof initWorldMap>;
