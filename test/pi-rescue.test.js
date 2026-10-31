import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("pi rescue reruns the installer and re-enables Cog/Cage kiosk services", async () => {
  const rescueScript = await readFile(new URL("../pi/rescue-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(rescueScript, /install-pi-kiosk\.sh/);
  assert.match(rescueScript, /systemctl set-default multi-user\.target/);
  assert.match(rescueScript, /force_multi_user_target/);
  assert.match(rescueScript, /\/etc\/systemd\/system\/default\.target/);
  assert.match(rescueScript, /systemctl enable "\$\{unit\}"/);
  assert.match(rescueScript, /heatmap-app\.service/);
  assert.match(rescueScript, /heatmap-kiosk\.service/);
  assert.match(rescueScript, /systemctl disable --now lightdm\.service/);
});

test("pi rescue can restore Wi-Fi prerequisites when given a country", async () => {
  const rescueScript = await readFile(new URL("../pi/rescue-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(rescueScript, /WIFI_COUNTRY="\$\{WIFI_COUNTRY:-\$\{1:-\}\}"/);
  assert.match(rescueScript, /raspi-config nonint do_wifi_country/);
  assert.match(rescueScript, /rfkill unblock wifi/);
  assert.match(rescueScript, /nmcli radio wifi on/);
});
