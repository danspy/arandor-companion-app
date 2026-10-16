import type { APIRoute } from 'astro';
import { db, DMScreenState, eq } from '@/db';
import { isAuthenticated, getUserRole } from '../../lib/auth';

const DM_SCREEN_STATE_ID = 'current-dm-screen';

// GET - Fetch current DM Screen state (public - no authentication required)
// This endpoint is public because the player display page (/display) needs access
export const GET: APIRoute = async () => {
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
        placeholderImageUrl: null,
        showTimer: false,
        timerDuration: 0,
        timerStartedAt: null,
        timerPausedAt: null,
        timerStatus: 'stopped',
        updatedAt: new Date(),
      });
      state = { 
        id: DM_SCREEN_STATE_ID, 
        currentLocationId: null, 
        spotlightNpcIds: [], 
        customAssets: [], 
        showInitiativeTracker: false,
        screenVisible: true,
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
    
    // Fetch current state
    let state = await db.select().from(DMScreenState).where(eq(DMScreenState.id, DM_SCREEN_STATE_ID)).get();
    
    // Create if doesn't exist
    if (!state) {
      await db.insert(DMScreenState).values({
        id: DM_SCREEN_STATE_ID,
        currentLocationId: updates.currentLocationId ?? null,
        spotlightNpcIds: updates.spotlightNpcIds ?? [],
        customAssets: updates.customAssets ?? [],
        showInitiativeTracker: updates.showInitiativeTracker ?? false,
        screenVisible: updates.screenVisible ?? true,
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
          customAssets: updates.customAssets !== undefined ? updates.customAssets : state.customAssets,
          showInitiativeTracker: updates.showInitiativeTracker !== undefined ? updates.showInitiativeTracker : state.showInitiativeTracker,
          screenVisible: updates.screenVisible !== undefined ? updates.screenVisible : state.screenVisible,
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
