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
const { dur, fps, timeline } = await probe.evaluate(() => ({ dur: window.DURATION, fps: window.FPS, timeline: window.TIMELINE }));
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
const run = (a) => new Promise((r, j) => spawn('ffmpeg', ['-y', '-v', 'error', ...a], { stdio: 'inherit' }).on('close', (c) => (c ? j(new Error('ffmpeg failed')) : r())));
await run(['-f', 'concat', '-safe', '0', '-i', 'out/list.txt', '-c', 'copy', 'out/video.mp4']);

// Audio: narration lines voice/lNN.wav placed at their scene start + soft whooshes on cuts
const lines = timeline.map((_, i) => `voice/l${String(i + 1).padStart(2, '0')}.wav`).filter((f) => fs.existsSync(f));
if (lines.length) {
  await run(['-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.6:duration=0.6', '-af',
    'highpass=f=400,lowpass=f=5000,afade=t=in:d=0.25:curve=exp,afade=t=out:st=0.25:d=0.35,volume=0.22', '-ar', '22050', '-ac', '1', 'out/whoosh.wav']);
  const inputs = [], filters = [], tags = [];
  lines.forEach((f, i) => {
    inputs.push('-i', f);
    const ms = Math.round((timeline[i].a + timeline[i].lead) * 1000);
    filters.push(`[${i}]aresample=44100,adelay=${ms}|${ms}[v${i}]`); tags.push(`[v${i}]`);
  });
  timeline.slice(1).forEach((s, k) => {
    const n = lines.length + k;
    inputs.push('-i', 'out/whoosh.wav');
    const ms = Math.max(0, Math.round((s.a - 0.3) * 1000));
    filters.push(`[${n}]aresample=44100,adelay=${ms}|${ms}[w${k}]`); tags.push(`[w${k}]`);
  });
  filters.push(`${tags.join('')}amix=inputs=${tags.length}:normalize=0,loudnorm=I=-15:TP=-1.5,apad[a]`);
  await run([...inputs, '-i', 'out/video.mp4', '-filter_complex', filters.join(';'), '-map', `${inputs.length / 2}:v`, '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', 'out/madhab.mp4']);
  fs.rmSync('out/video.mp4'); fs.rmSync('out/whoosh.wav');
} else {
  fs.renameSync('out/video.mp4', 'out/madhab.mp4');
}
fs.rmSync('out/list.txt');
for (let w = 0; w < WORKERS; w++) fs.rmSync(`out/part${w}.mp4`);
console.log('done: out/madhab.mp4', ((Date.now() - started) / 1000).toFixed(0) + 's');
