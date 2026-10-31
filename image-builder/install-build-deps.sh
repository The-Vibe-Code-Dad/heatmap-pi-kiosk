#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo apt-get install -y \
  arch-test \
  bc \
  bison \
  ca-certificates \
  coreutils \
  curl \
  debootstrap \
  dosfstools \
  e2fsprogs \
  file \
  git \
  libarchive-tools \
  libcap2-bin \
  kmod \
  parted \
  pigz \
  gpg \
  qemu-user-static \
  quilt \
  rsync \
  sudo \
  bmap-tools \
  unzip \
  xxd \
  xz-utils \
  zerofree \
  zip

echo
echo "Common pi-gen build dependencies are installed."
