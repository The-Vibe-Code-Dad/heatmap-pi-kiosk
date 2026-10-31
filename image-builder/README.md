# Pi Image Builder

Builds a flashable Raspberry Pi OS image with the heat map kiosk already installed.

## What It Produces

- Raspberry Pi OS image
- SSH disabled
- `heatmap-app.service` enabled
- `heatmap-kiosk.service` enabled
- Cog + Cage configured to run the board as the only fullscreen app on first boot

## Best Build Environment

- Linux machine
- or WSL2 Ubuntu on Windows

Recommended Pi target:
- Raspberry Pi Zero 2 W or better

## Linux / WSL Build

From the `image-builder` folder:

```bash
chmod +x install-build-deps.sh build-image.sh
sudo -v
./install-build-deps.sh
FIRST_USER_PASS='your-pi-password' ./build-image.sh
```

If `build-image.sh` exits immediately with a sudo warning, refresh your sudo session in that shell first and rerun it.

The finished image files are copied into:

```bash
image-builder/output
```

If the project folder is on an NTFS/external drive such as `/media/...`, the builder automatically moves its temporary `WORK_DIR` under `/tmp` because `pi-gen` cannot build correctly on `fuseblk`/NTFS work directories.

## Windows Shortcut

From PowerShell:

```powershell
cd .\image-builder
.\build-image.ps1 -WslDistro Ubuntu -FirstUserPass "your-pi-password"
```

## Useful Options

Linux / WSL environment variables:

- `IMG_NAME`
- `FIRST_USER_NAME`
- `FIRST_USER_PASS`
- `TARGET_HOSTNAME`
- `TIMEZONE_DEFAULT`
- `LOCALE_DEFAULT`
- `KEYBOARD_KEYMAP`
- `WPA_COUNTRY`
- `WPA_SSID`
- `WPA_PASSWORD`

PowerShell parameters mirror those same values.

Example with Wi-Fi preloaded:

```powershell
.\build-image.ps1 `
  -WslDistro Ubuntu `
  -FirstUserPass "your-pi-password" `
  -WifiCountry US `
  -WifiSsid "YourWifi" `
  -WifiPassword "YourWifiPassword"
```

If you do not preseed Wi-Fi during the image build, the kiosk now opens its touchscreen Wi-Fi setup on first boot. If the radio is still blocked, enter the two-letter Wi-Fi country code there first, then scan or connect.

## Flash The Finished Image

1. Open Raspberry Pi Imager.
2. Choose `Use custom`.
3. Pick the image from `image-builder/output`.
4. Write it to the SD card.
5. Boot the Pi.

The kiosk should come up automatically on first boot.

## Notes

- The image build uses Raspberry Pi's official `pi-gen` project during the build.
- If the Windows pack process hits privilege issues inside WSL or Docker, rerun the build inside a normal Ubuntu shell with `sudo`.
