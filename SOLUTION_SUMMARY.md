# Solution Summary: Admin Role Update & Dashboard Navigation

This document answers your questions about updating the admin role on production and the Dashboard navigation item.

## Question 1: How do I update my existing admin on production to match the role admin?

### Answer: Use the new `update-user-role.mjs` script

Your existing admin user on production likely doesn't have the `admin` role set in the database. The role system was added in PR #82, so any users created before that won't have proper roles assigned.

### Quick Solution (Recommended):

```bash
# SSH to your production server
ssh deploy@your-server.com

# Navigate to your app directory
cd /srv/arandor

# Update the admin user to have the admin role
ASTRO_DATABASE_FILE=/srv/arandor/data/content.db node scripts/update-user-role.mjs admin admin
```

You should see output like:
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

### What This Does:
- Updates the `role` field in the User table for the admin user
- Grants full admin permissions including access to the `/users` page
- Allows you to manage users through the web interface
- Takes effect immediately (login again to see changes)

### Alternative Methods:

**Method 2: Direct SQL Update**
```bash
sqlite3 /srv/arandor/data/content.db "UPDATE User SET role = 'admin' WHERE username = 'admin';"
```

**Method 3: Web Interface**
If you have another admin user with proper permissions, you can update roles through the `/users` page.

### Detailed Documentation:
- See [MIGRATION_GUIDE_role_system.md](MIGRATION_GUIDE_role_system.md) for complete migration instructions
- See [scripts/README.md](scripts/README.md) for script documentation

---

## Question 2: Why is the navigation item "Dashboard" back? When did that happen?

### Answer: Dashboard was added back in PR #82 (Commit 3159658)

The "Dashboard" navigation link was added back to the navigation menu when the role system was implemented. This happened in:
- **Pull Request:** #82 - "Add role system for users"
- **Commit:** 3159658
- **Date:** December 9, 2025

### What the Dashboard Navigation Does:
- Links to the home page (`/`) 
- Provides a label for what users see when they visit the root URL
- Makes it clearer that the home page is a dashboard with campaign overview

### Dashboard Features:
The Dashboard (home page) shows:
- Campaign Progress - Current party level and progress to next level
- Faction Standings - Relationship status with different factions
- Active Quests - Summary of ongoing quests
- Party Members - Quick view of active characters
- Latest Diary Entries - Recent session notes
- Library Entries - Recent lore and knowledge

### Why Was It Added Back?
The Dashboard link was likely added back to improve navigation clarity and match the role system's access control patterns. It makes it explicit that the home page is a dashboard page, not just an empty landing page.

### Can I Remove It?
If you prefer not to have the Dashboard navigation item, you have two options:

1. **Keep the functionality, remove the link**: The Dashboard page (home `/`) will still be accessible by clicking the "Arandor Companion" logo in the navigation bar.

2. **Remove the navigation link**: Edit `src/layouts/Layout.astro` and remove the Dashboard links from both desktop and mobile navigation menus (lines 86 and 128).

---

## Summary of Changes Made

This solution provides:

### 1. New Script: `scripts/update-user-role.mjs`
- Updates the role of existing users in the database
- Validates input and provides clear error messages
- Shows before/after role information
- Lists all users if the specified user doesn't exist

### 2. Migration Guide: `MIGRATION_GUIDE_role_system.md`
- Complete migration instructions for production
- Explains the role system and its permissions
- Multiple methods for updating roles
- Troubleshooting section
- Answers about Dashboard navigation

### 3. Updated Documentation
- **README.md**: Updated User Management section with role information and migration note
- **scripts/README.md**: Added documentation for the new `update-user-role.mjs` script

### 4. Role System Overview
The system includes three roles:
- **Admin**: Full access + user management
- **Dungeon Master**: Can edit all content (currently same as Player)
- **Player**: Can edit diary, library, characters, NPCs, locations, and quests

---

## Next Steps

1. **Update your production admin user** using the script above
2. **Review the migration guide** at [MIGRATION_GUIDE_role_system.md](MIGRATION_GUIDE_role_system.md)
3. **Test the changes** by logging in and accessing the `/users` page
4. **Update other users** if needed using the same script

## Need Help?

If you encounter any issues:
1. Check the migration guide troubleshooting section
2. Verify database file path and permissions
3. Check server logs: `sudo journalctl -u arandor.service -n 100`
4. Open a GitHub issue with details about your problem

---

## Files Added/Modified

- ✅ Added: `scripts/update-user-role.mjs` - Script to update user roles
- ✅ Added: `MIGRATION_GUIDE_role_system.md` - Complete migration documentation
- ✅ Updated: `README.md` - User management section with role system info
- ✅ Updated: `scripts/README.md` - Documentation for the new script
