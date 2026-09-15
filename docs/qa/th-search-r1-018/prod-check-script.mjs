import { chromium } from 'playwright';
const browser = await chromium.launch();
const urls = [
  ['CONTRACTOR-BROWARD','https://www.asktrusthub.com/ask?q=roofers+in+Broward+County'],
  ['NAIC-CODE-FILLER','https://www.asktrusthub.com/ask?q=NAIC+code+10064'],
  ['SENIOR-DEICTIC','https://www.asktrusthub.com/ask?q=Who+owns+this+nursing+home%3F'],
  ['INSURANCE-NAMED','https://www.asktrusthub.com/ask?q=National+Trust+Insurance+Group'],
  ['INSURANCE-ZIP','https://www.asktrusthub.com/ask?q=insurance+agencies+in+ZIP+33441'],
  ['CROSS-MOVER-LENDER','https://www.asktrusthub.com/ask?q=I+need+a+mover+and+a+mortgage+lender+in+New+Jersey'],
  ['MOVE-JK-BARE','https://www.asktrusthub.com/ask?q=JK+Moving+Services'],
];
for (const [id, url] of urls) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 }).catch(()=>{});
  await page.waitForTimeout(1200);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('=== '+id+' ===');
  console.log(text.slice(0, 600).replace(/\s+/g,' '));
  console.log();
  await page.close();
}
await browser.close();
