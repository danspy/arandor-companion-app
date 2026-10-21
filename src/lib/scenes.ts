// Saved display scenes and the start screen of the DM screen. Pure logic, shared by the API
// routes and the browser, so nothing server-only may be imported here (types only).

import type { DMScreenState } from '@/db';

type DMScreenStateRow = typeof DMScreenState.$inferSelect;

export type ScreenMode = 'live' | 'start' | 'pause';

export interface StartScreen {
  title: string;
  session: number | null;
  date: string; // YYYY-MM-DD
  recap: string;
  showRecap: boolean;
}

export interface SceneSetup {
  locationId: string | null;
  locationHidden: boolean;
  spotlightIds: string[]; // NPC id or `character:<id>`, same keys as the live spotlight
  hiddenIds: string[];
  focusIds: string[];
  npcsHidden: boolean;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// Spotlight without duplicates; hidden/focus marks only on entries that are in the spotlight.
export function normalizeSetup(s: SceneSetup): SceneSetup {
  const spotlightIds = [...new Set(s.spotlightIds)];
  const inSpotlight = new Set(spotlightIds);
  return {
    ...s,
    spotlightIds,
    hiddenIds: [...new Set(s.hiddenIds)].filter((id) => inSpotlight.has(id)),
    focusIds: [...new Set(s.focusIds)].filter((id) => inSpotlight.has(id)),
  };
}

export function snapshotSetup(state: DMScreenStateRow): SceneSetup {
  return normalizeSetup({
    locationId: state.currentLocationId ?? null,
    locationHidden: !!state.locationHidden,
    spotlightIds: strings(state.spotlightNpcIds),
    hiddenIds: strings(state.hiddenNpcIds),
    focusIds: strings(state.focusNpcIds),
    npcsHidden: !!state.npcsHidden,
  });
}

// The DMScreenState fields a scene replaces. Initiative tracker and timer are not touched.
export function setupToStateUpdate(
  s: SceneSetup,
  exists: { npcIds: Set<string>; characterIds: Set<string>; locationIds: Set<string> },
) {
  const known = (id: string) =>
    id.startsWith('character:') ? exists.characterIds.has(id.slice('character:'.length)) : exists.npcIds.has(id);
  const n = normalizeSetup({ ...s, spotlightIds: s.spotlightIds.filter(known) });
  return {
    currentLocationId: n.locationId && exists.locationIds.has(n.locationId) ? n.locationId : null,
    locationHidden: n.locationHidden,
    spotlightNpcIds: n.spotlightIds,
    hiddenNpcIds: n.hiddenIds,
    focusNpcIds: n.focusIds,
    npcsHidden: n.npcsHidden,
    screenMode: 'live' as const,
    screenVisible: true as const,
  };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

// Spotlight order matters, the order of the marks does not.
export function matchesSetup(state: DMScreenStateRow, s: SceneSetup): boolean {
  const live = snapshotSetup(state);
  const want = normalizeSetup(s);
  return (
    live.locationId === want.locationId &&
    live.locationHidden === want.locationHidden &&
    live.npcsHidden === want.npcsHidden &&
    live.spotlightIds.length === want.spotlightIds.length &&
    live.spotlightIds.every((id, i) => id === want.spotlightIds[i]) &&
    sameSet(live.hiddenIds, want.hiddenIds) &&
    sameSet(live.focusIds, want.focusIds)
  );
}

export function validateScene(
  body: unknown,
): { ok: true; name: string; setup: SceneSetup } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < 1 || name.length > 80) return { ok: false, error: 'Name must be 1 to 80 characters' };
  const raw = b.setup;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Setup is required' };
  const r = raw as Record<string, unknown>;
  for (const k of ['spotlightIds', 'hiddenIds', 'focusIds']) {
    if (r[k] !== undefined && !(Array.isArray(r[k]) && (r[k] as unknown[]).every((x) => typeof x === 'string'))) {
      return { ok: false, error: `${k} must be a list of ids` };
    }
  }
  if (r.locationId != null && typeof r.locationId !== 'string') return { ok: false, error: 'locationId must be text or null' };
  const setup = normalizeSetup({
    locationId: typeof r.locationId === 'string' && r.locationId ? r.locationId : null,
    locationHidden: r.locationHidden === true,
    spotlightIds: strings(r.spotlightIds),
    hiddenIds: strings(r.hiddenIds),
    focusIds: strings(r.focusIds),
    npcsHidden: r.npcsHidden === true,
  });
  return { ok: true, name, setup };
}

export function validateStartScreen(body: unknown): { ok: true; value: StartScreen } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (title.length > 120) return { ok: false, error: 'Title is too long (max 120 characters)' };
  const recap = typeof b.recap === 'string' ? b.recap : '';
  if (recap.length > 5000) return { ok: false, error: 'Recap is too long (max 5000 characters)' };
  const session = b.session ?? null;
  if (session !== null && !(Number.isInteger(session) && (session as number) >= 1)) {
    return { ok: false, error: 'Session must be a whole number of at least 1' };
  }
  const date = typeof b.date === 'string' ? b.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Date must be YYYY-MM-DD' };
  return { ok: true, value: { title, session: session as number | null, date, recap, showRecap: b.showRecap === true } };
}

// Pre-filled start screen: next session number, today, and the latest session's summary as recap.
export function startDefaults(
  diary: { session: number; summary: string | null }[],
  today: string,
): { session: number | null; date: string; recap: string } {
  if (!diary.length) return { session: null, date: today, recap: '' };
  const last = diary.reduce((a, b) => (b.session > a.session ? b : a));
  return { session: last.session + 1, date: today, recap: last.summary ?? '' };
}
