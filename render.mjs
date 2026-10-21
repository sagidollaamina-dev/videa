// Renders src/index.html frame by frame with headless Chromium and encodes MP4 with ffmpeg.
// Usage: node render.mjs                -> out/madhab.mp4
//        node render.mjs --stills 1,5.5  -> out/still-<t>.png for quick checks
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const url = 'file://' + path.resolve('src/index.html');
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
const WORKERS = Number(process.env.WORKERS || 4);
fs.mkdirSync('out', { recursive: true });

const browser = await chromium.launch({ executablePath: exe, args: ['--disable-web-security', '--allow-file-access-from-files'] });

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(url);
  await page.evaluate(() => window.ready);
  return page;
}

if (stillsArg) {
  const page = await openPage();
  const fps = await page.evaluate(() => window.FPS);
  for (const s of stillsArg.split(',')) {
    await page.evaluate((f) => window.renderFrame(f), Math.round(Number(s) * fps));
    await page.screenshot({ path: `out/still-${s}.png` });
  }
  await browser.close();
  process.exit(0);
}

const probe = await openPage();
const { dur, fps } = await probe.evaluate(() => ({ dur: window.DURATION, fps: window.FPS }));
await probe.close();
const total = Math.round(dur * fps);
console.log(`duration ${dur.toFixed(2)}s, ${total} frames, ${WORKERS} workers`);

const chunk = Math.ceil(total / WORKERS);
let done = 0;
const started = Date.now();
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const from = w * chunk, to = Math.min(total, from + chunk);
  const page = await openPage();
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', `out/part${w}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = from; f < to; f++) {
    await page.evaluate((f) => window.renderFrame(f), f);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (++done % 150 === 0) console.log(`${done}/${total} frames, ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await page.close();
}));
await browser.close();

fs.writeFileSync('out/list.txt', Array.from({ length: WORKERS }, (_, w) => `file 'part${w}.mp4'`).join('\n'));
await new Promise((r, j) => spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'out/list.txt', '-c', 'copy', '-movflags', '+faststart', 'out/madhab.mp4'], { stdio: 'inherit' })
  .on('close', (c) => (c ? j(new Error('concat failed')) : r())));
for (let w = 0; w < WORKERS; w++) fs.rmSync(`out/part${w}.mp4`);
console.log('done: out/madhab.mp4', ((Date.now() - started) / 1000).toFixed(0) + 's');
