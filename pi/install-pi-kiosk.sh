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
NODE_MAJOR="${NODE_MAJOR:-}"
PI_IMAGE_BUILD="${PI_IMAGE_BUILD:-0}"
WIFI_COUNTRY="${WIFI_COUNTRY:-${WPA_COUNTRY:-}}"
SERVICE_HOME=""
APT_RETRIES="${APT_RETRIES:-3}"
APT_HTTP_TIMEOUT="${APT_HTTP_TIMEOUT:-30}"
APT_OPTIONS=(
  "-o" "Acquire::Retries=${APT_RETRIES}"
  "-o" "Acquire::http::Timeout=${APT_HTTP_TIMEOUT}"
  "-o" "Acquire::https::Timeout=${APT_HTTP_TIMEOUT}"
)

run_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

apt_get() {
  run_root apt-get "${APT_OPTIONS[@]}" "$@"
}

run_as_service_user() {
  local command="$1"

  if [[ "$(id -un)" == "$SERVICE_USER" ]]; then
    bash -lc "cd '${APP_DIR}' && ${command}"
  elif [[ "$(id -u)" -eq 0 ]]; then
    su - "${SERVICE_USER}" -s /bin/bash -c "cd '${APP_DIR}' && ${command}"
  else
    sudo -u "${SERVICE_USER}" bash -lc "cd '${APP_DIR}' && ${command}"
  fi
}

resolve_target_architecture() {
  if command -v dpkg >/dev/null 2>&1; then
    dpkg --print-architecture 2>/dev/null && return
  fi

  uname -m
}

resolve_target_node_major() {
  if [[ -n "${NODE_MAJOR}" ]]; then
    printf '%s\n' "${NODE_MAJOR}"
    return
  fi

  case "$(resolve_target_architecture)" in
    armhf|armv7l)
      printf '18\n'
      ;;
    *)
      printf '20\n'
      ;;
  esac
}

ensure_node_runtime() {
  local install_node=0
  local current_major=""
  local target_major=""
  local target_arch=""

  target_major="$(resolve_target_node_major)"
  target_arch="$(resolve_target_architecture)"

  if ! command -v node >/dev/null 2>&1; then
    install_node=1
  else
    current_major="$(node -p 'process.versions.node.split(".")[0]')"

    if [[ -z "${current_major}" || "${current_major}" -lt "${target_major}" ]]; then
      install_node=1
    fi
  fi

  if [[ "${install_node}" -eq 1 ]]; then
    echo "Installing Node ${target_major} runtime for ${target_arch}..."

    if [[ "${target_arch}" == "armhf" ]]; then
      # Raspberry Pi OS armhf already ships Node 18 in the distro repos.
      # NodeSource's current Node 20 setup script rejects armhf outright.
      apt_get install -y nodejs npm
      return
    fi

    curl -fsSL "https://deb.nodesource.com/setup_${target_major}.x" | run_root bash -
    apt_get install -y nodejs
  fi
}

package_installed() {
  local package_name="$1"

  dpkg-query -W -f='${Status}' "${package_name}" 2>/dev/null | grep -q "install ok installed"
}

ensure_kiosk_runtime_stack() {
  local required_packages=(
    cage
    cog
    fonts-dejavu-core
  )
  local missing_packages=()
  local package_name=""

  for package_name in "${required_packages[@]}"; do
    if ! package_installed "${package_name}"; then
      missing_packages+=("${package_name}")
    fi
  done

  if [[ "${#missing_packages[@]}" -eq 0 ]]; then
    return
  fi

  echo "Installing WebKit/Cage packages required for kiosk mode..."
  echo "Missing packages: ${missing_packages[*]}"
  apt_get install -y "${required_packages[@]}"
}

cage_supports_hide_cursor() {
  local cage_bin="$1"
  local usage_text=""

  [[ -x "${cage_bin}" ]] || return 1
  usage_text="$("${cage_bin}" -h 2>&1 || true)"
  grep -q "Hide cursor" <<<"${usage_text}"
}

install_cursorless_cage() {
  local cage_bin="/usr/local/bin/cage"
  local patch_file="${APP_DIR}/pi/cage-hide-cursor.patch"
  local build_dir=""
  local build_packages=(
    build-essential
    git
    libwayland-dev
    libwlroots-0.18-dev
    libxkbcommon-dev
    meson
    ninja-build
    patch
    pkg-config
    wayland-protocols
  )

  if cage_supports_hide_cursor "${cage_bin}"; then
    echo "Cursorless Cage is already installed at ${cage_bin}."
    return
  fi

  if [[ ! -r "${patch_file}" ]]; then
    echo "Missing Cage cursor patch: ${patch_file}" >&2
    exit 1
  fi

  echo "Building Cage v0.2.0 with hard cursor hiding for touch-only kiosk mode..."
  apt_get install -y --no-install-recommends "${build_packages[@]}"
  if ! pkg-config --exists wlroots-0.18; then
    echo "Missing wlroots-0.18 development files; install libwlroots-0.18-dev." >&2
    exit 1
  fi

  build_dir="$(mktemp -d)"
  if ! (
    cd "${build_dir}"
    env \
      GIT_TERMINAL_PROMPT=0 \
      GIT_ASKPASS= \
      SSH_ASKPASS= \
      GCM_INTERACTIVE=Never \
      git -c credential.helper= clone --depth 1 --branch v0.2.0 https://github.com/cage-kiosk/cage.git cage
    cd cage
    patch -p1 < "${patch_file}"
    meson setup build -Dman-pages=disabled --prefix=/usr/local --buildtype=release
    ninja -C build
    run_root ninja -C build install
  ); then
    rm -rf "${build_dir}"
    return 1
  fi
  rm -rf "${build_dir}"

  if ! cage_supports_hide_cursor "${cage_bin}"; then
    echo "The installed Cage binary does not expose the hide-cursor option." >&2
    exit 1
  fi
}

enable_service_links() {
  enable_systemd_unit_link "NetworkManager.service" "/etc/systemd/system/multi-user.target.wants"
  run_root mkdir -p /etc/systemd/system/multi-user.target.wants
  run_root ln -sf /etc/systemd/system/heatmap-app.service /etc/systemd/system/multi-user.target.wants/heatmap-app.service
  run_root ln -sf /etc/systemd/system/heatmap-kiosk.service /etc/systemd/system/multi-user.target.wants/heatmap-kiosk.service
  run_root rm -f /etc/systemd/system/graphical.target.wants/heatmap-kiosk.service
  run_root rm -f /etc/systemd/system/graphical.target.wants/lightdm.service
  run_root rm -f /etc/systemd/system/display-manager.service
  run_root rm -f /etc/systemd/system/getty.target.wants/getty@tty1.service
}

resolve_systemd_unit_path() {
  local unit_name="$1"
  local candidate=""

  for candidate in \
    "/etc/systemd/system/${unit_name}" \
    "/lib/systemd/system/${unit_name}" \
    "/usr/lib/systemd/system/${unit_name}"
  do
    if [[ -e "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  return 1
}

enable_systemd_unit_link() {
  local unit_name="$1"
  local target_dir="$2"
  local alias_name="${3:-}"
  local unit_path=""

  unit_path="$(resolve_systemd_unit_path "${unit_name}")" || return 1
  run_root mkdir -p "${target_dir}"
  run_root ln -sf "${unit_path}" "${target_dir}/${unit_name}"

  if [[ -n "${alias_name}" ]]; then
    run_root ln -sf "${unit_path}" "/etc/systemd/system/${alias_name}"
  fi
}

force_default_systemd_target() {
  local target_name="$1"
  local target_path=""

  target_path="$(resolve_systemd_unit_path "${target_name}")" || return 1
  run_root mkdir -p /etc/systemd/system
  run_root ln -snf "${target_path}" /etc/systemd/system/default.target
}

ensure_service_user() {
  if [[ ! "$(id -u "$SERVICE_USER" 2>/dev/null || echo "")" =~ ^[0-9]+$ ]]; then
    echo "Service user '${SERVICE_USER}' does not exist yet."
    exit 1
  fi

  SERVICE_HOME="$(getent passwd "${SERVICE_USER}" | cut -d: -f6)"

  if [[ -z "${SERVICE_HOME}" ]]; then
    echo "Unable to resolve the home directory for '${SERVICE_USER}'."
    exit 1
  fi
}

ensure_kiosk_user_groups() {
  local group_name=""

  for group_name in video input render tty; do
    if getent group "${group_name}" >/dev/null 2>&1; then
      run_root usermod -aG "${group_name}" "${SERVICE_USER}"
    fi
  done
}

configure_boot_mode() {
  run_root systemctl set-default multi-user.target 2>/dev/null || true

  if command -v raspi-config >/dev/null 2>&1; then
    run_root raspi-config nonint do_wayland W1 || true
    run_root raspi-config nonint do_ssh 0 || true
  fi

  # `systemctl set-default` is not reliable inside the offline pi-gen chroot.
  # Force the target symlink so first boot still lands in the kiosk service.
  force_default_systemd_target "multi-user.target" || true
}

disable_display_manager() {
  run_root rm -f /etc/systemd/system/display-manager.service
  run_root rm -f /etc/systemd/system/graphical.target.wants/lightdm.service
  run_root rm -f /etc/lightdm/lightdm.conf.d/12-heatmap-kiosk-autologin.conf
  run_root rm -f /etc/lightdm/lightdm.conf.d/99-heatmap-kiosk-autologin.conf

  if [[ "${PI_IMAGE_BUILD}" != "1" ]]; then
    run_root systemctl disable --now lightdm.service 2>/dev/null || true
    run_root systemctl stop display-manager.service 2>/dev/null || true
  fi
}

disable_console_autologin() {
  run_root rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf
  run_root rm -f /etc/systemd/system/getty.target.wants/getty@tty1.service
  run_root rmdir /etc/systemd/system/getty@tty1.service.d 2>/dev/null || true
}

configure_wifi_stack() {
  run_root mkdir -p /var/lib/NetworkManager
  run_root tee /var/lib/NetworkManager/NetworkManager.state >/dev/null <<EOF
[main]
WirelessEnabled=true
EOF

  if [[ -n "${WIFI_COUNTRY}" ]] && command -v raspi-config >/dev/null 2>&1; then
    run_root raspi-config nonint do_wifi_country "${WIFI_COUNTRY}" || true
  fi
}

disable_ssh_access() {
  run_root rm -f /boot/ssh /boot/firmware/ssh
  run_root rm -f /etc/systemd/system/multi-user.target.wants/ssh.service
  run_root rm -f /etc/systemd/system/sockets.target.wants/ssh.socket
  run_root rm -f /etc/systemd/system/multi-user.target.wants/sshd.service
  run_root rm -f /etc/systemd/system/sockets.target.wants/sshd.socket

  if [[ "${PI_IMAGE_BUILD}" != "1" ]]; then
    for unit in ssh.service ssh.socket sshd.service sshd.socket; do
      run_root systemctl disable --now "${unit}" 2>/dev/null || true
    done
  fi
}

suppress_first_boot_prompts() {
  if [[ -f /etc/xdg/autostart/piwiz.desktop ]]; then
    run_root bash -lc "grep -q '^Hidden=true\$' /etc/xdg/autostart/piwiz.desktop || printf '\nHidden=true\n' >> /etc/xdg/autostart/piwiz.desktop"
  fi
}

install_blank_cursor_theme() {
  local theme_dir="/usr/share/icons/heatmap-blank-cursor"
  local cursor_name=""
  local cursor_aliases=(
    default
    arrow
    right_ptr
    top_left_arrow
    left_ptr_help
    question_arrow
    left_ptr_watch
    watch
    progress
    crosshair
    hand1
    hand2
    pointer
    text
    xterm
    ibeam
    grab
    grabbing
    move
    fleur
    all-scroll
    context-menu
    copy
    alias
    cell
    vertical-text
    zoom-in
    zoom-out
    left_side
    right_side
    top_side
    bottom_side
    top_left_corner
    top_right_corner
    bottom_left_corner
    bottom_right_corner
    sb_h_double_arrow
    sb_v_double_arrow
    h_double_arrow
    v_double_arrow
    e-resize
    n-resize
    ne-resize
    nw-resize
    s-resize
    se-resize
    sw-resize
    w-resize
    ew-resize
    ns-resize
    nesw-resize
    nwse-resize
    col-resize
    row-resize
    dnd-none
    dnd-copy
    no-drop
    not-allowed
  )

  run_root install -d -m 0755 "${theme_dir}/cursors"

  run_root tee "${theme_dir}/index.theme" >/dev/null <<EOF
[Icon Theme]
Name=Heatmap Blank Cursor
Comment=Transparent cursor theme for touch-only kiosk sessions
EOF

  run_root bash -c "base64 --decode > '${theme_dir}/cursors/left_ptr'" <<'EOF'
WGN1chAAAAAAAAEAAQAAAAIA/f8QAAAAHAAAACQAAAACAP3/EAAAAAEAAAAQAAAAEAAAAAAAAAAA
AAAAMgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAA=
EOF
  run_root chmod 0644 "${theme_dir}/cursors/left_ptr"

  for cursor_name in "${cursor_aliases[@]}"; do
    run_root ln -sf left_ptr "${theme_dir}/cursors/${cursor_name}"
  done
}

install_kiosk_session_assets() {
  run_root install -d -m 0755 /etc/heatmap-pi-kiosk

  run_root install -m 0755 "${APP_DIR}/pi/heatmap-kiosk-session.sh" /usr/local/bin/heatmap-kiosk-session
  run_root rm -f /usr/share/xsessions/heatmap-kiosk.desktop
  run_root rm -f /etc/heatmap-pi-kiosk/openbox-rc.xml
  run_root rm -f /etc/heatmap-pi-kiosk/openbox-menu.xml
  run_root rm -f /etc/X11/xorg.conf.d/90-heatmap-kiosk-lockdown.conf
}

remove_chromium_policies() {
  run_root rm -f /etc/chromium/policies/managed/heatmap-pi-kiosk.json
  run_root rm -f /etc/chromium-browser/policies/managed/heatmap-pi-kiosk.json
}

echo "Installing Heat Map Pi Kiosk from ${APP_DIR}"
echo "Using service user: ${SERVICE_USER}"

ensure_service_user
ensure_kiosk_user_groups

apt_get update
apt_get install -y network-manager curl ca-certificates

ensure_node_runtime
ensure_kiosk_runtime_stack
install_cursorless_cage

run_root mkdir -p "${APP_DIR}/data-cache"
run_root chown -R "${SERVICE_USER}:${SERVICE_USER}" "${APP_DIR}"

run_as_service_user "npm install --omit=dev"

configure_boot_mode
install_blank_cursor_theme
install_kiosk_session_assets
remove_chromium_policies
disable_display_manager
disable_console_autologin
configure_wifi_stack
disable_ssh_access
suppress_first_boot_prompts

run_root install -m 0755 "${APP_DIR}/pi/heatmap-kiosk-browser.sh" /usr/local/bin/heatmap-kiosk-browser

run_root tee /etc/systemd/system/heatmap-app.service >/dev/null <<EOF
[Unit]
Description=Heat Map Pi Kiosk App
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
Environment=PORT=3000
Environment=HOST=127.0.0.1
Environment=REFRESH_MS=15000
Environment=STARTUP_REFRESH_DELAY_MS=8000
Environment=UNIVERSE_STARTUP_DELAY_MS=30000
Environment=PI_KIOSK_MODE=1
Environment=PI_ALLOW_SYSTEM_CONTROL=1
Environment=PI_APP_SERVICE_NAME=heatmap-app.service
Environment=PI_KIOSK_SERVICE_NAME=heatmap-kiosk.service
ExecStart=/usr/bin/env node src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

run_root tee /etc/systemd/system/heatmap-kiosk.service >/dev/null <<EOF
[Unit]
Description=Heat Map Pi Kiosk Display
Wants=heatmap-app.service
After=systemd-user-sessions.service heatmap-app.service
Conflicts=getty@tty1.service lightdm.service display-manager.service

[Service]
Type=simple
User=${SERVICE_USER}
PAMName=login
WorkingDirectory=${APP_DIR}
RuntimeDirectory=heatmap-kiosk
RuntimeDirectoryMode=0700
Environment=HEATMAP_KIOSK_URL=http://127.0.0.1:3000
Environment=HEALTH_URL=http://127.0.0.1:3000/api/health
Environment=CAGE_BIN=/usr/local/bin/cage
Environment=XDG_RUNTIME_DIR=/run/heatmap-kiosk
Environment=XDG_SESSION_TYPE=wayland
Environment=XCURSOR_THEME=heatmap-blank-cursor
Environment=XCURSOR_SIZE=16
Environment=WLR_NO_HARDWARE_CURSORS=1
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
UtmpIdentifier=tty1
UtmpMode=user
StandardInput=tty
StandardOutput=journal
StandardError=journal
ExecStart=/usr/local/bin/heatmap-kiosk-session
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

run_root rm -f /etc/systemd/system/graphical.target.wants/heatmap-kiosk.service

run_root tee /etc/sudoers.d/heatmap-pi-kiosk >/dev/null <<EOF
${SERVICE_USER} ALL=(root) NOPASSWD: /usr/bin/nmcli, /usr/bin/raspi-config, /usr/bin/rfkill, /usr/sbin/rfkill, /bin/systemctl restart heatmap-app.service, /bin/systemctl restart heatmap-kiosk.service, /bin/systemctl reboot
EOF
run_root chmod 0440 /etc/sudoers.d/heatmap-pi-kiosk

if [[ "${PI_IMAGE_BUILD}" == "1" ]]; then
  enable_service_links
  echo
  echo "Heat Map Pi Kiosk is staged for an image build."
  echo "The services will start automatically on first boot."
  exit 0
fi

run_root systemctl daemon-reload
run_root systemctl enable NetworkManager.service
run_root systemctl enable heatmap-app.service
run_root systemctl enable heatmap-kiosk.service
run_root systemctl disable --now lightdm.service 2>/dev/null || true
run_root systemctl disable --now getty@tty1.service 2>/dev/null || true
run_root systemctl restart NetworkManager.service || true
run_root systemctl restart heatmap-app.service
run_root systemctl restart heatmap-kiosk.service

echo
echo "Heat Map Pi Kiosk is installed."
echo "Cog/Cage kiosk boot targets are configured."
echo "Reboot the Pi to enter the kiosk automatically:"
echo "  sudo reboot"
