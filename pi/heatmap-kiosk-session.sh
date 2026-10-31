#!/usr/bin/env bash
set -euo pipefail

export XDG_SESSION_TYPE="${XDG_SESSION_TYPE:-wayland}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/heatmap-kiosk}"

while true; do
  /usr/local/bin/heatmap-kiosk-browser || true
  sleep 2
done
