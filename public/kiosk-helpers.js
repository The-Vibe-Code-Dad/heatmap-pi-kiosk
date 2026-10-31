const TICKER_TAPE_SYMBOL_LIMIT = 500;

function trimValue(value) {
  return `${value ?? ""}`.trim();
}

export function normalizeTickerSymbolInput(value) {
  return trimValue(value)
    .toUpperCase()
    .replaceAll(".", "-")
    .replace(/[^A-Z0-9^/-]/g, "");
}

export function normalizeTickerTapeDraftInput(value) {
  return `${value ?? ""}`
    .toUpperCase()
    .replaceAll(".", "-")
    .replace(/[^A-Z0-9^/,\s-]/g, "");
}

export function sanitizeTickerTapeSymbols(value) {
  const rawSymbols = Array.isArray(value)
    ? value
    : `${value ?? ""}`
        .split(/[\s,]+/)
        .filter(Boolean);
  const seen = new Set();
  const symbols = [];

  for (const rawSymbol of rawSymbols) {
    const symbol = normalizeTickerSymbolInput(rawSymbol);

    if (!symbol || seen.has(symbol)) {
      continue;
    }

    seen.add(symbol);
    symbols.push(symbol);

    if (symbols.length >= TICKER_TAPE_SYMBOL_LIMIT) {
      break;
    }
  }

  return symbols;
}

export function connectedWifiSsid(status) {
  return trimValue(status?.wifi?.connection);
}

export function rememberedWifiSsid(status) {
  return trimValue(status?.settings?.lastWifiSsid);
}

export function hasVisibleNetworkAddress(status) {
  return Array.isArray(status?.addresses) && status.addresses.length > 0;
}

export function shouldPromptForWifiSetup(status) {
  return (
    Boolean(status?.canManageWifi) &&
    rememberedWifiSsid(status) === "" &&
    connectedWifiSsid(status) === "" &&
    !hasVisibleNetworkAddress(status)
  );
}

export function shouldWarnAboutMissingNetwork(status) {
  return Boolean(status?.canManageWifi) && !hasVisibleNetworkAddress(status);
}

export function wifiConnectionMessage(status, desiredSsid = "") {
  const targetSsid = trimValue(desiredSsid);
  const activeSsid = connectedWifiSsid(status);

  if (targetSsid && targetSsid !== activeSsid) {
    return `"${targetSsid}" not connected.`;
  }

  return "No network.";
}
