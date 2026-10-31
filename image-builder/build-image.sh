#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORK_DIR="${WORK_DIR:-}"
OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/output}"
PI_GEN_DIR="${PI_GEN_DIR:-}"
PI_GEN_REPO="${PI_GEN_REPO:-https://github.com/RPi-Distro/pi-gen.git}"
PI_GEN_BRANCH="${PI_GEN_BRANCH:-bookworm}"
CUSTOM_STAGE_NAME="stage5-kiosk"
CUSTOM_STAGE_TEMPLATE="${SCRIPT_DIR}/${CUSTOM_STAGE_NAME}"
IMG_NAME="${IMG_NAME:-heatmap-pi-kiosk-$(date +%Y%m%d)}"
FIRST_USER_NAME="${FIRST_USER_NAME:-pi}"
FIRST_USER_PASS="${FIRST_USER_PASS:-}"
TARGET_HOSTNAME="${TARGET_HOSTNAME:-heatmap-kiosk}"
TIMEZONE_DEFAULT="${TIMEZONE_DEFAULT:-America/New_York}"
LOCALE_DEFAULT="${LOCALE_DEFAULT:-en_US.UTF-8}"
KEYBOARD_KEYMAP="${KEYBOARD_KEYMAP:-us}"
WPA_COUNTRY="${WPA_COUNTRY:-}"
WPA_SSID="${WPA_SSID:-}"
WPA_PASSWORD="${WPA_PASSWORD:-}"
CUSTOM_STAGE_DIR=""
APP_STAGE_DIR=""

need_command() {
  local command="$1"

  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "Missing required command: ${command}"
    exit 1
  fi
}

run_public_git() {
  env \
    GIT_TERMINAL_PROMPT=0 \
    GIT_ASKPASS= \
    SSH_ASKPASS= \
    GCM_INTERACTIVE=Never \
    git -c credential.helper= "$@"
}

filesystem_type_for() {
  local path="$1"

  if command -v findmnt >/dev/null 2>&1; then
    findmnt -no FSTYPE -T "${path}" 2>/dev/null
    return
  fi

  stat -f -c %T "${path}" 2>/dev/null || true
}

filesystem_supports_pi_gen_workdir() {
  local fs_type="$1"

  case "${fs_type}" in
    fuseblk|drvfs|exfat|fuse.exfat|msdos|ntfs|ntfs3|vfat)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

resolve_builder_paths() {
  local repo_fs_type=""

  if [[ -z "${WORK_DIR}" ]]; then
    repo_fs_type="$(filesystem_type_for "${SCRIPT_DIR}")"

    if filesystem_supports_pi_gen_workdir "${repo_fs_type}"; then
      WORK_DIR="${SCRIPT_DIR}/work"
    else
      WORK_DIR="/tmp/heatmap-pi-kiosk-image-builder-work"
      echo "Using Linux work dir '${WORK_DIR}' because '${SCRIPT_DIR}' is on unsupported filesystem '${repo_fs_type}'."
    fi
  fi

  if [[ -z "${PI_GEN_DIR}" ]]; then
    PI_GEN_DIR="${WORK_DIR}/pi-gen"
  fi

  CUSTOM_STAGE_DIR="${PI_GEN_DIR}/${CUSTOM_STAGE_NAME}"
  APP_STAGE_DIR="${CUSTOM_STAGE_DIR}/01-heatmap-kiosk/files/opt/heatmap-pi-kiosk"
}

run_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

ensure_sudo_ready() {
  if [[ "$(id -u)" -eq 0 ]]; then
    return
  fi

  if sudo -n true >/dev/null 2>&1; then
    return
  fi

  echo "This image build needs sudo access on the Linux host."
  echo "Run 'sudo -v' first in this shell, then rerun build-image.sh."
  exit 1
}

prompt_for_password() {
  if [[ -n "${FIRST_USER_PASS}" ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    echo "Set FIRST_USER_PASS before running the image build script."
    exit 1
  fi

  read -r -s -p "First-boot Pi password for ${FIRST_USER_NAME}: " FIRST_USER_PASS
  echo

  if [[ -z "${FIRST_USER_PASS}" ]]; then
    echo "A password is required."
    exit 1
  fi
}

sync_pi_gen() {
  mkdir -p "${WORK_DIR}" "${OUTPUT_DIR}"

  if [[ ! -d "${PI_GEN_DIR}/.git" ]]; then
    run_public_git clone --depth 1 --branch "${PI_GEN_BRANCH}" "${PI_GEN_REPO}" "${PI_GEN_DIR}"
    run_public_git -C "${PI_GEN_DIR}" config core.filemode false
    return
  fi

  # The cached pi-gen checkout under work/ is builder-owned scratch space.
  # Normalize file mode tracking and discard prior build residue before switching refs.
  run_public_git -C "${PI_GEN_DIR}" config core.filemode false
  run_public_git -C "${PI_GEN_DIR}" reset --hard HEAD
  run_public_git -C "${PI_GEN_DIR}" clean -fd
  run_public_git -C "${PI_GEN_DIR}" remote set-url origin "${PI_GEN_REPO}"
  run_public_git -C "${PI_GEN_DIR}" fetch --depth 1 origin "${PI_GEN_BRANCH}"
  run_public_git -C "${PI_GEN_DIR}" checkout -B "${PI_GEN_BRANCH}" FETCH_HEAD
  run_public_git -C "${PI_GEN_DIR}" reset --hard FETCH_HEAD
}

clear_pi_gen_deploy() {
  mkdir -p "${PI_GEN_DIR}/deploy"
  run_root find "${PI_GEN_DIR}/deploy" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
}

stage_kiosk_app() {
  rm -rf "${CUSTOM_STAGE_DIR}"
  mkdir -p "${APP_STAGE_DIR}"
  rsync -a "${CUSTOM_STAGE_TEMPLATE}/" "${CUSTOM_STAGE_DIR}/"
  find "${CUSTOM_STAGE_DIR}" -name "*.sh" -exec chmod +x {} +

  rsync -a --delete \
    --exclude ".git" \
    --exclude "node_modules" \
    --exclude "image-builder/output" \
    --exclude "image-builder/work" \
    --exclude "data-cache/*.json" \
    --exclude "data-cache/.gitkeep" \
    "${APP_DIR}/" "${APP_STAGE_DIR}/"

  mkdir -p "${APP_STAGE_DIR}/data-cache"
  : > "${APP_STAGE_DIR}/data-cache/.gitkeep"
}

disable_generic_exports() {
  local generic_export_stage=""

  for generic_export_stage in stage2 stage4; do
    if [[ -d "${PI_GEN_DIR}/${generic_export_stage}" ]]; then
      : > "${PI_GEN_DIR}/${generic_export_stage}/SKIP_IMAGES"
    fi
  done
}

write_config_value() {
  local config_key="$1"
  local config_value="$2"
  local escaped_value=""

  printf -v escaped_value "%q" "${config_value}"
  printf "%s=%s\n" "${config_key}" "${escaped_value}" >> "${PI_GEN_DIR}/config"
}

write_pi_gen_config() {
  : > "${PI_GEN_DIR}/config"

  write_config_value "IMG_NAME" "${IMG_NAME}"
  write_config_value "ENABLE_SSH" "0"
  write_config_value "DISABLE_FIRST_BOOT_USER_RENAME" "1"
  write_config_value "FIRST_USER_NAME" "${FIRST_USER_NAME}"
  write_config_value "FIRST_USER_PASS" "${FIRST_USER_PASS}"
  write_config_value "TARGET_HOSTNAME" "${TARGET_HOSTNAME}"
  write_config_value "LOCALE_DEFAULT" "${LOCALE_DEFAULT}"
  write_config_value "KEYBOARD_KEYMAP" "${KEYBOARD_KEYMAP}"
  write_config_value "TIMEZONE_DEFAULT" "${TIMEZONE_DEFAULT}"
  write_config_value "STAGE_LIST" "stage0 stage1 stage2 ${CUSTOM_STAGE_NAME}"
  write_config_value "DEPLOY_COMPRESSION" "zip"

  if [[ -n "${WPA_COUNTRY}" ]]; then
    write_config_value "WPA_COUNTRY" "${WPA_COUNTRY}"
  fi

  if [[ -n "${WPA_SSID}" ]]; then
    write_config_value "WPA_SSID" "${WPA_SSID}"
  fi

  if [[ -n "${WPA_PASSWORD}" ]]; then
    write_config_value "WPA_PASSWORD" "${WPA_PASSWORD}"
  fi
}

build_image() {
  pushd "${PI_GEN_DIR}" >/dev/null
  run_root ./build.sh
  popd >/dev/null
}

collect_outputs() {
  find "${PI_GEN_DIR}/deploy" -maxdepth 1 -type f -exec cp {} "${OUTPUT_DIR}/" \;
}

need_command git
need_command rsync
need_command bash
need_command sudo

resolve_builder_paths
ensure_sudo_ready
prompt_for_password
sync_pi_gen
clear_pi_gen_deploy
stage_kiosk_app
disable_generic_exports
write_pi_gen_config
build_image
collect_outputs

echo
echo "Pi image build complete."
echo "Look in: ${OUTPUT_DIR}"
