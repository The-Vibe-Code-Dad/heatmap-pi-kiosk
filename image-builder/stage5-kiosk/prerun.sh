#!/bin/bash -e

# Always rebuild the kiosk layer from the previous stage. Reusing an older
# custom-stage rootfs can bake deleted app files or old installer output into
# a new same-day image build.
rm -rf "${ROOTFS_DIR}"
copy_previous
