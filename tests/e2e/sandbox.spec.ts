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
  await expect(page.getByRole("heading", { name: "Why it was suggested" })).toBeVisible();
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
  await page.getByRole("link", { name: /^Commit a place ·/ }).click();
  await expect(page.getByRole("heading", { name: "Commit to a place" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByLabel("I confirm I am an adult (18 or over).").check();
  await page.getByLabel(/I understand this session is shared/).check();
  await page.getByRole("button", { name: "Commit my place" }).click();
  await expect(page.getByRole("status")).toContainText("One seat reserved");
  await expect(page.getByRole("heading", { name: /is yours/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Withdraw my commitment" })).toBeVisible();

  // Others reserve up to the threshold through the same guarded rules.
  await page.goto(proposalUrl);
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

test("an organiser edits the brief, sees field errors, and lookups degrade honestly", async ({ page }) => {
  await startSandbox(page);
  await page.getByRole("region", { name: "Illustrative book club" }).getByRole("link", { name: "Edit brief" }).click();
  await expect(page.getByRole("heading", { name: /group brief/ })).toBeVisible();

  // Invalid time window is reported and linked to the field.
  await page.locator("#window_0_end").fill("09:00");
  await page.getByRole("button", { name: "Save brief" }).click();
  await expect(page.getByRole("link", { name: "Time window 1" })).toBeVisible();

  // Reload clean, add a reference and switch to "ask us first".
  await page.goto(page.url().split("?")[0]!);
  await page.getByLabel("Reference 1").fill("A synthetic coastal memoir");
  await page.getByLabel(/Ask us first/).check();
  await page.getByLabel(/Allow these references to be looked up with Qloo/).check();
  await page.getByRole("button", { name: "Save brief" }).click();
  await expect(page.getByRole("status")).toContainText("Saved as a new brief version");
  await expect(page.getByText("Brief version 2").first()).toBeVisible();
  // "Ask us first" is not consent to share, so the group is no longer offered matching.
  await expect(
    page.getByRole("region", { name: "Illustrative book club" }).getByRole("button", { name: "Find shared sessions" }),
  ).toHaveCount(0);

  await page.getByRole("region", { name: "Illustrative book club" }).getByRole("link", { name: "Edit brief" }).click();
  await page.getByRole("link", { name: "Look up in Qloo" }).first().click();
  // Without a configured key the reference stays unlinked; nothing is guessed.
  await expect(page.getByRole("status")).toContainText(/not configured|no entity is guessed/);
});

test("demo showcase: a demonstration commitment stays in the browser", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Experiences forming" }).getByText("Demo data").first()).toBeVisible();
  await page.goto("/showcase/print-room");
  await expect(page.getByRole("note")).toContainText("Demo data");
  await page.getByRole("link", { name: /^Commit a place/ }).click();
  await expect(page.getByRole("heading", { name: "Commit to a place" })).toBeVisible();
  const submit = page.getByRole("button", { name: "Commit my place" });
  await expect(submit).toBeDisabled();
  await page.getByLabel(/I understand this holds a place/).check();
  await submit.click();
  await expect(page.getByRole("heading", { name: /is yours/ })).toBeVisible();
  await expect(page.getByText("Demonstration: no payment · no reservation").or(page.getByLabel("Demonstration only"))).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Withdraw my commitment" }).click();
  await expect(page).toHaveURL(/\/showcase\/print-room$/);
  await expect(page.getByRole("link", { name: /^Commit a place/ })).toBeVisible();
});
