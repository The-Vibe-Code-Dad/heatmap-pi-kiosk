import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DeviceSettingsStore } from "../src/lib/device-settings.js";

test("device settings store clamps hold time and keeps valid startup market", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-settings-"));
  const file = path.join(tempDir, "device-settings.json");
  const store = new DeviceSettingsStore({
    file,
    allowedMarketIds: ["nasdaq100", "dow30", "sp500"]
  });

  await store.load();
  const saved = await store.update({
    startupMarket: "sp500",
    holdToOpenMs: 9999,
    tickerTapePosition: "top",
    tickerTapeSymbols: ["spy", " qqq ", "MSFT", "spy"]
  });

  assert.equal(saved.startupMarket, "sp500");
  assert.equal(saved.holdToOpenMs, 3000);
  assert.equal(saved.tickerTapePosition, "top");
  assert.deepEqual(saved.tickerTapeSymbols, ["SPY", "QQQ", "MSFT"]);

  const fileContents = JSON.parse(await readFile(file, "utf8"));
  assert.equal(fileContents.startupMarket, "sp500");
  assert.equal(fileContents.holdToOpenMs, 3000);
  assert.equal(fileContents.tickerTapePosition, "top");
  assert.deepEqual(fileContents.tickerTapeSymbols, ["SPY", "QQQ", "MSFT"]);
});

test("device settings store defaults the ticker tape to hidden for a full-screen board", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-settings-defaults-"));
  const file = path.join(tempDir, "device-settings.json");
  const store = new DeviceSettingsStore({
    file,
    allowedMarketIds: ["nasdaq100", "dow30", "sp500"]
  });

  const loaded = await store.load();

  assert.equal(loaded.startupMarket, "sp500");
  assert.equal(loaded.tickerTapePosition, "hide");
  assert.equal(loaded.showHeaderLastSync, true);
  assert.equal(loaded.showHeaderWifi, false);
  assert.equal(loaded.showHeaderLocalTime, false);
});

test("device settings store persists top bar visibility toggles", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-settings-header-"));
  const file = path.join(tempDir, "device-settings.json");
  const store = new DeviceSettingsStore({
    file,
    allowedMarketIds: ["nasdaq100", "dow30", "sp500"]
  });

  await store.load();
  const saved = await store.update({
    showHeaderLastSync: false,
    showHeaderWifi: true,
    showHeaderLocalTime: true
  });

  assert.equal(saved.showHeaderLastSync, false);
  assert.equal(saved.showHeaderWifi, true);
  assert.equal(saved.showHeaderLocalTime, true);
});

test("device settings store accepts hidden ticker tape mode", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-settings-hide-"));
  const file = path.join(tempDir, "device-settings.json");
  const store = new DeviceSettingsStore({
    file,
    allowedMarketIds: ["nasdaq100", "dow30", "sp500"]
  });

  await store.load();
  const saved = await store.update({
    tickerTapePosition: "hide",
    tickerTapeSymbols: ["qqq"]
  });

  assert.equal(saved.tickerTapePosition, "hide");
  assert.deepEqual(saved.tickerTapeSymbols, ["QQQ"]);
});

test("device settings store keeps long ticker tape lists beyond the old 20 symbol cap", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-settings-tape-long-"));
  const file = path.join(tempDir, "device-settings.json");
  const store = new DeviceSettingsStore({
    file,
    allowedMarketIds: ["nasdaq100", "dow30", "sp500"]
  });
  const symbols = Array.from({ length: 25 }, (_entry, index) => `T${index + 1}`);

  await store.load();
  const saved = await store.update({
    tickerTapePosition: "bottom",
    tickerTapeSymbols: symbols
  });

  assert.deepEqual(saved.tickerTapeSymbols, symbols);
});

test("device settings store normalizes wifi country and remembers the last ssid", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-settings-wifi-"));
  const file = path.join(tempDir, "device-settings.json");
  const store = new DeviceSettingsStore({
    file,
    allowedMarketIds: ["nasdaq100", "dow30", "sp500"]
  });

  await store.load();
  const saved = await store.update({
    wifiCountry: "us",
    lastWifiSsid: "  Office Wifi  "
  });

  assert.equal(saved.wifiCountry, "US");
  assert.equal(saved.lastWifiSsid, "Office Wifi");
});

test("device settings store falls back when a power cut leaves corrupt settings", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-settings-corrupt-"));
  const file = path.join(tempDir, "device-settings.json");
  const warnings = [];
  const store = new DeviceSettingsStore({
    file,
    allowedMarketIds: ["nasdaq100", "dow30", "sp500"],
    logger: {
      warn: (...args) => warnings.push(args)
    }
  });

  await writeFile(file, "{\"tickerTapeSymbols\":[\"QQQ\"", "utf8");

  const loaded = await store.load();

  assert.equal(loaded.startupMarket, "sp500");
  assert.equal(loaded.tickerTapePosition, "hide");
  assert.deepEqual(loaded.tickerTapeSymbols, []);
  assert.equal(warnings.length, 1);
});

test("device settings store writes without leaving power-cut temp files behind", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "heatmap-pi-settings-atomic-"));
  const file = path.join(tempDir, "device-settings.json");
  const store = new DeviceSettingsStore({
    file,
    allowedMarketIds: ["nasdaq100", "dow30", "sp500"]
  });

  await store.load();
  await store.update({
    startupMarket: "dow30",
    tickerTapePosition: "bottom",
    tickerTapeSymbols: ["dia"]
  });

  const entries = await readdir(tempDir);
  const contents = await readFile(file, "utf8");

  assert.deepEqual(entries, ["device-settings.json"]);
  assert.equal(contents.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(contents).tickerTapeSymbols, ["DIA"]);
});
