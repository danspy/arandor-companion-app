import type { APIRoute } from 'astro';
import { db, InitiativeTracker, Character, User, eq } from 'astro:db';
import { requireAuth } from '../../../lib/middleware';
import { getCurrentUser } from '../../../lib/auth';

/**
 * Update HP for a specific initiative entry
 * Players can only update HP of their own characters
 * DM/Admin can update any entry (use the PUT /api/initiative/[id] endpoint instead)
 * PUT /api/initiative/update-hp
 */
export const PUT: APIRoute = async ({ request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const currentUser = await getCurrentUser(cookies);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { initiativeId, hp, maxHp, tempHp } = body;

    if (!initiativeId) {
      return new Response(JSON.stringify({ error: 'Initiative ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch the initiative entry
    const entry = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, initiativeId)).get();
    
    if (!entry) {
      return new Response(JSON.stringify({ error: 'Initiative entry not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if this is a character entry
    if (entry.type !== 'character') {
      return new Response(JSON.stringify({ error: 'Can only update HP for character entries' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch the character to check ownership
    let character;
    
    if (entry.characterId) {
      // New way: using characterId
      character = await db.select().from(Character).where(eq(Character.id, entry.characterId)).get();
    } else {
      // Fallback for legacy entries: match by name
      const characters = await db.select().from(Character);
      character = characters.find(c => c.name === entry.name);
    }
    
    if (!character) {
      return new Response(JSON.stringify({ error: 'Character not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check ownership - support both modern and legacy ownership
    let isOwner = false;
    
    // Check modern ownership first (character.userId field)
    if (character.userId) {
      isOwner = character.userId === currentUser.id;
    } else {
      // Check legacy ownership (character ID in user's characterIds array)
      const allUsers = await db.select().from(User);
      for (const user of allUsers) {
        if (user.id === currentUser.id && 
            user.characterIds && 
            Array.isArray(user.characterIds) && 
            user.characterIds.includes(character.id)) {
          isOwner = true;
          break;
        }
      }
    }
    
    if (!isOwner) {
      return new Response(JSON.stringify({ error: 'You can only update HP for your own character' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate HP values - helper function
    const validateHPValue = (value: any, fieldName: string) => {
      if (value === undefined || value === null) return null; // Allow null/undefined
      const num = Number(value);
      if (isNaN(num) || !Number.isInteger(num) || num < 0) {
        throw new Error(`${fieldName} must be a non-negative integer`);
      }
      return num;
    };

    try {
      const validatedHp = validateHPValue(hp, 'HP');
      const validatedMaxHp = validateHPValue(maxHp, 'Max HP');
      const validatedTempHp = validateHPValue(tempHp, 'Temp HP');

      // Calculate final HP values with temp HP consumption logic
      const currentHp = entry.hp ?? 0;
      const currentTempHp = entry.tempHp ?? 0;
      const currentMaxHp = entry.maxHp ?? 0;
      
      let finalHp = currentHp;
      let finalTempHp = currentTempHp;
      let finalMaxHp = currentMaxHp;
      
      // Update max HP if provided
      if (validatedMaxHp !== null) {
        finalMaxHp = validatedMaxHp;
      }
      
      // Handle HP and temp HP updates with D&D 5e rules
      // When both hp and tempHp are provided, we need to determine if this is:
      // 1. A direct set (e.g., from D&D Beyond sync) - use values as-is
      // 2. A manual update where we need to apply temp HP consumption logic
      
      // If HP is being reduced (taking damage), consume temp HP first
      if (validatedHp !== null && validatedHp < currentHp) {
        const hpLost = currentHp - validatedHp;
        
        // If temp HP value is also explicitly set to a different value, honor it (manual override)
        if (validatedTempHp !== null && validatedTempHp !== currentTempHp) {
          // User is manually setting both values - use as provided
          finalHp = validatedHp;
          finalTempHp = validatedTempHp;
        } else {
          // Apply temp HP consumption logic
          if (currentTempHp > 0) {
            if (hpLost <= currentTempHp) {
              // All damage absorbed by temp HP
              finalTempHp = currentTempHp - hpLost;
              finalHp = currentHp; // Regular HP unchanged
            } else {
              // Temp HP exhausted, remaining damage to regular HP
              const remainingDamage = hpLost - currentTempHp;
              finalTempHp = 0;
              finalHp = Math.max(0, currentHp - remainingDamage);
            }
          } else {
            // No temp HP, damage goes directly to regular HP
            finalHp = validatedHp;
          }
        }
      } else {
        // HP is being increased (healing) or set to higher value - healing doesn't affect temp HP
        if (validatedHp !== null) {
          finalHp = Math.min(validatedHp, finalMaxHp); // Can't exceed max HP
        }
        
        // Temp HP can be set independently (new temp HP, or manual override)
        if (validatedTempHp !== null) {
          finalTempHp = validatedTempHp;
        }
      }

      // Update HP in initiative tracker
      const now = new Date();
      const updateData: any = {
        updatedAt: now,
      };

      updateData.hp = finalHp;
      updateData.tempHp = finalTempHp;
      if (finalMaxHp !== currentMaxHp) updateData.maxHp = finalMaxHp;

      await db.update(InitiativeTracker)
        .set(updateData)
        .where(eq(InitiativeTracker.id, initiativeId));

      // Also update the character's HP in the Character table
      await db.update(Character)
        .set({
          hp: finalHp,
          maxHp: finalMaxHp,
          tempHp: finalTempHp,
          updatedAt: now,
        })
        .where(eq(Character.id, character.id));

      const updatedEntry = await db.select().from(InitiativeTracker).where(eq(InitiativeTracker.id, initiativeId)).get();
      
      return new Response(JSON.stringify(updatedEntry), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (validationError) {
      if (validationError instanceof Error) {
        return new Response(JSON.stringify({ error: validationError.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw validationError;
    }
  } catch (error) {
    console.error('Error updating HP:', error);
    return new Response(JSON.stringify({ error: 'Failed to update HP' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
