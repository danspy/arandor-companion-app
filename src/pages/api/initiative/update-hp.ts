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
    const { initiativeId, hp, maxHp, tempHp, deathSaveSuccesses, deathSaveFailures, isStable } = body;

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
    
    // Validate death save values (0-3)
    const validateDeathSaveValue = (value: any, fieldName: string) => {
      if (value === undefined || value === null) return null;
      const num = Number(value);
      if (isNaN(num) || !Number.isInteger(num) || num < 0 || num > 3) {
        throw new Error(`${fieldName} must be an integer between 0 and 3`);
      }
      return num;
    };

    try {
      const validatedHp = validateHPValue(hp, 'HP');
      const validatedMaxHp = validateHPValue(maxHp, 'Max HP');
      const validatedTempHp = validateHPValue(tempHp, 'Temp HP');
      const validatedDeathSaveSuccesses = validateDeathSaveValue(deathSaveSuccesses, 'Death Save Successes');
      const validatedDeathSaveFailures = validateDeathSaveValue(deathSaveFailures, 'Death Save Failures');

      // Update HP in initiative tracker
      const now = new Date();
      const updateData: any = {
        updatedAt: now,
      };

      if (validatedHp !== null) {
        updateData.hp = validatedHp;
        // Reset death saves when HP is restored above 0
        if (validatedHp > 0) {
          updateData.deathSaveSuccesses = 0;
          updateData.deathSaveFailures = 0;
          updateData.isStable = false;
        }
      }
      if (validatedMaxHp !== null) updateData.maxHp = validatedMaxHp;
      if (validatedTempHp !== null) updateData.tempHp = validatedTempHp;
      if (validatedDeathSaveSuccesses !== null) updateData.deathSaveSuccesses = validatedDeathSaveSuccesses;
      if (validatedDeathSaveFailures !== null) updateData.deathSaveFailures = validatedDeathSaveFailures;
      if (isStable !== undefined && isStable !== null) updateData.isStable = Boolean(isStable);

      await db.update(InitiativeTracker)
        .set(updateData)
        .where(eq(InitiativeTracker.id, initiativeId));

      // Also update the character's HP in the Character table
      const characterUpdateData: any = {
        updatedAt: now,
      };
      
      if (validatedHp !== null) {
        characterUpdateData.hp = validatedHp;
        // Reset death saves when HP is restored above 0
        if (validatedHp > 0) {
          characterUpdateData.deathSaveSuccesses = 0;
          characterUpdateData.deathSaveFailures = 0;
          characterUpdateData.isStable = false;
        }
      } else {
        characterUpdateData.hp = character.hp;
      }
      
      // Set maxHp
      if (validatedMaxHp !== null) {
        characterUpdateData.maxHp = validatedMaxHp;
      } else {
        characterUpdateData.maxHp = character.maxHp;
      }
      
      // Set tempHp
      if (validatedTempHp !== null) {
        characterUpdateData.tempHp = validatedTempHp;
      } else {
        characterUpdateData.tempHp = character.tempHp;
      }
      
      // Set death saves
      if (validatedDeathSaveSuccesses !== null) {
        characterUpdateData.deathSaveSuccesses = validatedDeathSaveSuccesses;
      }
      if (validatedDeathSaveFailures !== null) {
        characterUpdateData.deathSaveFailures = validatedDeathSaveFailures;
      }
      if (isStable !== undefined && isStable !== null) {
        characterUpdateData.isStable = Boolean(isStable);
      }

      await db.update(Character)
        .set(characterUpdateData)
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
