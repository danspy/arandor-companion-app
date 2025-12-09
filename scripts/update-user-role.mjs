#!/usr/bin/env node

/**
 * Update User Role Script
 * 
 * This script updates the role of an existing user in the Arandor Companion App database.
 * Useful for updating users that were created before the role system was implemented.
 * 
 * Usage:
 *   node scripts/update-user-role.mjs <username> <role>
 *   
 * Example:
 *   node scripts/update-user-role.mjs admin admin
 *   node scripts/update-user-role.mjs john dungeonmaster
 * 
 * Roles: admin, dungeonmaster, player
 */

import { createClient } from '@libsql/client';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Error: Invalid arguments');
    console.error('');
    console.error('Usage:');
    console.error('  node scripts/update-user-role.mjs <username> <role>');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/update-user-role.mjs admin admin');
    console.error('  node scripts/update-user-role.mjs john dungeonmaster');
    console.error('');
    console.error('Roles: admin, dungeonmaster, player');
    process.exit(1);
  }

  const [username, role] = args;

  // Validate role
  const validRoles = ['admin', 'dungeonmaster', 'player'];
  if (!validRoles.includes(role)) {
    console.error(`Error: Invalid role '${role}'`);
    console.error('Valid roles: admin, dungeonmaster, player');
    process.exit(1);
  }

  // Determine database path from environment or use default
  const dbPath = process.env.ASTRO_DATABASE_FILE || './data/content.db';
  
  console.log(`Using database: ${dbPath}`);
  
  try {
    // Create client connection
    const client = createClient({
      url: `file:${dbPath}`
    });
    
    // Check if user exists
    const existingUserResult = await client.execute({
      sql: 'SELECT id, username, role FROM User WHERE username = ?',
      args: [username]
    });
    
    if (existingUserResult.rows.length === 0) {
      console.error(`Error: User '${username}' not found`);
      console.error('');
      console.error('Available users:');
      const allUsers = await client.execute('SELECT username, role FROM User');
      allUsers.rows.forEach(user => {
        console.error(`  - ${user.username} (${user.role || 'no role set'})`);
      });
      process.exit(1);
    }
    
    const user = existingUserResult.rows[0];
    const oldRole = user.role || 'no role set';
    
    console.log('');
    console.log('Current user information:');
    console.log(`  Username: ${user.username}`);
    console.log(`  Current role: ${oldRole}`);
    console.log(`  New role: ${role}`);
    console.log('');
    
    // Update user role
    const result = await client.execute({
      sql: 'UPDATE User SET role = ? WHERE username = ?',
      args: [role, username]
    });
    
    if (result.rowsAffected === 1) {
      console.log('✅ User role updated successfully!');
      console.log(`   Username: ${username}`);
      console.log(`   Old role: ${oldRole}`);
      console.log(`   New role: ${role}`);
      console.log('');
      console.log('The user can now login with their updated permissions');
    } else {
      console.error('Error: Failed to update user role');
      process.exit(1);
    }
    
    client.close();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    
    if (error.code === 'SQLITE_CANTOPEN' || error.code === 'ENOENT') {
      console.error('');
      console.error('Database file not found. Please ensure:');
      console.error('1. The database has been created (run npm run build first)');
      console.error('2. The ASTRO_DATABASE_FILE environment variable points to the correct location');
      console.error(`   Current path: ${dbPath}`);
    }
    
    process.exit(1);
  }
}

main();
