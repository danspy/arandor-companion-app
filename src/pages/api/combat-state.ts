import type { APIRoute } from 'astro';
import { db, CombatState, eq } from '@/db';
import { requireDungeonmasterOrAdmin } from '../../lib/middleware';
import { advanceTurn, type TurnAction } from '../../lib/combat';

const COMBAT_STATE_ID = 'current-combat';

// GET - Fetch current combat state (public - no authentication required)
// This endpoint is public because the player display page (/display) needs access
export const GET: APIRoute = async () => {
  try {
    let state = await db.select().from(CombatState).where(eq(CombatState.id, COMBAT_STATE_ID)).get();
    
    // Create default state if it doesn't exist
    if (!state) {
      await db.insert(CombatState).values({
        id: COMBAT_STATE_ID,
        currentRound: 1,
        currentTurnIndex: 0,
        status: 'stopped',
        updatedAt: new Date(),
      });
      state = { id: COMBAT_STATE_ID, currentRound: 1, currentTurnIndex: 0, status: 'stopped', updatedAt: new Date() };
    }

    return new Response(JSON.stringify(state), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching combat state:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch combat state' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const data = await request.json();
    const { currentRound, currentTurnIndex, status } = data;

    // Validate required fields
    if (currentRound !== undefined && typeof currentRound !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid currentRound' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (currentTurnIndex !== undefined && typeof currentTurnIndex !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid currentTurnIndex' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (status !== undefined && !['active', 'paused', 'stopped'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status. Must be active, paused, or stopped' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Upsert combat state
    const existing = await db.select().from(CombatState).where(eq(CombatState.id, COMBAT_STATE_ID)).get();
    
    const updateData: any = { updatedAt: new Date() };
    if (currentRound !== undefined) updateData.currentRound = currentRound;
    if (currentTurnIndex !== undefined) updateData.currentTurnIndex = currentTurnIndex;
    if (status !== undefined) updateData.status = status;
    
    if (existing) {
      await db.update(CombatState)
        .set(updateData)
        .where(eq(CombatState.id, COMBAT_STATE_ID));
    } else {
      await db.insert(CombatState).values({
        id: COMBAT_STATE_ID,
        currentRound: currentRound || 1,
        currentTurnIndex: currentTurnIndex || 0,
        status: status || 'stopped',
        updatedAt: new Date(),
      });
    }

    const updated = await db.select().from(CombatState).where(eq(CombatState.id, COMBAT_STATE_ID)).get();

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating combat state:', error);
    return new Response(JSON.stringify({ error: 'Failed to update combat state' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST - Move the turn on the server: { action: 'start' | 'next' | 'prev' | 'new-fight' }.
// 'start' continues at the stored round and turn; only 'new-fight' goes back to round 1.
// The tracker and the DM screen both use this, so they can't compute different turns.
export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const { action } = await request.json();
    if (!['start', 'next', 'prev', 'new-fight'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action. Must be start, next, prev or new-fight' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await advanceTurn(action as TurnAction);
    return new Response(JSON.stringify(result), {
      status: 'error' in result ? 409 : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error advancing turn:', error);
    return new Response(JSON.stringify({ error: 'Failed to update combat state' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
