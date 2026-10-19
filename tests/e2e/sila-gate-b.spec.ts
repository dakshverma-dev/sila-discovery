import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { isBusinessDay, nextBusinessDay, scottishVenueCalendar } from "../../lib/sila/calendar";
import { businessNoonAtOrAfter, latestFeasibleFillBy, paymentDeadlines } from "../../lib/sila/schedule";
import { addDays, fromLocal, noon, toLocal } from "../../lib/sila/time";
import { adminQuery, assertLocalSilaTargets, closeSilaAdmin, followSignInEmail, freshEmail, signIn } from "./sila-helpers";

/**
 * Synthetic local Gate B rehearsal evidence, guide §27 (P0 01–P0 06).
 * Real browser forms, Supabase Auth links and guarded commands are exercised.
 * This is neither production evidence nor a real venue approval/payment.
 */
const calendar = scottishVenueCalendar();

function londonInput(instant: Date): string {
  const local = toLocal(instant);
  return `${local.date}T${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`;
}

function rehearsalDates() {
  const today = toLocal(new Date()).date;
  const decision = businessNoonAtOrAfter(noon(addDays(today, 10)), calendar);
  const covered: string[] = [];
  for (let day = addDays(today, -7); day <= toLocal(decision).date; day = addDays(day, 1)) {
    if (isBusinessDay(calendar, day)) covered.push(day);
  }
  const fill = latestFeasibleFillBy(decision, calendar, new Set(covered));
  if (!fill || fill <= new Date()) throw new Error("No future feasible synthetic fill deadline.");
  // §17 needs room for the balance notice/remedy and practical export. Fourteen
  // days also meets §12's at-least-seven-day final notice across weekends.
  const eventDay = addDays(toLocal(decision).date, 14);
  return {
    decision, fill, covered,
    start: fromLocal(eventDay, 18),
    end: fromLocal(eventDay, 20),
    balance: noon(nextBusinessDay(calendar, toLocal(decision).date)),
  };
}

async function fillFields(scope: Page | Locator, fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) await scope.getByLabel(label, { exact: true }).fill(value);
}

async function scanAndCheckMobile(page: Page, label: string) {
  await expect(page.locator("main")).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target) })), label).toEqual([]);
  const original = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 720 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), {
    message: `${label} has no horizontal scrolling at 320px`,
  }).toBe(true);
  if (original) await page.setViewportSize(original);
}

async function createVenue(operator: Page, name: string): Promise<string> {
  await operator.goto("/ops");
  const form = operator.getByRole("region", { name: "Create a venue", exact: true });
  await fillFields(form, {
    "Venue name": name,
    Address: "Synthetic rehearsal address, Edinburgh EH1 1AA",
    "Public access facts": "Synthetic venue: level entrance; contact the venue directly about access.",
    "Direct venue email": freshEmail("venue-contact"),
  });
  await form.getByRole("button", { name: "Create venue", exact: true }).click();
  await expect(operator.getByRole("status")).toContainText("Venue created.");
  return operator.getByRole("region", { name: "Invite venue staff", exact: true })
    .getByLabel("Venue", { exact: true }).locator("option", { hasText: name }).getAttribute("value")
    .then((id) => { if (!id) throw new Error("Created venue is missing from operator scope."); return id; });
}

async function invite(operator: Page, venueId: string, email: string, role: "coordinator" | "finance") {
  await operator.goto("/ops");
  const form = operator.getByRole("region", { name: "Invite venue staff", exact: true });
  await form.getByLabel("Venue", { exact: true }).selectOption(venueId);
  await form.getByLabel("Staff email", { exact: true }).fill(email);
  await form.getByLabel("Role", { exact: true }).selectOption(role);
  await form.getByRole("button", { name: "Save staff invitation" }).click();
  await expect(operator.getByRole("status")).toContainText("Staff invitation saved.");
}

/**
 * Explicit synthetic time advancement, only through the loopback admin pool.
 * Arrange a previous covered business-day 11:45 and call the existing clocked
 * release with §12 deadlines. The production worker receives no clock override,
 * secret bypass or relaxed release window. Received funds remain in the past.
 */
async function advanceSyntheticOpening(sessionId: string, decision: Date) {
  const now = new Date();
  let day = toLocal(now).date;
  while (!isBusinessDay(calendar, day) || fromLocal(day, 11, 45) > now) day = addDays(day, -1);
  const opened = fromLocal(day, 11, 45);
  const reached = fromLocal(day, 10, 30);
  const deadlines = paymentDeadlines(opened, decision, calendar);
  expect(deadlines.feasible).toBe(true);
  expect(deadlines.payBy > now).toBe(true);
  await adminQuery("update sila.allocations set committed_at = $2 where session_id = $1 and status = 'live'", [sessionId, reached]);
  await adminQuery(`update sila.sessions set minimum_reached_at = $2, payment_scheduled_for = $3,
    version = version + 1 where id = $1 and payment_opened_at is null`, [sessionId, reached, opened]);
  const [row] = await adminQuery<{ result: { ok: boolean; data: { opened: boolean } } }>(
    "select sila.release_payment_opening($1, $2, $3, $4) as result",
    [sessionId, opened, deadlines.payBy, deadlines.verifyBy],
  );
  if (!row) throw new Error("Synthetic release returned no result");
  expect(row.result.ok).toBe(true);
  expect(row.result.data.opened).toBe(true);
  return opened;
}

async function expectNeutralApi(page: Page, path: string) {
  const response = await page.request.get(path);
  expect(response.status()).toBe(404);
  const body = await response.json();
  expect(body.error).toMatchObject({ code: "NOT_FOUND", message: "Not found." });
  expect(body.data).toBeUndefined();
}

async function expectNeutralPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(page.getByText("This page could not be found.", { exact: true })).toBeVisible();
}

test.describe.serial("Gate B — synthetic local ordinary booking (§27)", () => {
  let sessionId: string;
  let planId: string;
  const otherCoordinatorEmail = freshEmail("other-coordinator");

  test.beforeAll(async ({ baseURL }) => {
    assertLocalSilaTargets(baseURL);
  });

  test.afterAll(async () => {
    await closeSilaAdmin();
  });

  test("ordinary booking, retained errors, finance permissions and WCAG/mobile checks", async ({ page, browser, baseURL, viewport }) => {
    test.setTimeout(240_000);
    const dates = rehearsalDates();
    const suffix = randomUUID().slice(0, 8);
    const venueName = `Synthetic Gate B Edinburgh ${suffix}`;
    const title = `Synthetic printmaking rehearsal ${suffix}`;
    const clubName = `Synthetic reading club ${suffix}`;
    const coordinatorEmail = freshEmail("coordinator");
    const financeEmail = freshEmail("finance");
    const organiserEmail = freshEmail("organiser");
    const operatorEmail = freshEmail("operator");
    const operatorContext = await browser.newContext({ baseURL, viewport: viewport ?? undefined });
    const coordinatorContext = await browser.newContext({ baseURL, viewport: viewport ?? undefined });
    const financeContext = await browser.newContext({ baseURL, viewport: viewport ?? undefined });
    const operator = await operatorContext.newPage();
    const coordinator = await coordinatorContext.newPage();
    const finance = await financeContext.newPage();
    try {
      await test.step("operator prepares synthetic venue, staff and dated draft through real forms", async () => {
        // Only operator bootstrap and the labelled clock advancement use admin writes.
        await adminQuery("insert into sila.operators(email) values ($1) on conflict do nothing", [operatorEmail]);
        await signIn(operator, operatorEmail, "/ops");
        const venueId = await createVenue(operator, venueName);
        await invite(operator, venueId, coordinatorEmail, "coordinator");
        await invite(operator, venueId, financeEmail, "finance");
        const otherVenue = await createVenue(operator, `Synthetic other venue ${suffix}`);
        await invite(operator, otherVenue, otherCoordinatorEmail, "coordinator");
        await operator.goto("/ops");
        const draft = operator.getByRole("region", { name: "Prepare a draft session", exact: true });
        await draft.getByLabel("Venue", { exact: true }).selectOption(venueId);
        await fillFields(draft, {
          "Activity title": title,
          "Session starts (London)": londonInput(dates.start),
          "Session ends (London)": londonInput(dates.end),
          "Price per person (GBP)": "35.00",
          "Minimum places": "16", Capacity: "20",
          "Fill by (London)": londonInput(dates.fill),
          "Final decision (London)": londonInput(dates.decision),
          "Balance due (London)": londonInput(dates.balance),
        });
        await draft.getByRole("button", { name: "Save draft and review" }).click();
        await expect(operator).toHaveURL(/\/venue\/sessions\/[a-f0-9-]+/);
        sessionId = new URL(operator.url()).pathname.split("/").at(-1)!;
      });

      await test.step("coordinator retains a rejected edit, approves terms/coverage and publishes", async () => {
        await signIn(coordinator, coordinatorEmail, `/venue/sessions/${sessionId}`);
        await fillFields(coordinator, {
          "Activity title": title,
          "Meeting point": "Synthetic front desk",
          "Start (London)": londonInput(dates.start), "End (London)": londonInput(dates.end),
          "Price per person (GBP, all compulsory charges included)": "-1",
          "Minimum places": "16", Capacity: "20", "Maximum clubs": "2",
          "Deposit (%)": "25", "Calendar days to pay": "5",
          "Fill by (London)": londonInput(dates.fill), "Final decision (London)": londonInput(dates.decision),
          "Balance due (London)": londonInput(dates.balance),
          "Room and instructor / resource": "Synthetic room and instructor",
          "Resource held until (London)": londonInput(dates.decision),
          "Resource hold checked by": "Synthetic coordinator",
          "Venue terms version": "synthetic-v1", "Platform terms version": "synthetic-v1",
          "Activity description": "Synthetic local rehearsal. No live session or real booking.",
          Inclusions: "Synthetic materials and instruction",
          "Approved staffed coverage dates": dates.covered.join("\n"),
          "Full venue terms": "Synthetic rehearsal terms: venue receives payments and refunds all pre-confirmation failures.",
          "How clubs pay the venue directly": "Synthetic bank transfer instructions — do not send money.",
        });
        await coordinator.getByLabel("Venue terms and access facts reviewed", { exact: true }).check();
        await coordinator.getByLabel("Venue approves running at the minimum without public top-ups", { exact: true }).check();
        await coordinator.getByRole("button", { name: "Save draft", exact: true }).click();
        await expect(coordinator.locator("main").getByRole("alert")).toBeVisible();
        await expect(coordinator.getByLabel("Activity title", { exact: true })).toHaveValue(title);
        await expect(coordinator.getByLabel("Meeting point", { exact: true })).toHaveValue("Synthetic front desk");
        await expect(coordinator.getByLabel("Approved staffed coverage dates", { exact: true })).toHaveValue(dates.covered.join("\n"));
        await coordinator.getByLabel("Price per person (GBP, all compulsory charges included)", { exact: true }).fill("35.00");
        await coordinator.getByRole("button", { name: "Save draft", exact: true }).click();
        await expect(coordinator.getByRole("status")).toContainText("Draft saved.");
        await coordinator.getByLabel("Resource hold and coverage approved", { exact: true }).check();
        await coordinator.getByRole("button", { name: "Publish and copy link", exact: true }).click();
        await expect(coordinator.getByRole("link", { name: /public session|open published|view public/i })).toHaveAttribute("href", `/s/${sessionId}`);
      });

      await test.step("organiser's request survives validation and real email authentication", async () => {
        await page.goto("/sign-in");
        await scanAndCheckMobile(page, "sign-in");
        await page.goto(`/s/${sessionId}`);
        await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await scanAndCheckMobile(page, "public dated session");
        await fillFields(page, { "Club name": clubName, "Places requested": "21", "Organiser email": organiserEmail });
        await page.getByRole("button", { name: "Request places", exact: true }).click();
        await expect(page.getByRole("alert").filter({ hasText: "This session has 20 places." })).toBeVisible();
        await expect(page.getByLabel("Club name", { exact: true })).toHaveValue(clubName);
        await expect(page.getByLabel("Organiser email", { exact: true })).toHaveValue(organiserEmail);
        await page.getByLabel("Places requested", { exact: true }).fill("16");
        await page.getByRole("button", { name: "Request 16 places", exact: true }).click();
        await expect(page.getByText("Check your email. Your request is saved.", { exact: true })).toBeVisible();
        await followSignInEmail(page, organiserEmail);
        await expect(page).toHaveURL(/\/plans\/[a-f0-9-]+$/);
        planId = new URL(page.url()).pathname.split("/").at(-1)!;
        await expect(page.getByRole("heading", { name: "Waiting for the venue to approve your places", exact: true })).toBeVisible();
        const rows = await adminQuery<{ count: string }>("select count(*)::text as count from sila.plans where session_id = $1", [sessionId]);
        expect(rows[0]?.count).toBe("1");
      });

      await test.step("finance has no approval or confirmation controls, including direct API calls", async () => {
        await signIn(finance, financeEmail, `/venue/sessions/${sessionId}`);
        await expect(finance.getByRole("button", { name: /Approve .* places and invite|Publish and copy link|Confirm session/ })).toHaveCount(0);
        const [session] = await adminQuery<{ terms_version: number; version: number }>(
          "select terms_version, version from sila.sessions where id = $1", [sessionId]);
        if (!session) throw new Error("Rehearsal session missing");
        for (const [path, data] of [
          [`/api/v1/sila/plans/${planId}/approve`, { places: 16, terms_version: session.terms_version }],
          [`/api/v1/sila/sessions/${sessionId}/confirm`, { expected_version: session.version, diary_checked: true }],
        ] as const) {
          const response = await finance.request.post(path, { data, headers: { "Idempotency-Key": randomUUID() } });
          expect(response.status()).toBe(404);
          expect((await response.json()).error.code).toBe("NOT_FOUND");
        }
      });

      await test.step("venue approves; only organiser commits; conditional state stays distinct", async () => {
        await coordinator.goto(`/venue/sessions/${sessionId}`);
        await coordinator.getByRole("button", { name: "Approve 16 places and invite", exact: true }).click();
        await expect(coordinator.getByText("Places approved. The organiser can now review the terms and commit conditionally.", { exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByRole("button", { name: "Commit 16 places if the session reaches 16", exact: true })).toBeVisible();
        await scanAndCheckMobile(page, "organiser review conditions");
        await scanAndCheckMobile(coordinator, "venue session requests");
        await page.getByRole("button", { name: "Commit 16 places if the session reaches 16", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Minimum reached, payment scheduled", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Your booking is confirmed", exact: true })).toHaveCount(0);
        const [session] = await adminQuery<{ phase: string; confirmed_at: Date | null }>("select phase, confirmed_at from sila.sessions where id = $1", [sessionId]);
        expect(session).toMatchObject({ phase: "published", confirmed_at: null });
      });

      await test.step("synthetic clock advancement opens payment; organiser report remains unverified", async () => {
        await advanceSyntheticOpening(sessionId, dates.decision);
        await page.reload();
        await expect(page.getByRole("heading", { name: "Pay your group deposit", exact: true })).toBeVisible();
        await expect(page.getByLabel("Amount paid (GBP)", { exact: true })).toHaveValue("140.00");
        await page.getByLabel("Payment reference", { exact: true }).fill(`SYNTHETIC-${suffix}`);
        await page.getByRole("button", { name: "I have paid", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Verification pending", exact: true })).toBeVisible();
        const [ledger] = await adminQuery<{ count: string }>(`select count(*)::text as count from sila.financial_entries f
          join sila.allocations a on a.id = f.allocation_id where a.session_id = $1`, [sessionId]);
        expect(ledger?.count).toBe("0");
        await finance.reload();
        await expect(finance.getByRole("button", { name: "Record receipt only", exact: true })).toBeVisible();
        await expect(finance.getByRole("button", { name: /and confirm|Confirm session/ })).toHaveCount(0);
      });

      await test.step("receipt survives blocked confirmation; diary check then creates exactly one booking", async () => {
        await coordinator.goto(`/venue/sessions/${sessionId}`);
        const receiptId = `SYNTHETIC-RECEIPT-${suffix}`;
        const receiptForm = coordinator.getByRole("form", { name: `Record receipt for ${clubName}`, exact: true });
        await fillFields(receiptForm, {
          "Venue receipt identifier": receiptId,
          "Funds actually received (London)": londonInput(new Date(Date.now() - 60_000)),
          "Amount received (GBP)": "140.00",
          "Evidence reference (no personal or financial account details)": "Synthetic local receipt evidence; no transfer occurred.",
        });
        await receiptForm.getByLabel("External diary checked", { exact: true }).uncheck();
        await receiptForm.getByRole("button", { name: /Record GBP .* and confirm/ }).click();
        await expect(receiptForm.getByRole("status")).toContainText(/receipt.*saved/i);
        await expect(receiptForm).toContainText(/diary/i);
        const [saved] = await adminQuery<{ receipts: string; bookings: string }>(`select
          (select count(*)::text from sila.financial_entries where receipt_id = $2) as receipts,
          (select count(*)::text from sila.bookings where session_id = $1) as bookings`, [sessionId, receiptId]);
        expect(saved).toEqual({ receipts: "1", bookings: "0" });
        await page.reload();
        await expect(page.getByRole("heading", { name: "Your booking is confirmed", exact: true })).toHaveCount(0);
        await coordinator.reload();
        const confirm = coordinator.locator("form").filter({ has: coordinator.getByRole("button", { name: "Confirm session", exact: true }) });
        await confirm.getByLabel("External diary checked", { exact: true }).check();
        await confirm.getByRole("button", { name: "Confirm session", exact: true }).click();
        await expect(coordinator.getByText("The venue has confirmed this booking.", { exact: true })).toBeVisible();
        const [booking] = await adminQuery<{ booking_ref: string }>(
          "select sila.booking_ref(booking_number) as booking_ref from sila.bookings where session_id = $1", [sessionId]);
        if (!booking) throw new Error("Venue confirmation created no booking");
        expect(booking.booking_ref).toMatch(/^SL\d+$/);
        await expect(coordinator.locator("main")).toContainText(booking.booking_ref);
        await page.reload();
        await expect(page.getByRole("heading", { name: "Your booking is confirmed", exact: true })).toBeVisible();
        await expect(page.locator("main")).toContainText(booking.booking_ref);
        const [counts] = await adminQuery<{ bookings: string; receipts: string }>(`select
          (select count(*)::text from sila.bookings where session_id = $1) as bookings,
          (select count(*)::text from sila.financial_entries where receipt_id = $2) as receipts`, [sessionId, receiptId]);
        expect(counts).toEqual({ bookings: "1", receipts: "1" });
        const summary = await page.request.get(`/api/v1/sila/sessions/${sessionId}/summary`);
        expect(summary.status()).toBe(200);
        expect(summary.headers()["cache-control"]).toBe("private, no-store");
        expect(summary.headers()["content-disposition"]).toMatch(/attachment; filename="Sila-SL\d+\.txt"/);
        expect(await summary.text()).toContain("VENUE-CONFIRMED BOOKING");
        expect(await summary.text()).toContain(clubName);
        expect(await summary.text()).not.toContain("Synthetic local receipt evidence");
      });

      await test.step("venue-caused cancellation keeps the booking history and finance verifies the full return (§17–18)", async () => {
        await coordinator.getByText("Venue cannot deliver this booking", { exact: true }).click();
        const closure = coordinator.getByRole("form", { name: "Close session with full refunds", exact: true });
        await closure.getByLabel("Reason for closure", { exact: true }).fill("Synthetic venue delivery failure; no real booking or transfer.");
        await closure.getByLabel("The venue accepts full return of every club's session payments.", { exact: true }).check();
        await closure.getByRole("button", { name: "Close session and track full refunds", exact: true }).click();
        await expect(coordinator.getByRole("status").filter({ hasText: "Session closed." })).toBeVisible();
        await expect(coordinator.getByRole("button", { name: "Record verified refund", exact: true })).toHaveCount(0);
        await page.reload();
        await expect(page.getByRole("heading", { name: "This session will not go ahead", exact: true })).toBeVisible();
        await expect(page.locator("main")).toContainText(/140\.00.*due back/);
        await finance.reload();
        const refund = finance.getByRole("form", { name: "Record verified refund", exact: true });
        const [closed] = await adminQuery<{ closed_at: Date }>("select closed_at from sila.session_closures where session_id=$1", [sessionId]);
        if (!closed) throw new Error("Closure was not recorded");
        await expect.poll(() => Date.now() - closed.closed_at.getTime()).toBeGreaterThan(2000);
        const returned = toLocal(new Date());
        const returnedInput = `${returned.date}T${String(returned.hour).padStart(2, "0")}:${String(returned.minute).padStart(2, "0")}:${String(new Date().getUTCSeconds()).padStart(2, "0")}`;
        await fillFields(refund, {
          "Amount returned (GBP)": "141.00", "Venue refund reference": `SYNTHETIC-RETURN-${suffix}`,
          "Money actually returned (London)": returnedInput, "Evidence of return": "Synthetic return evidence; no real funds moved.",
        });
        await refund.getByRole("button", { name: "Record verified refund", exact: true }).click();
        await expect(refund.getByRole("alert")).toBeVisible();
        await expect(refund.getByLabel("Venue refund reference", { exact: true })).toHaveValue(`SYNTHETIC-RETURN-${suffix}`);
        await refund.getByLabel("Amount returned (GBP)", { exact: true }).fill("140.00");
        await refund.getByRole("button", { name: "Record verified refund", exact: true }).click();
        await expect(finance.getByRole("status").filter({ hasText: "Refund verified." })).toBeVisible();
        await page.reload();
        await expect(page.locator("main")).toContainText("Refund verified");
        await expect(page.locator("main")).toContainText(/verified returns GBP 140\.00/);
        await scanAndCheckMobile(page, "organiser verified refund");
        await scanAndCheckMobile(finance, "venue refund ledger");
        const [history] = await adminQuery<{ bookings: string; refunds: string }>(`select
          (select count(*)::text from sila.bookings where session_id=$1) as bookings,
          (select count(*)::text from sila.refund_entries r join sila.allocations a on a.id=r.allocation_id where a.session_id=$1) as refunds`, [sessionId]);
        expect(history).toEqual({ bookings: "1", refunds: "1" });
      });
    } finally {
      await Promise.all([operatorContext.close(), coordinatorContext.close(), financeContext.close()]);
    }
  });

  test("other venue staff and another organiser receive neutral page/API 404s", async ({ page, browser, baseURL, viewport }) => {
    await signIn(page, otherCoordinatorEmail, "/venue");
    await expectNeutralPage(page, `/venue/sessions/${sessionId}`);
    await expectNeutralApi(page, `/api/v1/sila/sessions/${sessionId}`);
    await expectNeutralApi(page, `/api/v1/sila/sessions/${sessionId}/summary`);
    const otherContext = await browser.newContext({ baseURL, viewport: viewport ?? undefined });
    const otherOrganiser = await otherContext.newPage();
    try {
      await signIn(otherOrganiser, freshEmail("other-organiser"), "/plans");
      await expectNeutralPage(otherOrganiser, `/plans/${planId}`);
      await expectNeutralApi(otherOrganiser, `/api/v1/sila/plans/${planId}`);
      await expectNeutralApi(otherOrganiser, `/api/v1/sila/sessions/${sessionId}/summary`);
    } finally {
      await otherContext.close();
    }
  });
});

test("Gate C — two real browser organisers commit 7 + 9 and keep their records private (§15, §18, §27)", async ({ page, browser, baseURL, viewport }) => {
  test.setTimeout(180_000);
  assertLocalSilaTargets(baseURL);
  // Synthetic published fixture only. Requests, approvals, commitments,
  // receipts and confirmation below all use the real browser commands.
  const fixtures = await import("../db/sila/fixtures");
  const dates = rehearsalDates();
  const s = await fixtures.publishedSession({
    title: "Synthetic shared Edinburgh workshop", starts_at: dates.start, ends_at: dates.end,
    fill_by: dates.fill, decision_by: dates.decision, balance_due_at: dates.balance,
    hold_expires_at: dates.decision, covered_dates: dates.covered,
    calendar_version: calendar.version, payment_route: "Synthetic venue transfer instructions. Do not send real money.",
  });
  const aName = `Synthetic seven-place club ${randomUUID().slice(0, 6)}`;
  const bName = `Synthetic nine-place club ${randomUUID().slice(0, 6)}`;
  const venueContext = await browser.newContext({ baseURL, viewport: viewport ?? undefined });
  const bContext = await browser.newContext({ baseURL, viewport: viewport ?? undefined });
  const venue = await venueContext.newPage();
  const clubB = await bContext.newPage();
  try {
    const coordinatorEmail = freshEmail("shared-coordinator");
    await signIn(venue, coordinatorEmail, "/venue");
    await fixtures.okData(fixtures.sila("add_venue_member", s.venue.operator.personId, randomUUID(), s.venue.venueId, coordinatorEmail, "coordinator"));
    await venue.goto(`/venue/sessions/${s.sessionId}`);
    const planIds: string[] = [];
    for (const [organiser, club, places] of [[page, aName, 7], [clubB, bName, 9]] as const) {
      await organiser.goto(`/s/${s.sessionId}`);
      const email = freshEmail(`shared-${places}`);
      await fillFields(organiser, { "Club name": club, "Places requested": String(places), "Organiser email": email });
      await organiser.getByRole("button", { name: `Request ${places} places`, exact: true }).click();
      await expect(organiser.getByText("Check your email. Your request is saved.", { exact: true })).toBeVisible();
      await followSignInEmail(organiser, email);
      await expect(organiser).toHaveURL(/\/plans\/[a-f0-9-]+$/);
      planIds.push(new URL(organiser.url()).pathname.split("/").at(-1)!);
      await venue.reload();
      await venue.getByRole("article", { name: club, exact: true }).getByRole("button", { name: `Approve ${places} places and invite`, exact: true }).click();
      await expect(venue.getByText("Places approved. The organiser can now review the terms and commit conditionally.", { exact: true })).toBeVisible();
      await organiser.reload();
      await organiser.getByRole("button", { name: `Commit ${places} places if the session reaches 16`, exact: true }).click();
      await expect(organiser.getByRole("heading", { name: places === 7 ? "Waiting for more places" : "Minimum reached, payment scheduled", exact: true })).toBeVisible();
    }
    await page.reload();
    await expect(page.getByRole("heading", { name: "Minimum reached, payment scheduled", exact: true })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(bName);
    await expectNeutralApi(page, `/api/v1/sila/plans/${planIds[1]}`);
    await advanceSyntheticOpening(s.sessionId, dates.decision);
    for (const [organiser, amount, club] of [[page, "61.25", aName], [clubB, "78.75", bName]] as const) {
      await organiser.reload();
      await expect(organiser.getByLabel("Amount paid (GBP)", { exact: true })).toHaveValue(amount);
      await organiser.getByLabel("Payment reference", { exact: true }).fill(`SYNTHETIC-${amount}`);
      await organiser.getByRole("button", { name: "I have paid", exact: true }).click();
      await expect(organiser.getByRole("heading", { name: "Verification pending", exact: true })).toBeVisible();
      await venue.reload();
      const receipt = venue.getByRole("form", { name: `Record receipt for ${club}`, exact: true });
      await fillFields(receipt, { "Venue receipt identifier": `SYNTHETIC-${randomUUID()}`,
        "Funds actually received (London)": londonInput(new Date(Date.now()-60000)),
        "Amount received (GBP)": amount, "Evidence reference (no personal or financial account details)": "Synthetic shared receipt; no real transfer." });
      await receipt.getByRole("button", { name: "Record receipt only", exact: true }).click();
      await expect(receipt.getByRole("status")).toContainText("Receipt saved.");
      if (amount === "61.25") {
        await page.reload();
        await expect(page.getByRole("heading", { name: "Waiting for another deposit", exact: true })).toBeVisible();
      }
    }
    await venue.reload();
    const confirmation = venue.locator("form").filter({ has: venue.getByRole("button", { name: "Confirm session", exact: true }) });
    await confirmation.getByLabel("External diary checked", { exact: true }).check();
    await confirmation.getByRole("button", { name: "Confirm session", exact: true }).click();
    await expect(venue.getByText("The venue has confirmed this booking.", { exact: true })).toBeVisible();
    for (const organiser of [page, clubB]) {
      await organiser.reload();
      await expect(organiser.getByRole("heading", { name: "Your booking is confirmed", exact: true })).toBeVisible();
    }
    const summary = await page.request.get(`/api/v1/sila/sessions/${s.sessionId}/summary`);
    expect(await summary.text()).toContain(aName);
    expect(await summary.text()).not.toContain(bName);
    await scanAndCheckMobile(page, "shared confirmed club plan");
  } finally {
    await Promise.all([venueContext.close(), bContext.close(), fixtures.admin.end(), fixtures.app.end(), closeSilaAdmin()]);
  }
});
