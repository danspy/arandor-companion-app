import { db, User, eq } from '@/db';
import type { AstroCookies } from 'astro';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const SESSION_COOKIE_NAME = 'session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

// ── Passwords ────────────────────────────────────────────────────────────────
// Stored as "pbkdf2_sha512$<iterations>$<salt>$<hash>". Hashes from before that format
// ("<salt>:<hash>", 1000 iterations) still verify and are upgraded on the next login.

const PBKDF2_ITERATIONS = 210_000;
const pbkdf2 = promisify(crypto.pbkdf2);

async function derive(password: string, salt: string, iterations: number): Promise<Buffer> {
  return pbkdf2(password, salt, iterations, 64, 'sha512');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2_sha512$${PBKDF2_ITERATIONS}$${salt}$${hash.toString('hex')}`;
}

function parseHash(stored: string): { salt: string; hash: string; iterations: number } | null {
  if (stored.startsWith('pbkdf2_sha512$')) {
    const [, iterations, salt, hash] = stored.split('$');
    return { salt, hash, iterations: Number(iterations) };
  }
  const [salt, hash] = stored.split(':');
  return salt && hash ? { salt, hash, iterations: 1000 } : null;
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const parsed = parseHash(hashedPassword);
  if (!parsed || !parsed.iterations) return false;
  const expected = Buffer.from(parsed.hash, 'hex');
  const actual = await derive(password, parsed.salt, parsed.iterations);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function needsRehash(hashedPassword: string): boolean {
  return parseHash(hashedPassword)?.iterations !== PBKDF2_ITERATIONS;
}

export async function authenticateUser(username: string, password: string): Promise<boolean> {
  const users = await db.select().from(User).where(eq(User.username, username));
  if (users.length === 0) return false;

  const user = users[0];
  if (!(await verifyPassword(password, user.passwordHash))) return false;

  if (needsRehash(user.passwordHash)) {
    await db.update(User).set({ passwordHash: await hashPassword(password) }).where(eq(User.id, user.id));
  }
  return true;
}

// ── Sessions ─────────────────────────────────────────────────────────────────
// The cookie holds "v1.<username>.<expires>.<signature>", signed with HMAC-SHA256 using
// SESSION_SECRET (set per environment by systemd, never in git). A cookie that was not
// issued by this server, was altered or has expired is treated as logged out.

let devSecret: string | null = null;

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (import.meta.env?.DEV) {
    // Local development without a configured secret: sessions last until restart.
    if (!devSecret) {
      devSecret = crypto.randomBytes(32).toString('hex');
      console.warn('SESSION_SECRET is not set; using a temporary secret (sessions end on restart).');
    }
    return devSecret;
  }
  console.error('SESSION_SECRET is missing or shorter than 32 characters; nobody can log in.');
  return null;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function setSession(cookies: AstroCookies, username: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error('Sessions are disabled: SESSION_SECRET is not configured');

  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `v1.${Buffer.from(username).toString('base64url')}.${expires}`;
  cookies.set(SESSION_COOKIE_NAME, `${payload}.${sign(payload, secret)}`, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_MAX_AGE,
  });
}

/** The logged-in username, or undefined if the cookie is missing, forged or expired. */
export function getSession(cookies: AstroCookies): string | undefined {
  const value = cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = value && sessionSecret();
  if (!value || !secret) return undefined;

  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return undefined;
  const [version, user, expires, signature] = parts;

  const expected = Buffer.from(sign(`${version}.${user}.${expires}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return undefined;
  if (Number(expires) < Date.now() / 1000) return undefined;

  return Buffer.from(user, 'base64url').toString();
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
