import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEMO_SESSION_ID } from "../../lib/sila/demo";
import { assertLocalSilaTargets, closeSilaAdmin, followSignInEmail } from "./sila-helpers";

test.afterAll(closeSilaAdmin);

test("demo entry is unavailable outside the explicit local demo environment", async ({ page }) => {
  test.skip(process.env.SILA_DEMO_MODE === "local", "This server is explicitly running the local demo");
  assertLocalSilaTargets();
  const response = await page.goto("/pilot-demo");
  expect(response?.status()).toBe(404);
});

test("local demo labels synthetic facts, supports role sign-in and meets automated AA checks", async ({ page }) => {
  test.skip(process.env.SILA_DEMO_MODE !== "local", "Run against npm run demo");
  assertLocalSilaTargets();
  await page.goto("/pilot-demo");
  await expect(page.getByRole("heading", { name: "Try a shared session." })).toBeVisible();
  await expect(page.locator("main")).toContainText("Do not send money.");
  await expect(page.getByRole("button", { name: /^Email .* sign-in$/ })).toHaveCount(5);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("pilot-demo.png"), fullPage: true });
  await page.getByRole("button", { name: "Email venue coordinator sign-in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await followSignInEmail(page, "coordinator@demo.sila.example");
  await expect(page).toHaveURL(new RegExp(`/venue/sessions/${DEMO_SESSION_ID}`));
  await expect(page.getByRole("heading", { name: "Review your session", exact: true })).toBeVisible();
});
