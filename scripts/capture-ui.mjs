import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const phase = process.argv[2] || "after";
await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [1920, 1366, 768, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width < 500 ? 844 : 1000 },
      deviceScaleFactor: 1,
    });
    await page.clock.install({ time: new Date("2026-10-16T17:00:00Z") });
    await page.goto("http://127.0.0.1:5173/dashboard", {
      waitUntil: "networkidle",
    });
    await page.locator('.leaflet-container').waitFor();
    await page.screenshot({
      path: `docs/screenshots/${phase}-${width}.png`,
      fullPage: true,
    });
    console.log(`${phase}: ${width}px captured`);
    if(phase==='after'){
      await page.getByRole('button',{name:'Koyu temaya geç'}).click();
      await page.locator('.leaflet-container').waitFor();
      await page.screenshot({path:`docs/screenshots/dark-${width}px.png`,fullPage:true});
    }
    await page.close();
  }
  if(phase==='after')for(const width of [1366,390]){
    const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
    await page.clock.install({time:new Date('2026-10-16T17:00:00Z')});
    for(const [name,path] of [['replay','/history?mode=replay&event=2024-06-07'],['performance','/performance']]){
      await page.goto('http://127.0.0.1:5173'+path,{waitUntil:'networkidle'});
      await page.screenshot({path:`docs/screenshots/${name}-${width}.png`,fullPage:true});
    }
    await page.close();
  }
} finally {
  await browser.close();
}
