#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting Heat Map Pi Kiosk all-in-one install from ${APP_DIR}"
echo
echo "This installer will:"
echo "- install system packages"
echo "- install Node.js if needed"
echo "- install app dependencies"
echo "- enable the Cog/Cage kiosk runtime"
echo "- register the kiosk services"
echo

bash "${APP_DIR}/pi/install-pi-kiosk.sh"
