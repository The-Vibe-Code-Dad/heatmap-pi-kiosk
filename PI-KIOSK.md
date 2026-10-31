# Pi Kiosk Notes

Recommended target:
- Raspberry Pi Zero 2 W or better

## Fastest Path Now

Use the image builder in [image-builder/README.md](./image-builder/README.md) to create a flashable SD-card image with the kiosk already installed.

Windows shortcut:

```powershell
cd .\image-builder
.\build-image.ps1 -WslDistro Ubuntu -FirstUserPass "your-pi-password"
```

Linux / WSL shortcut:

```bash
cd image-builder
chmod +x install-build-deps.sh build-image.sh
./install-build-deps.sh
FIRST_USER_PASS='your-pi-password' ./build-image.sh
```

Build output lands in:

```text
image-builder/output
```

Flash that image with Raspberry Pi Imager using `Use custom`.

## Manual Install Path

If you want to install on top of an already-flashed Raspberry Pi OS card:

1. Use Raspberry Pi Imager.
2. Choose Raspberry Pi OS Lite or Desktop.
3. In the imager advanced options, you can prefill Wi-Fi if you already know it.
4. Boot the Pi.
5. Copy this repository folder to the Pi.
6. Run:

```bash
cd heatmap-pi-kiosk
chmod +x install.sh
./install.sh
```

If you are running from a FAT-formatted USB drive, the execute bit will not stick. In that case either run `bash install.sh` directly or copy `heatmap-pi-kiosk` onto the Pi's local filesystem first, then use `chmod +x install.sh`.

The installer disables SSH and starts the kiosk as a Cog WebKit app inside the Cage single-app Wayland compositor on boot.

If you want Wi-Fi ready before the first touchscreen session, you can preseed the country during install:

```bash
cd heatmap-pi-kiosk
WIFI_COUNTRY=US bash install.sh
```

If you skip that, the kiosk now opens the device settings panel on first boot so Wi-Fi can be finished from the touchscreen, including the country code when Raspberry Pi OS has blocked the radio.

## Touch Controls

- tap the map to switch boards
- press and hold the top bar to open settings

## Pi Settings Panel

- choose startup board
- change hold duration
- set ticker tape top, bottom, or hide
- add ticker tape symbols
- set Wi-Fi country code if the radio is blocked on first boot
- scan and join Wi-Fi networks
- restart the app
- restart the kiosk runtime
- reboot the device
