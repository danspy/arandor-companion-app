#!/bin/bash
# Diagnostic script to check environment variable setup for podcast feature
# Run this on your server to diagnose why OPENAI_API_KEY is not loading

echo "=========================================="
echo "Environment Variable Diagnostic Script"
echo "=========================================="
echo ""

# Check 1: Does .env file exist?
echo "1. Checking if .env file exists..."
if [ -f "/srv/arandor/.env" ]; then
    echo "   ✓ /srv/arandor/.env exists"
    
    # Check file permissions
    echo ""
    echo "2. Checking file permissions..."
    ls -l /srv/arandor/.env
    
    # Check file content (safely, without showing the actual key)
    echo ""
    echo "3. Checking file format..."
    if grep -q "^OPENAI_API_KEY=" /srv/arandor/.env; then
        echo "   ✓ OPENAI_API_KEY line found"
        # Check if it has quotes (wrong format)
        if grep -q '^OPENAI_API_KEY="' /srv/arandor/.env; then
            echo "   ✗ ERROR: API key has quotes - systemd won't parse this correctly!"
            echo "   Fix: Remove quotes from OPENAI_API_KEY value"
        elif grep -q '^OPENAI_API_KEY = ' /srv/arandor/.env; then
            echo "   ✗ ERROR: API key has spaces around = sign"
            echo "   Fix: Remove spaces (should be: OPENAI_API_KEY=sk-proj-...)"
        else
            echo "   ✓ Format looks correct (no quotes, no spaces)"
        fi
        
        # Check if it's still the placeholder
        if grep -q "REPLACE_WITH_YOUR_ACTUAL_OPENAI_API_KEY" /srv/arandor/.env; then
            echo "   ✗ ERROR: Still using placeholder value!"
            echo "   Fix: Replace with your actual API key from OpenAI"
        fi
    else
        echo "   ✗ ERROR: No OPENAI_API_KEY line found in .env file"
    fi
else
    echo "   ✗ /srv/arandor/.env does NOT exist"
    echo "   Fix: Create it by running:"
    echo "        cd /srv/arandor"
    echo "        cp .env.production .env"
    echo "        nano .env  # Edit to add your API key"
fi

# Check 2: Is systemd service file updated?
echo ""
echo "4. Checking systemd service file..."
if grep -q "EnvironmentFile.*\.env" /etc/systemd/system/arandor.service 2>/dev/null; then
    echo "   ✓ Service file has EnvironmentFile directive"
    grep "EnvironmentFile" /etc/systemd/system/arandor.service
else
    echo "   ✗ Service file does NOT have EnvironmentFile directive"
    echo "   Fix: Update the service file:"
    echo "        sudo cp /srv/arandor/arandor.service /etc/systemd/system/arandor.service"
    echo "        sudo systemctl daemon-reload"
fi

# Check 3: What environment variables can systemd see?
echo ""
echo "5. Checking what environment variables systemd can see..."
sudo systemctl show arandor.service --property=Environment | head -5

echo ""
echo "6. Checking EnvironmentFiles setting..."
sudo systemctl show arandor.service --property=EnvironmentFiles

echo ""
echo "=========================================="
echo "Quick Fix Commands"
echo "=========================================="
echo ""
echo "If .env doesn't exist or is wrong:"
echo "  cd /srv/arandor"
echo "  cp .env.production .env"
echo "  nano .env  # Add your API key (no quotes!)"
echo "  chmod 600 .env"
echo "  chown deploy:deploy .env"
echo ""
echo "If systemd service needs update:"
echo "  sudo cp /srv/arandor/arandor.service /etc/systemd/system/arandor.service"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl restart arandor.service"
echo ""
echo "Then check logs:"
echo "  sudo journalctl -u arandor.service -n 20"
echo ""
