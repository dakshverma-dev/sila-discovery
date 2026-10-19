import AxeBuilder from "@axe-core/playwright";
import {expect,test} from "@playwright/test";

test("complete landing composition, audience actions and accessible mobile layout",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Some doors only open to a group.",exact:true})).toBeVisible();
  const bands=page.getByRole("region",{name:"Experiences in detail",exact:true});
  await expect(bands.getByRole("article")).toHaveCount(3);
  for(const img of await page.locator("main img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(()=>img.evaluate(el=>(el as HTMLImageElement).naturalWidth),{timeout:15000,message:`Artwork loads: ${await img.getAttribute("src")}`}).toBeGreaterThan(0);
  }
  for(const heading of ["An evening in the print room","The art of the woodcut","Type, paper & the printed page"]) {
    const title=bands.getByRole("heading",{name:heading,exact:true});
    await title.scrollIntoViewIfNeeded();
    await expect(title).toBeVisible();
    await expect(title.locator("[data-reveal]").last()).toHaveCSS("translate","none");
  }
  for(const heading of ["How it works","Help make these happen","For club organisers","For cultural venues"])await expect(page.getByRole("heading",{name:heading,exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const scan=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
  expect(scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
  await page.getByRole("link",{name:"Sila home",exact:true}).click();
  await page.screenshot({path:test.info().outputPath("sila-landing-complete.png"),fullPage:true});
  await page.screenshot({path:test.info().outputPath("sila-landing-hero.png")});
  await bands.getByRole("article").first().screenshot({path:test.info().outputPath("sila-experience-feature.png")});
  await bands.getByRole("article").filter({has:page.getByRole("heading",{name:"The art of the woodcut",exact:true})}).getByRole("link",{name:"View experience",exact:true}).click();
  await expect(page).toHaveURL(/\/s\/woodcut$/);
  await expect(page.getByRole("heading",{name:"The art of the woodcut",exact:true})).toBeVisible();
  await page.goto("/");
  await page.getByRole("button",{name:"Open venue workspace",exact:true}).click();
  await expect(page).toHaveURL(/\/venue$/);
  await expect(page.getByRole("heading",{name:"Good morning, Rowan.",exact:true})).toBeVisible();
  await page.goto("/");
  await page.getByRole("button",{name:"Open organiser workspace",exact:true}).click();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.getByRole("heading",{name:"Your plans, taking shape.",exact:true})).toBeVisible();
});
