#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEFAULT_SERVICE_USER="$(
  if [[ "$(id -u)" -eq 0 ]]; then
    printf '%s' "${SUDO_USER:-pi}"
  else
    id -un
  fi
)"
SERVICE_USER="${SERVICE_USER:-${DEFAULT_SERVICE_USER}}"
WIFI_COUNTRY="${WIFI_COUNTRY:-${1:-}}"
AUTO_REBOOT="${AUTO_REBOOT:-0}"

run_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

force_multi_user_target() {
  local target_path=""

  for target_path in \
    /etc/systemd/system/multi-user.target \
    /lib/systemd/system/multi-user.target \
    /usr/lib/systemd/system/multi-user.target
  do
    if [[ -e "${target_path}" ]]; then
      run_root mkdir -p /etc/systemd/system
      run_root ln -snf "${target_path}" /etc/systemd/system/default.target
      return 0
    fi
  done

  return 1
}

step() {
  printf '\n==> %s\n' "$1"
}

step "Reinstalling kiosk services from ${APP_DIR}"
run_root env SERVICE_USER="${SERVICE_USER}" WIFI_COUNTRY="${WIFI_COUNTRY}" bash "${APP_DIR}/pi/install-pi-kiosk.sh"

step "Forcing Cog/Cage kiosk boot and service enablement"
run_root systemctl daemon-reload
run_root systemctl set-default multi-user.target || true
force_multi_user_target || true

if command -v raspi-config >/dev/null 2>&1; then
  run_root raspi-config nonint do_wayland W1 || true

  if [[ -n "${WIFI_COUNTRY}" ]]; then
    run_root raspi-config nonint do_wifi_country "${WIFI_COUNTRY}" || true
  fi
fi

for unit in NetworkManager.service heatmap-app.service heatmap-kiosk.service; do
  run_root systemctl enable "${unit}" || true
done

run_root systemctl disable --now lightdm.service 2>/dev/null || true
run_root systemctl disable --now getty@tty1.service 2>/dev/null || true

if command -v rfkill >/dev/null 2>&1; then
  run_root rfkill unblock wifi || true
fi

if command -v nmcli >/dev/null 2>&1; then
  run_root nmcli radio wifi on || true
fi

run_root systemctl restart NetworkManager.service || true
run_root systemctl restart heatmap-app.service || true
run_root systemctl restart heatmap-kiosk.service || true

echo
echo "Pi kiosk rescue finished."

if [[ "${AUTO_REBOOT}" == "1" ]]; then
  echo "Rebooting now..."
  run_root systemctl reboot
else
  echo "Reboot the Pi to confirm the touchscreen app comes up cleanly:"
  echo "  sudo reboot"
fi
