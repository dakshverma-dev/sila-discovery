import type { Pence } from "./types";

export function isPence(value: unknown): value is Pence {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function assertPence(value: unknown, field: string): Pence {
  if (!isPence(value)) {
    throw new RangeError(`${field} must be a non-negative whole number of pence`);
  }
  return value;
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatGbp(pence: Pence): string {
  return gbp.format(assertPence(pence, "amount") / 100);
}

/** Parse a user-entered pounds string such as "12.50" into whole pence. Returns null if invalid. */
export function parsePounds(input: string): Pence | null {
  const match = /^\s*£?\s*(\d{1,7})(?:\.(\d{1,2}))?\s*$/.exec(input);
  if (!match) return null;
  const pounds = Number(match[1]);
  const pennies = Number((match[2] ?? "0").padEnd(2, "0"));
  return pounds * 100 + pennies;
}
