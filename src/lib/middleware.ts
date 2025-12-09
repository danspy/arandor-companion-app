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
