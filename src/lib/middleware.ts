import type { AstroCookies } from 'astro';
import { isAuthenticated, getUserRole } from './auth';

export function requireAuth(cookies: AstroCookies): Response | null {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}

export async function requireRole(cookies: AstroCookies, allowedRoles: string[]): Promise<Response | null> {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const userRole = await getUserRole(cookies);
  if (!userRole || !allowedRoles.includes(userRole)) {
    return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return null;
}

export async function requireAdmin(cookies: AstroCookies): Promise<Response | null> {
  return await requireRole(cookies, ['admin']);
}

export async function requireDungeonmasterOrAdmin(cookies: AstroCookies): Promise<Response | null> {
  return await requireRole(cookies, ['dungeonmaster', 'admin']);
}

export async function requirePlayerOrAbove(cookies: AstroCookies): Promise<Response | null> {
  return await requireRole(cookies, ['player', 'dungeonmaster', 'admin']);
}

/** For responses that show DM-only fields to the DM and admins and leave them out for everyone else. */
export async function isDungeonmasterOrAdmin(cookies: AstroCookies): Promise<boolean> {
  const role = await getUserRole(cookies);
  return role === 'dungeonmaster' || role === 'admin';
}
