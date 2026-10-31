import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("kiosk startup includes a splash badge while the app boots", async () => {
  const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(indexHtml, /id="startup-splash"/);
  assert.match(indexHtml, /startup-splash-logo/);
  assert.match(indexHtml, /id="startup-splash-status"/);
  assert.match(styles, /\.startup-splash\s*\{/);
  assert.match(styles, /\.startup-splash-card\s*\{/);
});

test("kiosk startup can open the app wifi prompt before the normal board handoff", async () => {
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(appJs, /const promptForWifi = shouldPromptForWifiSetup\(deviceStatus\)/);
  assert.match(appJs, /if \(!promptForWifi && hasWifiConnection\(deviceStatus\)\) \{[\s\S]*syncMarketDataInBackground\(\{ quiet: true \}\)/);
  assert.match(appJs, /status: "Opening Wi-Fi setup\.\.\."/);
  assert.match(appJs, /Finish Wi-Fi setup on the touchscreen\./);
  assert.match(appJs, /await openSettings\(\{\s*message: "Set your Wi-Fi country, SSID, and password to bring the kiosk online\."/);
  assert.match(appJs, /state\.syncAfterSettingsClose = true/);
  assert.match(appJs, /const shouldSyncAfterClose = state\.syncAfterSettingsClose && hasWifiConnection/);
  assert.match(appJs, /await loadMarket\(state\.marketId\)/);
});
