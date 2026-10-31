#!/bin/bash -e

SUBSTAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -d "${SUBSTAGE_DIR}/files" ]]; then
  mkdir -p "${ROOTFS_DIR}"
  rsync -a "${SUBSTAGE_DIR}/files/" "${ROOTFS_DIR}/"
fi
