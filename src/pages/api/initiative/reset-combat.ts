import type { APIRoute } from 'astro';
import { db, InitiativeTracker, CombatState, eq } from 'astro:db';
import { requireDungeonmasterOrAdmin } from '../../../lib/middleware';

const COMBAT_STATE_ID = 'current-combat';

// POST - Reset combat: Keep player characters with initiative 10, remove NPCs/monsters/others, reset round to 1
export const POST: APIRoute = async ({ cookies }) => {
  const authError = await requireDungeonmasterOrAdmin(cookies);
  if (authError) return authError;

  try {
    // Get all initiative entries
    const entries = await db.select().from(InitiativeTracker);
    
    // Update character entries to initiative 10
    const characterUpdates = entries
      .filter(entry => entry.type === 'character')
      .map(entry => 
        db.update(InitiativeTracker)
          .set({ 
            initiative: 10,
            updatedAt: new Date()
          })
          .where(eq(InitiativeTracker.id, entry.id))
      );
    
    // Delete non-character entries (npc, monster, other)
    const nonCharacterDeletes = entries
      .filter(entry => entry.type !== 'character')
      .map(entry => 
        db.delete(InitiativeTracker)
          .where(eq(InitiativeTracker.id, entry.id))
      );
    
    // Reset combat state to round 1, turn index 0
    const combatStateUpdate = db.update(CombatState)
      .set({
        currentRound: 1,
        currentTurnIndex: 0,
        updatedAt: new Date()
      })
      .where(eq(CombatState.id, COMBAT_STATE_ID));
    
    // Execute all updates and deletes
    await Promise.all([
      ...characterUpdates,
      ...nonCharacterDeletes,
      combatStateUpdate
    ]);

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
