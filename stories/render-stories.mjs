// Renders the three warm-up stories to stories/story-1..3.png
import { chromium } from 'playwright-core';
import path from 'node:path';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const n of [1, 2, 3]) {
  await page.goto('file://' + path.resolve('stories/stories.html') + '?s=' + n);
  await page.evaluate(() => window.ready);
  await page.screenshot({ path: `stories/story-${n}.png` });
  console.log(`stories/story-${n}.png`);
}
await browser.close();
