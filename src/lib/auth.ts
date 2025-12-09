import { db, User, eq } from 'astro:db';
import type { AstroCookies } from 'astro';

const SESSION_COOKIE_NAME = 'session';

// Simple password hashing using Node's crypto module
export async function hashPassword(password: string): Promise<string> {
  const crypto = await import('node:crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const crypto = await import('node:crypto');
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

export async function authenticateUser(username: string, password: string): Promise<boolean> {
  const users = await db.select().from(User).where(eq(User.username, username));
  
  if (users.length === 0) {
    return false;
  }
  
  const user = users[0];
  return await verifyPassword(password, user.passwordHash);
}

export function setSession(cookies: AstroCookies, username: string) {
  cookies.set(SESSION_COOKIE_NAME, username, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function getSession(cookies: AstroCookies): string | undefined {
  return cookies.get(SESSION_COOKIE_NAME)?.value;
}

export function clearSession(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE_NAME, {
    path: '/',
  });
}

export function isAuthenticated(cookies: AstroCookies): boolean {
  return !!getSession(cookies);
}

export async function getUserRole(cookies: AstroCookies): Promise<string | null> {
  const username = getSession(cookies);
  if (!username) return null;
  
  const users = await db.select().from(User).where(eq(User.username, username));
  if (users.length === 0) return null;
  
  return users[0].role || 'player';
}

export async function getCurrentUser(cookies: AstroCookies) {
  const username = getSession(cookies);
  if (!username) return null;
  
  const users = await db.select().from(User).where(eq(User.username, username));
  if (users.length === 0) return null;
  
  return users[0];
}
