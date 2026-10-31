# Pi Kiosk Changelog

## 2026-04-29

### Ticker Tape And Open Bell
- Raised the saved ticker-tape symbol limit beyond the old 20-symbol cap.
- Made ticker-tape quote refreshes patch the existing tape items instead of rebuilding the track, so the scroll does not jump back to the beginning on each update.
- Changed regular-hours heat-map refreshes to one minute, with a one-second quote burst for the first 30 seconds after the 9:30 AM Eastern market open.
- Matched the optional Last Sync and Local Time header text size to the heat-map title text.

## 2026-04-28

### Wi-Fi Ready Sync
- Added a local sync-now action that refreshes market universes and heat-map quotes immediately without waiting for the next market-window timer.
- Triggered that sync at startup when Wi-Fi is already connected, and after the first Wi-Fi setup succeeds once the settings panel closes.
- Refreshed the visible board after a manual/startup sync completes, and based the header's last-sync label and session detection on quote timestamps so stale Pi clock time is less likely to show a wrong market state.
- Moved the index price/change beside the heat-map name, matched the top bar height to the ticker tape, and added saved top-bar toggles for last sync, Wi-Fi, and local time.
- Replaced the scrollable Wi-Fi button list with a network dropdown, and changed the region control to an Auto/common-region dropdown.
- Added best-effort Wi-Fi region detection from the Pi regulatory domain so Auto can prefill and save the detected country when available.
- Added a Hidden network option to the Wi-Fi dropdown and labeled Auto with the detected country when one is available.
- Added a visible pressed-key shade on the touchscreen keyboard so taps give immediate feedback.
- Removed the duplicate active/pressed touch-keyboard flash so a touchscreen tap shows as one clean key press.
- Simplified optional top-bar local time to show only the time, and changed optional Wi-Fi status to compact signal bars.
- Moved Ticker Tape Position directly above the ticker-tape input controls in settings.

## 2026-04-27

### Dynamic Boards And Header Layout
- Made the Nasdaq board derive its diagonal split boxes from the synced roster count: 100 symbols uses no split, 101 uses the third-row column-10 split, and 102 uses third-row column-10 and column-11 splits.
- Changed the fresh default board to S&P 500 in both device settings and the initial browser load.
- Reworked the top bar into one row with the board name, dollar-formatted index price/change, session label, and latest sync time shown in Eastern time.

### Touchscreen Header And Quote Timing
- Removed the cramped `UP / FLAT / DOWN` market breadth summary from the top bar, leaving the session label and latest update time.
- Changed heat-map quote refresh timing to use half-hour premarket and after-hours wakes from 7:30-9:30 AM and 4:00-6:00 PM Eastern while keeping the normal live cadence during regular trading hours.

## 2026-04-26

### Cog/Cage Kiosk Runtime
- Replaced the Chromium/LightDM/Openbox display path with a systemd-owned `heatmap-kiosk.service` that runs Cog inside Cage directly on `tty1`.
- Switched kiosk packages from Chromium and X11 desktop pieces to `cog`, `cage`, and a basic font set, leaving the local Node app as the boot UI surface.
- Updated restart controls and sudo permissions to target `heatmap-kiosk.service` instead of `lightdm.service`.
- Removed stale Xsession/Openbox/Xorg kiosk assets and disabled display-manager/getty ownership of the primary screen.

### Touchscreen Kiosk Polish
- Hid the app and startup cursors for touch-only kiosk use, including the Cog startup loading page.
- Added a transparent Wayland cursor theme for Cage/Cog sessions so the compositor cursor does not sit in the middle of the touchscreen.
- Fixed the Default Board and Ticker Tape Position dropdown colors so their settings stay readable on the touchscreen.
- Made the settings long-press gesture listen on the top edge of the whole document with touch and pointer events instead of only the small header bar.

## 2026-04-25

### Pi Image Builder Follow-Up Fixes
- Escaped generated `pi-gen/config` values with Bash-safe quoting so passwords, Wi-Fi names, and other builder options containing shell-sensitive characters do not break or inject config.
- Changed the Windows PowerShell wrapper to pass image-build options as WSL `env` argv entries instead of interpolating them into a shell command.
- Cleared stale `pi-gen/deploy` files before each build and forced the custom kiosk stage rootfs to be recopied from the previous stage on reruns so same-day rebuilds do not reuse old app or installer output.
- Fixed the image LightDM autologin override so the main Raspberry Pi OS `lightdm.conf` cannot keep booting the old `LXDE-pi-x` desktop or a stale build-host username instead of the dedicated kiosk session.
- Fixed the Chromium kiosk URL allowlist entries so both the local app root and its subpaths, including `/api/health`, can load under the block-all policy.
- Fixed the kiosk board viewport layout so the heat map consumes the full touchscreen instead of sitting in the top auto-sized row with dead space below it.
- Added post-render tile label fitting so symbols and percent changes scale to their actual tile boxes on the Nasdaq, Dow, and S&P layouts.
- Reworked the touch keyboard for short landscape touchscreens: wide keys now use the correct grid span math, common symbols such as `@` are available immediately, and the compact keyboard stays inside the settings panel.
- Changed board label fitting to use one board-wide font size selected from the tightest tile so symbols stay uniform instead of clipping differently from box to box.
- Restored the intended taller S&P 500 layout to 25 columns by 20 rows so the 500-name board uses the full display with readable cells.
- Removed the dark seam under the Nasdaq diagonal split tile and left only the white divider line.
- Made settings mode pause live board streams and ticker refreshes, with the server heat-map timer idling while no live board is subscribed.
- Switched the touch keyboard to pointer-down handling so symbol/layout keys do not steal focus from the active input, and changed the Done key into an Enter action.
- Moved Wi-Fi and ticker feedback into their own settings cards, focused the Wi-Fi password after network selection, and made ticker additions/removals save immediately without a second Save step.
- Fixed a first-boot white-screen path by starting the local app before Wi-Fi is online and making the Chromium launcher keep waiting/restart the app instead of opening a dead local URL.
- Added a Chromium startup loading screen with an animated progress bar while the local kiosk app warms up.
- Embedded a small version of the kiosk logo in the startup loading screen so the user sees branded feedback before the app server is ready.
- Changed the startup loading screen to show a percentage, current boot stage, elapsed health-check status, and a clear app-service-not-responding message instead of looping forever.
- Rebuilt the Nasdaq center split as a single painted tile with one white diagonal divider so the old clipped-tile dark seam cannot appear.
- Delayed quote/universe network warmup until after the HTTP health endpoint is live, so first boot can open the local UI even when Wi-Fi or Yahoo/Wikipedia calls are slow.
- Moved Chromium startup into the LightDM kiosk session and made the in-app kiosk restart target `lightdm.service`, avoiding a separate display-attached browser service that could leave the Pi at the login greeter after restart.
- Added Chromium's basic password store mode to avoid Linux keyring setup prompts after kiosk autologin.
- Made the kiosk browser profile disposable and cleared stale Chromium locks before each launch so repeated kiosk restarts cannot inherit a broken browser profile.
- Made ticker-tape quote refreshes run in the background so saved tape symbols cannot block the heat-map board during startup or kiosk restart.
- Added compositor-safe Chromium flags and a critical dark startup style so render/CSS hiccups cannot present as a plain white screen.
- Changed device settings and market-universe cache saves to atomic fsync-and-rename writes so a hard power pull is less likely to leave truncated JSON that breaks the next boot.
- Rejected malformed-but-parseable cached market rosters and loaded device settings before opening the health endpoint, making post-power-loss recovery more predictable.

## 2026-04-24

### Dedicated Single-App Kiosk Lockdown
- Replaced the Raspberry Pi auto-login target from the general `LXDE` desktop with a dedicated `heatmap-kiosk` LightDM session so the device boots into a minimal single-app environment.
- Added Openbox kiosk-session assets, an empty root menu, and Xorg lock-down flags so the Pi display is owned by the kiosk instead of a normal desktop shell.
- Hardened the Chromium launcher with app mode, an isolated kiosk profile, reduced background/browser features, and navigation-history suppression.
- Added managed Chromium policies that only allow the local kiosk origin and disable guest profiles, extra browser profiles, incognito mode, saved passwords, sync, and DevTools.
- Added app-side shortcut and navigation guards plus restrictive HTTP security headers so common browser escape paths stay closed even when a physical keyboard is attached.
- Fixed the image-build boot target so offline `pi-gen` staging forces `/etc/systemd/system/default.target` to `graphical.target` instead of occasionally falling back to the `tty1` login console on first boot.
- Removed duplicate legacy `LXDE` and boot-behaviour setup from the custom image-builder stage so the installer owns the kiosk boot/session configuration in one place.

### Zero-Intervention Startup And Touchscreen Input
- Changed the default ticker tape position to `Hide` so fresh kiosk installs land on the full-screen board instead of spending display area on the tape.
- Updated the startup Wi-Fi gate to auto-open only for the true first-run `no Wi-Fi info yet` case, while still keeping the missing-network reminder path for reconnect problems.
- Added an app-side Wi-Fi password show/hide toggle so operators can see what they type without relying on Raspberry Pi OS dialogs.
- Refreshed the settings keyboard preview on ordinary physical-keyboard typing as well as touch-keyboard input so text remains visible while typing in the settings panel.

## 2026-04-23

### Pi Image Builder Reliability
- Corrected the Pi image builder to use the public official `RPi-Distro/pi-gen` repository instead of the non-working `RaspberryPiLtd/pi-gen` URL.
- Fixed reuse of existing shallow `pi-gen` checkouts so the builder can switch cleanly onto the requested branch instead of failing on `checkout`.
- Normalized cached `pi-gen` file-mode drift and cleared stale builder residue before ref switches so reused worktrees do not fail with `local changes would be overwritten`.
- Disabled interactive Git credential prompting during the public `pi-gen` fetch so VS Code's GitHub auth flow does not block image builds.
- Excluded `image-builder/output` from the staged kiosk app copy so prior image artifacts are not baked into later builds.
- Switched the builder config from deprecated `DEPLOY_ZIP` to `DEPLOY_COMPRESSION='zip'`.
- Expanded `install-build-deps.sh` to match the upstream `pi-gen` dependency list more closely.
- Changed the Pi installer to keep `armhf` on the Raspberry Pi OS `nodejs` package line (Node 18) instead of forcing a failing NodeSource Node 20 upgrade.

## 2026-04-22

### Image Builder Packaging
- Added a fast-fail sudo preflight to the Pi image builder so unattended packaging stops immediately with a clear host-permission message instead of stalling partway through setup.
- Updated the image-builder docs to tell operators to refresh sudo credentials before starting a flashable Pi image build.

### Installer Reliability
- Fixed the Pi installer so it upgrades Node.js when an older version is already installed instead of only installing Node when `node` is completely missing.
- Documented the FAT-formatted USB installer gotcha: `chmod +x install.sh` does not persist on `vfat`, so `bash install.sh` or a copy to the Pi filesystem is required.
- Re-verified the Pi kiosk app test suite passes after the installer/documentation updates.

### Appliance Boot And Image Builder
- Added a flashable Pi image workflow under `image-builder`.
- Moved `pi-gen` temporary work off `/mnt/c/...` paths to avoid WSL permission failures.
- Switched the builder to Raspberry Pi's official `pi-gen` repository.
- Added the custom kiosk export stage and kiosk image suffix handling.
- Skipped the extra generic image exports so the builder focuses on the kiosk image.
- Documented that the older `2026-04-21` `*lite.zip` image is a slimmer base build while the newer `2026-04-22` kiosk zip includes the full graphical/browser stack and is therefore much larger.
- Set SSH disabled by default in the image config.
- Forced first-boot graphical auto-login for the kiosk user.
- Disabled first-boot Pi wizard prompts that could interrupt kiosk startup.
- Disabled SSH services inside the built image as a second safety check.
- Updated image-builder docs to use the newest `*kiosk.zip` output instead of older `*lite.zip` images.

### Pi Install And Kiosk Services
- Added a one-command Pi installer flow with `install.sh`.
- Hardened the Pi install script to force graphical boot and kiosk service startup.
- Added LightDM auto-login configuration and console auto-login fallback.
- Linked the kiosk app and browser services into the correct boot targets.
- Changed the kiosk browser service to wait for the display manager before launching.
- Disabled SSH and suppressed first-boot prompts during install as well as in the image build.
- Switched the Pi install to use `chromium` directly and improved browser startup reliability.

### Wi-Fi And Device Controls
- Added device settings and Wi-Fi management APIs for kiosk mode.
- Switched Wi-Fi scanning and connection handling to system-level `nmcli` calls.
- Added radio unblock, Wi-Fi-on, managed-device, and rescan preparation before scans/connects.
- Added NetworkManager configuration, Wi-Fi country handling, and radio setup in the installer.
- Added a Wi-Fi password show/hide eye button in the settings panel.
- Added a startup Wi-Fi setup gate that opens settings before the board when the kiosk boots without a connected SSID or network address.
- Added a one-minute Wi-Fi reminder that reopens settings with `No network.` or `"SSID" not connected.` when the kiosk still has no usable network.
- Remembered the last attempted or active SSID so the Wi-Fi form can reopen with the expected network name already filled in.
- Reduced extra `nmcli` rescan churn while checking device status so the settings panel is less likely to stall on Pi hardware.
- Kept device restart, kiosk restart, app restart, and reboot actions available from settings.

### Kiosk UI And Startup Experience
- Added a logo-based startup splash screen that shows kiosk startup status.
- Added the app logo asset to the Pi kiosk public app and favicon path.
- Made the splash dismiss cleanly after successful startup or after a startup error.
- Capped the startup splash visibility so boot does not sit on a long full-screen status card before the kiosk UI appears.
- Attached the ticker tape to the board frame with `Top`, `Bottom`, and `Hide` options.
- Added ticker tape symbol management in settings, including saveable symbol lists.
- Added a touchscreen keyboard for settings inputs.
- Fixed the touchscreen keyboard preview and hide behavior.
- Fixed the on-screen keyboard row sizing so wide keys and missing keys no longer break the layout on the Pi display.
- Kept physical-keyboard typing visible in the settings preview and reused the Wi-Fi focus flow when auto-opening the network menu.
- Restored multi-symbol ticker tape entry so comma- and space-separated ticker lists can be pasted or typed before saving.
- Prevented board/ticker refresh churn while settings are open so the keyboard feels less laggy.

### Board Layout And Rendering
- Added the Nasdaq 100, Dow 30, and S&P 500 board layouts to the Pi kiosk.
- Preserved the five-row Nasdaq layout with the center diagonal split tile.
- Added smarter symbol and percent text fitting based on actual board cell size.
- Reworked dense-board text rules so very small tiles prioritize readable ticker symbols instead of unreadable percent text.
- Changed the S&P 500 kiosk board from a `50 x 10` layout to a `25 x 20` layout so symbols are usable on the Pi screen.
- Reworked the diagonal split tile so the slash no longer leaves a dark seam underneath.
- Reduced tile padding and letter spacing so more ticker symbols fit on the Pi screen.
- Re-rendered the board on resize so it scales with actual screen size and orientation changes.
- Improved full-screen board sizing so the heat map uses the real display area instead of clustering at the top.

### Performance Tuning For Pi Hardware
- Slowed the kiosk refresh profile to better fit Pi Zero-class hardware.
- Increased the refresh interval to reduce churn on the device.
- Reduced batch size and parallel quote load to lower rendering pressure.
- Reduced extra focus/change work inside the touch keyboard handlers.

### Data And Market Behavior
- Added live quote refresh for the three supported boards.
- Added ticker-tape quote fetching and refresh handling.
- Added startup-board persistence and saved device settings.
- Added scheduled market-universe sync behavior and cached universe/device data stores.

### Verification
- Added and maintained automated tests for device settings, market baskets, image-builder file presence, snapshots, universe sync timing, ticker-tape input parsing, and Wi-Fi prompt rules.
- Verified the Pi kiosk app test suite passes after the kiosk and image-builder changes.
