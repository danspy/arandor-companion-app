#!/bin/bash
set -e

# CONFIGURABLE LOCATIONS
OLD_DB="/tmp/astro-build.db"          # Your currently-used Astro DB file (change if different)
NEW_DB="/srv/arandor/data/content.db" # Where you want the DB file to live

# Ensure target directory exists
mkdir -p "$(dirname "$NEW_DB")"

# If current DB exists, copy it over for migration; else, create a blank file
if [ -f "$OLD_DB" ]; then
    echo "Copying $OLD_DB to $NEW_DB for migration..."
    cp "$OLD_DB" "$NEW_DB"
else
    if [ ! -f "$NEW_DB" ]; then
        echo "No existing DB found -- initializing blank DB at $NEW_DB"
        touch "$NEW_DB"
    fi
fi

# Correct file permissions for node or your deployment user
chown $(whoami):$(whoami) "$NEW_DB"   # Or use 'deploy:deploy' if your app runs as 'deploy'
chmod 660 "$NEW_DB"

# (Optional) Validate DB structure
echo "Existing tables in $NEW_DB:"
sqlite3 "$NEW_DB" ".tables"

# Run Astro build with correct database path
echo "Running production build..."
ASTRO_DATABASE_FILE="$NEW_DB" npm run build

echo ""
echo "Build complete! The database path is now set to $NEW_DB"
echo "If you use systemd:"
echo "  sudo systemctl restart arandor.service"
echo ""
echo "After restart, confirm with: lsof | grep content.db"
echo "(should show node process using $NEW_DB)"