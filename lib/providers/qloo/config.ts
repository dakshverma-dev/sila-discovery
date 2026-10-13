import { QlooError } from "./errors";

/** Hackathon keys are valid only against this host (D11, Qloo hackathon developer guide). */
export const QLOO_HACKATHON_BASE_URL = "https://hackathon.api.qloo.com";

export const QLOO_DEFAULTS = {
  requestTimeoutMs: 8_000,
  maxConcurrency: 4,
  callsPerJob: 24,
  maxRetriesPerRequest: 1,
  outputType: "urn:entity:book",
} as const;

export interface QlooConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Reads server-side configuration. Refuses any host other than the hackathon
 * environment so a staging or production URL can never be used by mistake.
 */
export function qlooConfigFromEnv(env: Record<string, string | undefined> = process.env): QlooConfig {
  const apiKey = env.QLOO_API_KEY?.trim();
  if (!apiKey) throw new QlooError("QLOO_UNAVAILABLE", "NOT_CONFIGURED", false);
  const baseUrl = (env.QLOO_BASE_URL?.trim() || QLOO_HACKATHON_BASE_URL).replace(/\/+$/, "");
  if (baseUrl !== QLOO_HACKATHON_BASE_URL) {
    throw new QlooError("QLOO_UNAVAILABLE", "NOT_CONFIGURED", false);
  }
  return { baseUrl, apiKey };
}
