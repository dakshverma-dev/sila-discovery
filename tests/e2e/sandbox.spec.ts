import { expect, test, type Page } from "@playwright/test";

/*
 * Judge sandbox journey (R15, T09-T13 through the UI). Each test starts its own
 * isolated synthetic workspace, so tests never share state.
 */

async function startSandbox(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a sandbox" }).click();
  await expect(page).toHaveURL(/\/demo\?notice=SANDBOX_STARTED/);
  await expect(page.getByRole("note").first()).toContainText("Judge sandbox");
}

async function expectNoHorizontalScroll(page: Page) {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits, "page must not scroll horizontally").toBe(true);
}

async function actAs(page: Page, persona: string) {
  await page.getByLabel("Acting as").selectOption({ label: persona });
  await page.getByRole("button", { name: "Switch" }).click();
  await expect(page.locator(".persona-line")).toContainText(persona);
}

async function draftAndPublish(page: Page): Promise<string> {
  // Organiser asks the agent for suggestions.
  await page
    .getByRole("region", { name: "Illustrative book club" })
    .getByRole("button", { name: "Find shared sessions" })
    .click();
  await expect(page.getByRole("heading", { name: "Options to compare" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Synthetic evidence (illustrative, not from Qloo)")).toBeVisible();
  await page.getByRole("link", { name: "Inspect reasons and send for venue review" }).first().click();
  await expect(page.getByRole("heading", { name: "Why this option" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  const proposalUrl = new URL(page.url()).pathname;

  await page.getByRole("button", { name: "Send this option for venue review" }).click();
  await expect(page.getByRole("status")).toContainText("Sent to the venue for review");

  // Venue publishes immutable terms.
  await actAs(page, "Rowan (venue manager)");
  await page.goto(proposalUrl);
  await page.getByRole("button", { name: "Publish terms" }).click();
  await expect(page.getByRole("status")).toContainText("Published");
  await expect(page.getByText("Open for reservations").first()).toBeVisible();
  return proposalUrl;
}

test("organiser to venue confirmation, with an individual participant seat", async ({ page }) => {
  await startSandbox(page);
  const proposalUrl = await draftAndPublish(page);

  // Book club organiser accepts; acceptance alone creates no seats.
  await actAs(page, "Ailsa (book club organiser)");
  await page.goto(proposalUrl);
  await page.getByRole("button", { name: "Save decision" }).click();
  await expect(page.getByRole("status")).toContainText("does not reserve any seats");
  await page.getByRole("button", { name: /Simulate the other organisers accepting/ }).click();
  await expect(page.getByRole("status")).toContainText("Simulated");

  // A participant reserves exactly one seat.
  await actAs(page, "Bram (book club)");
  await page.goto(proposalUrl);
  await expect(page.getByText("No payment is collected here.").first()).toBeVisible();
  await page.getByLabel("I confirm I am an adult (18 or over).").check();
  await page.getByLabel(/I understand this session is shared/).check();
  await page.getByRole("button", { name: "Reserve one seat" }).click();
  await expect(page.getByRole("status")).toContainText("One seat reserved");
  await expect(page.getByRole("button", { name: "Withdraw my seat" })).toBeVisible();

  // Others reserve up to the threshold through the same guarded rules.
  await page.getByRole("button", { name: /Simulate other members reserving/ }).click();
  await expect(page.getByText("Ready for venue confirmation").first()).toBeVisible();

  // Venue confirms; payment is never implied.
  await actAs(page, "Rowan (venue manager)");
  await page.goto(proposalUrl);
  await page.getByRole("button", { name: "Confirm reservation booking" }).click();
  await expect(page.getByText("Confirmed by venue").first()).toBeVisible();
  await expect(page.getByText("Payment has not been collected.").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.goto("/demo");
  await expectNoHorizontalScroll(page);
});

test("a price revision releases seats and needs fresh acceptance", async ({ page }) => {
  await startSandbox(page);
  const proposalUrl = await draftAndPublish(page);
  await page.getByRole("button", { name: "Sandbox: Simulate organisers accepting" }).click();
  await page.getByRole("button", { name: /Simulate members reserving/ }).click();
  await expect(page.getByText("Ready for venue confirmation").first()).toBeVisible();

  await page.getByText("Revise the price").click();
  await page.getByLabel("New all-in price per person (£)").fill("19.50");
  await page.getByRole("button", { name: "Publish revised terms" }).click();
  await expect(page.getByRole("status")).toContainText("Revised terms published");
  await expect(page.getByText("These terms were revised.")).toBeVisible();
  await expect(page.getByText("£19.50 per person")).toBeVisible();
  await expect(page.getByText("0 individual reservations of")).toBeVisible();

  await page.goto(proposalUrl);
  await page.getByRole("button", { name: "Confirm reservation booking" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Not completed" })).toContainText("not available yet");
});

test("private groups are explained, never matched", async ({ page }) => {
  await startSandbox(page);
  await actAs(page, "Zoe (history walkers organiser)");
  await expect(page.getByText("has not chosen to share a session")).toBeVisible();
  await expect(page.getByRole("button", { name: "Find shared sessions" })).toHaveCount(0);
});

test("an unknown proposal is not revealed", async ({ page }) => {
  await startSandbox(page);
  await page.goto("/demo/proposals/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("alert").filter({ hasText: "Not completed" })).toContainText("not available to this persona");
});

test("the sandbox requires a capability", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/demo");
  await expect(page).toHaveURL(/error=SANDBOX_EXPIRED/);
  await context.close();
});
