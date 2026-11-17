// Renders src/index.html frame by frame with headless Chromium, then mixes narration, ambient pad and whooshes.
// Usage (from immunotrop/): node render.mjs              -> out/immunotrop.mp4
//                           node render.mjs --stills 3,40  -> out/still-<t>.png
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const url = 'file://' + path.resolve('src/index.html');
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
const WORKERS = Number(process.env.WORKERS || 4);
const OUT = 'out/immunotrop.mp4';
fs.mkdirSync('out', { recursive: true });

const browser = await chromium.launch({ executablePath: exe, args: ['--disable-web-security', '--allow-file-access-from-files'] });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(url);
  await page.evaluate(() => window.ready);
  return page;
}
const run = (a) => new Promise((r, j) => spawn('ffmpeg', ['-y', '-v', 'error', ...a], { stdio: 'inherit' }).on('close', (c) => (c ? j(new Error('ffmpeg failed')) : r())));

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
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', `out/part${w}.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = from; f < to; f++) {
    await page.evaluate((f) => window.renderFrame(f), f);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (++done % 240 === 0) console.log(`${done}/${total} frames, ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await page.close();
}));
await browser.close();

fs.writeFileSync('out/list.txt', Array.from({ length: WORKERS }, (_, w) => `file 'part${w}.mp4'`).join('\n'));
await run(['-f', 'concat', '-safe', '0', '-i', 'out/list.txt', '-c', 'copy', 'out/video.mp4']);

// Ambient pad: slow drift between A minor and F major, low-passed, with a soft echo.
const ch = (fr, ph) => fr.map((f, i) => `${(0.05 - i * 0.008).toFixed(3)}*sin(2*PI*${f}*t)*(0.6+0.4*sin(2*PI*0.0${5 + i}*t+${i + ph}))`).join('+');
const mixw = '(0.5+0.5*sin(2*PI*t/40))';
await run(['-f', 'lavfi', '-i', `aevalsrc='${mixw}*(${ch([110, 164.81, 220, 261.63], 0)})+(1-${mixw})*(${ch([87.31, 130.81, 174.61, 220], 2)})':s=44100:d=${dur.toFixed(2)}`,
  '-af', `lowpass=f=900,aecho=0.8:0.7:120|260:0.35|0.25,afade=t=in:d=3,afade=t=out:st=${(dur - 4).toFixed(2)}:d=4,volume=0.55`, '-ac', '1', 'out/pad.wav']);
await run(['-f', 'lavfi', '-i', 'anoisesrc=color=pink:amplitude=0.6:duration=0.9', '-af',
  'highpass=f=300,lowpass=f=3500,afade=t=in:d=0.45:curve=exp,afade=t=out:st=0.45:d=0.45,volume=0.16', '-ar', '44100', '-ac', '1', 'out/whoosh.wav']);

const inputs = [], filters = [], tags = [];
timeline.lines.forEach((l, i) => {
  inputs.push('-i', l.file);
  const ms = Math.round(l.at * 1000);
  filters.push(`[${i}]aresample=44100,adelay=${ms}|${ms}[v${i}]`); tags.push(`[v${i}]`);
});
timeline.cuts.forEach((c, k) => {
  const n = inputs.length / 2;
  inputs.push('-i', 'out/whoosh.wav');
  const ms = Math.max(0, Math.round((c - 0.45) * 1000));
  filters.push(`[${n}]adelay=${ms}|${ms}[w${k}]`); tags.push(`[w${k}]`);
});
const padIdx = inputs.length / 2; inputs.push('-i', 'out/pad.wav'); tags.push(`[${padIdx}]`);
filters.push(`${tags.join('')}amix=inputs=${tags.length}:normalize=0,loudnorm=I=-16:TP=-1.5,apad[a]`);
const vIdx = inputs.length / 2;
await run([...inputs, '-i', 'out/video.mp4', '-filter_complex', filters.join(';'), '-map', `${vIdx}:v`, '-map', '[a]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT]);
for (const f of ['out/video.mp4', 'out/whoosh.wav', 'out/pad.wav', 'out/list.txt', ...Array.from({ length: WORKERS }, (_, w) => `out/part${w}.mp4`)]) fs.rmSync(f, { force: true });
console.log('done:', OUT, ((Date.now() - started) / 1000).toFixed(0) + 's');
