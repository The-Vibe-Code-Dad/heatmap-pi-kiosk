import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTickerTapeDraftInput,
  sanitizeTickerTapeSymbols,
  shouldPromptForWifiSetup,
  shouldWarnAboutMissingNetwork,
  wifiConnectionMessage
} from "../public/kiosk-helpers.js";

test("ticker tape draft normalization preserves separators for multi-symbol input", () => {
  const draft = normalizeTickerTapeDraftInput("spy, qqq ms.ft$");

  assert.equal(draft, "SPY, QQQ MS-FT");
  assert.deepEqual(sanitizeTickerTapeSymbols(draft), ["SPY", "QQQ", "MS-FT"]);
});

test("ticker tape sanitizer keeps more than 20 symbols", () => {
  const symbols = Array.from({ length: 25 }, (_entry, index) => `T${index + 1}`);

  assert.deepEqual(sanitizeTickerTapeSymbols(symbols), symbols);
});

test("wifi setup prompt opens before the map only when wifi and network are both missing", () => {
  assert.equal(
    shouldPromptForWifiSetup({
      canManageWifi: true,
      settings: { lastWifiSsid: "" },
      wifi: { connection: null },
      addresses: []
    }),
    true
  );

  assert.equal(
    shouldPromptForWifiSetup({
      canManageWifi: true,
      settings: { lastWifiSsid: "" },
      wifi: { connection: null },
      addresses: [{ interface: "eth0", address: "192.168.1.20" }]
    }),
    false
  );

  assert.equal(
    shouldPromptForWifiSetup({
      canManageWifi: true,
      settings: { lastWifiSsid: "Office Wifi" },
      wifi: { connection: null },
      addresses: []
    }),
    false
  );
});

test("wifi reminder message distinguishes no network from a named ssid not connecting", () => {
  assert.equal(
    shouldWarnAboutMissingNetwork({
      canManageWifi: true,
      wifi: { connection: "Office Wifi" },
      addresses: []
    }),
    true
  );

  assert.equal(
    wifiConnectionMessage(
      {
        canManageWifi: true,
        wifi: { connection: null },
        addresses: []
      },
      "Office Wifi"
    ),
    "\"Office Wifi\" not connected."
  );

  assert.equal(
    wifiConnectionMessage({
      canManageWifi: true,
      wifi: { connection: "Office Wifi" },
      addresses: []
    }),
    "No network."
  );
});
