const VENUE_TIMEZONE = "Europe/London";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

const time = new Intl.DateTimeFormat("en-GB", {
  timeZone: VENUE_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** Slot interval shown in venue local time with an explicit zone label (D17). */
export function formatSlot(startIso: string, endIso: string): string {
  return `${dateTime.format(new Date(startIso))} – ${time.format(new Date(endIso))}`;
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** "YYYY-MM-DDTHH:mm" for a datetime-local input, on the London date of `day`. */
export function londonInputValue(day: Date, hour: number, minute: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VENUE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(day);
  return `${parts}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
