import {
  shouldPromptForWifiSetup,
  shouldWarnAboutMissingNetwork,
  wifiConnectionMessage
} from "./kiosk-helpers.js";

const tickerBar = document.querySelector("#ticker-bar");
const titleLabel = document.querySelector("#board-title");
const sessionLabel = document.querySelector("#session-label");
const summaryLabel = document.querySelector("#summary-label");
const headerWifiLabel = document.querySelector("#header-wifi-label");
const headerLocalTime = document.querySelector("#header-local-time");
const indexPrice = document.querySelector("#index-price");
const indexChange = document.querySelector("#index-change");
const boardGrid = document.querySelector("#board-grid");
const boardShell = document.querySelector("#board-shell");
const tickerTapeShell = document.querySelector("#ticker-tape-shell");
const tickerTapeTrack = document.querySelector("#ticker-tape-track");
const startupSplash = document.querySelector("#startup-splash");
const startupSplashTitle = document.querySelector("#startup-splash-title");
const startupSplashStatus = document.querySelector("#startup-splash-status");
const startupSplashMessage = document.querySelector("#startup-splash-message");
const settingsBackdrop = document.querySelector("#settings-backdrop");
const settingsPanel = document.querySelector(".settings-panel");
const settingsClose = document.querySelector("#settings-close");
const touchKeyboard = document.querySelector("#touch-keyboard");
const deviceHostname = document.querySelector("#device-hostname");
const devicePlatform = document.querySelector("#device-platform");
const deviceAddresses = document.querySelector("#device-addresses");
const deviceWifiStatus = document.querySelector("#device-wifi-status");
const startupMarketSelect = document.querySelector("#startup-market-select");
const holdDurationInput = document.querySelector("#hold-duration-input");
const tickerTapePositionSelect = document.querySelector("#ticker-tape-position-select");
const showLastSyncToggle = document.querySelector("#show-last-sync-toggle");
const showWifiToggle = document.querySelector("#show-wifi-toggle");
const showLocalTimeToggle = document.querySelector("#show-local-time-toggle");
const tickerTapeSymbolInput = document.querySelector("#ticker-tape-symbol-input");
const addTickerTapeSymbolButton = document.querySelector("#add-ticker-tape-symbol");
const tickerTapeSymbols = document.querySelector("#ticker-tape-symbols");
const saveDeviceSettingsButton = document.querySelector("#save-device-settings");
const wifiNetworks = document.querySelector("#wifi-networks");
const scanWifiButton = document.querySelector("#scan-wifi");
const wifiCountryInput = document.querySelector("#wifi-country-input");
const wifiSsidInput = document.querySelector("#wifi-ssid-input");
const wifiPasswordInput = document.querySelector("#wifi-password-input");
const wifiPasswordToggleButton = document.querySelector("#wifi-password-toggle");
const connectWifiButton = document.querySelector("#connect-wifi");
const wifiMessage = document.querySelector("#wifi-message");
const restartAppButton = document.querySelector("#restart-app");
const restartKioskButton = document.querySelector("#restart-kiosk");
const rebootDeviceButton = document.querySelector("#reboot-device");
const settingsMessage = document.querySelector("#settings-message");
const tickerMessage = document.querySelector("#ticker-message");

const MARKET_ORDER = ["sp500", "nasdaq100", "dow30"];
const KEYBOARD_LAYOUTS = {
  alpha: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "@"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", "-"],
    [
      { action: "shift", label: "Shift", className: "wide accent" },
      "z",
      "x",
      "c",
      "v",
      "b",
      "n",
      "m",
      ".",
      { action: "backspace", label: "Del", className: "wide accent" }
    ],
    [
      { action: "symbols", label: "123 @#", className: "wide accent" },
      { action: "space", label: "Space", className: "space" },
      { action: "clear", label: "Clear", className: "wide accent" },
      { action: "enter", label: "Enter", className: "wide done" }
    ]
  ],
  symbols: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
    ["-", "_", "=", "+", "[", "]", "{", "}", "/", "\\"],
    [
      ";",
      ":",
      "'",
      "\"",
      ",",
      ".",
      "?",
      "|",
      "~",
      { action: "backspace", label: "Del", className: "wide accent" }
    ],
    [
      { action: "alpha", label: "ABC", className: "wide accent" },
      { action: "space", label: "Space", className: "space" },
      { action: "clear", label: "Clear", className: "wide accent" },
      { action: "enter", label: "Enter", className: "wide done" }
    ]
  ],
  numeric: [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["0", { action: "backspace", label: "Del", className: "accent" }, { action: "clear", label: "Clear", className: "accent" }],
    [{ action: "enter", label: "Enter", className: "done" }]
  ]
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  signDisplay: "always",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short"
});

const localTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit"
});

const state = {
  marketId: MARKET_ORDER[0],
  snapshot: null,
  previousChanges: new Map(),
  requestId: 0,
  stream: null,
  switching: false,
  holdTimer: null,
  holdTriggered: false,
  holdSuppressTimer: null,
  holdActive: false,
  holdPointerId: null,
  deviceStatus: null,
  tickerTapeSymbolsDraft: [],
  tickerTapeRefreshTimer: null,
  wifiReminderTimer: null,
  keyboardTarget: null,
  keyboardMode: "alpha",
  keyboardShift: false,
  keyboardPressedKeyId: null,
  keyboardPressedTimer: null,
  boardFitFrame: null,
  settingsOpen: false,
  tickerTapeNeedsRefresh: false,
  syncAfterSettingsClose: false,
  syncRequest: null,
  localTimeTimer: null
};

const SETTINGS_EDGE_HOLD_HEIGHT_PX = 96;
const SETTINGS_HOLD_MOVE_TOLERANCE_PX = 44;
const HOLD_CLICK_SUPPRESSION_MS = 1400;
const TOUCH_KEYBOARD_PRESS_MS = 180;
const TICKER_TAPE_SYMBOL_LIMIT = 500;
const HIDDEN_WIFI_OPTION_VALUE = "__hidden__";
const HEADER_SETTING_DEFAULTS = {
  showHeaderLastSync: true,
  showHeaderWifi: false,
  showHeaderLocalTime: false
};
const HEADER_TOGGLES = [
  {
    button: showLastSyncToggle,
    setting: "showHeaderLastSync",
    label: "Last Sync"
  },
  {
    button: showWifiToggle,
    setting: "showHeaderWifi",
    label: "Wi-Fi"
  },
  {
    button: showLocalTimeToggle,
    setting: "showHeaderLocalTime",
    label: "Local Time"
  }
];

function flattenCompanies(snapshot) {
  return snapshot.sectors.flatMap((sector) => sector.companies);
}

function displaySymbolFor(company) {
  return company.displaySymbol ?? company.symbol;
}

function colorForChange(changePercent) {
  if (changePercent >= 0.1) {
    return "#25a746";
  }

  if (changePercent <= -0.1) {
    return "#c32642";
  }

  return "#343d49";
}

function sortCompanies(companies) {
  return companies.slice().sort((left, right) => {
    return (
      right.changePercent - left.changePercent ||
      right.change - left.change ||
      displaySymbolFor(left).localeCompare(displaySymbolFor(right))
    );
  });
}

function formatPercent(value) {
  return `${percentFormatter.format(value ?? 0)}%`;
}

function formatPrice(value) {
  return value === null || value === undefined ? "--" : decimalFormatter.format(value);
}

function formatDollar(value) {
  return value === null || value === undefined ? "--" : `$${formatPrice(value)}`;
}

function formatSignedDollar(value) {
  if (value === null || value === undefined) {
    return "--";
  }

  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${formatPrice(Math.abs(value))}`;
}

function headerSettings(settings = state.deviceStatus?.settings) {
  return {
    showHeaderLastSync:
      typeof settings?.showHeaderLastSync === "boolean"
        ? settings.showHeaderLastSync
        : HEADER_SETTING_DEFAULTS.showHeaderLastSync,
    showHeaderWifi:
      typeof settings?.showHeaderWifi === "boolean"
        ? settings.showHeaderWifi
        : HEADER_SETTING_DEFAULTS.showHeaderWifi,
    showHeaderLocalTime:
      typeof settings?.showHeaderLocalTime === "boolean"
        ? settings.showHeaderLocalTime
        : HEADER_SETTING_DEFAULTS.showHeaderLocalTime
  };
}

function syncHeaderToggleButtons(settings = state.deviceStatus?.settings) {
  const resolved = headerSettings(settings);

  for (const { button, setting, label } of HEADER_TOGGLES) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    const enabled = resolved[setting] === true;
    button.textContent = `${label} ${enabled ? "On" : "Off"}`;
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
  }
}

function applyHeaderVisibility(settings = state.deviceStatus?.settings) {
  const resolved = headerSettings(settings);

  summaryLabel?.classList.toggle("hidden", !resolved.showHeaderLastSync);
  headerWifiLabel?.classList.toggle("hidden", !resolved.showHeaderWifi);
  headerLocalTime?.classList.toggle("hidden", !resolved.showHeaderLocalTime);
  syncHeaderToggleButtons(resolved);
}

function headerWifiSignalBars(status = state.deviceStatus) {
  const connection = trimValue(status?.wifi?.connection);
  const signal = Number(status?.wifi?.signal);

  if (!connection || !Number.isFinite(signal)) {
    return 0;
  }

  if (signal >= 75) {
    return 4;
  }

  if (signal >= 50) {
    return 3;
  }

  if (signal >= 25) {
    return 2;
  }

  return 1;
}

function renderHeaderWifi(status = state.deviceStatus) {
  if (!headerWifiLabel) {
    return;
  }

  const connection = trimValue(status?.wifi?.connection);
  const signal = Number(status?.wifi?.signal);
  const hasSignal = connection && Number.isFinite(signal);
  const activeBars = headerWifiSignalBars(status);
  const bars = [1, 2, 3, 4]
    .map((bar) => {
      const className = bar <= activeBars ? "wifi-signal-bar wifi-signal-bar-active" : "wifi-signal-bar";
      return `<span class="${className}"></span>`;
    })
    .join("");

  headerWifiLabel.setAttribute(
    "aria-label",
    !connection ? "Wi-Fi disconnected" : hasSignal ? `Wi-Fi signal ${signal}%` : "Wi-Fi signal unavailable"
  );
  headerWifiLabel.classList.toggle("header-wifi-label-no-signal", !connection);
  headerWifiLabel.innerHTML = `<span class="wifi-signal-bars" aria-hidden="true">${bars}</span>`;
}

function updateHeaderLocalTime() {
  if (!headerLocalTime) {
    return;
  }

  headerLocalTime.textContent = localTimeFormatter.format(new Date());
}

function renderHeaderStatus(snapshot = state.snapshot) {
  const syncedAt = snapshot?.latestMarketTimestamp ?? snapshot?.fetchedAt;
  const syncedLabel = syncedAt ? timeFormatter.format(new Date(syncedAt)) : "waiting";

  summaryLabel.textContent = syncedAt ? `Last sync ${syncedLabel}` : "Waiting";
  renderHeaderWifi();
  updateHeaderLocalTime();
  applyHeaderVisibility();
}

function startHeaderLocalTimeClock() {
  updateHeaderLocalTime();

  if (state.localTimeTimer !== null) {
    return;
  }

  state.localTimeTimer = window.setInterval(() => {
    renderHeaderStatus(state.snapshot);
  }, 15_000);
}

function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeTickerSymbolInput(value) {
  return `${value ?? ""}`
    .trim()
    .toUpperCase()
    .replaceAll(".", "-")
    .replace(/[^A-Z0-9^/-]/g, "");
}

function sanitizeTickerTapeSymbols(value) {
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

function trimValue(value) {
  return `${value ?? ""}`.trim();
}

function isTextEditingTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable === true
  );
}

function shouldAllowEditingShortcut(event) {
  if (!isTextEditingTarget(event.target) || event.altKey) {
    return false;
  }

  const key = `${event.key ?? ""}`.toLowerCase();
  return ["a", "c", "v", "x", "y", "z", "arrowleft", "arrowright", "backspace", "delete", "home", "end"].includes(
    key
  );
}

function shouldBlockKioskShortcut(event) {
  const key = `${event.key ?? ""}`;

  if (/^F\d{1,2}$/.test(key)) {
    return true;
  }

  if (["BrowserBack", "BrowserForward", "GoBack", "GoForward", "LaunchApplication1", "LaunchApplication2"].includes(key)) {
    return true;
  }

  if (event.altKey && ["ArrowLeft", "ArrowRight", "Home", "F4"].includes(key)) {
    return true;
  }

  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }

  if (shouldAllowEditingShortcut(event)) {
    return false;
  }

  return true;
}

function normalizeWifiCountryInput(value) {
  return trimValue(value)
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

function isKeyboardField(element) {
  return (
    element instanceof HTMLInputElement &&
    ["text", "password", "number"].includes(element.type) &&
    settingsBackdrop.contains(element)
  );
}

function keyboardFieldLabel(input) {
  return (
    input?.closest(".settings-field")?.querySelector(".settings-label")?.textContent?.trim() ?? "Input"
  );
}

function keyboardPreviewValue(input) {
  const value = `${input?.value ?? ""}`;

  if (value === "") {
    return "Tap keys to type";
  }

  if (input?.type === "password") {
    return "\u2022".repeat(value.length);
  }

  return value;
}

function syncPasswordVisibilityToggle() {
  if (!(wifiPasswordToggleButton instanceof HTMLButtonElement)) {
    return;
  }

  const passwordVisible = wifiPasswordInput.type === "text";
  wifiPasswordToggleButton.textContent = passwordVisible ? "Hide" : "Show";
  wifiPasswordToggleButton.setAttribute("aria-pressed", passwordVisible ? "true" : "false");
}

function currentKeyboardLayoutName() {
  if (state.keyboardTarget?.type === "number") {
    return "numeric";
  }

  return state.keyboardMode;
}

function layoutRowsForKeyboard() {
  return KEYBOARD_LAYOUTS[currentKeyboardLayoutName()] ?? KEYBOARD_LAYOUTS.alpha;
}

function keyboardPressIdForValue(value) {
  return `value:${encodeURIComponent(value)}`;
}

function keyboardPressIdForAction(action) {
  return `action:${action}`;
}

function keyboardButtonMarkup(key) {
  if (typeof key === "string") {
    const isAlphaKey = currentKeyboardLayoutName() === "alpha" && /^[a-z]$/i.test(key);
    const label = isAlphaKey && state.keyboardShift ? key.toUpperCase() : key;
    return `
      <button
        class="touch-keyboard-key"
        type="button"
        data-keyboard-value="${encodeURIComponent(key)}"
        data-keyboard-press-id="${keyboardPressIdForValue(key)}"
      >
        ${escapeHtml(label)}
      </button>
    `;
  }

  const classSuffix = key.className
    ? key.className
        .split(/\s+/)
        .filter(Boolean)
        .map((name) => `touch-keyboard-key-${name}`)
        .join(" ")
    : "";
  const buttonClass = ["touch-keyboard-key", classSuffix].filter(Boolean).join(" ");

  return `
    <button
      class="${buttonClass}"
      type="button"
      data-keyboard-action="${key.action}"
      data-keyboard-press-id="${keyboardPressIdForAction(key.action)}"
    >
      ${escapeHtml(key.label)}
    </button>
  `;
}

function applyPressedTouchKeyboardKey() {
  const keys = touchKeyboard.querySelectorAll("[data-keyboard-press-id]");

  for (const key of keys) {
    const isPressed = key.dataset.keyboardPressId === state.keyboardPressedKeyId;
    key.classList.toggle("touch-keyboard-key-pressed", isPressed);
  }
}

function clearPressedTouchKeyboardKey() {
  if (state.keyboardPressedTimer !== null) {
    clearTimeout(state.keyboardPressedTimer);
    state.keyboardPressedTimer = null;
  }

  state.keyboardPressedKeyId = null;
  applyPressedTouchKeyboardKey();
}

function pressTouchKeyboardKey(key) {
  state.keyboardPressedKeyId = key.dataset.keyboardPressId ?? null;

  if (state.keyboardPressedTimer !== null) {
    clearTimeout(state.keyboardPressedTimer);
  }

  applyPressedTouchKeyboardKey();
  state.keyboardPressedTimer = setTimeout(clearPressedTouchKeyboardKey, TOUCH_KEYBOARD_PRESS_MS);
}

function keyboardKeySpan(key) {
  if (typeof key === "string") {
    return 1;
  }

  const classNames = `${key.className ?? ""}`.split(/\s+/);

  if (classNames.includes("space")) {
    return 4;
  }

  if (classNames.includes("wide")) {
    return 2;
  }

  return 1;
}

function keyboardRowColumns(row) {
  return row.reduce((total, key) => total + keyboardKeySpan(key), 0);
}

function renderTouchKeyboard() {
  if (!state.keyboardTarget) {
    clearPressedTouchKeyboardKey();
    touchKeyboard.innerHTML = "";
    touchKeyboard.classList.add("hidden");
    settingsPanel?.classList.remove("settings-panel-keyboard-open");
    return;
  }

  const layoutName = currentKeyboardLayoutName();
  const rows = layoutRowsForKeyboard();
  const shiftLabel =
    layoutName === "numeric" ? "Number Pad" : state.keyboardShift ? "Uppercase" : "Lowercase";

  touchKeyboard.innerHTML = `
    <div class="touch-keyboard-header">
      <div class="touch-keyboard-header-copy">
        <span class="touch-keyboard-field">${escapeHtml(keyboardFieldLabel(state.keyboardTarget))}</span>
        <span class="touch-keyboard-meta">${escapeHtml(shiftLabel)}</span>
      </div>
      <button
        class="button button-ghost touch-keyboard-hide"
        type="button"
        data-keyboard-action="hide"
        data-keyboard-press-id="${keyboardPressIdForAction("hide")}"
      >
        Hide Keyboard
      </button>
    </div>
    <div class="touch-keyboard-preview" id="touch-keyboard-preview">${escapeHtml(keyboardPreviewValue(state.keyboardTarget))}</div>
    <div class="touch-keyboard-grid">
      ${rows
        .map((row) => {
          return `
            <div class="touch-keyboard-row" style="--keyboard-columns:${keyboardRowColumns(row)}">
              ${row.map((key) => keyboardButtonMarkup(key)).join("")}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
  touchKeyboard.classList.remove("hidden");
  settingsPanel?.classList.add("settings-panel-keyboard-open");
  applyPressedTouchKeyboardKey();
}

function refreshTouchKeyboardPreview() {
  const preview = document.querySelector("#touch-keyboard-preview");

  if (!preview || !isKeyboardField(state.keyboardTarget)) {
    return;
  }

  preview.textContent = keyboardPreviewValue(state.keyboardTarget);
}

function openTouchKeyboard(targetInput) {
  if (!isKeyboardField(targetInput)) {
    return;
  }

  state.keyboardTarget = targetInput;

  if (targetInput.type !== "number") {
    state.keyboardMode = "alpha";
  }

  renderTouchKeyboard();
}

function closeTouchKeyboard({ blur = false } = {}) {
  if (blur && isKeyboardField(state.keyboardTarget)) {
    state.keyboardTarget.blur();
  }

  state.keyboardTarget = null;
  state.keyboardMode = "alpha";
  state.keyboardShift = false;
  renderTouchKeyboard();
}

function focusKeyboardInput(input) {
  if (document.activeElement !== input) {
    input.focus({ preventScroll: true });
  }
}

function emitInputUpdate(input) {
  input.dispatchEvent(new Event("input", { bubbles: true }));
  refreshTouchKeyboardPreview();
}

function insertTextIntoKeyboardTarget(text) {
  const input = state.keyboardTarget;

  if (!isKeyboardField(input)) {
    return;
  }

  const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
  const selectionEnd = typeof input.selectionEnd === "number" ? input.selectionEnd : input.value.length;
  const nextValue = `${input.value.slice(0, selectionStart)}${text}${input.value.slice(selectionEnd)}`;
  const nextCaretPosition = selectionStart + text.length;

  input.value = nextValue;
  focusKeyboardInput(input);

  if (typeof input.setSelectionRange === "function") {
    input.setSelectionRange(nextCaretPosition, nextCaretPosition);
  }

  emitInputUpdate(input);
}

function backspaceKeyboardTarget() {
  const input = state.keyboardTarget;

  if (!isKeyboardField(input) || input.value.length === 0) {
    return;
  }

  const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
  const selectionEnd = typeof input.selectionEnd === "number" ? input.selectionEnd : input.value.length;

  if (selectionStart !== selectionEnd) {
    input.value = `${input.value.slice(0, selectionStart)}${input.value.slice(selectionEnd)}`;
    focusKeyboardInput(input);
    if (typeof input.setSelectionRange === "function") {
      input.setSelectionRange(selectionStart, selectionStart);
    }
    emitInputUpdate(input);
    return;
  }

  if (selectionStart === 0) {
    return;
  }

  const nextCaretPosition = selectionStart - 1;
  input.value = `${input.value.slice(0, nextCaretPosition)}${input.value.slice(selectionEnd)}`;
  focusKeyboardInput(input);

  if (typeof input.setSelectionRange === "function") {
    input.setSelectionRange(nextCaretPosition, nextCaretPosition);
  }

  emitInputUpdate(input);
}

function clearKeyboardTarget() {
  if (!isKeyboardField(state.keyboardTarget)) {
    return;
  }

  state.keyboardTarget.value = "";
  focusKeyboardInput(state.keyboardTarget);
  emitInputUpdate(state.keyboardTarget);
}

function clampNumber(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function fittedTextSizesForTile(container) {
  const symbol = container.querySelector(".symbol");
  const change = container.querySelector(".change");

  if (!symbol || !change) {
    return null;
  }

  const bounds = container.getBoundingClientRect();

  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const style = window.getComputedStyle(container);
  const horizontalPadding =
    Number.parseFloat(style.paddingLeft || "0") + Number.parseFloat(style.paddingRight || "0");
  const verticalPadding =
    Number.parseFloat(style.paddingTop || "0") + Number.parseFloat(style.paddingBottom || "0");
  const symbolLength = Math.max(1, symbol.textContent.trim().length);
  const changeLength = Math.max(1, change.textContent.trim().length);
  const diagonalScale = container.classList.contains("diagonal-label") ? 0.92 : 1;
  const usableWidth = Math.max(1, (bounds.width - horizontalPadding - 2) * diagonalScale);
  const usableHeight = Math.max(1, (bounds.height - verticalPadding - 2) * diagonalScale);
  const compact = bounds.width < 22 || bounds.height < 24;
  const symbolMinimum = compact ? 2.8 : 4.8;
  const changeMinimum = compact ? 2.6 : 4.2;
  const symbolMaximum = compact ? 9 : 17;
  const changeMaximum = compact ? 7 : 12;
  const symbolSize = clampNumber(
    Math.min(usableWidth / (symbolLength * 0.9), usableHeight * 0.42),
    symbolMinimum,
    symbolMaximum
  );
  const changeSize = clampNumber(
    Math.min(usableWidth / (changeLength * 0.76), usableHeight * 0.26),
    changeMinimum,
    changeMaximum
  );

  return { symbolSize, changeSize };
}

function fitBoardText() {
  state.boardFitFrame = null;
  const tiles = [...boardGrid.querySelectorAll(".tile, .diagonal-label")];
  const fittedSizes = tiles.map(fittedTextSizesForTile).filter(Boolean);

  if (fittedSizes.length === 0) {
    return;
  }

  const symbolSize = Math.min(...fittedSizes.map((size) => size.symbolSize));
  const changeSize = Math.min(...fittedSizes.map((size) => size.changeSize));

  for (const tile of tiles) {
    const symbol = tile.querySelector(".symbol");
    const change = tile.querySelector(".change");

    if (symbol) {
      symbol.style.fontSize = `${symbolSize.toFixed(2)}px`;
    }

    if (change) {
      change.style.fontSize = `${changeSize.toFixed(2)}px`;
    }
  }
}

function scheduleBoardTextFit() {
  if (state.boardFitFrame !== null) {
    window.cancelAnimationFrame(state.boardFitFrame);
  }

  state.boardFitFrame = window.requestAnimationFrame(fitBoardText);
}

function handleKeyboardCharacter(rawValue) {
  if (!isKeyboardField(state.keyboardTarget)) {
    return;
  }

  const layoutName = currentKeyboardLayoutName();
  let value = rawValue;

  if (layoutName === "alpha" && /^[a-z]$/i.test(rawValue)) {
    value = state.keyboardShift ? rawValue.toUpperCase() : rawValue.toLowerCase();
  }

  insertTextIntoKeyboardTarget(value);
}

function submitKeyboardTarget() {
  const input = state.keyboardTarget;

  if (!isKeyboardField(input)) {
    return;
  }

  if (input === tickerTapeSymbolInput) {
    addTickerTapeSymbolsFromInput().catch((error) => {
      setTickerMessage(error.message, "error");
    });
    return;
  }

  if (input === wifiCountryInput) {
    wifiSsidInput.focus({ preventScroll: true });
    openTouchKeyboard(wifiSsidInput);
    return;
  }

  if (input === wifiSsidInput) {
    wifiPasswordInput.focus({ preventScroll: true });
    openTouchKeyboard(wifiPasswordInput);
    return;
  }

  if (input === wifiPasswordInput) {
    connectWifi().catch((error) => {
      setWifiMessage(error.message, "error");
    });
    return;
  }

  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}

function handleKeyboardAction(action) {
  switch (action) {
    case "shift":
      state.keyboardShift = !state.keyboardShift;
      renderTouchKeyboard();
      focusKeyboardInput(state.keyboardTarget);
      break;
    case "symbols":
      state.keyboardMode = "symbols";
      state.keyboardShift = false;
      renderTouchKeyboard();
      focusKeyboardInput(state.keyboardTarget);
      break;
    case "alpha":
      state.keyboardMode = "alpha";
      renderTouchKeyboard();
      focusKeyboardInput(state.keyboardTarget);
      break;
    case "space":
      insertTextIntoKeyboardTarget(" ");
      break;
    case "backspace":
      backspaceKeyboardTarget();
      break;
    case "clear":
      clearKeyboardTarget();
      break;
    case "hide":
      closeTouchKeyboard({ blur: true });
      break;
    case "enter":
      submitKeyboardTarget();
      break;
    default:
      break;
  }
}

function boardTuningFor(layout) {
  if (layout.rowItemCounts.length >= 12) {
    return {
      symbolSize: "0.52rem",
      changeSize: "0.38rem",
      tilePaddingBlock: "1px",
      tilePaddingInline: "2px",
      tileGap: "1px"
    };
  }

  if (layout.columnCount >= 20) {
    return {
      symbolSize: "clamp(0.72rem, 0.86vw, 0.9rem)",
      changeSize: "clamp(0.58rem, 0.66vw, 0.72rem)",
      tilePaddingBlock: "6px",
      tilePaddingInline: "6px",
      tileGap: "4px"
    };
  }

  return {
    symbolSize: "clamp(0.94rem, 1.12vw, 1.28rem)",
    changeSize: "clamp(0.72rem, 0.82vw, 0.94rem)",
    tilePaddingBlock: "8px",
    tilePaddingInline: "8px",
    tileGap: "5px"
  };
}

function applyBoardTuning(layout) {
  const tuning = boardTuningFor(layout);

  boardGrid.style.gridTemplateRows = `repeat(${layout.rowItemCounts.length}, minmax(0, 1fr))`;
  boardGrid.style.setProperty("--symbol-size", tuning.symbolSize);
  boardGrid.style.setProperty("--change-size", tuning.changeSize);
  boardGrid.style.setProperty("--tile-padding-block", tuning.tilePaddingBlock);
  boardGrid.style.setProperty("--tile-padding-inline", tuning.tilePaddingInline);
  boardGrid.style.setProperty("--tile-gap", tuning.tileGap);
}

function updateTickerTapePlacement(position) {
  const resolvedPosition =
    position === "top" || position === "bottom" || position === "hide" ? position : "hide";

  boardShell.classList.remove("board-shell-ticker-top", "board-shell-ticker-bottom", "board-shell-ticker-hide");
  boardShell.classList.add(`board-shell-ticker-${resolvedPosition}`);
  tickerTapeShell.classList.remove("ticker-tape-top", "ticker-tape-bottom");

  if (resolvedPosition !== "hide") {
    tickerTapeShell.classList.add(`ticker-tape-${resolvedPosition}`);
  }
}

function renderTickerTapeSymbolChips(symbols) {
  if (symbols.length === 0) {
    tickerTapeSymbols.innerHTML = `<div class="wifi-empty">No ticker tape symbols yet.</div>`;
    return;
  }

  tickerTapeSymbols.innerHTML = symbols
    .map((symbol) => {
      return `
        <button class="ticker-tape-symbol-chip" type="button" data-remove-symbol="${symbol}">
          <span>${symbol}</span>
          <span class="ticker-tape-chip-remove" aria-hidden="true">X</span>
        </button>
      `;
    })
    .join("");
}

function tickerTapeSignature(items) {
  return items.map((item) => item.symbol).join("|");
}

function tickerTapeAvailabilityClass(item) {
  if (!item.available) {
    return "ticker-tape-item-unavailable";
  }

  if (item.changePercent > 0.05) {
    return "ticker-tape-item-positive";
  }

  if (item.changePercent < -0.05) {
    return "ticker-tape-item-negative";
  }

  return "ticker-tape-item-flat";
}

function tickerTapeChangeLabel(item) {
  return item.available
    ? `${item.change >= 0 ? "+" : ""}${formatPrice(item.change)} (${formatPercent(item.changePercent)})`
    : "Waiting";
}

function renderTickerTapeItem(item) {
  return `
    <span class="ticker-tape-item ${tickerTapeAvailabilityClass(item)}">
      <span class="ticker-tape-symbol">${escapeHtml(item.symbol)}</span>
      <span class="ticker-tape-price">${formatPrice(item.price)}</span>
      <span class="ticker-tape-change">${tickerTapeChangeLabel(item)}</span>
    </span>
  `;
}

function updateTickerTapeItemElement(element, item) {
  element.className = `ticker-tape-item ${tickerTapeAvailabilityClass(item)}`;
  element.querySelector(".ticker-tape-symbol").textContent = item.symbol;
  element.querySelector(".ticker-tape-price").textContent = formatPrice(item.price);
  element.querySelector(".ticker-tape-change").textContent = tickerTapeChangeLabel(item);
}

function renderTickerTapeTrack(items) {
  const signature = tickerTapeSignature(items);
  const durationSeconds = Math.max(20, items.length * 4);
  const duration = `${durationSeconds}s`;

  if (tickerTapeTrack.style.animationDuration !== duration) {
    tickerTapeTrack.style.animationDuration = duration;
  }

  if (tickerTapeTrack.dataset.symbols !== signature) {
    const segment = items.map(renderTickerTapeItem).join("");

    tickerTapeTrack.innerHTML = `
      <span class="ticker-tape-segment">${segment}</span>
      <span class="ticker-tape-segment" aria-hidden="true">${segment}</span>
    `;
    tickerTapeTrack.dataset.symbols = signature;
    return;
  }

  tickerTapeTrack.querySelectorAll(".ticker-tape-item").forEach((element, index) => {
    updateTickerTapeItemElement(element, items[index % items.length]);
  });
}

function renderTickerTape(payload) {
  const items = payload?.items ?? [];
  const position = payload?.position ?? state.deviceStatus?.settings?.tickerTapePosition ?? "hide";

  updateTickerTapePlacement(position);
  scheduleBoardTextFit();

  if (position === "hide" || items.length === 0) {
    tickerTapeTrack.innerHTML = "";
    delete tickerTapeTrack.dataset.symbols;
    tickerTapeShell.classList.add("hidden");
    return;
  }

  renderTickerTapeTrack(items);
  tickerTapeShell.classList.remove("hidden");
}

function renderTile(company, extraClass = "") {
  const previousValue = state.previousChanges.get(company.symbol);
  const didMove = previousValue !== undefined && previousValue !== company.changePercent;
  const background = colorForChange(company.changePercent);

  state.previousChanges.set(company.symbol, company.changePercent);

  return `
    <article class="tile ${extraClass} ${didMove ? "pulse" : ""}" style="background:${background}">
      <span class="symbol">${displaySymbolFor(company)}</span>
      <span class="change">${formatPercent(company.changePercent)}</span>
    </article>
  `;
}

function renderDiagonalPair(companies) {
  const [topLeftCompany, bottomRightCompany] = companies;
  const topLeftPrevious = state.previousChanges.get(topLeftCompany.symbol);
  const bottomRightPrevious = state.previousChanges.get(bottomRightCompany.symbol);
  const topLeftMoved =
    topLeftPrevious !== undefined && topLeftPrevious !== topLeftCompany.changePercent;
  const bottomRightMoved =
    bottomRightPrevious !== undefined && bottomRightPrevious !== bottomRightCompany.changePercent;

  state.previousChanges.set(topLeftCompany.symbol, topLeftCompany.changePercent);
  state.previousChanges.set(bottomRightCompany.symbol, bottomRightCompany.changePercent);

  const topLeftColor = colorForChange(topLeftCompany.changePercent);
  const bottomRightColor = colorForChange(bottomRightCompany.changePercent);

  return `
    <div class="tile-stack diagonal-pair ${topLeftMoved || bottomRightMoved ? "pulse" : ""}" style="--split-top:${topLeftColor}; --split-bottom:${bottomRightColor}">
      <article class="diagonal-label diagonal-label-top-left">
        <span class="symbol">${displaySymbolFor(topLeftCompany)}</span>
        <span class="change">${formatPercent(topLeftCompany.changePercent)}</span>
      </article>
      <article class="diagonal-label diagonal-label-bottom-right">
        <span class="symbol">${displaySymbolFor(bottomRightCompany)}</span>
        <span class="change">${formatPercent(bottomRightCompany.changePercent)}</span>
      </article>
    </div>
  `;
}

function buildRows(companies, rowItemCounts) {
  const rows = [];
  let cursor = 0;

  for (const size of rowItemCounts) {
    rows.push(companies.slice(cursor, cursor + size));
    cursor += size;
  }

  return rows;
}

function splitSlotsForRow(layout, rowIndex) {
  const splits = Array.isArray(layout.splits) && layout.splits.length > 0
    ? layout.splits
    : layout.split
      ? [layout.split]
      : [];

  return new Map(
    splits
      .filter((split) => split.rowIndex === rowIndex && split.style === "diagonal")
      .map((split) => [split.slotIndex, split])
  );
}

function renderRowTiles(rowCompanies, layout, rowIndex) {
  const splitSlots = splitSlotsForRow(layout, rowIndex);
  let companyIndex = 0;
  const cells = [];

  for (let slotIndex = 0; slotIndex < layout.columnCount && companyIndex < rowCompanies.length; slotIndex += 1) {
    if (splitSlots.has(slotIndex) && companyIndex + 1 < rowCompanies.length) {
      cells.push(renderDiagonalPair(rowCompanies.slice(companyIndex, companyIndex + 2)));
      companyIndex += 2;
      continue;
    }

    cells.push(renderTile(rowCompanies[companyIndex]));
    companyIndex += 1;
  }

  return cells.join("");
}

function renderTiles(companies, layout) {
  const sortedCompanies = sortCompanies(companies);
  const rows = buildRows(sortedCompanies, layout.rowItemCounts);

  applyBoardTuning(layout);

  boardGrid.innerHTML = rows
    .map((rowCompanies, rowIndex) => {
      const rowStyle = `style="grid-template-columns: repeat(${layout.columnCount}, minmax(0, 1fr));"`;
      const hasSplit = splitSlotsForRow(layout, rowIndex).size > 0;

      return `
        <div class="board-row ${hasSplit ? "board-row-split" : ""}" ${rowStyle}>
          ${renderRowTiles(rowCompanies, layout, rowIndex)}
        </div>
      `;
    })
    .join("");
  scheduleBoardTextFit();
}

function render(snapshot) {
  const companies = flattenCompanies(snapshot);
  const index = snapshot.index;
  const market = snapshot.market;

  titleLabel.textContent = market.title;
  document.title = `${market.title} Pi Kiosk`;
  sessionLabel.textContent = snapshot.marketSession.toUpperCase();
  renderHeaderStatus(snapshot);
  indexPrice.textContent = formatDollar(index.price);
  indexChange.textContent = `${formatSignedDollar(index.change)} (${formatPercent(index.changePercent)})`;
  indexChange.className = "index-change";
  indexChange.classList.add(
    index.changePercent > 0.05 ? "positive" : index.changePercent < -0.05 ? "negative" : "flat"
  );
  renderTiles(companies, market.layout);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? `Request failed with HTTP ${response.status}.`);
  }

  return payload;
}

function setSettingsMessage(message, tone = "") {
  settingsMessage.textContent = message ?? "";
  settingsMessage.className = "settings-message";

  if (tone) {
    settingsMessage.classList.add(`settings-message-${tone}`);
  }
}

function setCardMessage(element, message, tone = "") {
  if (!element) {
    return;
  }

  element.textContent = message ?? "";
  element.className = "settings-card-message";

  if (tone) {
    element.classList.add(`settings-card-message-${tone}`);
  }
}

function setWifiMessage(message, tone = "") {
  setCardMessage(wifiMessage, message, tone);
}

function setTickerMessage(message, tone = "") {
  setCardMessage(tickerMessage, message, tone);
}

function showStartupSplash({
  title = "Starting Kiosk",
  status = "Preparing the touchscreen app...",
  message = "The kiosk will open the board or Wi-Fi setup in a moment."
} = {}) {
  startupSplashTitle.textContent = title;
  startupSplashStatus.textContent = status;
  startupSplashMessage.textContent = message;
  startupSplash.classList.remove("hidden");
  startupSplash.setAttribute("aria-hidden", "false");
}

function hideStartupSplash() {
  startupSplash.classList.add("hidden");
  startupSplash.setAttribute("aria-hidden", "true");
}

function renderWifiNetworks(networks) {
  wifiNetworks.replaceChildren();

  if (networks.length === 0) {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "No Wi-Fi networks found";
    wifiNetworks.append(emptyOption);
  } else {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a Wi-Fi network";
    wifiNetworks.append(placeholder);
  }

  const hiddenOption = document.createElement("option");
  hiddenOption.value = HIDDEN_WIFI_OPTION_VALUE;
  hiddenOption.textContent = "Hidden network...";
  wifiNetworks.append(hiddenOption);

  const desiredSsid = resolvedWifiSsid();
  const activeSsid = networks.find((network) => network.active)?.ssid ?? "";
  const selectedSsid = desiredSsid || activeSsid;

  for (const network of networks) {
    const option = document.createElement("option");
    const signalLabel = network.signal === null || network.signal === undefined ? "--" : `${network.signal}%`;
    const securityLabel = network.security ?? "Open";
    option.value = network.ssid ?? "";
    option.textContent = `${network.ssid ?? ""} (${signalLabel} | ${securityLabel})${network.active ? " - connected" : ""}`;
    wifiNetworks.append(option);
  }

  wifiNetworks.value = networks.some((network) => network.ssid === selectedSsid) ? selectedSsid : "";
}

function configuredWifiCountry(status) {
  return normalizeWifiCountryInput(status?.settings?.wifiCountry);
}

function detectedWifiCountry(status) {
  return normalizeWifiCountryInput(status?.wifi?.country);
}

function savedWifiCountry(status) {
  return configuredWifiCountry(status) || detectedWifiCountry(status);
}

function savedWifiSsid(status) {
  return trimValue(status?.settings?.lastWifiSsid || status?.wifi?.connection);
}

function ensureWifiCountryOption(country) {
  const normalized = normalizeWifiCountryInput(country);

  if (!normalized || wifiCountryInput.querySelector(`option[value="${normalized}"]`)) {
    return;
  }

  const option = document.createElement("option");
  option.value = normalized;
  option.textContent = `${normalized} (detected)`;
  wifiCountryInput.append(option);
}

function updateAutoWifiCountryOption(status) {
  const option = wifiCountryInput.querySelector('option[value=""]');

  if (!option) {
    return;
  }

  const detectedCountry = detectedWifiCountry(status);
  option.textContent = detectedCountry ? `Auto: ${detectedCountry}` : "Auto";
}

function resolvedWifiCountry(status = state.deviceStatus) {
  return normalizeWifiCountryInput(wifiCountryInput.value) || savedWifiCountry(status);
}

function resolvedWifiSsid(status = state.deviceStatus) {
  return trimValue(wifiSsidInput.value) || savedWifiSsid(status);
}

function syncWifiSetupInputs(status) {
  const country = configuredWifiCountry(status);
  const ssid = savedWifiSsid(status);

  updateAutoWifiCountryOption(status);

  if (country && document.activeElement !== wifiCountryInput && trimValue(wifiCountryInput.value) === "") {
    ensureWifiCountryOption(country);
    wifiCountryInput.value = country;
  }

  if (ssid && document.activeElement !== wifiSsidInput && trimValue(wifiSsidInput.value) === "") {
    wifiSsidInput.value = ssid;
  }
}

function focusWifiSetup() {
  if (wifiNetworks instanceof HTMLSelectElement && !wifiNetworks.disabled) {
    wifiNetworks.focus({ preventScroll: true });
    closeTouchKeyboard();
    return;
  }

  wifiSsidInput.focus({ preventScroll: true });
  openTouchKeyboard(wifiSsidInput);
}

function clearWifiReminder() {
  if (state.wifiReminderTimer !== null) {
    clearTimeout(state.wifiReminderTimer);
    state.wifiReminderTimer = null;
  }
}

function scheduleWifiReminder(status) {
  clearWifiReminder();

  if (!shouldWarnAboutMissingNetwork(status)) {
    return;
  }

  state.wifiReminderTimer = window.setTimeout(async () => {
    const refreshedStatus = await refreshDeviceStatus({ quiet: true });

    if (!refreshedStatus || !shouldWarnAboutMissingNetwork(refreshedStatus)) {
      return;
    }

    await openSettings({
      message: wifiConnectionMessage(refreshedStatus, resolvedWifiSsid(refreshedStatus)),
      tone: "error",
      focusWifi: true
    });
  }, 60_000);
}

function renderDeviceStatus(status) {
  deviceHostname.textContent = status.hostname ?? "--";
  devicePlatform.textContent = status.kioskMode ? `${status.platform} kiosk` : status.platform ?? "--";
  deviceAddresses.textContent =
    status.addresses.length === 0
      ? "No network address"
      : status.addresses.map((entry) => `${entry.interface}: ${entry.address}`).join(" | ");
  deviceWifiStatus.textContent =
    status.wifi.connection
      ? `${status.wifi.connection}${status.wifi.signal !== null ? ` (${status.wifi.signal}%)` : ""}`
      : status.wifi.state ?? "Unavailable";

  startupMarketSelect.value = status.settings.startupMarket;
  holdDurationInput.value = `${status.settings.holdToOpenMs}`;
  tickerTapePositionSelect.value = status.settings.tickerTapePosition ?? "hide";
  state.tickerTapeSymbolsDraft = [...(status.settings.tickerTapeSymbols ?? [])];
  renderTickerTapeSymbolChips(state.tickerTapeSymbolsDraft);
  restartAppButton.disabled = !status.canControlSystem;
  restartKioskButton.disabled = !status.canControlSystem;
  rebootDeviceButton.disabled = !status.canControlSystem;
  scanWifiButton.disabled = !status.canManageWifi;
  connectWifiButton.disabled = !status.canManageWifi;
  syncWifiSetupInputs(status);
  renderHeaderStatus(state.snapshot);
}

async function refreshTickerTape({ quiet = false } = {}) {
  if (state.settingsOpen) {
    state.tickerTapeNeedsRefresh = true;
    return null;
  }

  try {
    const tickerTape = await fetchJson("/api/device/ticker-tape");
    renderTickerTape(tickerTape);
    state.tickerTapeNeedsRefresh = false;
    return tickerTape;
  } catch (error) {
    if (!quiet) {
      setTickerMessage(error.message, "error");
    }

    return null;
  }
}

function refreshTickerTapeInBackground({ quiet = true } = {}) {
  refreshTickerTape({ quiet }).catch((error) => {
    if (!quiet) {
      setTickerMessage(error.message, "error");
    }
  });
}

function currentDeviceSettingsPatch(overrides = {}) {
  return {
    startupMarket: startupMarketSelect.value,
    holdToOpenMs: holdDurationInput.value,
    tickerTapePosition: tickerTapePositionSelect.value,
    tickerTapeSymbols: state.tickerTapeSymbolsDraft,
    ...headerSettings(),
    ...overrides
  };
}

async function saveDeviceSettings(overrides = {}) {
  const result = await fetchJson("/api/device/settings", {
    method: "POST",
    body: JSON.stringify(currentDeviceSettingsPatch(overrides))
  });

  if (state.deviceStatus) {
    state.deviceStatus.settings = result.settings;
    renderDeviceStatus(state.deviceStatus);
  } else {
    state.tickerTapeSymbolsDraft = [...(result.settings.tickerTapeSymbols ?? [])];
    renderTickerTapeSymbolChips(state.tickerTapeSymbolsDraft);
  }

  state.tickerTapeNeedsRefresh = true;

  if (!state.settingsOpen) {
    refreshTickerTapeInBackground({ quiet: true });
  }

  return result.settings;
}

async function toggleHeaderSetting(setting) {
  const settings = headerSettings();
  await saveDeviceSettings({ [setting]: !settings[setting] });
  renderHeaderStatus(state.snapshot);
}

async function addTickerTapeSymbolsFromInput() {
  const nextSymbols = sanitizeTickerTapeSymbols(tickerTapeSymbolInput.value);

  if (nextSymbols.length === 0) {
    setTickerMessage("Type a ticker symbol to add it to the tape.", "error");
    return;
  }

  const combined = sanitizeTickerTapeSymbols([...state.tickerTapeSymbolsDraft, ...nextSymbols]);

  if (combined.length === state.tickerTapeSymbolsDraft.length) {
    setTickerMessage("That ticker is already on the tape.", "error");
    tickerTapeSymbolInput.select();
    return;
  }

  setTickerMessage("Adding ticker...");
  await saveDeviceSettings({ tickerTapeSymbols: combined });
  tickerTapeSymbolInput.value = "";
  emitInputUpdate(tickerTapeSymbolInput);
  focusKeyboardInput(tickerTapeSymbolInput);
  openTouchKeyboard(tickerTapeSymbolInput);
  setTickerMessage("Ticker added to the tape.", "success");
}

async function removeTickerTapeSymbol(symbol) {
  const nextSymbols = state.tickerTapeSymbolsDraft.filter((entry) => entry !== symbol);

  if (nextSymbols.length === state.tickerTapeSymbolsDraft.length) {
    return;
  }

  setTickerMessage("Removing ticker...");
  await saveDeviceSettings({ tickerTapeSymbols: nextSymbols });
  setTickerMessage(`${symbol} removed from the tape.`, "success");
}

function startTickerTapeRefreshLoop() {
  if (state.tickerTapeRefreshTimer !== null) {
    clearInterval(state.tickerTapeRefreshTimer);
  }

  state.tickerTapeRefreshTimer = window.setInterval(() => {
    if (state.settingsOpen) {
      return;
    }

    refreshTickerTape({ quiet: true }).catch(() => {});
  }, 30_000);
}

function stopTickerTapeRefreshLoop() {
  if (state.tickerTapeRefreshTimer !== null) {
    clearInterval(state.tickerTapeRefreshTimer);
    state.tickerTapeRefreshTimer = null;
  }
}

async function refreshDeviceStatus({ quiet = false, scheduleReminder = true } = {}) {
  try {
    const status = await fetchJson("/api/device/status");
    state.deviceStatus = status;
    renderDeviceStatus(status);
    if (scheduleReminder) {
      scheduleWifiReminder(status);
    }
    return status;
  } catch (error) {
    if (!quiet) {
      setSettingsMessage(error.message, "error");
    }
    return null;
  }
}

function hasWifiConnection(status) {
  return Boolean(status?.wifi?.connection);
}

async function refreshCurrentMarketSnapshot({ quiet = true } = {}) {
  if (state.settingsOpen) {
    return null;
  }

  try {
    const response = await fetch(`/api/heatmap?market=${encodeURIComponent(state.marketId)}`);

    if (!response.ok) {
      throw new Error(`Board refresh failed with HTTP ${response.status}.`);
    }

    const snapshot = await response.json();
    state.snapshot = snapshot;
    state.marketId = snapshot.market.id;
    render(snapshot);
    scheduleBoardTextFit();
    return snapshot;
  } catch (error) {
    if (!quiet) {
      summaryLabel.textContent = error.message;
    }

    return null;
  }
}

function syncMarketDataInBackground({ quiet = true } = {}) {
  if (state.syncRequest !== null) {
    return state.syncRequest;
  }

  if (!quiet) {
    summaryLabel.textContent = "Syncing now...";
  }

  state.syncRequest = fetchJson("/api/device/actions/sync-now", { method: "POST" })
    .then(async (result) => {
      await refreshCurrentMarketSnapshot({ quiet });
      return result;
    })
    .catch((error) => {
      if (!quiet) {
        summaryLabel.textContent = error.message;
      }

      return null;
    })
    .finally(() => {
      state.syncRequest = null;
    });

  return state.syncRequest;
}

async function refreshWifiNetworks({ quiet = false, country = "" } = {}) {
  try {
    const params = new URLSearchParams();
    const nextCountry = normalizeWifiCountryInput(country || wifiCountryInput.value);

    if (nextCountry) {
      params.set("country", nextCountry);
    }

    const query = params.toString();
    const result = await fetchJson(
      query === "" ? "/api/device/wifi/networks" : `/api/device/wifi/networks?${query}`
    );
    renderWifiNetworks(result.networks ?? []);
    return result.networks ?? [];
  } catch (error) {
    if (!quiet) {
      setWifiMessage(error.message, "error");
    }

    throw error;
  }
}

function pauseLiveBoardUpdates() {
  state.settingsOpen = true;
  closeStream();
  stopTickerTapeRefreshLoop();
  clearWifiReminder();
}

async function resumeLiveBoardUpdates() {
  state.settingsOpen = false;

  if (state.tickerTapeNeedsRefresh) {
    refreshTickerTapeInBackground({ quiet: true });
  }

  startTickerTapeRefreshLoop();
  const status = await refreshDeviceStatus({ quiet: true }).catch(() => null);
  const shouldSyncAfterClose = state.syncAfterSettingsClose && hasWifiConnection(status ?? state.deviceStatus);

  if (!state.snapshot) {
    await loadMarket(state.marketId);
  } else {
    connectStream(state.marketId, state.requestId);
    scheduleBoardTextFit();
  }

  if (shouldSyncAfterClose) {
    state.syncAfterSettingsClose = false;
    syncMarketDataInBackground({ quiet: true });
  }
}

async function openSettings({ message = "", tone = "", focusWifi = false } = {}) {
  pauseLiveBoardUpdates();
  settingsBackdrop.classList.remove("hidden");
  settingsBackdrop.setAttribute("aria-hidden", "false");
  setSettingsMessage("");
  setWifiMessage("");
  setTickerMessage("");

  await refreshDeviceStatus({ quiet: true, scheduleReminder: false });
  await refreshWifiNetworks({
    quiet: true,
    country: resolvedWifiCountry()
  }).catch(() => {});

  if (message) {
    if (focusWifi) {
      setWifiMessage(message, tone);
    } else {
      setSettingsMessage(message, tone);
    }
  }

  if (focusWifi) {
    focusWifiSetup();
  }
}

function closeSettings() {
  closeTouchKeyboard({ blur: true });
  settingsBackdrop.classList.add("hidden");
  settingsBackdrop.setAttribute("aria-hidden", "true");
  resumeLiveBoardUpdates().catch((error) => {
    summaryLabel.textContent = error.message;
  });
}

function closeStream() {
  if (state.stream) {
    state.stream.close();
    state.stream = null;
  }
}

window.open = () => null;

document.addEventListener(
  "click",
  (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;

    if (!anchor) {
      return;
    }

    const href = anchor.getAttribute("href") ?? "";

    if (href.startsWith("#")) {
      return;
    }

    const targetUrl = new URL(anchor.href, window.location.href);

    if (anchor.target === "_blank" || targetUrl.origin !== window.location.origin) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true
);

for (const eventName of ["contextmenu", "dragstart", "drop"]) {
  document.addEventListener(
    eventName,
    (event) => {
      event.preventDefault();
    },
    true
  );
}

function connectStream(marketId, requestId) {
  if (state.settingsOpen) {
    return;
  }

  closeStream();

  const stream = new EventSource(`/api/stream?market=${encodeURIComponent(marketId)}`);
  state.stream = stream;

  stream.onmessage = (event) => {
    if (requestId !== state.requestId) {
      return;
    }

    state.snapshot = JSON.parse(event.data);
    state.marketId = state.snapshot.market.id;
    render(state.snapshot);
  };

  stream.onerror = () => {
    if (state.stream !== stream) {
      return;
    }

    sessionLabel.textContent = "RECONNECTING";
  };
}

async function loadMarket(marketId) {
  if (state.settingsOpen) {
    state.marketId = marketId;
    return;
  }

  if (state.switching) {
    return;
  }

  state.switching = true;
  state.requestId += 1;
  state.marketId = marketId;
  state.previousChanges.clear();
  closeStream();
  sessionLabel.textContent = "CONNECTING";
  summaryLabel.textContent = "Loading board...";

  try {
    const requestId = state.requestId;
    const response = await fetch(`/api/heatmap?market=${encodeURIComponent(marketId)}`);

    if (!response.ok) {
      throw new Error(`Board load failed with HTTP ${response.status}.`);
    }

    const snapshot = await response.json();

    if (requestId !== state.requestId) {
      return;
    }

    state.snapshot = snapshot;
    state.marketId = snapshot.market.id;
    render(snapshot);
    connectStream(state.marketId, requestId);
  } finally {
    state.switching = false;
  }
}

function nextMarketId() {
  const currentIndex = MARKET_ORDER.indexOf(state.marketId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % MARKET_ORDER.length;
  return MARKET_ORDER[nextIndex];
}

function clearHoldTimer() {
  if (state.holdTimer !== null) {
    clearTimeout(state.holdTimer);
    state.holdTimer = null;
  }
}

function holdDuration() {
  return state.deviceStatus?.settings?.holdToOpenMs ?? 1200;
}

function clearHoldSuppressTimer() {
  if (state.holdSuppressTimer !== null) {
    clearTimeout(state.holdSuppressTimer);
    state.holdSuppressTimer = null;
  }
}

function markHoldTriggered() {
  state.holdTriggered = true;
  clearHoldSuppressTimer();
  state.holdSuppressTimer = setTimeout(() => {
    state.holdTriggered = false;
    state.holdSuppressTimer = null;
  }, HOLD_CLICK_SUPPRESSION_MS);
}

function primaryClientYForEvent(event) {
  const changedTouch = event.changedTouches?.[0];
  const activeTouch = event.touches?.[0];

  if (changedTouch && Number.isFinite(changedTouch.clientY)) {
    return changedTouch.clientY;
  }

  if (activeTouch && Number.isFinite(activeTouch.clientY)) {
    return activeTouch.clientY;
  }

  return Number.isFinite(event.clientY) ? event.clientY : null;
}

function settingsGestureEdgeHeight() {
  const tickerBottom = tickerBar?.getBoundingClientRect?.().bottom ?? 0;
  return Math.max(SETTINGS_EDGE_HOLD_HEIGHT_PX, Math.ceil(tickerBottom));
}

function isPrimaryHoldStart(event) {
  if (event.touches?.length > 1) {
    return false;
  }

  if (Number.isFinite(event.button) && event.button !== 0) {
    return false;
  }

  return event.isPrimary !== false;
}

function isTopEdgeSettingsHold(event) {
  const clientY = primaryClientYForEvent(event);
  const target = event.target instanceof Node ? event.target : null;

  return (
    clientY !== null &&
    clientY <= settingsGestureEdgeHeight() &&
    !state.settingsOpen &&
    (target === null || !settingsBackdrop.contains(target))
  );
}

function beginSettingsHold(event) {
  if (!isPrimaryHoldStart(event) || !isTopEdgeSettingsHold(event)) {
    return;
  }

  state.holdTriggered = false;
  state.holdActive = true;
  state.holdPointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
  clearHoldTimer();
  state.holdTimer = setTimeout(() => {
    state.holdActive = false;
    state.holdPointerId = null;
    markHoldTriggered();
    openSettings().catch((error) => {
      setSettingsMessage(error.message, "error");
    });
  }, holdDuration());
}

function cancelSettingsHold() {
  state.holdActive = false;
  state.holdPointerId = null;
  clearHoldTimer();
}

function moveSettingsHold(event) {
  if (!state.holdActive) {
    return;
  }

  if (state.holdPointerId !== null && event.pointerId !== state.holdPointerId) {
    return;
  }

  const clientY = primaryClientYForEvent(event);

  if (clientY !== null && clientY > settingsGestureEdgeHeight() + SETTINGS_HOLD_MOVE_TOLERANCE_PX) {
    cancelSettingsHold();
  }
}

function suppressClickAfterSettingsHold(event) {
  if (!state.holdTriggered) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  state.holdTriggered = false;
  clearHoldSuppressTimer();
}

document.addEventListener("pointerdown", beginSettingsHold, true);
document.addEventListener("pointermove", moveSettingsHold, true);
document.addEventListener("pointerup", cancelSettingsHold, true);
document.addEventListener("pointercancel", cancelSettingsHold, true);
document.addEventListener("touchstart", beginSettingsHold, { capture: true, passive: true });
document.addEventListener("touchmove", moveSettingsHold, { capture: true, passive: true });

for (const eventName of ["touchend", "touchcancel"]) {
  document.addEventListener(eventName, cancelSettingsHold, true);
}

document.addEventListener("click", suppressClickAfterSettingsHold, true);

boardGrid.addEventListener("click", () => {
  loadMarket(nextMarketId()).catch((error) => {
    summaryLabel.textContent = error.message;
  });
});

settingsClose.addEventListener("click", () => {
  if (!touchKeyboard.classList.contains("hidden")) {
    closeTouchKeyboard({ blur: true });
    return;
  }

  closeSettings();
});
settingsBackdrop.addEventListener("click", (event) => {
  if (event.target === settingsBackdrop) {
    closeSettings();
    return;
  }

  if (isKeyboardField(event.target)) {
    openTouchKeyboard(event.target);
  }
});

settingsBackdrop.addEventListener("focusin", (event) => {
  if (isKeyboardField(event.target)) {
    openTouchKeyboard(event.target);
    return;
  }

  if (event.target instanceof HTMLSelectElement) {
    closeTouchKeyboard();
  }
});

settingsBackdrop.addEventListener("input", (event) => {
  if (isKeyboardField(event.target)) {
    refreshTouchKeyboardPreview();
  }
});

window.addEventListener("resize", scheduleBoardTextFit);
window.addEventListener("orientationchange", scheduleBoardTextFit);

touchKeyboard.addEventListener("pointerdown", (event) => {
  const key =
    event.target instanceof Element
      ? event.target.closest("[data-keyboard-action], [data-keyboard-value]")
      : null;

  if (!key) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  pressTouchKeyboardKey(key);

  const action = key.dataset.keyboardAction;
  const value = key.dataset.keyboardValue;

  if (action) {
    handleKeyboardAction(action);
    return;
  }

  if (value) {
    handleKeyboardCharacter(decodeURIComponent(value));
  }
});

wifiNetworks.addEventListener("change", () => {
  const ssid = wifiNetworks.value;

  if (!ssid) {
    return;
  }

  if (ssid === HIDDEN_WIFI_OPTION_VALUE) {
    wifiSsidInput.value = "";
    wifiPasswordInput.value = "";
    wifiPasswordInput.type = "password";
    syncPasswordVisibilityToggle();
    setWifiMessage("Type the hidden network name, then enter the password.", "success");
    wifiSsidInput.focus({ preventScroll: true });
    openTouchKeyboard(wifiSsidInput);
    return;
  }

  wifiSsidInput.value = ssid;
  wifiPasswordInput.value = "";
  wifiPasswordInput.type = "password";
  syncPasswordVisibilityToggle();
  setWifiMessage(`Selected ${wifiSsidInput.value}. Enter the password.`, "success");
  wifiPasswordInput.focus({ preventScroll: true });
  openTouchKeyboard(wifiPasswordInput);
});

addTickerTapeSymbolButton.addEventListener("click", () => {
  addTickerTapeSymbolsFromInput().catch((error) => {
    setTickerMessage(error.message, "error");
  });
});
tickerTapeSymbolInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  addTickerTapeSymbolsFromInput().catch((error) => {
    setTickerMessage(error.message, "error");
  });
});

tickerTapeSymbols.addEventListener("click", (event) => {
  const removeButton = event.target instanceof Element ? event.target.closest("[data-remove-symbol]") : null;

  if (!removeButton) {
    return;
  }

  const symbol = removeButton.dataset.removeSymbol;
  removeTickerTapeSymbol(symbol).catch((error) => {
    setTickerMessage(error.message, "error");
  });
});

scanWifiButton.addEventListener("click", () => {
  setWifiMessage("Scanning Wi-Fi networks...");
  refreshWifiNetworks({ country: resolvedWifiCountry() })
    .then(() => {
      setWifiMessage("Wi-Fi scan complete.", "success");
    })
    .catch((error) => {
      setWifiMessage(error.message, "error");
    });
});

wifiCountryInput.addEventListener("change", () => {
  refreshWifiNetworks({ country: resolvedWifiCountry(), quiet: true }).catch(() => {});
});

wifiPasswordToggleButton?.addEventListener("click", () => {
  const selectionStart =
    typeof wifiPasswordInput.selectionStart === "number" ? wifiPasswordInput.selectionStart : null;
  const selectionEnd =
    typeof wifiPasswordInput.selectionEnd === "number" ? wifiPasswordInput.selectionEnd : null;

  wifiPasswordInput.type = wifiPasswordInput.type === "password" ? "text" : "password";
  syncPasswordVisibilityToggle();
  refreshTouchKeyboardPreview();
  wifiPasswordInput.focus({ preventScroll: true });

  if (
    selectionStart !== null &&
    selectionEnd !== null &&
    typeof wifiPasswordInput.setSelectionRange === "function"
  ) {
    wifiPasswordInput.setSelectionRange(selectionStart, selectionEnd);
  }
});

async function connectWifi() {
  setWifiMessage("Connecting to Wi-Fi...");
  const result = await fetchJson("/api/device/wifi/connect", {
    method: "POST",
    body: JSON.stringify({
      country: resolvedWifiCountry(),
      ssid: wifiSsidInput.value,
      password: wifiPasswordInput.value
    })
  });
  wifiPasswordInput.value = "";
  wifiPasswordInput.type = "password";
  syncPasswordVisibilityToggle();
  const connection = result.wifi?.connection || wifiSsidInput.value;
  setWifiMessage(`Wi-Fi connection request sent${connection ? ` for ${connection}` : ""}.`, "success");
  if (hasWifiConnection(result)) {
    state.syncAfterSettingsClose = true;
    state.tickerTapeNeedsRefresh = true;
  }
  await refreshDeviceStatus({ scheduleReminder: false });
  refreshWifiNetworks({ country: resolvedWifiCountry(), quiet: true }).catch(() => {});
}

connectWifiButton.addEventListener("click", () => {
  connectWifi().catch((error) => {
    setWifiMessage(error.message, "error");
  });
});

saveDeviceSettingsButton.addEventListener("click", async () => {
  try {
    await saveDeviceSettings();
    setSettingsMessage("Device settings saved.", "success");
  } catch (error) {
    setSettingsMessage(error.message, "error");
  }
});

for (const { button, setting } of HEADER_TOGGLES) {
  button?.addEventListener("click", async () => {
    try {
      await toggleHeaderSetting(setting);
      setSettingsMessage("Top bar setting saved.", "success");
    } catch (error) {
      setSettingsMessage(error.message, "error");
    }
  });
}

restartAppButton.addEventListener("click", async () => {
  try {
    await fetchJson("/api/device/actions/restart-app", { method: "POST" });
    setSettingsMessage("App restart requested.", "success");
  } catch (error) {
    setSettingsMessage(error.message, "error");
  }
});

restartKioskButton.addEventListener("click", async () => {
  try {
    await fetchJson("/api/device/actions/restart-kiosk", { method: "POST" });
    setSettingsMessage("Kiosk restart requested.", "success");
  } catch (error) {
    setSettingsMessage(error.message, "error");
  }
});

rebootDeviceButton.addEventListener("click", async () => {
  try {
    await fetchJson("/api/device/actions/reboot", { method: "POST" });
    setSettingsMessage("Device reboot requested.", "success");
  } catch (error) {
    setSettingsMessage(error.message, "error");
  }
});

document.addEventListener(
  "keydown",
  (event) => {
    // Keep the keyboard useful for text entry while blocking common browser escape hatches.
    if (shouldBlockKioskShortcut(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

  if (event.key === "Escape") {
    if (!touchKeyboard.classList.contains("hidden")) {
      closeTouchKeyboard({ blur: true });
      return;
    }

    closeSettings();
  }
  },
  true
);

async function initialize() {
  syncPasswordVisibilityToggle();
  startHeaderLocalTimeClock();
  showStartupSplash({
    title: "Starting Kiosk",
    status: "Checking device status...",
    message: "Preparing the board, network controls, and touchscreen settings."
  });

  const deviceStatus = await refreshDeviceStatus({ quiet: true });

  if (deviceStatus?.settings?.startupMarket && MARKET_ORDER.includes(deviceStatus.settings.startupMarket)) {
    state.marketId = deviceStatus.settings.startupMarket;
  }

  const promptForWifi = shouldPromptForWifiSetup(deviceStatus);

  if (!promptForWifi && hasWifiConnection(deviceStatus)) {
    syncMarketDataInBackground({ quiet: true });
  }

  if (promptForWifi) {
    showStartupSplash({
      title: "Starting Kiosk",
      status: "Opening Wi-Fi setup...",
      message: "Finish Wi-Fi setup on the touchscreen. The shell should not be needed for normal setup."
    });
  } else {
    showStartupSplash({
      title: "Starting Kiosk",
      status: "Loading board...",
      message: "Live market tiles will appear in a moment."
    });
  }

  if (promptForWifi) {
    await openSettings({
      message: "Set your Wi-Fi country, SSID, and password to bring the kiosk online.",
      focusWifi: true
    });
    hideStartupSplash();
  }

  if (!state.settingsOpen) {
    startTickerTapeRefreshLoop();
    await loadMarket(state.marketId);
    refreshTickerTapeInBackground({ quiet: true });
  }

  hideStartupSplash();
}

initialize().catch((error) => {
  summaryLabel.textContent = error.message;
  showStartupSplash({
    title: "Startup Issue",
    status: error.message,
    message: "The kiosk UI did not finish loading cleanly."
  });
});
