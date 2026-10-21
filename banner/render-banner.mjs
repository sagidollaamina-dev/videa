// Renders banner/banner.html to PNG (2x): banner/banner.png and banner/banner-clean.png (no text).
import { chromium } from 'playwright-core';
import path from 'node:path';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
const url = 'file://' + path.resolve('banner/banner.html');
for (const [q, out] of [['', 'banner/banner.png'], ['?text=0', 'banner/banner-clean.png']]) {
  await page.goto(url + q);
  await page.evaluate(() => window.ready);
  await page.screenshot({ path: out });
  console.log(out);
}
await browser.close();
