import type { APIRoute } from 'astro';
import { db, DMScreenState, eq } from '@/db';
import { getUserRole } from '../../../lib/auth';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';
import { validateStartScreen } from '../../../lib/scenes';

const DM_SCREEN_STATE_ID = 'current-dm-screen';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// GET - Fetch current DM Screen state (DM/Admin only). The player display reads the public,
// filtered /api/display instead, so hidden locations and NPCs never reach players.
export const GET: APIRoute = async ({ cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    let state = await db.select().from(DMScreenState).where(eq(DMScreenState.id, DM_SCREEN_STATE_ID)).get();
    
    // Create default state if it doesn't exist
    if (!state) {
      await db.insert(DMScreenState).values({
        id: DM_SCREEN_STATE_ID,
        currentLocationId: null,
        spotlightNpcIds: [],
        customAssets: [],
        showInitiativeTracker: false,
        screenVisible: true,
        screenMode: 'live',
        placeholderImageUrl: null,
        showTimer: false,
        timerDuration: 0,
        timerStartedAt: null,
        timerPausedAt: null,
        timerStatus: 'stopped',
        updatedAt: new Date(),
      });
      state = { 
        locationHidden: false,
        hiddenNpcIds: [],
        npcsHidden: false,
        focusNpcIds: [],
        id: DM_SCREEN_STATE_ID, 
        currentLocationId: null, 
        spotlightNpcIds: [], 
        customAssets: [], 
        showInitiativeTracker: false,
        screenVisible: true,
        screenMode: 'live',
        startScreen: null,
        placeholderImageUrl: null,
        showTimer: false,
        timerDuration: 0,
        timerStartedAt: null,
        timerPausedAt: null,
        timerStatus: 'stopped',
        updatedAt: new Date() 
      };
    }

    return new Response(JSON.stringify(state), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching DM Screen state:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// PUT - Update DM Screen state (DM/Admin only)
export const PUT: APIRoute = async ({ request, cookies }) => {
  const userRole = await getUserRole(cookies);
  const canEdit = userRole === 'admin' || userRole === 'dungeonmaster';

  if (!canEdit) {
    return new Response(JSON.stringify({ error: 'Forbidden - DM/Admin only' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const updates = await request.json();

    // Screen mode and the legacy screenVisible flag stay in sync both ways
    if (updates.screenMode !== undefined && !['live', 'start', 'pause'].includes(updates.screenMode)) {
      return json({ error: 'screenMode must be live, start or pause' }, 400);
    }
    if (updates.startScreen !== undefined) {
      const checked = validateStartScreen(updates.startScreen);
      if (!checked.ok) return json({ error: checked.error }, 400);
      updates.startScreen = checked.value;
    }
    if (updates.screenMode === undefined && updates.screenVisible !== undefined) {
      updates.screenMode = updates.screenVisible ? 'live' : 'pause';
    }
    if (updates.screenMode !== undefined) updates.screenVisible = updates.screenMode !== 'pause';

    // Fetch current state
    let state = await db.select().from(DMScreenState).where(eq(DMScreenState.id, DM_SCREEN_STATE_ID)).get();

    // Timer actions are stamped with the server's clock, so the countdown is the same on every
    // device no matter how far their clocks are apart.
    const now = Date.now();
    switch (updates.timerAction) {
      case 'start':
        Object.assign(updates, { timerStatus: 'running', timerStartedAt: now, timerPausedAt: null });
        break;
      case 'resume':
        if (state?.timerStatus === 'paused' && state.timerStartedAt && state.timerPausedAt) {
          Object.assign(updates, { timerStatus: 'running', timerStartedAt: now - (state.timerPausedAt - state.timerStartedAt), timerPausedAt: null });
        }
        break;
      case 'pause':
        if (state?.timerStatus === 'running') Object.assign(updates, { timerStatus: 'paused', timerPausedAt: now });
        break;
      case 'reset':
        Object.assign(updates, { timerStatus: 'stopped', timerStartedAt: null, timerPausedAt: null });
        break;
    }
    delete updates.timerAction;

    // Only entries still in the spotlight can be hidden or focused (removing one also forgets
    // its marks)
    const spotlight: string[] = updates.spotlightNpcIds ?? state?.spotlightNpcIds ?? [];
    const hidden: string[] = updates.hiddenNpcIds ?? state?.hiddenNpcIds ?? [];
    const focus: string[] = updates.focusNpcIds ?? state?.focusNpcIds ?? [];
    if (updates.spotlightNpcIds !== undefined || updates.hiddenNpcIds !== undefined) {
      updates.hiddenNpcIds = hidden.filter((id) => spotlight.includes(id));
    }
    if (updates.spotlightNpcIds !== undefined || updates.focusNpcIds !== undefined) {
      updates.focusNpcIds = focus.filter((id) => spotlight.includes(id));
    }
    
    // Create if doesn't exist
    if (!state) {
      await db.insert(DMScreenState).values({
        id: DM_SCREEN_STATE_ID,
        currentLocationId: updates.currentLocationId ?? null,
        spotlightNpcIds: updates.spotlightNpcIds ?? [],
        locationHidden: updates.locationHidden ?? false,
        hiddenNpcIds: updates.hiddenNpcIds ?? [],
        npcsHidden: updates.npcsHidden ?? false,
        focusNpcIds: updates.focusNpcIds ?? [],
        customAssets: updates.customAssets ?? [],
        showInitiativeTracker: updates.showInitiativeTracker ?? false,
        screenVisible: updates.screenVisible ?? true,
        screenMode: updates.screenMode ?? 'live',
        startScreen: updates.startScreen ?? null,
        placeholderImageUrl: updates.placeholderImageUrl ?? null,
        showTimer: updates.showTimer ?? false,
        timerDuration: updates.timerDuration ?? 0,
        timerStartedAt: updates.timerStartedAt ?? null,
        timerPausedAt: updates.timerPausedAt ?? null,
        timerStatus: updates.timerStatus ?? 'stopped',
        updatedAt: new Date(),
      });
    } else {
      // Update existing state
      await db.update(DMScreenState)
        .set({
          currentLocationId: updates.currentLocationId !== undefined ? updates.currentLocationId : state.currentLocationId,
          spotlightNpcIds: updates.spotlightNpcIds !== undefined ? updates.spotlightNpcIds : state.spotlightNpcIds,
          locationHidden: updates.locationHidden !== undefined ? !!updates.locationHidden : state.locationHidden,
          hiddenNpcIds: updates.hiddenNpcIds !== undefined ? updates.hiddenNpcIds : state.hiddenNpcIds,
          npcsHidden: updates.npcsHidden !== undefined ? !!updates.npcsHidden : state.npcsHidden,
          focusNpcIds: updates.focusNpcIds !== undefined ? updates.focusNpcIds : state.focusNpcIds,
          customAssets: updates.customAssets !== undefined ? updates.customAssets : state.customAssets,
          showInitiativeTracker: updates.showInitiativeTracker !== undefined ? updates.showInitiativeTracker : state.showInitiativeTracker,
          screenVisible: updates.screenVisible !== undefined ? updates.screenVisible : state.screenVisible,
          screenMode: updates.screenMode !== undefined ? updates.screenMode : state.screenMode,
          startScreen: updates.startScreen !== undefined ? updates.startScreen : state.startScreen,
          placeholderImageUrl: updates.placeholderImageUrl !== undefined ? updates.placeholderImageUrl : state.placeholderImageUrl,
          showTimer: updates.showTimer !== undefined ? updates.showTimer : state.showTimer,
          timerDuration: updates.timerDuration !== undefined ? updates.timerDuration : state.timerDuration,
          timerStartedAt: updates.timerStartedAt !== undefined ? updates.timerStartedAt : state.timerStartedAt,
          timerPausedAt: updates.timerPausedAt !== undefined ? updates.timerPausedAt : state.timerPausedAt,
          timerStatus: updates.timerStatus !== undefined ? updates.timerStatus : state.timerStatus,
          updatedAt: new Date(),
        })
        .where(eq(DMScreenState.id, DM_SCREEN_STATE_ID));
    }

    // Fetch updated state
    const updatedState = await db.select().from(DMScreenState).where(eq(DMScreenState.id, DM_SCREEN_STATE_ID)).get();

    return new Response(JSON.stringify(updatedState), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating DM Screen state:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
