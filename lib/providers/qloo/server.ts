import { QlooClient } from "./client";
import { qlooConfigFromEnv } from "./config";
import { QlooError } from "./errors";

/** Returns a configured server-side client, or null when no key is set. */
export function qlooClientOrNull(): QlooClient | null {
  try {
    return new QlooClient(qlooConfigFromEnv());
  } catch (error) {
    if (error instanceof QlooError && error.reason === "NOT_CONFIGURED") return null;
    throw error;
  }
}
