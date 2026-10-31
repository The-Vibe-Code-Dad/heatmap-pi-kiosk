import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function splitNmcliLine(line) {
  const cells = [];
  let current = "";
  let escaped = false;

  for (const character of line) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === ":") {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}

function normalizeSignal(value) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function trimValue(value) {
  return `${value ?? ""}`.trim();
}

function normalizeWifiCountry(value) {
  const normalized = trimValue(value).toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "";
}

function parseRegulatoryCountry(output) {
  const matches = [...`${output ?? ""}`.matchAll(/\bcountry\s+([A-Z]{2})\s*:/gi)];
  const countries = matches.map((match) => normalizeWifiCountry(match[1])).filter(Boolean);

  return countries.find((country) => country !== "00") ?? countries[0] ?? "";
}

function parseDeviceStatusOutput(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitNmcliLine(line));
}

function visibleAddresses() {
  let interfaces;

  try {
    interfaces = os.networkInterfaces();
  } catch {
    return [];
  }

  const addresses = [];

  for (const [name, records] of Object.entries(interfaces)) {
    for (const record of records ?? []) {
      if (record.internal || record.family !== "IPv4") {
        continue;
      }

      addresses.push({
        interface: name,
        address: record.address
      });
    }
  }

  return addresses;
}

export class DeviceService {
  constructor({
    settingsStore,
    logger = console,
    runCommand,
    kioskMode = process.env.PI_KIOSK_MODE === "1",
    systemControlEnabled = process.env.PI_ALLOW_SYSTEM_CONTROL === "1",
    appServiceName = process.env.PI_APP_SERVICE_NAME ?? "heatmap-app.service",
    kioskServiceName = process.env.PI_KIOSK_SERVICE_NAME ?? "heatmap-kiosk.service"
  }) {
    this.settingsStore = settingsStore;
    this.logger = logger;
    this.kioskMode = kioskMode;
    this.systemControlEnabled = systemControlEnabled;
    this.appServiceName = appServiceName;
    this.kioskServiceName = kioskServiceName;
    this.commandCache = new Map();
    this.runCommand = runCommand;
  }

  async prime() {
    await this.settingsStore.load();
  }

  async getStatus() {
    const [nmcliAvailable, wifi] = await Promise.all([
      this.#commandAvailable("nmcli"),
      this.#getWifiStatus()
    ]);
    const wifiCountry = await this.#detectWifiCountry();

    return {
      kioskMode: this.kioskMode,
      systemControlEnabled: this.systemControlEnabled,
      platform: process.platform,
      hostname: os.hostname(),
      addresses: visibleAddresses(),
      wifi: {
        ...wifi,
        country: wifiCountry || null
      },
      canManageWifi: this.kioskMode && process.platform === "linux" && nmcliAvailable,
      canControlSystem: this.kioskMode && process.platform === "linux" && this.systemControlEnabled,
      settings: this.settingsStore.get()
    };
  }

  async listWifiNetworks({ rescan = true, country = "" } = {}) {
    if (!this.kioskMode || process.platform !== "linux") {
      return [];
    }

    if (!(await this.#commandAvailable("nmcli"))) {
      return [];
    }

    await this.#prepareWifi({ country, rescan });

    const output = await this.#run("nmcli", [
      "-t",
      "-f",
      "IN-USE,SSID,SIGNAL,SECURITY",
      "device",
      "wifi",
      "list",
      "--rescan",
      "no"
    ]);

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [inUse, ssid, signal, security] = splitNmcliLine(line);

        return {
          ssid,
          signal: normalizeSignal(signal),
          security: security || "Open",
          active: inUse === "*"
        };
      })
      .filter((network) => network.ssid)
      .sort((left, right) => {
        return (
          Number(right.active) - Number(left.active) ||
          (right.signal ?? -1) - (left.signal ?? -1) ||
          left.ssid.localeCompare(right.ssid)
        );
      });
  }

  async connectWifi({ ssid, password, country = "" }) {
    const desiredSsid = trimValue(ssid);

    if (!desiredSsid) {
      throw new Error("SSID is required.");
    }

    if (!this.kioskMode || process.platform !== "linux") {
      throw new Error("Wi-Fi management is unavailable on this device.");
    }

    if (!(await this.#commandAvailable("nmcli"))) {
      throw new Error("Wi-Fi management is unavailable on this device.");
    }

    const currentSettings = this.settingsStore.get();
    const desiredCountry =
      normalizeWifiCountry(country) || currentSettings.wifiCountry || (await this.#detectWifiCountry());

    await this.settingsStore.update({
      lastWifiSsid: desiredSsid,
      wifiCountry: desiredCountry
    });

    await this.#prepareWifi({
      country: desiredCountry,
      rescan: true
    });

    const args = ["nmcli", "device", "wifi", "connect", desiredSsid];

    if (trimValue(password) !== "") {
      args.push("password", trimValue(password));
    }

    await this.#run("sudo", args);
    return this.getStatus();
  }

  async updateSettings(patch) {
    return this.settingsStore.update(patch);
  }

  async restartApp() {
    if (!this.systemControlEnabled) {
      throw new Error("System control is disabled.");
    }

    await this.#run("sudo", ["systemctl", "restart", this.appServiceName]);
  }

  async restartKiosk() {
    if (!this.systemControlEnabled) {
      throw new Error("System control is disabled.");
    }

    await this.#run("sudo", ["systemctl", "restart", this.kioskServiceName]);
  }

  async rebootDevice() {
    if (!this.systemControlEnabled) {
      throw new Error("System control is disabled.");
    }

    await this.#run("sudo", ["systemctl", "reboot"]);
  }

  async #getWifiStatus() {
    if (!(await this.#commandAvailable("nmcli"))) {
      return {
        interface: null,
        state: "unavailable",
        connection: null
      };
    }

    const output = await this.#run("nmcli", ["-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status"]);
    const wifiRow = parseDeviceStatusOutput(output).find((cells) => cells[1] === "wifi");

    if (!wifiRow) {
      return {
        interface: null,
        state: "missing",
        connection: null
      };
    }

    if (!this.kioskMode || process.platform !== "linux") {
      return {
        interface: wifiRow[0] ?? null,
        state: wifiRow[2] ?? null,
        connection: wifiRow[3] && wifiRow[3] !== "--" ? wifiRow[3] : null,
        signal: null,
        security: null
      };
    }

    const networks = await this.listWifiNetworks({ rescan: false }).catch(() => []);
    const activeNetwork = networks.find((network) => network.active);

    return {
      interface: wifiRow[0] ?? null,
      state: wifiRow[2] ?? null,
      connection: wifiRow[3] && wifiRow[3] !== "--" ? wifiRow[3] : activeNetwork?.ssid ?? null,
      signal: activeNetwork?.signal ?? null,
      security: activeNetwork?.security ?? null
    };
  }

  async #prepareWifi({ country = "", rescan = false } = {}) {
    if (!this.kioskMode || process.platform !== "linux") {
      return;
    }

    const desiredCountry =
      normalizeWifiCountry(country) || this.settingsStore.get().wifiCountry || (await this.#detectWifiCountry());

    if (desiredCountry && (await this.#commandAvailable("raspi-config"))) {
      await this.#bestEffort("sudo", ["raspi-config", "nonint", "do_wifi_country", desiredCountry]);
    }

    if (await this.#commandAvailable("rfkill")) {
      await this.#bestEffort("sudo", ["rfkill", "unblock", "wifi"]);
    }

    await this.#bestEffort("sudo", ["nmcli", "radio", "wifi", "on"]);

    const output = await this.#run("nmcli", ["-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status"]);
    const wifiRow = parseDeviceStatusOutput(output).find((cells) => cells[1] === "wifi");
    const wifiInterface = wifiRow?.[0] ?? "";

    if (!wifiInterface) {
      return;
    }

    await this.#bestEffort("sudo", ["nmcli", "device", "set", wifiInterface, "managed", "yes"]);

    if (rescan) {
      await this.#bestEffort("sudo", ["nmcli", "device", "wifi", "rescan", "ifname", wifiInterface]);
    }
  }

  async #detectWifiCountry() {
    if (!this.kioskMode || process.platform !== "linux" || !(await this.#commandAvailable("iw"))) {
      return "";
    }

    try {
      return parseRegulatoryCountry(await this.#run("iw", ["reg", "get"]));
    } catch {
      return "";
    }
  }

  async #commandAvailable(command) {
    if (this.commandCache.has(command)) {
      return this.commandCache.get(command);
    }

    try {
      await this.#run(process.platform === "win32" ? "where" : "which", [command]);
      this.commandCache.set(command, true);
      return true;
    } catch {
      this.commandCache.set(command, false);
      return false;
    }
  }

  async #bestEffort(command, args) {
    try {
      await this.#run(command, args);
    } catch (error) {
      this.logger.warn(`Ignoring Wi-Fi preparation failure for '${command} ${args.join(" ")}'.`, error);
    }
  }

  async #run(command, args) {
    if (typeof this.runCommand === "function") {
      const result = await this.runCommand(command, args);
      return `${result?.stdout ?? ""}`.trim();
    }

    const { stdout } = await execFileAsync(command, args, {
      timeout: 15_000,
      windowsHide: true
    });

    return stdout.trim();
  }
}
