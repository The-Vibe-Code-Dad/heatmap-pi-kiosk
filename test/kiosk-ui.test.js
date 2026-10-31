import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("kiosk UI defaults to a full-screen board with the ticker tape hidden", async () => {
  const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  const settingsJs = await readFile(new URL("../src/lib/device-settings.js", import.meta.url), "utf8");

  assert.match(indexHtml, /board-shell board-shell-ticker-hide/);
  assert.match(indexHtml, /<span class="title" id="board-title">S&amp;P 500 HEAT MAP<\/span>/);
  assert.match(indexHtml, /<style>[\s\S]*background: #03070d;[\s\S]*cursor: none;[\s\S]*startup-splash/);
  assert.match(appJs, /const MARKET_ORDER = \["sp500", "nasdaq100", "dow30"\]/);
  assert.match(appJs, /state\.deviceStatus\?\.settings\?\.tickerTapePosition \?\? "hide"/);
  assert.match(styles, /\.screen\s*\{[\s\S]*grid-template-rows: minmax\(0, 1fr\)/);
  assert.match(styles, /\.board\s*\{[\s\S]*height: 100dvh/);
  assert.match(styles, /body \* \{[\s\S]*cursor: none !important/);
  assert.match(settingsJs, /startupMarket: "sp500"/);
  assert.match(settingsJs, /tickerTapePosition: "hide"/);
});

test("kiosk tiles fit their labels after the board scales to the viewport", async () => {
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(appJs, /function fittedTextSizesForTile\(container\)/);
  assert.match(appJs, /Math\.min\(\.\.\.fittedSizes\.map\(\(size\) => size\.symbolSize\)\)/);
  assert.match(appJs, /querySelectorAll\("\.tile, \.diagonal-label"\)/);
  assert.match(appJs, /scheduleBoardTextFit\(\);/);
  assert.match(appJs, /window\.addEventListener\("resize", scheduleBoardTextFit\)/);
  assert.match(styles, /container-type: size/);
  assert.doesNotMatch(styles, /font-size: min\(0\.62rem, var\(--symbol-size\)\)/);
});

test("kiosk Nasdaq diagonal split paints one tile so no dark seam can appear", async () => {
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(appJs, /class="diagonal-label diagonal-label-top-left"/);
  assert.match(appJs, /--split-top:\$\{topLeftColor\}; --split-bottom:\$\{bottomRightColor\}/);
  assert.match(appJs, /function splitSlotsForRow\(layout, rowIndex\)/);
  assert.match(appJs, /layout\.splits/);
  assert.match(styles, /background: linear-gradient\([\s\S]*var\(--split-top\)[\s\S]*rgba\(250, 252, 255, 0\.9\)[\s\S]*var\(--split-bottom\)/);
  assert.doesNotMatch(appJs, /tile-split-diagonal/);
  assert.doesNotMatch(styles, /clip-path: polygon/);
});

test("kiosk S&P board uses taller rows for readable touchscreen symbols", async () => {
  const marketsJs = await readFile(new URL("../src/data/markets.js", import.meta.url), "utf8");

  assert.match(marketsJs, /const SP_500_ROW_COUNTS = Array\.from\(\{ length: 20 \}, \(\) => 25\)/);
  assert.match(marketsJs, /columnCount: 25/);
});

test("kiosk UI exposes an app-side Wi-Fi password visibility toggle", async () => {
  const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(indexHtml, /id="wifi-password-toggle"/);
  assert.match(appJs, /wifiPasswordInput\.type = wifiPasswordInput\.type === "password" \? "text" : "password"/);
  assert.match(appJs, /syncPasswordVisibilityToggle\(\)/);
});

test("kiosk keyboard preview refreshes for general physical keyboard input inside settings", async () => {
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(appJs, /settingsBackdrop\.addEventListener\("input", \(event\) => \{/);
  assert.match(appJs, /refreshTouchKeyboardPreview\(\);/);
});

test("kiosk touch keyboard keeps wide controls on screen and includes common symbols", async () => {
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(appJs, /function keyboardRowColumns\(row\)/);
  assert.match(appJs, /keyboardRowColumns\(row\)/);
  assert.match(appJs, /"@"/);
  assert.match(appJs, /123 @#/);
  assert.match(appJs, /label: "Enter"/);
  assert.match(appJs, /touchKeyboard\.addEventListener\("pointerdown"/);
  assert.match(appJs, /event\.preventDefault\(\);/);
  assert.match(appJs, /function pressTouchKeyboardKey\(key\)/);
  assert.match(appJs, /touch-keyboard-key-pressed/);
  assert.match(appJs, /TOUCH_KEYBOARD_PRESS_MS = 180/);
  assert.match(appJs, /settings-panel-keyboard-open/);
  assert.match(styles, /\.settings-panel-keyboard-open/);
  assert.match(styles, /\.touch-keyboard-key\.touch-keyboard-key-pressed/);
  assert.doesNotMatch(styles, /\.touch-keyboard-key:active/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(styles, /@media \(max-height: 560px\)/);
});

test("kiosk settings flow stays local, fast, and saves operator changes immediately", async () => {
  const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(indexHtml, /id="wifi-message"/);
  assert.match(indexHtml, /<select id="wifi-country-input">[\s\S]*<option value="">Auto<\/option>/);
  assert.match(indexHtml, /<select class="wifi-network-select" id="wifi-networks">/);
  assert.match(indexHtml, /id="ticker-message"/);
  assert.match(appJs, /function pauseLiveBoardUpdates\(\)/);
  assert.match(appJs, /closeStream\(\);[\s\S]*stopTickerTapeRefreshLoop\(\);/);
  assert.match(appJs, /function resumeLiveBoardUpdates\(\)/);
  assert.match(appJs, /function refreshTickerTapeInBackground/);
  assert.match(appJs, /function renderTickerTapeTrack\(items\)/);
  assert.match(appJs, /tickerTapeTrack\.dataset\.symbols/);
  assert.match(appJs, /refreshTickerTapeInBackground\(\{ quiet: true \}\);/);
  assert.match(appJs, /HIDDEN_WIFI_OPTION_VALUE = "__hidden__"/);
  assert.match(appJs, /hiddenOption\.textContent = "Hidden network\.\.\."/);
  assert.match(appJs, /Type the hidden network name, then enter the password\./);
  assert.match(appJs, /function updateAutoWifiCountryOption\(status\)/);
  assert.match(appJs, /option\.textContent = detectedCountry \? `Auto: \$\{detectedCountry\}` : "Auto"/);
  assert.match(appJs, /wifiNetworks\.addEventListener\("change"/);
  assert.match(appJs, /function ensureWifiCountryOption\(country\)/);
  assert.match(appJs, /openTouchKeyboard\(wifiPasswordInput\)/);
  assert.match(appJs, /saveDeviceSettings\(\{ tickerTapeSymbols: combined \}\)/);
  assert.match(appJs, /saveDeviceSettings\(\{ tickerTapeSymbols: nextSymbols \}\)/);
  assert.doesNotMatch(appJs, /Array\.from\(\{ length: 3 \}, \(\) => items\)/);
  assert.match(appJs, /setWifiMessage\("Connecting to Wi-Fi\.\.\."\)/);
  assert.doesNotMatch(styles, /backdrop-filter: blur/);
});

test("kiosk settings can open from a touch hold on the top edge", async () => {
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(appJs, /SETTINGS_EDGE_HOLD_HEIGHT_PX = 96/);
  assert.match(appJs, /function beginSettingsHold\(event\)/);
  assert.match(appJs, /document\.addEventListener\("touchstart", beginSettingsHold/);
  assert.match(appJs, /document\.addEventListener\("pointerdown", beginSettingsHold, true\)/);
  assert.match(appJs, /clientY <= settingsGestureEdgeHeight\(\)/);
  assert.match(appJs, /document\.addEventListener\("click", suppressClickAfterSettingsHold, true\)/);
  assert.doesNotMatch(appJs, /tickerBar\.addEventListener\("pointerdown"/);
});

test("kiosk header keeps market price beside the title and uses configurable status buttons", async () => {
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const indexHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(appJs, /timeZone: "America\/New_York"/);
  assert.match(appJs, /const syncedAt = snapshot\?\.latestMarketTimestamp \?\? snapshot\?\.fetchedAt/);
  assert.match(appJs, /summaryLabel\.textContent = syncedAt \? `Last sync \$\{syncedLabel\}` : "Waiting"/);
  assert.match(appJs, /function renderHeaderWifi\(status = state\.deviceStatus\)/);
  assert.match(appJs, /headerWifiLabel\.innerHTML = `<span class="wifi-signal-bars" aria-hidden="true">\$\{bars\}<\/span>`/);
  assert.match(appJs, /headerLocalTime\.textContent = localTimeFormatter\.format\(new Date\(\)\)/);
  assert.match(appJs, /const localTimeFormatter = new Intl\.DateTimeFormat\("en-US", \{\s*hour: "numeric",\s*minute: "2-digit"\s*\}\);/);
  assert.match(appJs, /showHeaderLastSync/);
  assert.match(indexHtml, /class="market-strip"[\s\S]*id="board-title"[\s\S]*id="index-price"[\s\S]*id="index-change"[\s\S]*id="session-label"/);
  assert.match(indexHtml, /id="header-wifi-label" aria-label="Wi-Fi disconnected"/);
  assert.match(indexHtml, /id="show-last-sync-toggle"/);
  assert.match(indexHtml, /id="show-wifi-toggle"/);
  assert.match(indexHtml, /id="show-local-time-toggle"/);
  assert.ok(
    indexHtml.indexOf("Top Bar") < indexHtml.indexOf("Ticker Tape Position") &&
      indexHtml.indexOf("Ticker Tape Position") < indexHtml.indexOf("Add To Ticker Tape")
  );
  assert.match(appJs, /indexPrice\.textContent = formatDollar\(index\.price\)/);
  assert.match(appJs, /indexChange\.textContent = `\$\{formatSignedDollar\(index\.change\)\} \(\$\{formatPercent\(index\.changePercent\)\}\)`/);
  assert.match(styles, /--kiosk-bar-height: 32px/);
  assert.match(styles, /\.ticker-tape\s*\{[\s\S]*height: var\(--kiosk-bar-height\)/);
  assert.match(styles, /\.ticker-tape-segment\s*\{[\s\S]*gap: 28px/);
  assert.match(styles, /transform: translateX\(-50%\)/);
  assert.match(styles, /\.ticker-bar\s*\{[\s\S]*height: var\(--kiosk-bar-height\)[\s\S]*white-space: nowrap/);
  assert.match(styles, /\.meta\s*\{[\s\S]*font-size: inherit/);
  assert.match(styles, /\.wifi-signal-bars/);
  assert.match(styles, /\.wifi-signal-bar-active/);
  assert.doesNotMatch(appJs, /summary\.advancers[\s\S]*UP[\s\S]*FLAT[\s\S]*DOWN/);
});

test("kiosk cursor stays hidden for touch-only use", async () => {
  const runtimeScript = await readFile(new URL("../pi/heatmap-kiosk-browser.sh", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(styles, /body \* \{[\s\S]*cursor: none !important/);
  assert.match(runtimeScript, /cursor: none;/);
  assert.match(runtimeScript, /\/usr\/local\/bin\/cage/);
  assert.match(runtimeScript, /exec "\$\{CAGE_BIN\}" -c -d -- "\$\{COG_BIN\}"/);
  assert.match(runtimeScript, /XCURSOR_THEME="\$\{XCURSOR_THEME:-heatmap-blank-cursor\}"/);
  assert.match(runtimeScript, /XCURSOR_SIZE="\$\{XCURSOR_SIZE:-16\}"/);
  assert.match(runtimeScript, /WLR_NO_HARDWARE_CURSORS="\$\{WLR_NO_HARDWARE_CURSORS:-1\}"/);
});

test("kiosk settings select menus keep readable dark option colors", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.settings-field select\s*\{[\s\S]*color-scheme: dark/);
  assert.match(styles, /\.settings-field select option,[\s\S]*\.settings-field select optgroup\s*\{[\s\S]*background: #07111b;[\s\S]*color: #f4fbff/);
});

test("kiosk persistent json writes are atomic for hard power cuts", async () => {
  const settingsJs = await readFile(new URL("../src/lib/device-settings.js", import.meta.url), "utf8");
  const universeSyncJs = await readFile(new URL("../src/lib/universe-sync.js", import.meta.url), "utf8");

  for (const source of [settingsJs, universeSyncJs]) {
    assert.match(source, /function writeJsonAtomically/);
    assert.match(source, /await handle\.sync\(\);/);
    assert.match(source, /await rename\(tempFile, file\);/);
    assert.match(source, /await syncDirectory\(directory\);/);
    assert.match(source, /await rm\(tempFile, \{ force: true \}\)/);
  }
});

test("kiosk Cog/Cage launcher opens the app as a fullscreen WebKit appliance", async () => {
  const runtimeScript = await readFile(new URL("../pi/heatmap-kiosk-browser.sh", import.meta.url), "utf8");

  assert.match(runtimeScript, /COG_BIN/);
  assert.match(runtimeScript, /CAGE_BIN/);
  assert.match(runtimeScript, /command -v cog/);
  assert.match(runtimeScript, /command -v cage/);
  assert.match(runtimeScript, /exec "\$\{CAGE_BIN\}" -c -d -- "\$\{COG_BIN\}"/);
  assert.match(runtimeScript, /--platform=wl/);
  assert.match(runtimeScript, /--bg-color="#03070d"/);
  assert.match(runtimeScript, /--webprocess-failure=restart/);
  assert.match(runtimeScript, /startup_loading_url/);
  assert.match(runtimeScript, /LOADING_LOGO_PATH/);
  assert.match(runtimeScript, /logo-loading\.png/);
  assert.match(runtimeScript, /class=\\"logo\\" src=\\"data:image\/png;base64/);
  assert.match(runtimeScript, /Starting Heat Map Kiosk/);
  assert.match(runtimeScript, /id="percent">6%/);
  assert.match(runtimeScript, /Checking app health endpoint/);
  assert.match(runtimeScript, /App service is not responding/);
  assert.match(runtimeScript, /data:text\/html;base64/);
  assert.match(runtimeScript, /meta name="health-url"/);
  assert.match(runtimeScript, /fetch\(healthUrl/);
  assert.match(runtimeScript, /mode: "no-cors"/);
  assert.match(runtimeScript, /image\.src = appUrl\.replace/);
  assert.match(runtimeScript, /wait_for_app/);
  assert.doesNotMatch(runtimeScript, /chromium/);
  assert.doesNotMatch(runtimeScript, /--user-data-dir/);
  assert.doesNotMatch(runtimeScript, /--kiosk/);
  assert.doesNotMatch(runtimeScript, /--incognito/);
});

test("kiosk UI blocks common browser escape hatches while keeping local settings input in-app", async () => {
  const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(appJs, /window\.open = \(\) => null;/);
  assert.match(appJs, /function shouldBlockKioskShortcut\(event\)/);
  assert.match(appJs, /document\.addEventListener\(\s*"click"/);
  assert.match(appJs, /anchor\.target === "_blank" \|\| targetUrl\.origin !== window\.location\.origin/);
  assert.match(appJs, /for \(const eventName of \["contextmenu", "dragstart", "drop"\]\)/);
  assert.match(appJs, /Keep the keyboard useful for text entry while blocking common browser escape hatches\./);
});

test("kiosk server serves restrictive headers for a single-app local appliance", async () => {
  const serverJs = await readFile(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(serverJs, /Content-Security-Policy/);
  assert.match(serverJs, /frame-ancestors 'none'/);
  assert.match(serverJs, /Permissions-Policy/);
  assert.match(serverJs, /Referrer-Policy/);
  assert.match(serverJs, /X-Content-Type-Options/);
  assert.match(serverJs, /X-Frame-Options/);
});

test("kiosk server answers health before network quote warmup", async () => {
  const serverJs = await readFile(new URL("../src/server.js", import.meta.url), "utf8");
  const installScript = await readFile(new URL("../pi/install-pi-kiosk.sh", import.meta.url), "utf8");

  assert.match(serverJs, /STARTUP_REFRESH_DELAY_MS/);
  assert.match(serverJs, /UNIVERSE_STARTUP_DELAY_MS/);
  assert.match(serverJs, /marketRefreshCadenceMs/);
  assert.match(serverJs, /nextMarketRefreshDelayMs/);
  assert.match(serverJs, /function startupQuoteRefreshDelayMs/);
  assert.match(serverJs, /async function syncMarketDataNow/);
  assert.match(serverJs, /async function syncAtStartupIfWifiConnected/);
  assert.match(serverJs, /status\.wifi\?\.connection/);
  assert.match(serverJs, /app\.post\("\/api\/device\/actions\/sync-now"/);
  assert.match(serverJs, /startupQuoteRefreshDelayMs\(\)\)\.unref/);
  assert.match(serverJs, /await deviceService\.prime\(\)[\s\S]*app\.listen\(port, host/);
  assert.match(serverJs, /app\.listen\(port, host/);
  assert.match(serverJs, /syncAtStartupIfWifiConnected\(\)/);
  assert.match(serverJs, /for \(const store of stores\.values\(\)\) \{\s*store\.start\(\);/);
  assert.match(serverJs, /setTimeout\(\(\) => \{[\s\S]*store\.prime\(\)/);
  assert.match(serverJs, /setTimeout\(\(\) => \{[\s\S]*universeSyncService[\s\S]*prime/);
  assert.match(installScript, /Environment=STARTUP_REFRESH_DELAY_MS=8000/);
  assert.match(installScript, /Environment=UNIVERSE_STARTUP_DELAY_MS=30000/);
});
