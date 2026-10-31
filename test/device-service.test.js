import assert from "node:assert/strict";
import test from "node:test";
import { DeviceService } from "../src/lib/device-service.js";

function createSettingsStore() {
  let settings = {
    startupMarket: "nasdaq100",
    holdToOpenMs: 1200,
    tickerTapePosition: "hide",
    tickerTapeSymbols: ["SPY"],
    wifiCountry: "",
    lastWifiSsid: ""
  };

  return {
    async load() {},
    get() {
      return {
        ...settings,
        tickerTapeSymbols: [...settings.tickerTapeSymbols]
      };
    },
    async update(patch) {
      settings = {
        ...settings,
        ...patch
      };

      return this.get();
    }
  };
}

function createRunner(responses) {
  const calls = [];
  const runCommand = async (command, args) => {
    const key = `${command} ${args.join(" ")}`;
    calls.push(key);

    if (!responses.has(key)) {
      throw new Error(`Unexpected command: ${key}`);
    }

    const response = responses.get(key);
    const stdout = Array.isArray(response) ? response.shift() ?? "" : response;

    return {
      stdout
    };
  };

  return {
    calls,
    runCommand
  };
}

test("listWifiNetworks can skip an explicit rescan", async () => {
  const finder = process.platform === "win32" ? "where" : "which";
  const { calls, runCommand } = createRunner(
    new Map([
      [`${finder} nmcli`, "nmcli"],
      [`${finder} rfkill`, "rfkill"],
      ["sudo rfkill unblock wifi", ""],
      ["sudo nmcli radio wifi on", ""],
      ["nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status", "wlan0:wifi:connected:Office\\:Wifi"],
      ["sudo nmcli device set wlan0 managed yes", ""],
      ["nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list --rescan no", "*:Office\\:Wifi:72:WPA2\n:Guest:30:"]
    ])
  );
  const service = new DeviceService({
    settingsStore: createSettingsStore(),
    runCommand,
    kioskMode: true
  });

  const networks = await service.listWifiNetworks({ rescan: false });

  assert.deepEqual(networks, [
    {
      ssid: "Office:Wifi",
      signal: 72,
      security: "WPA2",
      active: true
    },
    {
      ssid: "Guest",
      signal: 30,
      security: "Open",
      active: false
    }
  ]);
  assert.ok(calls.includes("nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list --rescan no"));
  assert.ok(calls.includes("sudo rfkill unblock wifi"));
  assert.ok(calls.includes("sudo nmcli device set wlan0 managed yes"));
});

test("getStatus reads the active wifi without forcing a fresh scan", async () => {
  const finder = process.platform === "win32" ? "where" : "which";
  const { calls, runCommand } = createRunner(
    new Map([
      [`${finder} nmcli`, "nmcli"],
      [`${finder} rfkill`, "rfkill"],
      ["sudo rfkill unblock wifi", ""],
      ["sudo nmcli radio wifi on", ""],
      ["nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status", ["wlan0:wifi:connected:--", "wlan0:wifi:connected:--"]],
      ["sudo nmcli device set wlan0 managed yes", ""],
      ["nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list --rescan no", "*:Office Wifi:68:WPA2"]
    ])
  );
  const service = new DeviceService({
    settingsStore: createSettingsStore(),
    runCommand,
    kioskMode: true
  });

  const status = await service.getStatus();

  assert.equal(status.wifi.interface, "wlan0");
  assert.equal(status.wifi.state, "connected");
  assert.equal(status.wifi.connection, "Office Wifi");
  assert.equal(status.wifi.signal, 68);
  assert.ok(calls.includes("nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list --rescan no"));
  assert.ok(!calls.includes("nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list --rescan yes"));
});

test("getStatus avoids sudo Wi-Fi preparation when the app is not running in kiosk mode", async () => {
  const finder = process.platform === "win32" ? "where" : "which";
  const { calls, runCommand } = createRunner(
    new Map([
      [`${finder} nmcli`, "nmcli"],
      ["nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status", "wlan0:wifi:connected:Office Wifi"]
    ])
  );
  const service = new DeviceService({
    settingsStore: createSettingsStore(),
    runCommand,
    kioskMode: false
  });

  const status = await service.getStatus();

  assert.equal(status.canManageWifi, false);
  assert.equal(status.wifi.connection, "Office Wifi");
  assert.ok(calls.every((call) => !call.startsWith("sudo ")));
  assert.ok(!calls.includes("nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list --rescan no"));
});

test("connectWifi can set the Wi-Fi country before joining the network", async () => {
  const finder = process.platform === "win32" ? "where" : "which";
  const settingsStore = createSettingsStore();
  const { calls, runCommand } = createRunner(
    new Map([
      [`${finder} nmcli`, "nmcli"],
      [`${finder} raspi-config`, "raspi-config"],
      [`${finder} rfkill`, "rfkill"],
      ["sudo raspi-config nonint do_wifi_country US", ""],
      ["sudo rfkill unblock wifi", ""],
      ["sudo nmcli radio wifi on", ""],
      ["nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status", ["wlan0:wifi:disconnected:--", "wlan0:wifi:connected:Office Wifi", "wlan0:wifi:connected:Office Wifi"]],
      ["sudo nmcli device set wlan0 managed yes", ""],
      ["sudo nmcli device wifi rescan ifname wlan0", ""],
      ["sudo nmcli device wifi connect Office Wifi password swordfish", ""],
      ["nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list --rescan no", "*:Office Wifi:61:WPA2"]
    ])
  );
  const service = new DeviceService({
    settingsStore,
    runCommand,
    kioskMode: true
  });

  const status = await service.connectWifi({
    country: "us",
    ssid: "Office Wifi",
    password: "swordfish"
  });

  assert.equal(status.wifi.connection, "Office Wifi");
  assert.equal(settingsStore.get().wifiCountry, "US");
  assert.equal(settingsStore.get().lastWifiSsid, "Office Wifi");
  assert.ok(calls.includes("sudo raspi-config nonint do_wifi_country US"));
  assert.ok(calls.includes("sudo nmcli device wifi rescan ifname wlan0"));
});

test("connectWifi can auto-detect the Wi-Fi country when region is Auto", async () => {
  const finder = process.platform === "win32" ? "where" : "which";
  const settingsStore = createSettingsStore();
  const { calls, runCommand } = createRunner(
    new Map([
      [`${finder} nmcli`, "nmcli"],
      [`${finder} iw`, "iw"],
      [`${finder} raspi-config`, "raspi-config"],
      [`${finder} rfkill`, "rfkill"],
      ["iw reg get", ["global\ncountry US: DFS-FCC", "global\ncountry US: DFS-FCC"]],
      ["sudo raspi-config nonint do_wifi_country US", ""],
      ["sudo rfkill unblock wifi", ""],
      ["sudo nmcli radio wifi on", ""],
      [
        "nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status",
        [
          "wlan0:wifi:disconnected:--",
          "wlan0:wifi:connected:Office Wifi",
          "wlan0:wifi:connected:Office Wifi"
        ]
      ],
      ["sudo nmcli device set wlan0 managed yes", ""],
      ["sudo nmcli device wifi rescan ifname wlan0", ""],
      ["sudo nmcli device wifi connect Office Wifi password swordfish", ""],
      ["nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list --rescan no", "*:Office Wifi:61:WPA2"]
    ])
  );
  const service = new DeviceService({
    settingsStore,
    runCommand,
    kioskMode: true
  });

  const status = await service.connectWifi({
    ssid: "Office Wifi",
    password: "swordfish"
  });

  assert.equal(status.wifi.connection, "Office Wifi");
  assert.equal(status.wifi.country, "US");
  assert.equal(settingsStore.get().wifiCountry, "US");
  assert.ok(calls.includes("iw reg get"));
});
