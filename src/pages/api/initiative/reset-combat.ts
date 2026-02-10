import type { APIRoute } from 'astro';
import { db, InitiativeTracker, CombatState, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';

const COMBAT_STATE_ID = 'current-combat';

// POST - Reset combat: Keep player characters with initiative 10, remove NPCs/monsters/others, reset round to 1
export const POST: APIRoute = async ({ cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    const { sql } = await import('astro:db');
    
    // Update all character entries to initiative 10 (batch operation)
    await db.update(InitiativeTracker)
      .set({ 
        initiative: 10,
        updatedAt: new Date()
      })
      .where(eq(InitiativeTracker.type, 'character'));
    
    // Delete all non-character entries (npc, monster, other) (batch operation)
    await db.delete(InitiativeTracker)
      .where(sql`${InitiativeTracker.type} != 'character'`);
    
    // Reset combat state to round 1, turn index 0
    await db.update(CombatState)
      .set({
        currentRound: 1,
        currentTurnIndex: 0,
        updatedAt: new Date()
      })
      .where(eq(CombatState.id, COMBAT_STATE_ID));

    return new Response(JSON.stringify({ success: true, message: 'Combat reset successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error resetting combat:', error);
    return new Response(JSON.stringify({ error: 'Failed to reset combat' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
