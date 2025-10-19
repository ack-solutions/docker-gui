#!/bin/bash
# Script to reload Nginx configuration

set -e

echo "Reloading Nginx configuration..."

# Test configuration first
if docker exec nginx-proxy nginx -t 2>/dev/null; then
    echo "PASS: Nginx configuration is valid"
    
    # Reload
    docker exec nginx-proxy nginx -s reload
    echo "SUCCESS: Nginx reloaded successfully"
else
    echo "ERROR: Nginx configuration has errors. Please fix them first."
    exit 1
fi

