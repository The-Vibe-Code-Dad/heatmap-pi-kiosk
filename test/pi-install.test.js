import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("pi installer defaults armhf builds to distro Node 18 instead of NodeSource 20", async () => {
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(installScript, /armhf\|armv7l/);
  assert.match(installScript, /printf '18\\n'/);
  assert.match(installScript, /apt_get install -y nodejs npm/);
});

test("pi installer gives apt downloads retries and network timeouts", async () => {
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(installScript, /APT_RETRIES="\$\{APT_RETRIES:-3\}"/);
  assert.match(installScript, /APT_HTTP_TIMEOUT="\$\{APT_HTTP_TIMEOUT:-30\}"/);
  assert.match(installScript, /Acquire::Retries=\$\{APT_RETRIES\}/);
  assert.match(installScript, /Acquire::http::Timeout=\$\{APT_HTTP_TIMEOUT\}/);
  assert.match(installScript, /run_root apt-get "\$\{APT_OPTIONS\[@\]\}" "\$@"/);
});

test("pi installer bootstraps the Cog/Cage kiosk runtime instead of a desktop stack", async () => {
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(installScript, /Installing WebKit\/Cage packages required for kiosk mode/);
  assert.match(installScript, /cage/);
  assert.match(installScript, /cog/);
  assert.match(installScript, /fonts-dejavu-core/);
  assert.doesNotMatch(installScript, /apt-get install -y chromium/);
  assert.doesNotMatch(installScript, /apt-get install -y[^\n]*openbox/);
  assert.doesNotMatch(installScript, /apt-get install -y[^\n]*xserver-xorg/);
  assert.doesNotMatch(installScript, /systemctl enable lightdm\.service/);
});

test("pi installer starts the dedicated Cog/Cage kiosk service instead of a full desktop shell", async () => {
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(installScript, /tee \/etc\/systemd\/system\/heatmap-kiosk\.service/);
  assert.match(installScript, /ExecStart=\/usr\/local\/bin\/heatmap-kiosk-session/);
  assert.match(installScript, /Conflicts=getty@tty1\.service lightdm\.service display-manager\.service/);
  assert.match(installScript, /TTYPath=\/dev\/tty1/);
  assert.match(installScript, /Environment=XDG_SESSION_TYPE=wayland/);
  assert.match(installScript, /systemctl enable heatmap-kiosk\.service/);
  assert.match(installScript, /systemctl disable --now lightdm\.service/);
  assert.doesNotMatch(installScript, /user-session=LXDE/);
  assert.doesNotMatch(installScript, /autologin-session=LXDE/);
});

test("pi installer forces a transparent Wayland cursor theme for touch-only kiosk use", async () => {
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(installScript, /install_blank_cursor_theme/);
  assert.match(installScript, /\/usr\/share\/icons\/heatmap-blank-cursor/);
  assert.match(installScript, /base64 --decode > '\$\{theme_dir\}\/cursors\/left_ptr'/);
  assert.match(installScript, /ln -sf left_ptr "\$\{theme_dir\}\/cursors\/\$\{cursor_name\}"/);
  assert.match(installScript, /Environment=XCURSOR_THEME=heatmap-blank-cursor/);
  assert.match(installScript, /Environment=XCURSOR_SIZE=16/);
  assert.match(installScript, /Environment=WLR_NO_HARDWARE_CURSORS=1/);
});

test("pi installer builds Cage with a hard hide-cursor flag", async () => {
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");
  const cagePatch = await readFile(new URL("../pi/cage-hide-cursor.patch", import.meta.url), "utf8");

  assert.match(installScript, /install_cursorless_cage/);
  assert.match(installScript, /cage_supports_hide_cursor/);
  assert.match(installScript, /\$\(\"\$\{cage_bin\}\" -h 2>&1 \|\| true\)/);
  assert.match(installScript, /libwlroots-0\.18-dev/);
  assert.match(installScript, /pkg-config --exists wlroots-0\.18/);
  assert.match(installScript, /--branch v0\.2\.0/);
  assert.match(installScript, /cage-hide-cursor\.patch/);
  assert.match(installScript, /meson setup build -Dman-pages=disabled --prefix=\/usr\/local/);
  assert.match(installScript, /ninja -C build/);
  assert.match(installScript, /Environment=CAGE_BIN=\/usr\/local\/bin\/cage/);
  assert.match(cagePatch, /server->hide_cursor = true/);
  assert.match(cagePatch, /wlr_cursor_unset_image/);
  assert.match(cagePatch, /handle_request_set_cursor/);
});

test("pi installer enables the kiosk and network services during image builds", async () => {
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(installScript, /enable_systemd_unit_link "NetworkManager\.service"/);
  assert.match(installScript, /heatmap-kiosk\.service/);
  assert.match(installScript, /force_default_systemd_target "multi-user\.target"/);
  assert.match(installScript, /\/etc\/systemd\/system\/default\.target/);
});

test("pi app service starts before Wi-Fi is online so the local setup UI can load", async () => {
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(installScript, /Description=Heat Map Pi Kiosk App[\s\S]*After=network\.target/);
  assert.doesNotMatch(installScript, /After=network-online\.target/);
  assert.doesNotMatch(installScript, /Wants=network-online\.target/);
});

test("pi installer removes tty1 shell autologin so the kiosk can own the display", async () => {
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(installScript, /disable_console_autologin/);
  assert.doesNotMatch(installScript, /agetty --autologin/);
});

test("pi installer ships dedicated Cog/Cage session assets", async () => {
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");
  const sessionScript = await readFile(new URL("../pi/heatmap-kiosk-session.sh", import.meta.url), "utf8");

  assert.match(installScript, /install_kiosk_session_assets/);
  assert.match(installScript, /heatmap-kiosk-session\.sh/);
  assert.match(installScript, /remove_chromium_policies/);
  assert.match(installScript, /\/etc\/chromium\/policies\/managed\/heatmap-pi-kiosk\.json/);
  assert.match(sessionScript, /XDG_SESSION_TYPE="\$\{XDG_SESSION_TYPE:-wayland\}"/);
  assert.match(sessionScript, /XDG_RUNTIME_DIR="\$\{XDG_RUNTIME_DIR:-\/run\/heatmap-kiosk\}"/);
  assert.match(sessionScript, /\/usr\/local\/bin\/heatmap-kiosk-browser/);
  assert.match(installScript, /Environment=PI_KIOSK_SERVICE_NAME=heatmap-kiosk\.service/);
  assert.match(installScript, /systemctl restart heatmap-kiosk\.service/);
  assert.doesNotMatch(sessionScript, /openbox/);
});
