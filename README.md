# Heat Map Pi Kiosk

A touchscreen market heat map and stock ticker for Raspberry Pi, by The Vibe Code Dad. Displays Nasdaq-100, Dow, and S&P 500 boards in a fullscreen Cog/WebKit browser with the Cage Wayland compositor.

- Tap the map to switch boards.
- Press and hold the top edge to open device settings.
- Configure Wi-Fi, startup board, header indicators, and an optional ticker tape from the touchscreen.
- Restart the app, restart the kiosk, or reboot from the settings panel.

## Hardware and software

- Raspberry Pi Zero 2 W or better, a display (touchscreen recommended), microSD card, and suitable power supply.
- Raspberry Pi OS Bookworm Lite or Desktop as the installer/image-builder target.
- Internet access for installation, market quotes, and roster updates.

## Install on an existing Pi

Boot Raspberry Pi OS and run these commands in a terminal on the Pi as your normal user:

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/The-Vibe-Code-Dad/heatmap-pi-kiosk.git
cd heatmap-pi-kiosk
bash install.sh
```

The installer installs the required system and Node packages, registers the app and kiosk services, configures the display session, and disables SSH. Run it from the Pi's local filesystem. If you use SSH to begin setup, arrange local keyboard/display access before installation.

You can supply your two-letter Wi-Fi country code during installation:

```bash
WIFI_COUNTRY=US bash install.sh
```

If Wi-Fi has not been configured, the kiosk opens touchscreen Wi-Fi setup on first boot. See [Pi setup and controls](PI-KIOSK.md) for details.

## Build a flashable SD-card image

On Linux or WSL2 Ubuntu, from the repository root:

```bash
cd image-builder
bash install-build-deps.sh
sudo -v
bash build-image.sh
```

The builder prompts for the Pi user's password, downloads Raspberry Pi's `pi-gen`, installs the kiosk, and writes the resulting image to `image-builder/output/`. Flash it using Raspberry Pi Imager's **Use custom** option.

See the [image-builder guide](image-builder/README.md) for Windows PowerShell commands, Wi-Fi presets, and build options. Generated images and build work directories are not included in this source repository.

## Preview and develop

With Node.js 18 or later and npm installed:

```bash
npm ci
npm test
npm start
```

Open <http://localhost:3000>. Pi-specific Wi-Fi and system controls require the installed kiosk services on a Pi.

An optional Docker preview is also included:

```bash
docker compose up --build -d
```

Open <http://localhost:3100>.

## Repository contents

`src/` and `public/` contain the application and display assets. `pi/`, `install.sh`, and `rescue.sh` contain installation and recovery tools. `image-builder/` contains the SD-image build scripts. `test/` contains the automated checks. `package-lock.json` records npm dependency versions.

Dependencies, runtime settings/cache, logs, generated disk images, and image-builder work files are ignored by Git. A fresh installation creates its own settings and cache in `data-cache/`.

Market data is fetched from external public endpoints at runtime; availability and update timing depend on those providers.
