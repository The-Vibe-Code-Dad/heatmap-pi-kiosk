#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting Heat Map Pi Kiosk rescue from ${APP_DIR}"
echo
echo "This rescue will:"
echo "- rerun the kiosk installer"
echo "- force the Cog/Cage kiosk boot target"
echo "- enable NetworkManager and kiosk services"
echo "- unblock Wi-Fi when possible"
echo

bash "${APP_DIR}/pi/rescue-pi-kiosk.sh" "$@"
