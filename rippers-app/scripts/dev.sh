#!/bin/bash
set -e

# Kill anything holding port 3000
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# Wait for port to release
sleep 1

# Start Next.js on port 3000, bound to localhost (fixes macOS IPv6 issue)
exec "$(dirname "$0")/../node_modules/.bin/next" dev --port 3000 --hostname localhost
