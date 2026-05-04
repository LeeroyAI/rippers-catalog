#!/bin/bash
set -e

# Kill anything holding port 3000
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# Wait for port to release
sleep 1

# Default: 0.0.0.0 so phones / other PCs on the same Wi‑Fi can hit this Mac (http://<LAN-IP>:3000).
# Use `npm run dev:local` to bind localhost only.
HOST="${RIPPERS_DEV_HOST:-0.0.0.0}"

if [ "$HOST" = "0.0.0.0" ]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  echo ""
  echo "Rippers dev server"
  echo "  This machine: http://localhost:3000"
  if [ -n "$LAN_IP" ]; then
    echo "  Other devices: http://${LAN_IP}:3000"
  else
    echo "  Other devices: http://<this Mac's Wi-Fi IP>:3000  (System Settings → Network)"
  fi
  echo ""
fi

exec "$(dirname "$0")/../node_modules/.bin/next" dev --port 3000 --hostname "$HOST"
