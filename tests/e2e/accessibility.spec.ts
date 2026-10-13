import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/* N04: automated WCAG 2.2 AA checks on the core screens. Manual screen-reader review is still required. */

test.skip(({ viewport }) => (viewport?.width ?? 0) < 400, "Run once, on the desktop project");

async function scan(page: Page, label: string) {
  // Next streams metadata on dynamic pages; wait for the title rather than racing it.
  await expect(page).toHaveTitle(/Shared Cultural Bookings/);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = result.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`);
  expect(summary, `${label} accessibility violations`).toEqual([]);
}

async function actAs(page: Page, persona: string) {
  await page.getByLabel("Acting as").selectOption({ label: persona });
  await page.getByRole("button", { name: "Switch" }).click();
  await expect(page.locator(".persona-line")).toContainText(persona);
}

test("core screens have no automatically detectable WCAG AA violations", async ({ page }) => {
  await page.goto("/");
  await scan(page, "home");
  await page.getByRole("button", { name: "Start a sandbox" }).click();
  await expect(page).toHaveURL(/\/demo/);
  await scan(page, "organiser dashboard");

  await page.getByRole("region", { name: "Illustrative book club" }).getByRole("button", { name: "Find shared sessions" }).click();
  await expect(page.getByRole("heading", { name: "Options to compare" })).toBeVisible({ timeout: 20_000 });
  await scan(page, "match run");

  await page.getByRole("link", { name: "Inspect reasons and send for venue review" }).first().click();
  await expect(page.getByRole("heading", { name: "Why this option" })).toBeVisible();
  await scan(page, "proposal (organiser)");
  const proposalUrl = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Send this option for venue review" }).click();
  await actAs(page, "Rowan (venue manager)");
  await scan(page, "venue dashboard");
  await page.goto(proposalUrl);
  await scan(page, "proposal (venue, publish form)");
  await page.getByRole("button", { name: "Publish terms" }).click();
  await page.getByRole("button", { name: "Sandbox: Simulate organisers accepting" }).click();
  await actAs(page, "Bram (book club)");
  await page.goto(proposalUrl);
  await scan(page, "proposal (participant, reservation form)");
  await actAs(page, "Ailsa (book club organiser)");

  await page.goto("/demo");
  await page.getByRole("region", { name: "Illustrative book club" }).getByRole("link", { name: "Edit brief" }).click();
  await scan(page, "brief editor");

  await page.goto("/demo/account");
  await scan(page, "your data");

  await page.goto("/sandbox");
  await scan(page, "matching explorer");
});
