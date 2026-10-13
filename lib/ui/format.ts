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
