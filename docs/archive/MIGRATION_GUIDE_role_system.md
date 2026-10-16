# Migration Guide: Role System Update

This guide helps you migrate your production instance after the role system was added in PR #82.

## What Changed?

### 1. Role System Added
The app now has a role-based access control system with three roles:
- **Admin**: Full access including user management
- **Dungeon Master**: Can access dashboard, map, quests, and all player content
- **Player**: Can edit diary, library, characters, NPCs, and locations

### 2. Dashboard Navigation Item Returned
The "Dashboard" navigation link is now visible in both desktop and mobile navigation menus. This navigation item links to the home page (`/`) which shows the campaign dashboard with:
- Campaign progress tracker
- Faction standings
- Active quests
- Party members
- Latest diary entries
- Library entries

The Dashboard navigation was added back in **commit 3159658** (PR #82) as part of the role system implementation.

## Migration Steps for Production

### Step 1: Update Your Admin User Role

If you created your admin user before the role system was added, you need to update it to have the `admin` role.

**Option 1: Using the Command Line Script (Recommended)**

```bash
# SSH to your production server
ssh deploy@your-server.com

# Navigate to the app directory
cd /srv/arandor

# Update the admin user to have admin role
ASTRO_DATABASE_FILE=/srv/arandor/data/content.db node scripts/update-user-role.mjs admin admin
```

**Expected output:**
```
Using database: /srv/arandor/data/content.db

Current user information:
  Username: admin
  Current role: player
  New role: admin

✅ User role updated successfully!
   Username: admin
   Old role: player
   New role: admin

The user can now login with their updated permissions
```

**Option 2: Using SQL Directly**

```bash
# SSH to your production server
ssh deploy@your-server.com

# Open the database
sqlite3 /srv/arandor/data/content.db

# Check current role
SELECT username, role FROM User WHERE username = 'admin';

# Update role to admin
UPDATE User SET role = 'admin' WHERE username = 'admin';

# Verify the change
SELECT username, role FROM User WHERE username = 'admin';

# Exit sqlite
.quit
```

**Option 3: Using the Web Interface**

If you already have another admin user with proper permissions:

1. Login to the app
2. Navigate to `/users` page
3. Click "Edit" next to the admin user
4. Change the role to "Admin"
5. Click "Update User"

### Step 2: Verify the Changes

1. Login to your app at `https://your-domain.com/login`
2. You should now see the "Users" link in the navigation (admin-only)
3. Visit the `/users` page to confirm you can manage users
4. The Dashboard link should be visible in the navigation menu

### Step 3: Update Other Users (Optional)

If you have other users that were created before the role system, you can update their roles as well:

```bash
# Update a user to dungeonmaster
ASTRO_DATABASE_FILE=/srv/arandor/data/content.db node scripts/update-user-role.mjs john dungeonmaster

# Update a user to player
ASTRO_DATABASE_FILE=/srv/arandor/data/content.db node scripts/update-user-role.mjs jane player
```

## Role Permissions Reference

### Admin Role
- ✅ Full access to all pages and features
- ✅ Can manage users (create, edit, delete)
- ✅ Can view and access `/users` page
- ✅ Can edit all content (diary, library, characters, NPCs, locations, quests, factions, campaign progress)

### Dungeon Master Role
- ✅ Can view all pages except `/users`
- ✅ Can edit all content (diary, library, characters, NPCs, locations, quests, factions, campaign progress)
- ❌ Cannot manage users or access `/users` page

### Player Role
- ✅ Can view all pages except `/users`
- ✅ Can edit all content (diary, library, characters, NPCs, locations, quests, factions, campaign progress)
- ❌ Cannot manage users or access `/users` page

**Note:** Currently, Dungeon Master and Player roles have the same permissions. The distinction is there for future feature differentiation.

## Troubleshooting

### "Users" Link Not Showing After Update

1. Make sure you've updated the role to `admin` (not `Admin` or `ADMIN` - it's case-sensitive)
2. Logout and login again to refresh your session
3. Check the database to verify the role was updated:
   ```bash
   sqlite3 /srv/arandor/data/content.db "SELECT username, role FROM User WHERE username = 'admin';"
   ```

### Cannot Access `/users` Page

1. Verify your role is set to `admin`:
   ```bash
   ASTRO_DATABASE_FILE=/srv/arandor/data/content.db node scripts/update-user-role.mjs admin admin
   ```
2. Logout and login again
3. If issue persists, check the server logs for any errors

### Script Cannot Find Database

If you get an error like "Database file not found", make sure to set the `ASTRO_DATABASE_FILE` environment variable:

```bash
# Check where your database is located
ls -la /srv/arandor/data/content.db

# Use the correct path
ASTRO_DATABASE_FILE=/srv/arandor/data/content.db node scripts/update-user-role.mjs admin admin
```

## Questions About Dashboard Navigation

### Why is the Dashboard navigation item back?

The Dashboard link was added back in PR #82 (commit 3159658) as part of implementing the role-based access control system. The Dashboard provides a useful overview of:
- Campaign progress and party level
- Faction standings
- Active quests summary
- Party members at a glance
- Recent diary and library entries

### Can I remove the Dashboard link?

If you prefer not to have the Dashboard navigation item, you can edit `src/layouts/Layout.astro` and remove the Dashboard links from both the desktop and mobile navigation menus. However, note that the home page (`/`) will still be accessible by clicking the "Arandor Companion" logo.

## Need Help?

If you encounter issues during migration:

1. Check the logs: `sudo journalctl -u arandor.service -n 100`
2. Verify database permissions: `ls -la /srv/arandor/data/`
3. Open an issue on GitHub with details about your problem
