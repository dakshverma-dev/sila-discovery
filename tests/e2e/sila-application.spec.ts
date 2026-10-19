import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Exercise the exported product UI with isolated browser sample records.
async function account(page:Page,name:string){
  await page.locator(".sa-account-menu > summary").click();
  await page.locator(".sa-account-popover").getByRole("button",{name:new RegExp(name)}).click();
  await expect(page.locator(".sa-account-menu > summary")).toContainText(name);
}
async function accessible(page:Page){
  const title=page.locator("h1 [data-reveal]");if(await title.count())await expect(title.last()).toHaveCSS("translate","none");
  const result=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}

test("ordinary home, experience search and organiser dashboard use the reference design",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Some doors only open to a group.",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Explore experiences",exact:true})).toBeVisible();
  await accessible(page);
  await page.screenshot({path:test.info().outputPath("sila-home.png"),fullPage:true});
  await page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Experiences",exact:true}).click();
  await page.getByRole("group",{name:"Status",exact:true}).getByRole("button",{name:"Deposits open",exact:true}).click();
  const bands=page.getByRole("region",{name:"Experiences in detail",exact:true});
  await expect(bands.getByRole("heading",{name:"The art of the woodcut",exact:true})).toBeVisible();
  await expect(bands.getByRole("heading",{name:"An evening in the print room",exact:true})).toHaveCount(0);
  await bands.getByRole("heading",{name:"The art of the woodcut",exact:true}).getByRole("link").click();
  await expect(page).toHaveURL(/\/s\/woodcut$/);
  await page.getByRole("link",{name:"Open your plan",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Verification pending",exact:true})).toBeVisible();
  await accessible(page);
});

test("venue approval and organiser commitment remain distinct and persist on refresh",async({page})=>{
  const writes:string[]=[];page.on("request",r=>{if(!["GET","HEAD"].includes(r.method()))writes.push(r.url());});
  await page.goto("/");await account(page,"Rowan Ellis");
  await expect(page.getByRole("heading",{name:"Good morning, Rowan.",exact:true})).toBeVisible();
  await accessible(page);
  await page.screenshot({path:test.info().outputPath("sila-venue.png"),fullPage:true});
  await page.screenshot({path:test.info().outputPath("sila-venue-overview.png")});
  await page.locator(".sa-session-table-row").filter({has:page.getByRole("heading",{name:"An evening in the print room",exact:true})}).click();
  await page.getByRole("button",{name:/Club requests/}).click();
  const approval=page.getByRole("form",{name:"Approve Leith Arts Club",exact:true});
  await approval.getByRole("checkbox").check();await approval.getByRole("button",{name:/Approve 9 places/}).click();
  await expect(approval).toHaveCount(0);
  await account(page,"Elliot Reid");
  await page.getByRole("heading",{name:"An evening in the print room",exact:true}).getByRole("link").click();
  await expect(page.getByRole("heading",{name:"Your places are approved",exact:true})).toBeVisible();
  const commitment=page.getByRole("form",{name:"Commit your club",exact:true});
  await commitment.getByRole("checkbox").check();await commitment.getByRole("button",{name:/Commit 9 places/}).click();
  await expect(page.getByText("Minimum reached. Venue confirmation is still required.", {exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Payment scheduled",exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole("heading",{name:"Payment scheduled",exact:true})).toBeVisible();
  await accessible(page);
  await page.goto("/plans/meadows-print");await expect(page.getByRole("heading",{name:"Plan not found",exact:true})).toBeVisible();
  expect(writes).toEqual([]);
});

test("finance verifies a timely receipt, venue checks the diary, organiser receives practical details",async({page})=>{
  await page.goto("/");await account(page,"Alex Campbell");
  await page.goto("/venue/sessions/woodcut?tab=payments");
  await expect(page.getByRole("heading",{name:"An evening in the print room",exact:true})).toHaveCount(0);
  const receipt=page.getByRole("form",{name:"Record receipt for Meadows Book Circle",exact:true});
  await page.locator(".sa-panel").filter({has:page.getByRole("heading",{name:"Meadows Book Circle",exact:true})}).getByText("Record a verified receipt",{exact:true}).click();
  await receipt.getByLabel("Unique venue receipt reference").fill("EPS-NEW-TEST");
  await receipt.getByLabel("Funds actually received (London)").fill("2026-11-02T11:00");
  await receipt.getByLabel("Evidence reference").fill("Sample reconciliation entry");
  await receipt.getByRole("button",{name:"Record receipt",exact:true}).click();
  await expect(receipt.getByRole("status")).toContainText("Receipt saved");
  await expect(page.getByRole("button",{name:"Confirm session",exact:true})).toHaveCount(0);
  await account(page,"Rowan Ellis");await page.goto("/venue/sessions/woodcut");
  const confirm=page.getByRole("form",{name:"Confirm session",exact:true});
  await confirm.getByRole("checkbox").check();await confirm.getByRole("button",{name:"Confirm session",exact:true}).click();
  await expect(page.locator(".sa-session-banner")).toContainText("Confirmed");
  await account(page,"Maya Okafor");await page.goto("/plans/meadows-woodcut");
  await expect(page.getByRole("heading",{name:"Your booking is confirmed",exact:true})).toBeVisible();
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Download practical details"}).click();
  expect((await download).suggestedFilename()).toMatch(/^Sila-SL/);
  await page.getByRole("button",{name:"Payment history",exact:true}).click();
  await expect(page.getByText("EPS-NEW-TEST",{exact:false})).toBeVisible();
  await expect(page.getByText("EPS-R1",{exact:false})).toHaveCount(0);
  await accessible(page);
});

test("refund due and verified return are separate records",async({page})=>{
  await page.goto("/");await account(page,"Alex Campbell");await page.goto("/venue/sessions/autumn-prints?tab=payments");
  const refund=page.getByRole("form",{name:"Record refund for Meadows Book Circle",exact:true});
  await refund.getByLabel("Unique refund reference").fill("RETURN-TEST");await refund.getByLabel("Evidence of return").fill("Sample completed return");
  await refund.getByRole("button",{name:"Record verified refund",exact:true}).click();
  await expect(refund).toHaveCount(0);
  await expect(page.locator(".sa-refund-summary").getByText("Refund verified",{exact:true})).toBeVisible();
  await account(page,"Maya Okafor");await page.goto("/plans/meadows-autumn");
  await expect(page.locator(".sa-refund-summary").getByText("Refund verified",{exact:true})).toBeVisible();
  await accessible(page);
});

test("reviewed draft publishes and a newly created record reloads at its own address",async({page})=>{
  await page.goto("/");await account(page,"Rowan Ellis");await page.goto("/venue/sessions/botanical-print");
  const draft=page.getByRole("form",{name:"Save session draft",exact:true});
  await draft.getByRole("checkbox",{name:/Venue terms and factual/}).check();
  await draft.getByRole("checkbox",{name:/The venue approves/}).check();
  await draft.getByRole("button",{name:"Save draft",exact:true}).click();
  await expect(page.getByText("The publication checks pass.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Publish session",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Botanical impressions",exact:true})).toBeVisible();
  await page.goto("/venue/sessions/new");await page.getByLabel("Activity title").fill("A new print session");
  await page.getByRole("button",{name:/Create draft & continue/}).click();
  await expect(page).toHaveURL(/venue\/sessions\/session/);
  await page.reload();await expect(page.getByLabel("Activity title")).toHaveValue("A new print session");
  await accessible(page);
});

test("operations records an introduction and pauses intake without venue decision controls",async({page})=>{
  await page.goto("/");await account(page,"Sila operations");
  await expect(page.getByRole("button",{name:"Confirm session",exact:true})).toHaveCount(0);
  await page.getByLabel("Incident or resume reason").fill("Staff coverage review");
  await page.getByRole("button",{name:"Pause new intake",exact:true}).click();
  await expect(page.getByText("New intake paused",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Manual introductions",exact:true}).click();
  await page.getByLabel("Club name").fill("Sample Culture Club");
  await page.getByLabel("Source evidence & reason").fill("Club enquiry about printmaking");
  await page.getByRole("button",{name:/Record introduction/}).click();
  await expect(page.getByText("Sample Culture Club",{exact:true})).toBeVisible();
  await accessible(page);
});


test("a new organiser request, conversation and pre-opening withdrawal work at their own URLs",async({page})=>{
  await page.goto("/");await account(page,"Rowan Ellis");await page.goto("/venue/sessions/botanical-print");
  const draft=page.getByRole("form",{name:"Save session draft",exact:true});
  // Bring the proposed final decision within the maximum 21-day commitment wait (§15).
  await draft.getByLabel("Final decision (London)",{exact:true}).fill("2026-11-24T12:00");
  await draft.getByLabel("Fill by (London)",{exact:true}).fill("2026-11-12T12:00");
  await draft.getByLabel("Resource held until (London)",{exact:true}).fill("2026-11-24T12:00");
  await draft.getByRole("checkbox",{name:/Venue terms and factual/}).check();
  await draft.getByRole("checkbox",{name:/The venue approves/}).check();
  await draft.getByRole("button",{name:"Save draft",exact:true}).click();
  await expect(page.getByText("The publication checks pass.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Publish session",exact:true}).click();
  await account(page,"Maya Okafor");await page.goto("/s/botanical-print");
  await page.getByRole("link",{name:"Request places for your club",exact:true}).click();
  const request=page.getByRole("form",{name:"Request club places",exact:true});
  await request.getByLabel("Places requested").fill("7");await request.getByRole("checkbox",{name:/I manage this club enquiry/}).check();
  await request.getByRole("button",{name:/Request 7 places/}).click();
  await expect(page.getByRole("heading",{name:"Your request for 7 places is with the venue.",exact:true})).toBeVisible();
  await accessible(page);
  await page.getByRole("link",{name:"Open your plan",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Waiting for the venue",exact:true})).toBeVisible();
  const planUrl=page.url();await page.reload();
  await page.getByRole("button",{name:/Messages \(/}).click();
  await page.getByLabel("Your message").fill("Are the materials included in our agreed price?");
  await page.getByRole("button",{name:"Send message",exact:true}).click();
  await expect(page.getByText("Are the materials included in our agreed price?",{exact:true})).toBeVisible();
  await account(page,"Rowan Ellis");await page.goto("/venue/sessions/botanical-print?tab=requests");
  const approval=page.getByRole("form",{name:"Approve Meadows Book Circle",exact:true});
  await approval.getByRole("checkbox").check();await approval.getByRole("button",{name:/Approve 7 places/}).click();
  await account(page,"Maya Okafor");await page.goto(planUrl);
  const commitment=page.getByRole("form",{name:"Commit your club",exact:true});
  await commitment.getByRole("checkbox").check();await commitment.getByRole("button",{name:/Commit 7 places/}).click();
  await expect(page.getByRole("heading",{name:"Waiting for more places",exact:true})).toBeVisible();
  await page.getByText("Withdraw before payment opens",{exact:true}).click();
  const withdrawal=page.getByRole("form",{name:"Withdraw your club",exact:true});
  await withdrawal.getByLabel("Reason",{exact:true}).fill("Club timetable changed");
  await withdrawal.getByRole("button",{name:"Release my conditional places",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Withdrawn",exact:true})).toBeVisible();
  await accessible(page);
});
