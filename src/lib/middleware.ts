import type { AstroCookies } from 'astro';
import { isAuthenticated } from './auth';

export function requireAuth(cookies: AstroCookies): Response | null {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}
