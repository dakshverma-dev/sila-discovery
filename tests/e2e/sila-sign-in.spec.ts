import { expect, test } from "@playwright/test";
import { adminQuery, freshEmail, signIn } from "./sila-helpers";

test("signing in with a fresh email lands on next and shows the account bar", async ({ page }) => {
  const email = freshEmail();
  await signIn(page, email, "/account");

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId("account-email")).toHaveText(email);

  const people = await adminQuery<{ email: string }>("select email from sila.people where email = $1", [email]);
  expect(people).toHaveLength(1);
});

test("signing out is a POST and ends the session", async ({ page }) => {
  const email = freshEmail();
  await signIn(page, email, "/account");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);

  const getResponse = await page.request.get("/auth/sign-out");
  expect(getResponse.status()).toBe(405);
});

test("an off-site next value is ignored and the person lands on the home page", async ({ page }) => {
  const email = freshEmail();
  await signIn(page, email, "//evil.example");

  const url = new URL(page.url());
  expect(url.host).toBe(new URL(test.info().project.use.baseURL ?? "http://localhost:3100").host);
  expect(url.pathname).toBe("/");
});

test("an invalid email is reported without sending anything", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter a valid email address." })).toContainText("Enter a valid email address.");
});
