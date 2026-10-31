function normalizedText(value) {
  return `${value ?? ""}`.trim().toLowerCase();
}

export function normalizeRemoteAddress(value) {
  const normalized = `${value ?? ""}`.trim();

  if (normalized.startsWith("::ffff:")) {
    return normalized.slice("::ffff:".length);
  }

  return normalized;
}

export function isLoopbackAddress(value) {
  const normalized = normalizeRemoteAddress(value);
  return normalized === "127.0.0.1" || normalized === "::1";
}

export function isLoopbackHostname(value) {
  const normalized = normalizedText(value).replace(/^\[(.*)\]$/, "$1");
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

function defaultPortFor(protocol) {
  return protocol === "https:" ? "443" : "80";
}

export function originMatchesLoopback(origin, expectedPort, protocol = "http:") {
  if (!origin) {
    return true;
  }

  try {
    const url = new URL(origin);
    return (
      isLoopbackHostname(url.hostname) &&
      (url.port || defaultPortFor(url.protocol)) === (expectedPort || defaultPortFor(protocol))
    );
  } catch {
    return false;
  }
}
