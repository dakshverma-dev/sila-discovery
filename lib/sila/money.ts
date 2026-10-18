/** GBP minor units (pence). */
export type Minor = number;

export interface GroupAmounts {
  totalMinor: Minor;
  depositMinor: Minor;
  balanceMinor: Minor;
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${field} must be a non-negative integer`);
}

/**
 * Per-group amounts computed on the server (§18). The percentage deposit is rounded
 * half up to the penny once per group; the balance is the exact remainder.
 */
export function groupAmounts(priceMinor: Minor, places: number, depositBasisPoints: number): GroupAmounts {
  assertNonNegativeInteger(priceMinor, "priceMinor");
  assertNonNegativeInteger(places, "places");
  if (!Number.isSafeInteger(depositBasisPoints) || depositBasisPoints < 0 || depositBasisPoints > 10_000) {
    throw new RangeError("depositBasisPoints must be between 0 and 10000");
  }
  const totalMinor = priceMinor * places;
  const depositMinor = Math.floor((totalMinor * depositBasisPoints + 5_000) / 10_000);
  return { totalMinor, depositMinor, balanceMinor: totalMinor - depositMinor };
}

export function formatGBP(minor: Minor): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}GBP ${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
