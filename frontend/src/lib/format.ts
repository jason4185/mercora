const utcDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatUtc(timestamp: number) {
  const parts = utcDateTime.formatToParts(timestamp);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("day")} ${value("month")} ${value("year")} · ${value("hour")}:${value("minute")} UTC`;
}

export function formatUtcTime(timestamp: number) {
  return `${new Date(timestamp).toISOString().slice(11, 16)} UTC`;
}

export function formatUtcDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(timestamp);
}

export function formatUtcWindow(start: number, end: number) {
  return `${formatUtc(start)} – ${formatUtc(end)}`;
}

export function formatCompactUtcWindow(start: number, end: number) {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(start);
  const time = (value: number) => new Date(value).toISOString().slice(11, 16);
  return `${date} · ${time(start)}–${time(end)} UTC`;
}
