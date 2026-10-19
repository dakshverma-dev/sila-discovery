import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, type Page } from "@playwright/test";

/** Shared helpers for the Sila browser journeys. They need the local Supabase stack (Auth, Mailpit, Postgres). */

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const ADMIN_URL = process.env.DATABASE_ADMIN_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let adminPool: Pool | undefined;

function requireLoopback(raw: string, label: string, protocols: readonly string[]): URL {
  const url = new URL(raw);
  if (!protocols.includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error(`${label} must use a loopback host for synthetic Sila browser tests.`);
  }
  return url;
}

/** Refuse remote targets before sending synthetic contacts or using an admin connection. */
export function assertLocalSilaTargets(baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100"): void {
  requireLoopback(baseURL, "E2E_BASE_URL", ["http:", "https:"]);
  requireLoopback(MAILPIT, "MAILPIT_URL", ["http:", "https:"]);
  requireLoopback(ADMIN_URL, "DATABASE_ADMIN_URL", ["postgres:", "postgresql:"]);
  for (const name of ["E2E_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const) {
    if (process.env[name]) requireLoopback(process.env[name], name, ["http:", "https:"]);
  }
}

/** Runs SQL as the local superuser. For arranging and inspecting test data only. */
export async function adminQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  assertLocalSilaTargets();
  adminPool ??= new Pool({ connectionString: ADMIN_URL, max: 2 });
  const { rows } = await adminPool.query(sql, params);
  return rows as T[];
}

export function freshEmail(prefix = "person"): string {
  return `${prefix}-${randomUUID()}@test.example`;
}

async function latestVerifyLink(email: string): Promise<string> {
  assertLocalSilaTargets();
  const deadline = Date.now() + 20_000;
  let lastError = "no message yet";
  while (Date.now() < deadline) {
    try {
      const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
      const body = (await search.json()) as { messages?: { ID: string; Created: string }[] };
      const newest = [...(body.messages ?? [])].sort((a, b) => b.Created.localeCompare(a.Created))[0];
      if (newest) {
        const message = (await (await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`)).json()) as {
          HTML?: string;
          Text?: string;
        };
        const source = `${message.Text ?? ""}\n${message.HTML ?? ""}`;
        const found = /https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]*/.exec(source);
        if (found) {
          const link = found[0].replace(/&amp;/g, "&");
          const target = requireLoopback(link, "Supabase Auth email link", ["http:", "https:"]);
          const redirect = target.searchParams.get("redirect_to");
          if (redirect) requireLoopback(redirect, "Auth callback", ["http:", "https:"]);
          return link;
        }
        lastError = "message has no verify link";
      }
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`No sign-in email for ${email}: ${lastError}`);
}

/** Follow the real Mailpit link after a request form has already sent the email. */
export async function followSignInEmail(page: Page, email: string): Promise<void> {
  assertLocalSilaTargets(new URL(page.url()).origin);
  await page.goto(await latestVerifyLink(email));
}

/** Close the shared local admin connection after the suite. */
export async function closeSilaAdmin(): Promise<void> {
  await adminPool?.end();
  adminPool = undefined;
}

/**
 * Signs `email` in through the real form and the emailed link, ending on `next`.
 * Any address works locally: Mailpit catches the message instead of sending it.
 */
export async function signIn(page: Page, email: string, next = "/"): Promise<void> {
  assertLocalSilaTargets();
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("Check your email for a sign-in link. You can close this tab.")).toBeVisible();

  await followSignInEmail(page, email);
  const expectedPath = new URL(next, "http://placeholder.invalid").pathname;
  await page.waitForURL((url) => url.pathname === expectedPath);
}
