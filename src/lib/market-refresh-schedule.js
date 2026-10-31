const EASTERN_TIME_ZONE = "America/New_York";
const EXTENDED_REFRESH_MS = 30 * 60_000;
const REGULAR_REFRESH_MS = 60_000;
const OPENING_BURST_REFRESH_MS = 1_000;
const OPENING_BURST_DURATION_MS = 30_000;
const PREMARKET_START_MINUTE = 7 * 60 + 30;
const REGULAR_START_MINUTE = 9 * 60 + 30;
const REGULAR_END_MINUTE = 16 * 60;
const EXTENDED_END_MINUTE = 18 * 60;
const MIN_TIMER_DELAY_MS = 1_000;
const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

const easternFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIME_ZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

function easternParts(date) {
  const parts = Object.fromEntries(easternFormatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    weekday: parts.weekday,
    year: Number.parseInt(parts.year, 10),
    month: Number.parseInt(parts.month, 10),
    day: Number.parseInt(parts.day, 10),
    hour: Number.parseInt(parts.hour, 10),
    minute: Number.parseInt(parts.minute, 10),
    second: Number.parseInt(parts.second, 10),
    millisecond: date.getMilliseconds()
  };
}

function minuteOfDay(parts) {
  return parts.hour * 60 + parts.minute;
}

function isTradingWeekday(parts) {
  return WEEKDAYS.has(parts.weekday);
}

function millisecondsUntilMinute(parts, targetMinute) {
  const remainingMs =
    (targetMinute - minuteOfDay(parts)) * 60_000 - parts.second * 1_000 - parts.millisecond;

  return Math.max(MIN_TIMER_DELAY_MS, remainingMs);
}

function millisecondsSinceMinute(parts, targetMinute) {
  return (minuteOfDay(parts) - targetMinute) * 60_000 + parts.second * 1_000 + parts.millisecond;
}

function millisecondsUntilCadenceBoundary(parts, startMinute, cadenceMs) {
  const elapsedMs = millisecondsSinceMinute(parts, startMinute);
  const remainder = elapsedMs % cadenceMs;
  const delayMs = remainder === 0 ? cadenceMs : cadenceMs - remainder;

  return Math.max(MIN_TIMER_DELAY_MS, delayMs);
}

function easternDatePlusDays(parts, dayOffset) {
  return easternParts(new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, 12)));
}

function easternWallTimeToUtcMs(parts, hour, minute) {
  let utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0, 0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = easternParts(new Date(utcMs));
    const desiredWallMs = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0, 0);
    const actualWallMs = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      actual.millisecond
    );
    const correctionMs = desiredWallMs - actualWallMs;

    utcMs += correctionMs;

    if (correctionMs === 0) {
      break;
    }
  }

  return utcMs;
}

function nextTradingPremarketStartMs(date, parts) {
  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const candidate = dayOffset === 0 ? parts : easternDatePlusDays(parts, dayOffset);

    if (!isTradingWeekday(candidate)) {
      continue;
    }

    if (dayOffset === 0 && minuteOfDay(parts) >= PREMARKET_START_MINUTE) {
      continue;
    }

    const targetMs = easternWallTimeToUtcMs(candidate, 7, 30);

    if (targetMs > date.getTime()) {
      return targetMs;
    }
  }

  return date.getTime() + EXTENDED_REFRESH_MS;
}

export function marketRefreshCadenceMs(date = new Date(), regularRefreshMs = REGULAR_REFRESH_MS) {
  const parts = easternParts(date);

  if (!isTradingWeekday(parts)) {
    return null;
  }

  const minute = minuteOfDay(parts);

  if (minute >= PREMARKET_START_MINUTE && minute < REGULAR_START_MINUTE) {
    return EXTENDED_REFRESH_MS;
  }

  if (minute >= REGULAR_START_MINUTE && minute < REGULAR_END_MINUTE) {
    const millisecondsSinceOpen = millisecondsSinceMinute(parts, REGULAR_START_MINUTE);

    if (millisecondsSinceOpen >= 0 && millisecondsSinceOpen < OPENING_BURST_DURATION_MS) {
      return OPENING_BURST_REFRESH_MS;
    }

    return regularRefreshMs;
  }

  if (minute >= REGULAR_END_MINUTE && minute < EXTENDED_END_MINUTE) {
    return EXTENDED_REFRESH_MS;
  }

  return null;
}

export function nextMarketRefreshDelayMs(date = new Date(), regularRefreshMs = REGULAR_REFRESH_MS) {
  const parts = easternParts(date);
  const cadenceMs = marketRefreshCadenceMs(date, regularRefreshMs);
  const minute = minuteOfDay(parts);

  if (cadenceMs === OPENING_BURST_REFRESH_MS) {
    return Math.min(
      OPENING_BURST_REFRESH_MS,
      Math.max(MIN_TIMER_DELAY_MS, OPENING_BURST_DURATION_MS - millisecondsSinceMinute(parts, REGULAR_START_MINUTE))
    );
  }

  if (cadenceMs === regularRefreshMs) {
    return millisecondsUntilCadenceBoundary(parts, REGULAR_START_MINUTE, regularRefreshMs);
  }

  if (cadenceMs === EXTENDED_REFRESH_MS) {
    const nextBoundary = Math.floor(minute / 30) * 30 + 30;
    const windowEnd = minute < REGULAR_START_MINUTE ? REGULAR_START_MINUTE : EXTENDED_END_MINUTE;

    return millisecondsUntilMinute(parts, Math.min(nextBoundary, windowEnd));
  }

  if (isTradingWeekday(parts) && minute >= REGULAR_END_MINUTE && minute < EXTENDED_END_MINUTE) {
    return millisecondsUntilMinute(parts, EXTENDED_END_MINUTE);
  }

  return Math.max(
    MIN_TIMER_DELAY_MS,
    nextTradingPremarketStartMs(date, parts) - date.getTime()
  );
}
