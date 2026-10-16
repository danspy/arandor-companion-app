#!/usr/bin/env node

/**
 * Add User Script
 * 
 * This script adds a new user to the Arandor Companion App database.
 * It uses the same database connection and password hashing as the app.
 * 
 * Usage:
 *   node scripts/add-user.mjs <username> <password> [role]
 *   
 * Example:
 *   node scripts/add-user.mjs newuser mypassword player
 * 
 * Roles: admin, dungeonmaster, player (default: player)
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { createClient } from '@libsql/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Password hashing function (matches src/lib/auth.ts)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Generate UUID v4 (simple implementation)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 2 || args.length > 3) {
    console.error('Error: Invalid arguments');
    console.error('');
    console.error('Usage:');
    console.error('  node scripts/add-user.mjs <username> <password> [role]');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/add-user.mjs john secretpassword player');
    console.error('');
    console.error('Roles: admin, dungeonmaster, player (default: player)');
    process.exit(1);
  }

  const [username, password, role = 'player'] = args;

  // Validate role
  const validRoles = ['admin', 'dungeonmaster', 'player'];
  if (!validRoles.includes(role)) {
    console.error(`Error: Invalid role '${role}'`);
    console.error('Valid roles: admin, dungeonmaster, player');
    process.exit(1);
  }

  // Validate username
  if (username.length < 3) {
    console.error('Error: Username must be at least 3 characters long');
    process.exit(1);
  }

  // Validate password
  if (password.length < 6) {
    console.error('Error: Password must be at least 6 characters long');
    process.exit(1);
  }

  // Determine database path from environment or use default
  const dbPath = process.env.DATABASE_FILE || process.env.ASTRO_DATABASE_FILE || './data/content.db';
  
  console.log(`Using database: ${dbPath}`);
  
  // Check if database file exists
  try {
    // Create client connection
    const client = createClient({
      url: `file:${dbPath}`
    });
    
    // Check if user already exists
    const existingUserResult = await client.execute({
      sql: 'SELECT username FROM User WHERE username = ?',
      args: [username]
    });
    
    if (existingUserResult.rows.length > 0) {
      console.error(`Error: User '${username}' already exists`);
      process.exit(1);
    }
    
    // Hash the password
    const passwordHash = hashPassword(password);
    
    // Insert new user
    const userId = generateUUID();
    const createdAt = new Date().getTime(); // Unix timestamp in milliseconds
    
    const result = await client.execute({
      sql: 'INSERT INTO User (id, username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [userId, username, passwordHash, role, createdAt]
    });
    
    if (result.rowsAffected === 1) {
      console.log('');
      console.log('✅ User created successfully!');
      console.log(`   Username: ${username}`);
      console.log(`   Role:     ${role}`);
      console.log(`   User ID:  ${userId}`);
      console.log('');
      console.log('The user can now login at the /login page');
    } else {
      console.error('Error: Failed to create user');
      process.exit(1);
    }
    
    client.close();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    
    if (error.code === 'SQLITE_CANTOPEN' || error.message.includes('unable to open database')) {
      console.error('');
      console.error('Database file not found. Please ensure:');
      console.error('1. The database has been created (run npm run build first)');
      console.error('2. The DATABASE_FILE environment variable points to the correct location');
      console.error(`   Current path: ${dbPath}`);
    }
    
    process.exit(1);
  }
}

main();
