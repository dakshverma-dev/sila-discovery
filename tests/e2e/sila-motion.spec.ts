import {expect,test} from "@playwright/test";

test.use({video:"on"});

test("prototype reveals, pointer depth, scroll drift and artwork navigation actually animate",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const evidence:{kind:string;style:string}[]=[];
    const transitions:string[]=[];Object.assign(window,{silaArtworkTransitions:transitions});
    Object.assign(window,{silaMotionEvidence:evidence});
    new MutationObserver(records=>{
      for(const record of records){
        const el=record.target;
        if(el instanceof HTMLElement&&el.closest("[data-session-art]")&&el.style.viewTransitionName.startsWith("sila-art-"))transitions.push(el.style.viewTransitionName);
        if(evidence.length<400&&el instanceof HTMLElement&&(el.dataset.unfold||el.dataset.reveal))evidence.push({kind:el.dataset.unfold??el.dataset.reveal!,style:el.getAttribute("style")??""});
      }
    }).observe(document,{subtree:true,attributes:true,attributeFilter:["style"]});
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/js-motion/);
  await page.getByRole("group",{name:"Printmaking artwork collage",exact:true}).scrollIntoViewIfNeeded();
  const evidence=()=>page.evaluate(()=>(window as unknown as {silaMotionEvidence:{kind:string;style:string}[]}).silaMotionEvidence);
  await expect.poll(async()=>new Set((await evidence()).filter(e=>e.kind==="wipe").map(e=>e.style)).size).toBeGreaterThan(2);
  await expect.poll(async()=>new Set((await evidence()).filter(e=>e.kind==="fan").map(e=>e.style)).size).toBeGreaterThan(2);
  const hero=page.getByRole("region",{name:"Some doors only open to a group.",exact:true});
  const circle=hero.locator('[data-unfold="circle"]');
  await expect(circle).toHaveCSS("mask-image","none");
  const depth=hero.locator('[data-depth="20"]');
  await page.mouse.move(15,80);
  await expect.poll(()=>depth.evaluate(el=>parseFloat((el as HTMLElement).style.translate))).toBeLessThan(-2);
  await page.mouse.move(300,650);
  const first=await depth.evaluate(el=>(el as HTMLElement).style.translate);
  await expect.poll(()=>depth.evaluate(el=>(el as HTMLElement).style.translate)).not.toBe(first);
  const bands=page.getByRole("region",{name:"Experiences in detail",exact:true});
  const title=bands.getByRole("article").first().locator('[data-reveal="line"]').first();
  await expect(title).toHaveCSS("translate","0px 110%");
  await bands.getByRole("article").first().scrollIntoViewIfNeeded();
  await expect(title).toHaveCSS("translate","none");
  const drift=bands.locator('[data-speed="-0.04"]').first();
  const before=await drift.evaluate(el=>(el as HTMLElement).style.translate);
  await page.mouse.wheel(0,240);
  await expect.poll(()=>drift.evaluate(el=>(el as HTMLElement).style.translate)).not.toBe(before);
  // As in the prototype's FLIP, the index thumbnail carries into the session page (visible at every width).
  const row=page.locator('#overview a[href$="/s/print-room"]');
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page).toHaveURL(/\/s\/print-room$/);
  const artwork=page.locator('[data-session-art] [data-art-key="print-room-printer"]');
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {silaArtworkTransitions:string[]}).silaArtworkTransitions.includes("sila-art-print-room-printer"))).toBe(true);
  await expect(artwork).toHaveCSS("view-transition-name","none");
  await expect(page.getByRole("heading",{name:"An evening in the print room",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Sila home",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Some doors only open to a group.",exact:true})).toBeVisible();
  await expect(page.locator('main [style*="view-transition-name"]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator("h1 [data-reveal]").first()).toHaveCSS("translate","none");
  expect(errors).toEqual([]);
  await page.screenshot({path:test.info().outputPath("sila-motion-restored.png")});
});

test("reduced motion is immediate, readable and responds to a preference change",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/js-motion/);
  const plate=page.locator('[data-unfold="wipe"]').first();
  await expect(plate).toHaveCSS("clip-path","none");
  await expect(page.getByRole("heading",{name:"Some doors only open to a group.",exact:true})).toBeVisible();
  await page.emulateMedia({reducedMotion:"no-preference"});
  await expect(page.locator("html")).toHaveClass(/js-motion/);
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(page.locator("html")).not.toHaveClass(/js-motion/);
  await expect(plate).toHaveCSS("clip-path","none");
  await expect(page.locator('[data-reveal="line"]').first()).toHaveCSS("translate","none");
  await page.getByRole("button",{name:"Open venue workspace",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Good morning, Rowan.",exact:true})).toBeVisible();
});

test("landing content is readable when JavaScript is disabled",async({browser,baseURL,viewport})=>{
  const context=await browser.newContext({baseURL,viewport:viewport??undefined,javaScriptEnabled:false});
  try{
    const page=await context.newPage();await page.goto("/");
    await expect(page.getByRole("heading",{name:"Some doors only open to a group.",exact:true})).toBeVisible();
    await expect(page.locator('[data-unfold="wipe"]').first()).toHaveCSS("clip-path","none");
    await expect(page.getByRole("heading",{name:"For cultural venues",exact:true})).toBeVisible();
    await expect(page.getByRole("region",{name:"Experiences in detail",exact:true}).getByRole("article")).toHaveCount(3);
  }finally{await context.close();}
});
