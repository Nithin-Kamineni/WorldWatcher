#!/usr/bin/env bash
# Starts the WorldWatcher stack and prints the URLs to reach it, including
# a LAN URL for other devices (phone, another machine) on the same network.
set -e

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

docker compose up -d
echo
docker compose ps

lan_ip=""
if command -v ip >/dev/null 2>&1; then
  # Linux
  lan_ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i=="src") print $(i+1)}')"
elif command -v ipconfig >/dev/null 2>&1; then
  # macOS
  for iface in en0 en1; do
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [ -n "$ip" ]; then lan_ip="$ip"; break; fi
  done
fi

echo
echo "WorldWatcher is up:"
echo "  This machine:   http://localhost/campaigns  (also http://localhost:5173/campaigns)"
if [ -n "$lan_ip" ]; then
  echo "  Other devices:  http://$lan_ip/campaigns  (same WiFi/LAN only)"
else
  echo "  Other devices:  couldn't auto-detect a LAN IP - check manually (ip a / ifconfig)."
fi
