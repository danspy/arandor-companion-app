import type { APIRoute } from 'astro';
import { db, User, eq } from 'astro:db';
import { isAuthenticated, hashPassword } from '../../../lib/auth';

// POST - Create a new user (admin-only)
export const POST: APIRoute = async ({ request, cookies }) => {
  // Check if user is authenticated
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (username.length < 3) {
      return new Response(JSON.stringify({ error: 'Username must be at least 3 characters long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if username already exists
    const existingUser = await db.select().from(User).where(eq(User.username, username));
    
    if (existingUser.length > 0) {
      return new Response(JSON.stringify({ error: 'Username already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate ID
    const id = crypto.randomUUID();

    // Insert new user
    await db.insert(User).values({
      id,
      username,
      passwordHash,
      createdAt: new Date(),
    });

    return new Response(JSON.stringify({ 
      success: true,
      user: {
        id,
        username,
        createdAt: new Date().toISOString()
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return new Response(JSON.stringify({ error: 'Failed to create user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// GET - List all users (admin-only, returns usernames only)
export const GET: APIRoute = async ({ cookies }) => {
  // Check if user is authenticated
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const users = await db.select({
      id: User.id,
      username: User.username,
      createdAt: User.createdAt,
    }).from(User);

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
