import type { APIRoute } from 'astro';
import { db, CombatState, eq } from 'astro:db';
import { requireAuth, requireDungeonmasterOrAdmin } from '../../lib/middleware';

const COMBAT_STATE_ID = 'current-combat';

export const GET: APIRoute = async ({ cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

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
