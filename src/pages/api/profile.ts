import type { APIRoute } from 'astro';
import { db, User, Character, eq } from 'astro:db';
import { getCurrentUser, hashPassword, verifyPassword } from '../../lib/auth';
import { requireAuth } from '../../lib/middleware';

// GET - Get current user's profile
export const GET: APIRoute = async ({ cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const user = await getCurrentUser(cookies);
    
    // Defense in depth: verify user exists even though requireAuth passed
    // This protects against edge cases where session exists but user was deleted
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return user profile without password hash
    return new Response(JSON.stringify({
      id: user.id,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      profileImageUrl: user.profileImageUrl,
      characterIds: user.characterIds,
      createdAt: user.createdAt,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT - Update current user's profile (password change only)
export const PUT: APIRoute = async ({ request, cookies }) => {
  const authError = requireAuth(cookies);
  if (authError) return authError;

  try {
    const user = await getCurrentUser(cookies);
    
    // Defense in depth: verify user exists even though requireAuth passed
    // This protects against edge cases where session exists but user was deleted
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { currentPassword, newPassword, firstName, profileImageUrl, characterIds } = body;

    // Handle profile information updates (firstName, profileImageUrl, characterIds)
    if (!currentPassword && !newPassword) {
      // Only updating profile info, no password change
      const updateData: any = {};
      
      if (firstName !== undefined) {
        // Validate firstName
        if (firstName && firstName.length > 100) {
          return new Response(JSON.stringify({ error: 'First name must be 100 characters or less' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        updateData.firstName = firstName || null;
      }
      
      if (profileImageUrl !== undefined) {
        // Validate profileImageUrl
        if (profileImageUrl) {
          if (profileImageUrl.length > 500) {
            return new Response(JSON.stringify({ error: 'Profile image URL must be 500 characters or less' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          // Basic URL format validation
          try {
            const url = new URL(profileImageUrl);
            // Only allow http and https schemes
            if (!['http:', 'https:'].includes(url.protocol)) {
              return new Response(JSON.stringify({ error: 'Profile image URL must use http or https protocol' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          } catch {
            // Also allow relative paths like /uploads/image.jpg
            if (!profileImageUrl.startsWith('/')) {
              return new Response(JSON.stringify({ error: 'Profile image must be a valid URL or relative path' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          }
        }
        updateData.profileImageUrl = profileImageUrl || null;
      }
      
      if (characterIds !== undefined) {
        // Validate that characterIds is an array
        if (!Array.isArray(characterIds)) {
          return new Response(JSON.stringify({ error: 'characterIds must be an array' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        // Validate each character ID is a string
        if (characterIds.some(id => typeof id !== 'string')) {
          return new Response(JSON.stringify({ error: 'All character IDs must be strings' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        updateData.characterIds = characterIds;
      }
      
      // Update user profile
      await db.update(User)
        .set(updateData)
        .where(eq(User.id, user.id));

      // If firstName was updated and user has assigned characters, update character player field
      if (firstName !== undefined && characterIds !== undefined && characterIds.length > 0) {
        const playerName = firstName || user.username;
        
        // Update player field for all assigned characters
        for (const charId of characterIds) {
          await db.update(Character)
            .set({ player: playerName })
            .where(eq(Character.id, charId));
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Profile updated successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate that both passwords are provided for password change
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ error: 'Both current password and new password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'New password must be at least 6 characters long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Current password is incorrect' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    await db.update(User)
      .set({ passwordHash })
      .where(eq(User.id, user.id));

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Password updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
