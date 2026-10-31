#!/bin/bash -e

SERVICE_USER="${FIRST_USER_NAME:-pi}"

chmod +x /opt/heatmap-pi-kiosk/pi/install-pi-kiosk.sh
chmod +x /opt/heatmap-pi-kiosk/pi/heatmap-kiosk-browser.sh

cd /opt/heatmap-pi-kiosk
SERVICE_USER="${SERVICE_USER}" PI_IMAGE_BUILD=1 ./pi/install-pi-kiosk.sh
