// "Иммунотропты вирустар": 2.5D medical motion video, 1920x1080.
// Every frame is a pure function of time (renderFrame(f)); scene lengths follow the narration in voice.js.
const W = 1920, H = 1080, FPS = 24;
const MAIN = document.getElementById('c').getContext('2d');
let X = MAIN; // current drawing context (swapped to off-screen buffers during transitions)

// ---------- math ----------
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pr = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  out3: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const ss = (t, a, b) => E.sine(pr(t, a, b));
function rng(seed) { let s = (seed * 7919) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const nz = (x, s = 0) => Math.sin(x * 1.7 + s) * 0.5 + Math.sin(x * 2.9 + s * 1.3) * 0.3 + Math.sin(x * 5.3 + s * 2.1) * 0.2;
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------- sprites (built once) ----------
function softDot(rgb) {
  const c = mk(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.35, `rgba(${rgb},.45)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
}
const DOT = softDot('255,255,255'), DOTC = softDot('130,230,255'), DOTR = softDot('255,70,95'),
  DOTA = softDot('255,185,90'), DOTV = softDot('165,145,255'), DOTO = softDot('255,120,60'), DOTP = softDot('255,190,210');

function makeVirus(spikes) {
  const S = 320, c = mk(S, S), g = c.getContext('2d'), C = S / 2, R = 100, r = rng(spikes ? 5 : 6);
  const sp = (a, col, len, al, from = R - 6) => {
    g.globalAlpha = al; g.strokeStyle = col; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(C + Math.cos(a) * from, C + Math.sin(a) * from);
    const kx = C + Math.cos(a) * (R + len), ky = C + Math.sin(a) * (R + len);
    g.lineTo(kx, ky); g.stroke();
    const kg = g.createRadialGradient(kx - 2, ky - 2, 0, kx, ky, 10); kg.addColorStop(0, '#ffd8d8'); kg.addColorStop(1, col);
    g.fillStyle = kg; g.beginPath(); g.arc(kx, ky, 9, 0, TAU); g.fill(); g.globalAlpha = 1;
  };
  if (spikes) for (let i = 0; i < 30; i++) sp(i / 30 * TAU + 0.1, '#9c1427', 22 + r() * 8, 0.8);
  const bg = g.createRadialGradient(C - R * 0.38, C - R * 0.42, 4, C, C, R);
  if (spikes) { bg.addColorStop(0, '#ffc2b8'); bg.addColorStop(0.3, '#f2485a'); bg.addColorStop(0.78, '#a3102a'); bg.addColorStop(1, '#4a0412'); }
  else { bg.addColorStop(0, '#e8b0b8'); bg.addColorStop(0.35, '#c06a80'); bg.addColorStop(0.8, '#874060'); bg.addColorStop(1, '#4a1c30'); }
  g.fillStyle = bg; g.beginPath(); g.arc(C, C, R, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(C, C, R, 0, TAU); g.clip();
  for (let i = 0; i < 190; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R, x = C + Math.cos(a) * d, y = C + Math.sin(a) * d, rr = 4 + r() * 9;
    g.fillStyle = 'rgba(60,0,12,.22)'; g.beginPath(); g.arc(x + 2, y + 2, rr, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,205,205,.16)'; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
  }
  const rim = g.createRadialGradient(C, C, R * 0.7, C, C, R);
  rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,190,200,.35)');
  g.fillStyle = rim; g.fillRect(0, 0, S, S); g.restore();
  if (spikes) {
    for (let i = 0; i < 26; i++) sp(i / 26 * TAU + r() * 0.1, '#f04257', 20 + r() * 10, 1);
    for (let i = 0; i < 22; i++) { // knobs facing the camera
      const a = r() * TAU, d = R * (0.35 + 0.55 * r()), x = C + Math.cos(a) * d, y = C + Math.sin(a) * d;
      const kg = g.createRadialGradient(x - 2, y - 2, 0, x, y, 9); kg.addColorStop(0, '#ffd0d0'); kg.addColorStop(1, '#c81e36');
      g.fillStyle = kg; g.beginPath(); g.arc(x, y, 7 + r() * 2, 0, TAU); g.fill();
    }
  }
  return c;
}

function makeCell(kind) {
  const S = 560, c = mk(S, S), g = c.getContext('2d'), C = S / 2, R = 220, r = rng(kind.charCodeAt(0) * 31);
  const pal = {
    T: ['#e4deff', '#8f7ff0', '#3a2a8c', '#1e1450'], B: ['#d8ecff', '#7aa0f0', '#2e4a9c', '#14234f'],
    M: ['#f0dcff', '#b083e8', '#5a2f99', '#2a1250'], P: ['#ffe2e8', '#f09ab0', '#b24a72', '#5e1736'],
  }[kind];
  for (let i = 0; i < 150; i++) { // microvilli on the rim
    const a = r() * TAU, rr = R - 4 + r() * 12, x = C + Math.cos(a) * rr, y = C + Math.sin(a) * rr;
    g.fillStyle = pal[1]; g.globalAlpha = 0.75; g.beginPath(); g.arc(x, y, 6 + r() * 7, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
  const bg = g.createRadialGradient(C - R * 0.35, C - R * 0.4, R * 0.05, C, C, R);
  bg.addColorStop(0, pal[0]); bg.addColorStop(0.45, pal[1]); bg.addColorStop(0.85, pal[2]); bg.addColorStop(1, pal[3]);
  g.fillStyle = bg; g.beginPath(); g.arc(C, C, R, 0, TAU); g.fill();
  g.save(); g.beginPath(); g.arc(C, C, R, 0, TAU); g.clip();
  // nucleus seen through the membrane
  const n = mk(S, S), ng = n.getContext('2d');
  ng.fillStyle = kind === 'P' ? 'rgba(90,40,150,.6)' : 'rgba(25,10,70,.5)';
  ng.beginPath();
  if (kind === 'M') { ng.ellipse(C + 20, C + 10, R * 0.6, R * 0.42, -0.4, 0, TAU); ng.fill(); ng.globalCompositeOperation = 'destination-out'; ng.beginPath(); ng.arc(C + 70, C - 70, R * 0.3, 0, TAU); }
  else ng.arc(C + R * 0.08, C + R * 0.05, R * (kind === 'P' ? 0.42 : 0.56), 0, TAU);
  ng.fill();
  g.filter = 'blur(10px)'; g.drawImage(n, 0, 0); g.filter = 'none';
  for (let i = 0; i < 420; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R, x = C + Math.cos(a) * d, y = C + Math.sin(a) * d, rr = 5 + r() * 8;
    g.fillStyle = 'rgba(20,0,60,.12)'; g.beginPath(); g.arc(x + 2, y + 2, rr, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
  }
  const rim = g.createRadialGradient(C, C, R * 0.72, C, C, R);
  rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,255,255,.28)');
  g.fillStyle = rim; g.fillRect(0, 0, S, S); g.restore();
  g.filter = 'blur(14px)'; g.fillStyle = 'rgba(255,255,255,.35)';
  g.beginPath(); g.ellipse(C - R * 0.38, C - R * 0.45, R * 0.28, R * 0.15, -0.6, 0, TAU); g.fill(); g.filter = 'none';
  return c;
}

function makeTissue(w, h, seed, pal) {
  const c = mk(w, h), g = c.getContext('2d'), r = rng(seed);
  const edge = (x) => 80 + 42 * Math.sin((x / w) * TAU * 3 + seed) + 20 * Math.sin((x / w) * TAU * 11 + seed * 2) + 9 * Math.sin((x / w) * TAU * 23);
  const path = new Path2D(); path.moveTo(0, h);
  for (let x = 0; x <= w; x += 10) path.lineTo(x, edge(x));
  path.lineTo(w, h); path.closePath();
  g.save(); g.clip(path); g.fillStyle = pal[3]; g.fillRect(0, 0, w, h);
  const cells = [];
  for (let y = 10; y < h + 40; y += 44) for (let x = 0; x < w; x += 54) cells.push([x + (r() - 0.5) * 26 + ((y / 44) % 2) * 27, y + (r() - 0.5) * 16, 28 + r() * 12, 23 + r() * 9]);
  cells.sort((a, b) => a[1] - b[1]);
  for (const [x0, y, rx, ry] of cells) for (const x of [x0, x0 - w, x0 + w]) {
    if (x < -60 || x > w + 60) continue;
    const gr = g.createRadialGradient(x - rx * 0.3, y - ry * 0.45, 2, x, y, rx * 1.1);
    gr.addColorStop(0, pal[0]); gr.addColorStop(0.45, pal[1]); gr.addColorStop(0.85, pal[2]); gr.addColorStop(1, pal[3]);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  }
  g.restore();
  g.filter = 'blur(5px)'; g.strokeStyle = 'rgba(255,235,240,.35)'; g.lineWidth = 8;
  g.beginPath(); for (let x = 0; x <= w; x += 10) g.lineTo(x, edge(x) + 4); g.stroke(); g.filter = 'none';
  return c;
}

function makeRbc() {
  const c = mk(200, 200), g = c.getContext('2d'), gr = g.createRadialGradient(100, 100, 0, 100, 100, 80);
  gr.addColorStop(0, '#d9566c'); gr.addColorStop(0.45, '#e9798b'); gr.addColorStop(0.78, '#f49aa8'); gr.addColorStop(1, '#c2445d');
  g.fillStyle = gr; g.beginPath(); g.arc(100, 100, 80, 0, TAU); g.fill(); return c;
}

function makeBody() {
  const c = mk(600, 1000), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round';
  g.beginPath(); g.arc(300, 105, 72, 0, TAU); g.fill();
  g.fillRect(270, 160, 60, 50);
  g.beginPath(); g.moveTo(190, 225); g.quadraticCurveTo(300, 190, 410, 225); g.quadraticCurveTo(420, 400, 375, 520);
  g.quadraticCurveTo(400, 590, 380, 640); g.lineTo(220, 640); g.quadraticCurveTo(200, 590, 225, 520); g.quadraticCurveTo(180, 400, 190, 225); g.fill();
  g.lineWidth = 58; g.beginPath(); g.moveTo(205, 250); g.quadraticCurveTo(150, 400, 140, 560); g.moveTo(395, 250); g.quadraticCurveTo(450, 400, 460, 560); g.stroke();
  g.lineWidth = 80; g.beginPath(); g.moveTo(255, 620); g.lineTo(245, 950); g.moveTo(345, 620); g.lineTo(355, 950); g.stroke();
  g.globalCompositeOperation = 'source-in';
  const gr = g.createLinearGradient(0, 0, 600, 1000); gr.addColorStop(0, 'rgba(255,240,245,.62)'); gr.addColorStop(1, 'rgba(255,175,200,.38)');
  g.fillStyle = gr; g.fillRect(0, 0, 600, 1000);
  g.globalCompositeOperation = 'source-over';
  return c;
}

function makeGrain(seed) {
  const c = mk(256, 256), g = c.getContext('2d'), d = g.createImageData(256, 256), r = rng(seed);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return c;
}

const VIR = makeVirus(true), VIRB = makeVirus(false);
const CELL = { T: makeCell('T'), B: makeCell('B'), M: makeCell('M'), P: makeCell('P') };
const TIS1 = makeTissue(2600, 520, 3, ['#ffe0e6', '#f29bb0', '#c4547a', '#7e2446']);
const TIS2 = makeTissue(2600, 520, 8, ['#f6d2e4', '#d98ab0', '#9c4474', '#5a1838']);
const RBC = makeRbc(), BODY = makeBody();
const GRAIN = [1, 2, 3].map(makeGrain);
const BA = mk(W, H), BB = mk(W, H);

// ---------- drawing helpers ----------
function dot(img, x, y, r, a = 1) { if (a <= 0) return; const ga = X.globalAlpha; X.globalAlpha = ga * a; X.drawImage(img, x - r, y - r, r * 2, r * 2); X.globalAlpha = ga; }
function glow(img, x, y, r, a) { X.save(); X.globalCompositeOperation = 'lighter'; dot(img, x, y, r, a); X.restore(); }
function spr(img, x, y, d, { rot = 0, a = 1, blur = 0, base } = {}) {
  if (a <= 0) return;
  const b = base || (img === VIR || img === VIRB ? 200 : 440), s = d / b, w = img.width * s, h = img.height * s;
  X.save(); X.globalAlpha *= a; if (blur > 0.3) X.filter = `blur(${blur.toFixed(1)}px)`;
  X.translate(x, y); if (rot) X.rotate(rot); X.drawImage(img, -w / 2, -h / 2, w, h); X.restore();
}
function cam(z, cx, cy, fn) { X.save(); X.translate(W / 2, H / 2); X.scale(z, z); X.translate(-W / 2 - cx, -H / 2 - cy); fn(); X.restore(); }
function view(a, fn) { if (a <= 0) return; X.save(); X.globalAlpha *= a; fn(); X.restore(); }
function blackout(a) { if (a <= 0) return; X.save(); X.globalAlpha = 1; X.fillStyle = `rgba(0,0,0,${a})`; X.fillRect(0, 0, W, H); X.restore(); }
function rrect(x, y, w, h, r) { X.beginPath(); X.roundRect(x, y, w, h, r); }

function plasma(t, { dark = 0 } = {}) {
  const g = X.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.78);
  g.addColorStop(0, '#f6bccb'); g.addColorStop(0.38, '#d77895'); g.addColorStop(0.72, '#8a2b50'); g.addColorStop(1, '#2c0818');
  X.fillStyle = g; X.fillRect(0, 0, W, H);
  for (let k = 0; k < 3; k++) glow(DOTP, W * (0.25 + 0.25 * k) + Math.sin(t * 0.11 + k * 2) * 160, H * (0.4 + 0.15 * Math.sin(t * 0.09 + k)), 560, 0.1);
  if (dark) { X.fillStyle = `rgba(26,4,14,${dark})`; X.fillRect(0, 0, W, H); }
}
function interiorBg(t) {
  const g = X.createRadialGradient(W * 0.45, H * 0.45, 0, W * 0.45, H * 0.45, W * 0.75);
  g.addColorStop(0, '#b45a7e'); g.addColorStop(0.5, '#7a2a4e'); g.addColorStop(1, '#25071a');
  X.fillStyle = g; X.fillRect(0, 0, W, H);
  for (let k = 0; k < 2; k++) glow(DOT, W * (0.3 + 0.4 * k) + Math.sin(t * 0.1 + k) * 100, H * 0.45, 500, 0.07);
}
function darkBg(c1 = '#4a1a52', c2 = '#12040f') {
  const g = X.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, c1); g.addColorStop(1, c2); X.fillStyle = g; X.fillRect(0, 0, W, H);
}

const MOTES = (() => { const r = rng(99); return Array.from({ length: 150 }, () => ({ x: r() * W * 1.4, y: r() * H * 1.2, z: 0.25 + r() * 1.9, s: 2 + r() * 5, v: 0.4 + r() })); })();
function motes(t, { cx = 0, cy = 0, a = 1, img = DOT } = {}) {
  for (const m of MOTES) {
    const z = m.z;
    const x = ((((m.x - cx * z + t * 12 * z * m.v) % (W * 1.4)) + W * 1.4) % (W * 1.4)) - W * 0.2;
    const y = ((((m.y - cy * z + Math.sin(t * 0.3 + m.x) * 24) % (H * 1.2)) + H * 1.2) % (H * 1.2)) - H * 0.1;
    const big = z > 1.5, r = m.s * z * (big ? 3.5 : 1.6);
    dot(img, x, y, r, (big ? 0.08 : 0.32) * a);
  }
}
function tissueBand({ y, flip = false, shift = 0, scale = 1, blur = 0, a = 1, img = TIS1 }) {
  X.save(); X.globalAlpha *= a; if (blur > 0.3) X.filter = `blur(${blur}px)`;
  X.translate(0, y); if (flip) X.scale(1, -1); X.scale(scale, scale);
  const w = img.width, ox = -((((shift / scale) % w) + w) % w);
  X.drawImage(img, ox, 0); X.drawImage(img, ox + w, 0); X.restore();
}

function macro(x, y, R, t, { a = 1, blur = 0, reach = 0, ang = -Math.PI / 2 } = {}) {
  X.save(); X.globalAlpha *= a; if (blur > 0.3) X.filter = `blur(${blur}px)`; X.translate(x, y);
  const p = new Path2D(), N = 120;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * TAU;
    const rr = R * (1 + 0.1 * Math.sin(3 * th + t * 0.7) + 0.07 * Math.sin(5 * th - t * 0.9 + 1) + 0.18 * Math.pow(Math.max(0, Math.sin(2 * th + t * 0.35)), 8) + reach * Math.pow(Math.max(0, Math.cos(th - ang)), 10));
    const px = Math.cos(th) * rr, py = Math.sin(th) * rr * 0.86;
    i ? p.lineTo(px, py) : p.moveTo(px, py);
  }
  const g = X.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R * 1.1);
  g.addColorStop(0, '#e6dcff'); g.addColorStop(0.45, '#9a86ee'); g.addColorStop(0.85, '#4a3399'); g.addColorStop(1, '#241656');
  X.fillStyle = g; X.fill(p);
  X.save(); X.clip(p);
  X.fillStyle = 'rgba(30,12,80,.35)'; X.filter = `blur(${12 + blur}px)`; X.beginPath(); X.ellipse(R * 0.1, R * 0.05, R * 0.45, R * 0.32, 0.3, 0, TAU); X.fill();
  X.filter = blur > 0.3 ? `blur(${blur}px)` : 'none';
  const r = rng(41);
  for (let i = 0; i < 160; i++) { const a2 = r() * TAU, d = Math.sqrt(r()) * R * 1.2; X.fillStyle = 'rgba(255,255,255,.09)'; X.beginPath(); X.arc(Math.cos(a2) * d, Math.sin(a2) * d, 6 + r() * 10, 0, TAU); X.fill(); }
  X.restore();
  X.strokeStyle = 'rgba(235,225,255,.4)'; X.lineWidth = 3; X.stroke(p);
  X.restore();
}

function helix(x0, x1, y, amp, t, { a = 1, blur = 0, amber = null, glw = 0, phase = 0, wav = 170 } = {}) {
  X.save(); X.globalAlpha *= a; if (blur > 0.3) X.filter = `blur(${blur}px)`; X.lineCap = 'round';
  for (let x = x0; x <= x1; x += 22) {
    const ph = (x / wav) * TAU + t * 1.1 + phase, y1 = y + Math.sin(ph) * amp, y2 = y - Math.sin(ph) * amp;
    const inA = amber && x > amber[0] && x < amber[1];
    X.strokeStyle = inA ? `rgba(255,195,100,${0.45 + 0.55 * glw})` : 'rgba(255,220,235,.4)'; X.lineWidth = 5;
    X.beginPath(); X.moveTo(x, y1); X.lineTo(x, y2); X.stroke();
  }
  for (const sg of [1, -1]) {
    X.strokeStyle = sg > 0 ? '#f6a9c4' : '#c7a4ff'; X.lineWidth = 10; X.beginPath();
    for (let x = x0; x <= x1; x += 8) { const ph = (x / wav) * TAU + t * 1.1 + phase; X.lineTo(x, y + sg * Math.sin(ph) * amp); }
    X.stroke();
    if (amber) {
      X.save(); X.strokeStyle = '#ffc266'; X.shadowColor = '#ffb050'; X.shadowBlur = 10 + 30 * glw; X.lineWidth = 11; X.beginPath();
      for (let x = amber[0]; x <= amber[1]; x += 8) { const ph = (x / wav) * TAU + t * 1.1 + phase; X.lineTo(x, y + sg * Math.sin(ph) * amp); }
      X.stroke(); X.restore();
    }
  }
  X.restore();
}

function ab(x, y, s, rot, a = 1, col = '#8fe6f2') {
  if (a <= 0) return;
  X.save(); X.globalAlpha *= a; X.translate(x, y); X.rotate(rot); X.scale(s, s);
  X.strokeStyle = col; X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = 7; X.shadowColor = col; X.shadowBlur = 12;
  X.beginPath(); X.moveTo(0, 30); X.lineTo(0, 0); X.lineTo(-20, -26); X.moveTo(0, 0); X.lineTo(20, -26); X.stroke(); X.restore();
}
function igm(x, y, s, rot, a = 1) { for (let k = 0; k < 5; k++) { const an = rot + (k / 5) * TAU; ab(x + Math.sin(an) * 34 * s, y - Math.cos(an) * 34 * s, s, an, a, '#b9a6ff'); } }

function body(cx, cy, sc, { a = 1, glowCol = 'rgba(255,200,220,.6)', blur = 0 } = {}) {
  X.save(); X.globalAlpha *= a; X.shadowColor = glowCol; X.shadowBlur = 40; if (blur > 0.3) X.filter = `blur(${blur}px)`;
  X.drawImage(BODY, cx - 300 * sc, cy - 500 * sc, 600 * sc, 1000 * sc); X.restore();
}
const bp = (cx, cy, sc, px, py) => [cx + (px - 300) * sc, cy + (py - 500) * sc];

function ecg(x0, x1, y, t, amp, a = 1, col = '#8ff0e0', irregular = 0) {
  X.save(); X.globalAlpha *= a; X.strokeStyle = col; X.lineWidth = 4; X.shadowColor = col; X.shadowBlur = 14; X.beginPath();
  for (let x = x0; x <= x1; x += 4) {
    const u = (((x - x0) / 240 - t * 0.9) % 1 + 1) % 1;
    let v = u > 0.42 && u < 0.46 ? -1 : u > 0.46 && u < 0.5 ? 0.6 : u > 0.5 && u < 0.53 ? -0.25 : 0;
    v += irregular * nz(x * 0.05 + t * 9) * 0.4;
    X.lineTo(x, y + v * amp);
  }
  X.stroke(); X.restore();
}

// ---------- text ----------
function txt(s, x, y, { size = 50, w = 800, a = 1, col = '#fff', align = 'center', sh = 18, ls = 0 } = {}) {
  if (a <= 0) return;
  X.save(); X.globalAlpha *= a; X.font = `${w} ${size}px Montserrat`; X.textAlign = align; X.textBaseline = 'middle';
  X.letterSpacing = ls + 'px'; X.shadowColor = 'rgba(45,0,16,.65)'; X.shadowBlur = sh; X.shadowOffsetY = 2;
  X.fillStyle = col; X.fillText(s, x, y); X.restore();
}
function label(s, t, t0, t1, o = {}) {
  const a = ss(t, t0, t0 + 0.45) * (1 - ss(t, t1 - 0.45, t1)); if (a <= 0) return;
  const rise = (1 - E.out3(pr(t, t0, t0 + 0.7))) * 16;
  txt(s, o.x ?? W / 2, (o.y ?? 968) + rise, { size: o.size ?? 54, a, w: o.w ?? 800, align: o.align ?? 'center' });
}
function chip(s, x, y, t, t0, { t1 = 1e9, size = 32, align = 'left', accent = '#ff6b81' } = {}) {
  const p = E.out3(pr(t, t0, t0 + 0.55)), a = pr(t, t0, t0 + 0.35) * (1 - ss(t, t1 - 0.4, t1)); if (a <= 0) return;
  X.save(); X.font = `600 ${size}px Montserrat`; X.letterSpacing = '0px';
  const tw = X.measureText(s).width, pw = tw + size * 1.8, ph = size * 1.8;
  let x0 = align === 'left' ? x : align === 'center' ? x - pw / 2 : x - pw; x0 += (1 - p) * 50;
  X.globalAlpha *= a; rrect(x0, y - ph / 2, pw, ph, ph / 2);
  X.fillStyle = 'rgba(45,8,26,.58)'; X.fill(); X.strokeStyle = 'rgba(255,220,230,.5)'; X.lineWidth = 1.5; X.stroke();
  X.fillStyle = accent; X.beginPath(); X.arc(x0 + size * 0.8, y, size * 0.2, 0, TAU); X.fill();
  X.fillStyle = '#fff'; X.textBaseline = 'middle'; X.textAlign = 'left'; X.fillText(s, x0 + size * 1.25, y + 1); X.restore();
}
function tag(s, x, y, t, t0, { dx = 0, dy = -110, t1 = 1e9, size = 36 } = {}) {
  const a = pr(t, t0, t0 + 0.4) * (1 - ss(t, t1 - 0.4, t1)); if (a <= 0) return;
  const p = E.out3(pr(t, t0, t0 + 0.6));
  X.save(); X.globalAlpha *= a; X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 2.5;
  X.beginPath(); X.moveTo(x, y); X.lineTo(x + dx * p, y + dy * p); X.stroke();
  X.fillStyle = '#fff'; X.beginPath(); X.arc(x, y, 7, 0, TAU); X.fill(); X.restore();
  txt(s, x + dx, y + dy + (dy < 0 ? -28 : 28), { size, w: 700, a });
}
function title(s, t, t0, t1, { y = H / 2, size = 104 } = {}) {
  X.save(); X.font = `800 ${size}px Montserrat`; X.letterSpacing = '0px';
  const chars = [...s], ws = chars.map((c) => X.measureText(c).width + 6), tw = ws.reduce((a, b) => a + b, 0);
  let x = W / 2 - tw / 2; const r = rng(17);
  chars.forEach((c, i) => {
    const st = t0 + i * 0.035, a = E.out3(pr(t, st, st + 0.6)), dr = r() * 2 - 1, dy = r() * 2 - 1;
    const out = E.inOut(pr(t, t1 + i * 0.02, t1 + i * 0.02 + 1.3)), bl = (1 - a) * 10 + out * 16;
    if (a > 0 && out < 1) {
      X.save(); X.globalAlpha *= a * (1 - out); if (bl > 0.3) X.filter = `blur(${bl.toFixed(1)}px)`;
      X.textAlign = 'left'; X.textBaseline = 'middle'; X.shadowColor = 'rgba(60,0,20,.6)'; X.shadowBlur = 26; X.fillStyle = '#fff';
      X.fillText(c, x + out * dr * 180, y + (1 - a) * 30 + out * (dy * 90 - 70)); X.restore();
    }
    x += ws[i];
  });
  X.restore();
}

// ---------- timeline ----------
const VO = window.VOICE || [];
const LEAD = 0.7, GAP = 0.6, TAIL = 1.0, XF = 1.0;
const SC = [], LINES = [];
let T = 0;
function addScene(id, draw, opt = {}) {
  let a = LEAD;
  const L = VO.map((v, i) => [v, i]).filter(([v]) => v[0] === id).map(([[, d, txt], i]) => { const o = { a, d, txt, i }; a += d + GAP; return o; });
  const dur = Math.max(L.length ? a - GAP + TAIL : opt.dur || 6, opt.min || 0);
  const s = { id, a: T, d: dur, L, draw, tr: opt.tr || 'zoom' };
  L.forEach((l) => LINES.push({ file: `voice/s${String(l.i + 1).padStart(2, '0')}.wav`, at: T + l.a }));
  SC.push(s); T += dur;
}
function wt(s, k, sub, off = 0) {
  const L = s.L[k]; if (!L) return 0;
  const i = L.txt.indexOf(sub), f = i < 0 ? 0 : i / L.txt.length;
  return L.a + 0.12 + L.d * 0.92 * f + off;
}
const le = (s, k) => s.L[k].a + s.L[k].d;

// ================= SCENES =================

// 1. Entry into the microworld
addScene(1, (t, s) => {
  const z = 1 + 0.16 * E.sine(pr(t, 0, s.d + 1));
  plasma(t); motes(t, { cx: t * 30 });
  cam(z, t * 25, 0, () => {
    spr(CELL.T, 1480, 500, 150, { blur: 6, a: 0.85, rot: t * 0.05 }); spr(CELL.B, 1630, 600, 110, { blur: 7, a: 0.8 }); spr(CELL.T, 1390, 640, 84, { blur: 8, a: 0.7 });
    const r = rng(3);
    for (let k = 0; k < 7; k++) {
      const sp = 0.6 + r() * 0.5, x0 = -300 - r() * 600, y0 = 280 + r() * 480, d = 46 + r() * 70;
      spr(VIR, x0 + (t + 2) * 95 * sp, y0 + Math.sin(t * 0.6 + k) * 24, d, { rot: t * 0.2 * sp + k, blur: d < 70 ? 3 : 0 });
    }
  });
  tissueBand({ y: H - 330 + (z - 1) * 200, shift: t * 70, scale: z, blur: 1.5, img: TIS1 });
  tissueBand({ y: 250 - (z - 1) * 200, flip: true, shift: t * 110 + 600, scale: 1.25 * z, blur: 11, img: TIS2, a: 0.95 });
  const pv = pr(t, 5.2, s.d + 0.8); if (pv > 0 && pv < 1) spr(VIR, lerp(-260, W + 260, pv), lerp(330, 260, pv), 360, { rot: t * 0.3, blur: 12, a: 0.95 });
  title('ИММУНОТРОПТЫ ВИРУСТАР', t, 0.9, 4.8);
  blackout(1 - ss(t, 0, 1.6));
});

// 2. Targets: T, B lymphocytes, monocytes, macrophages
addScene(2, (t, s) => {
  const px = lerp(-90, 90, E.sine(pr(t, 0, s.d)));
  plasma(t); motes(t, { cx: px });
  const ws = ['Т-лимфоциттер', 'В-лимфоциттер', 'моноциттер', 'макрофагтар'].map((w) => wt(s, 0, w)), wo = wt(s, 0, 'басқа');
  cam(1 + 0.05 * pr(t, 0, s.d), px, 0, () => {
    const fa = ss(t, wo, wo + 0.8);
    [[280, 240, 90], [1160, 170, 80], [1760, 290, 100], [660, 880, 70], [1900, 900, 90]].forEach(([x, y, d], k) =>
      spr(k % 2 ? CELL.B : CELL.T, x + Math.sin(t * 0.3 + k) * 10, y, d, { blur: 7, a: 0.3 + 0.55 * fa }));
    const tg = [[430, 560], [880, 650], [1290, 470], [1650, 650]];
    const vr = rng(12);
    tg.forEach(([tx, ty], k) => { for (let j = 0; j < 2; j++) {
      const sx = tx + (vr() - 0.5) * 700, sy = ty + (vr() < 0.5 ? -1 : 1) * (300 + vr() * 150), q = 0.45 * E.sine(pr(t, 0, s.d + 2));
      spr(VIR, lerp(sx, tx, q), lerp(sy, ty, q) + Math.sin(t + j + k) * 10, 46 + vr() * 26, { rot: t * 0.3 + k, blur: 1.5 });
    } });
    const cells = [[430, 560, 300, 'T'], [880, 650, 250, 'B'], [1290, 470, 340, 'M'], [1650, 650, 0, 'X']];
    const names = ['Т-лимфоцит', 'В-лимфоцит', 'Моноцит', 'Макрофаг'];
    cells.forEach(([x, y, d, k], i) => {
      const h = ss(t, ws[i], ws[i] + 0.5);
      glow(DOTV, x, y, (d || 400) * 0.95, 0.45 * h);
      if (k === 'X') macro(x, y, 180, t); else spr(CELL[k], x, y + Math.sin(t * 0.5 + i) * 8, d, { rot: Math.sin(t * 0.2 + i) * 0.2 });
      tag(names[i], x, y - (d || 330) / 2 + 12, t, ws[i], { dy: -80 });
    });
  });
  spr(CELL.T, 110 - px * 0.6, 990, 440, { blur: 18, a: 0.85 });
});

// 3. Long, complex relationship
addScene(3, (t, s) => {
  plasma(t, { dark: 0.18 }); motes(t, { cx: t * 10 });
  const z = 1 + 0.12 * E.sine(pr(t, 0, s.d)), tl = wt(s, 0, 'ұзақ'), td = s.L[0].a + 1.6;
  const cyc = t > tl ? Math.sin((t - tl) * 3.2) : 0, ca = ss(t, tl, tl + 0.8) * 0.5;
  cam(z, 0, 0, () => {
    const cx = 830, cy = 520, D = 600, R = D / 2;
    const ra = ss(t, tl - 0.3, tl + 0.5), lit = Math.floor(pr(t, tl, s.d + 0.3) * 60);
    X.save(); X.lineCap = 'round';
    for (let k = 0; k < 60; k++) {
      const an = -Math.PI / 2 + (k / 60) * TAU, r0 = R + 110, r1 = r0 + (k % 5 ? 14 : 28);
      X.globalAlpha = ra * (k < lit ? 0.95 : 0.25); X.strokeStyle = k < lit ? '#ffd9a0' : '#ffffff'; X.lineWidth = k % 5 ? 3 : 5;
      X.beginPath(); X.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); X.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); X.stroke();
    }
    X.restore();
    spr(CELL.T, cx, cy, D * (1 + 0.012 * Math.sin(t * 3)), { rot: t * 0.03 });
    const ang = -0.55, dx = cx + Math.cos(ang) * (R + 50), dy = cy + Math.sin(ang) * (R + 50);
    const p = E.inOut(pr(t, 0, td));
    if (p >= 1) glow(DOTA, cx + Math.cos(ang) * (R + 4), cy + Math.sin(ang) * (R + 4), 120, 0.5 + 0.2 * Math.sin(t * 3));
    spr(VIR, lerp(1820, dx, p), lerp(130, dy, p) + Math.sin(t * 1.3) * (1 - p) * 20, 160, { rot: p * 2 + t * 0.05 });
  });
  if (ca > 0) { X.save(); X.globalCompositeOperation = 'soft-light'; X.fillStyle = cyc > 0 ? `rgba(255,170,110,${ca * cyc})` : `rgba(110,120,255,${-ca * cyc})`; X.fillRect(0, 0, W, H); X.restore(); }
  label('Ұзақ уақыт · күрделі қарым-қатынас', t, tl, s.d + 1);
});

// 4. Three ways to harm
addScene(4, (t, s) => {
  plasma(t); motes(t, { cx: t * 20 });
  const w = [wt(s, 0, 'зақымдауы'), wt(s, 0, 'өзгертуі'), wt(s, 0, 'әлсіретуі')];
  const fw = [1 - ss(t, w[1] - 0.3, w[1] + 0.2), ss(t, w[1] - 0.3, w[1] + 0.2) * (1 - ss(t, w[2] - 0.3, w[2] + 0.2)), ss(t, w[2] - 0.3, w[2] + 0.2)];
  const allOn = Math.max(1 - ss(t, w[0] - 0.3, w[0]), ss(t, w[2] + 1.6, w[2] + 2.3));
  const px = lerp(-40, 40, pr(t, 0, s.d));
  cam(1.02, px, 0, () => {
    const P = [[400, 470], [960, 470], [1520, 470]], D = 400, R = D / 2;
    P.forEach(([x, y], i) => {
      const dim = Math.max(allOn, lerp(0.4, 1, fw[i]));
      view(dim, () => {
        if (i === 0) {
          const c = pr(t, w[0], w[0] + 0.8), q = t - w[0];
          spr(CELL.T, x, y, D, { a: lerp(1, 0.8, c) });
          if (c > 0) {
            const pts = [[-0.55, -0.62], [-0.18, -0.26], [-0.32, -0.04], [0.06, 0.2], [-0.06, 0.4], [0.26, 0.74]];
            const n = c * (pts.length - 1), k = Math.floor(n), f = n - k;
            X.save(); X.lineJoin = 'round'; X.lineCap = 'round';
            for (const [col, lw] of [['rgba(255,220,235,.6)', 12], ['#2a0818', 6]]) {
              X.strokeStyle = col; X.lineWidth = lw; X.beginPath();
              for (let j = 0; j <= k && j < pts.length; j++) X.lineTo(x + pts[j][0] * R, y + pts[j][1] * R);
              if (k < pts.length - 1) X.lineTo(x + lerp(pts[k][0], pts[k + 1][0], f) * R, y + lerp(pts[k][1], pts[k + 1][1], f) * R);
              X.stroke();
            }
            X.restore();
            const r = rng(4);
            for (let j = 0; j < 22; j++) { const an = -0.6 + r() * 1.6, sp = 40 + r() * 80, x0 = x + R * (0.0 + r() * 0.2), y0 = y + R * (r() - 0.4);
              dot(DOTV, x0 + Math.cos(an) * sp * q, y0 + Math.sin(an) * sp * q, 10 + r() * 10, clamp(q * 2) * (1 - pr(q, 2, 4))); }
          }
        } else if (i === 1) {
          const c = ss(t, w[1], w[1] + 0.9), pu = 0.75 + 0.25 * Math.sin(t * 5);
          spr(CELL.T, x, y, D);
          glow(DOTV, x + 10, y + 10, R * 0.8, 0.5 * (1 - c));
          glow(DOTR, x + 10, y + 10, R * 0.85, 0.75 * c * pu);
          spr(VIR, x + Math.cos(-0.8) * (R + 30), y + Math.sin(-0.8) * (R + 30), 90, { rot: t * 0.1 });
        } else {
          spr(CELL.T, x, y, D);
          for (let k = 0; k < 14; k++) {
            const u = ((t * 0.22 + k / 14) % 1), fade = 1 - ss(t, w[2] + (k % 7) * 0.12, w[2] + (k % 7) * 0.12 + 0.9) * (k % 5 === 0 ? 0.6 : 1);
            const ax = lerp(1980, x + R + 30, u), ay = y + ((k % 5) - 2) * 70 + Math.sin(t * 1.5 + k) * 18;
            ab(ax, ay, 1.1, -Math.PI / 2 + Math.sin(t + k) * 0.3, fade * clamp(u * 4) * 0.95);
          }
        }
      });
      txt(['Зақымдау', 'Қызметін өзгерту', 'Жауапты әлсірету'][i], x, 790, { size: 42, w: 700, a: ss(t, w[i], w[i] + 0.4) * Math.max(allOn, lerp(0.45, 1, fw[i])) });
    });
  });
});

// 5. Camouflage: lower antigenic activity
addScene(5, (t, s) => {
  plasma(t, { dark: 0.05 }); motes(t, { cx: t * 12 });
  const ta = wt(s, 0, 'антигендік'), th = wt(s, 0, 'жасырыну'), p = ss(t, ta - 0.3, ta + 1.8);
  cam(1 + 0.06 * pr(t, 0, s.d), 0, 0, () => {
    const x = 930, y = 470, d = 400, rot = t * 0.08;
    glow(DOTR, x, y, 330, 0.35 * (1 - p));
    spr(VIR, x, y, d, { rot, a: 1 - p }); spr(VIRB, x, y, d * 0.97, { rot, a: p * 0.75, blur: p * 2 });
    const m = pr(t, th - 1.4, s.d + 0.9);
    macro(lerp(W + 560, -560, E.inOut(m)), 820, 330, t, { blur: 4, reach: 0.3 * Math.sin(Math.PI * m) });
  });
  label('Антигендік белсенділік ↓', t, ta, s.d + 1, { y: 120 });
});

// 6. Cytokines
addScene(6, (t, s) => {
  plasma(t, { dark: 0.22 }); motes(t, { cx: t * 8 });
  const tc = wt(s, 0, 'түзілуіне'), tl = wt(s, 0, 'цитокиндердің'), c = ss(t, tc - 0.2, tc + 1.4);
  cam(1 + 0.04 * pr(t, 0, s.d), lerp(-30, 30, pr(t, 0, s.d)), 0, () => {
    spr(CELL.B, 520, 540, 430, { rot: t * 0.04 }); spr(CELL.T, 1400, 540, 430, { rot: -t * 0.03 });
    spr(VIR, 1440, 500, 80, { rot: t * 0.3, a: 0.9 }); glow(DOTR, 1440, 500, 120, 0.3 + 0.3 * c * (0.5 + 0.5 * Math.sin(t * 6)));
    const B = (u, p0, p1, p2) => [(1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]];
    for (let k = 0; k < 36; k++) {
      const top = k % 2 === 0, u = ((t * 0.3 + k / 36) % 1);
      let [x, y] = top ? B(u, [720, 480], [960, 220], [1200, 480]) : B(u, [1200, 610], [960, 870], [720, 610]);
      x += c * 90 * nz(k * 3.1 + t * 2.2); y += c * 90 * nz(k * 1.7 + t * 2.6, 2);
      const red = c > 0.3 && k % 3 !== 0, gone = k % 4 === 0 ? c : 0;
      const al = clamp(Math.sin(u * Math.PI) * 2) * (1 - gone);
      glow(red ? DOTR : DOTC, x, y, 22, al * 0.95); dot(DOT, x, y, 6, al * 0.8);
    }
  });
  label('Цитокиндер', t, tl, s.d + 1);
});

// 7. Two properties: persistence and latency
addScene(7, (t, s) => {
  const z = 1 + 0.6 * E.inOut(pr(t, s.d - 1.4, s.d + 0.4));
  plasma(t, { dark: 0.35 }); motes(t, { cx: t * 6, a: 1.3 });
  for (let k = 0; k < 5; k++) glow(DOT, 300 + k * 330 + Math.sin(t * 0.2 + k) * 60, 540 + Math.sin(t * 0.15 + k * 2) * 120, 380, 0.08);
  cam(z, 0, 0, () => {
    glow(DOTR, 960, 520, 200, 0.4);
    spr(VIR, 960, 520, 190, { rot: t * 0.25 });
    const split = E.inOut(pr(t, s.d - 1.4, s.d + 0.4)) * 380;
    [['ПЕРСИСТЕНЦИЯ', W * 0.26 - split, wt(s, 0, 'персистенция')], ['ЛАТЕНТТІЛІК', W * 0.74 + split, wt(s, 0, 'латенттілік')]].forEach(([w, x0, t0]) => {
      X.save(); X.font = '800 76px Montserrat'; X.letterSpacing = '0px';
      const ch = [...w], ws = ch.map((c) => X.measureText(c).width + 4), tw = ws.reduce((a, b) => a + b, 0); X.restore();
      let x = x0 - tw / 2; const r = rng(w.length);
      ch.forEach((c, i) => {
        const st = t0 + i * 0.04, p = E.out3(pr(t, st, st + 0.9)), ox = (r() - 0.5) * 500 * (1 - p), oy = (r() - 0.5) * 400 * (1 - p);
        if (p > 0) { X.save(); if (p < 0.97) X.filter = `blur(${((1 - p) * 12).toFixed(1)}px)`; txt(c, x + ws[i] / 2 + ox, 530 + oy, { size: 76, a: p }); X.restore(); }
        x += ws[i];
      });
    });
  });
});

// 8. Persistence and latency
function cellInterior(t, z, fx, fy) {
  interiorBg(t);
  cam(z, fx, fy, () => {
    X.save(); X.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      X.strokeStyle = `rgba(255,170,205,${0.18 + 0.05 * k % 2})`; X.lineWidth = 14; X.beginPath();
      for (let x = -100; x <= 1100; x += 20) X.lineTo(x, 760 + k * 40 + Math.sin(x / 90 + k + t * 0.4) * 22);
      X.stroke();
    }
    X.restore();
    [[300, 250, 190, 0.4], [700, 180, 150, -0.3], [180, 620, 170, 1.2], [880, 860, 160, 0.2], [560, 460, 130, 2.1]].forEach(([x, y, l, r], k) => {
      X.save(); X.translate(x + Math.sin(t * 0.3 + k) * 12, y); X.rotate(r + Math.sin(t * 0.2 + k) * 0.05);
      const g = X.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, '#ffb7a0'); g.addColorStop(1, '#b8455e');
      X.fillStyle = g; rrect(-l / 2, -34, l, 68, 34); X.fill();
      X.strokeStyle = 'rgba(255,225,210,.55)'; X.lineWidth = 4; X.beginPath();
      for (let i = 0; i <= 30; i++) X.lineTo(-l / 2 + 16 + (i / 30) * (l - 32), Math.sin(i * 1.3) * 18);
      X.stroke(); X.restore();
    });
    const nx = 1420, ny = 520, nr = 330;
    const g = X.createRadialGradient(nx - 100, ny - 120, 20, nx, ny, nr);
    g.addColorStop(0, '#a58cf0'); g.addColorStop(0.6, '#5a3fae'); g.addColorStop(1, '#2a1660');
    X.fillStyle = g; X.beginPath(); X.arc(nx, ny, nr, 0, TAU); X.fill();
    X.strokeStyle = 'rgba(220,200,255,.55)'; X.lineWidth = 8; X.stroke();
    for (let k = 0; k < 28; k++) { const an = (k / 28) * TAU; X.fillStyle = 'rgba(40,20,90,.9)'; X.beginPath(); X.arc(nx + Math.cos(an) * nr, ny + Math.sin(an) * nr, 9, 0, TAU); X.fill(); }
    const r = rng(9);
    for (let k = 0; k < 40; k++) { const an = r() * TAU, d = Math.sqrt(r()) * nr * 0.85; dot(DOTV, nx + Math.cos(an) * d, ny + Math.sin(an) * d, 30 + r() * 30, 0.25); }
    [[420, 380], [640, 640], [250, 820], [820, 330]].forEach(([x, y], k) => spr(VIR, x + Math.sin(t * 0.4 + k) * 14, y + Math.cos(t * 0.3 + k) * 10, 90, { rot: t * 0.05 + k, blur: k === 2 ? 3 : 0 }));
  });
}
function dnaView(t, glw) {
  darkBg('#5a2060', '#14040f'); motes(t, { cx: t * 5, a: 0.6, img: DOTV });
  helix(-50, 1970, 270, 40, t, { a: 0.45, blur: 7, phase: 1.3 });
  helix(-50, 1970, 540, 72, t, { amber: [760, 1160], glw });
  helix(-50, 1970, 830, 46, t, { a: 0.5, blur: 6, phase: 2.6 });
}
function bodyCalm(t, z, { aura = 1, crack = 0, flick = 0 } = {}) {
  plasma(t, { dark: 0.45 }); motes(t, { cx: t * 6, a: 0.7 });
  cam(z, 0, z > 1 ? -60 * (z - 1) : 0, () => {
    const cx = 960, cy = 530, sc = 0.82;
    glow(DOTC, cx, cy, 560, 0.22 * aura * (1 - crack) * (0.9 + 0.1 * Math.sin(t * 2)) * (1 - flick * (0.5 + 0.5 * nz(t * 40))));
    const r = rng(21);
    X.save(); X.lineCap = 'round';
    for (let k = 0; k < 48; k++) {
      const an = (k / 48) * TAU, off = crack * (60 + r() * 260), fl = 1 - flick * (0.5 + 0.5 * nz(t * 35 + k));
      const rx = 330 + off, ry = 470 + off, a0 = an + 0.02, a1 = an + TAU / 48 - 0.03;
      X.globalAlpha = aura * (1 - crack) * 0.7 * fl; X.strokeStyle = '#a9f2ff'; X.lineWidth = 5; X.shadowColor = '#7fe6ff'; X.shadowBlur = 16;
      X.beginPath(); X.ellipse(cx, cy, rx, ry, 0, a0, a1); X.stroke();
    }
    X.restore();
    body(cx, cy, sc, { glowCol: crack > 0 ? `rgba(255,${200 - crack * 120},${220 - crack * 150},.7)` : 'rgba(190,240,255,.6)' });
    if (crack > 0) glow(DOTR, cx, cy - 60, 360, 0.18 * crack);
  });
  ecg(560, 1360, 990, t, 40, 0.8, crack > 0.3 ? '#ff8fa0' : '#8ff0e0', crack);
}
addScene(8, (t, s) => {
  const L = s.L, tB = L[1].a, tC = L[2].a;
  const pz = E.inOut(pr(t, tB - 1.3, tB + 0.3)), zA = 1 + 2.4 * pz;
  const aB = ss(t, tB - 0.5, tB + 0.15), aC = ss(t, tC - 0.6, tC + 0.1);
  if (aB < 1) {
    cellInterior(t, zA, (1420 - 960) * pz, (520 - 540) * pz);
    const q = pr(t, L[0].a, tB - 0.6), lab = q < 0.34 ? '1 ай' : q < 0.67 ? '1 жыл' : '10 жыл';
    const ca = ss(t, L[0].a, L[0].a + 0.5) * (1 - ss(t, tB - 1.2, tB - 0.7));
    view(ca, () => {
      X.save(); X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 4; X.beginPath(); X.arc(1600, 140, 40, 0, TAU); X.stroke();
      const an = -Math.PI / 2 + q * TAU * 3; X.beginPath(); X.moveTo(1600, 140); X.lineTo(1600 + Math.cos(an) * 30, 140 + Math.sin(an) * 30); X.stroke(); X.restore();
      txt(lab, 1665, 142, { size: 46, align: 'left' });
    });
  }
  if (aB > 0 && aC < 1) view(aB, () => {
    dnaView(t, 0.25 + 0.15 * Math.sin(t * 1.6));
    tag('вирус геномы', 960, 470, t, tB + 0.9, { dy: -140, t1: tC - 0.3 });
    chip('жаңа вирустар түзілмейді', W / 2, 150, t, wt(s, 1, 'жаңа'), { align: 'center', t1: tC - 0.3, size: 34 });
  });
  if (aC > 0) view(aC, () => bodyCalm(t, lerp(1.35, 1, E.out3(pr(t, tC - 0.6, tC + 1.6)))));
  label('Персистенция', t, L[0].a + 0.2, tB - 0.6);
  label('Латентті инфекция', t, tB + 0.3, tC - 0.4);
  label('Клиникалық белгілер жоқ', t, tC + 0.3, s.d + 1, { y: 80 });
});

// 9. Reactivation
function causeIcon(k, x, y, r) {
  X.save(); X.translate(x, y); X.lineCap = 'round'; X.lineJoin = 'round';
  if (k === 0) { // kidney (transplant)
    const g = X.createRadialGradient(-10, -14, 4, 0, 0, r * 0.6); g.addColorStop(0, '#ffb4b4'); g.addColorStop(1, '#b8324c');
    X.fillStyle = g; X.beginPath(); X.moveTo(0, -r * 0.5); X.bezierCurveTo(r * 0.48, -r * 0.5, r * 0.48, r * 0.5, 0, r * 0.5);
    X.bezierCurveTo(-r * 0.32, r * 0.5, -r * 0.26, r * 0.18, -r * 0.1, r * 0.1); X.bezierCurveTo(0, r * 0.04, 0, -r * 0.04, -r * 0.1, -r * 0.1);
    X.bezierCurveTo(-r * 0.26, -r * 0.18, -r * 0.32, -r * 0.5, 0, -r * 0.5); X.fill();
    X.strokeStyle = '#ffe6ea'; X.lineWidth = 4; X.beginPath(); X.moveTo(-r * 0.06, 0); X.quadraticCurveTo(-r * 0.4, r * 0.05, -r * 0.5, r * 0.45); X.stroke();
  } else if (k === 1) { // capsule
    X.rotate(-0.6); X.fillStyle = '#f4f0ff'; rrect(-r * 0.55, -r * 0.2, r * 0.55, r * 0.4, [r * 0.2, 0, 0, r * 0.2]); X.fill();
    X.fillStyle = '#ff5a72'; rrect(0, -r * 0.2, r * 0.55, r * 0.4, [0, r * 0.2, r * 0.2, 0]); X.fill();
  } else if (k === 2) { // awareness ribbon
    X.strokeStyle = '#ff3b55'; X.lineWidth = r * 0.16; X.beginPath(); X.moveTo(-r * 0.32, r * 0.5); X.lineTo(r * 0.12, -r * 0.18);
    X.arc(0, -r * 0.3, r * 0.17, 0.8, Math.PI + 2.3, true); X.lineTo(r * 0.32, r * 0.5); X.stroke();
  } else if (k === 3) { // tumour cluster
    [[-14, -10, 20], [14, -14, 18], [18, 14, 20], [-14, 16, 18], [0, 0, 16], [-30, 4, 12]].forEach(([a, b, c]) => {
      const g = X.createRadialGradient(a - 5, b - 5, 2, a, b, c); g.addColorStop(0, '#d7ccff'); g.addColorStop(1, '#5a3fae'); X.fillStyle = g; X.beginPath(); X.arc(a, b, c, 0, TAU); X.fill(); });
  } else { // chronic: ECG
    X.strokeStyle = '#ffd08a'; X.lineWidth = 6; X.beginPath(); X.moveTo(-r * 0.55, 0); X.lineTo(-r * 0.2, 0); X.lineTo(-r * 0.08, -r * 0.4); X.lineTo(r * 0.06, r * 0.35); X.lineTo(r * 0.18, 0); X.lineTo(r * 0.55, 0); X.stroke();
  }
  X.restore();
}
addScene(9, (t, s) => {
  const L = s.L, tDrop = wt(s, 0, 'төмендеген'), tV = wt(s, 0, 'вирус'), tAct = wt(s, 0, 'белсенділенеді'), tR = wt(s, 1, 'реактивация'), t2 = L[2].a;
  const aB = ss(t, tV - 0.2, tV + 0.5);
  if (aB < 1) bodyCalm(t, 1 + 1.6 * E.inOut(pr(t, tV - 0.7, tV + 0.5)), { crack: E.out3(pr(t, tDrop + 0.3, tDrop + 1.5)), flick: pr(t, tDrop - 0.3, tDrop + 0.3) * (1 - pr(t, tDrop + 0.3, tDrop + 0.6)) });
  if (aB > 0) view(aB, () => {
    plasma(t, { dark: 0.3 }); motes(t, { cx: t * 15 });
    const m = ss(t, t2 - 0.3, t2 + 0.9), cx = 960, cy = lerp(520, 400, m), D = lerp(560, 360, m) * (1 + 0.15 * (1 - ss(t, tV - 0.2, tV + 1)));
    const fl = ss(t, tAct - 0.3, tAct + 0.6), va = lerp(1, 0.45, m);
    const r = rng(77);
    for (let k = 0; k < 7; k++) { // mRNA
      const an = (k / 7) * TAU + 0.3, g = pr(t, tAct, tAct + 1.6) * D * 0.75;
      if (g <= 0) continue;
      X.save(); X.globalAlpha *= va; X.strokeStyle = k % 2 ? 'rgba(255,140,90,.9)' : 'rgba(255,215,120,.9)'; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath();
      for (let u = 0; u <= g; u += 6) { const px = D * 0.18 + u, py = Math.sin(u / 22 + t * 3 + k) * 10; X.lineTo(cx + Math.cos(an) * px - Math.sin(an) * py, cy + Math.sin(an) * px + Math.cos(an) * py); }
      X.stroke(); X.restore();
    }
    spr(CELL.P, cx, cy, D, { rot: t * 0.05 });
    glow(DOTA, cx + D * 0.03, cy + D * 0.02, D * 0.42 * (1 + 0.3 * fl), 0.15 + 0.85 * fl * (0.8 + 0.2 * Math.sin(t * 7)));
    for (let k = 0; k < 20; k++) {
      const ti = L[1].a - 0.6 + k * 0.17, age = t - ti; if (age <= 0) continue;
      const an = k * 2.399 + r() * 0.2, rad = D / 2 + 20 + E.out3(clamp(age / 0.9)) * 40 + age * 75, sz = (56 + (k % 3) * 14) * lerp(0.3, 1, E.outBack(clamp(age / 0.7)));
      spr(VIR, cx + Math.cos(an) * rad, cy + Math.sin(an) * rad * 0.85, sz, { rot: age * 0.6 + k, a: va * clamp(age * 3) });
    }
    const sa = pr(t, tR, tR + 0.6), se = E.outExpo(sa);
    if (sa > 0) {
      const y = lerp(930, 105, m), sz = lerp(104, 62, m);
      X.save(); X.translate(W / 2, y); X.scale(lerp(1.7, 1, se), lerp(1.7, 1, se)); if (se < 0.98) X.filter = `blur(${((1 - se) * 16).toFixed(1)}px)`;
      X.shadowColor = 'rgba(255,170,80,.9)'; X.shadowBlur = 40; X.globalAlpha *= clamp(sa * 3);
      X.font = `800 ${sz}px Montserrat`; X.letterSpacing = '8px'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = '#fff'; X.fillText('РЕАКТИВАЦИЯ', 0, 0); X.restore();
    }
    const cw = ['трансплантациядан', 'супрессиялайтын', 'АИТВ', 'онкологиялық', 'созылмалы'].map((w) => wt(s, 2, w));
    ['Трансплантация', 'Иммуносупрессорлар', 'АИТВ', 'Онкология', 'Созылмалы аурулар'].forEach((n, k) => {
      const x = 220 + k * 370, y = 780, p = E.outBack(pr(t, cw[k], cw[k] + 0.6)), a = pr(t, cw[k], cw[k] + 0.3);
      if (a <= 0) return;
      X.save(); X.globalAlpha *= a; X.translate(x, y); X.scale(p, p);
      const g = X.createRadialGradient(-20, -24, 6, 0, 0, 82); g.addColorStop(0, 'rgba(255,255,255,.32)'); g.addColorStop(1, 'rgba(255,255,255,.07)');
      X.fillStyle = g; X.beginPath(); X.arc(0, 0, 78, 0, TAU); X.fill(); X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 2; X.stroke();
      causeIcon(k, 0, 0, 78); X.restore();
      txt(n, x, 905, { size: 28, w: 700, a });
    });
  });
});

// 10. Clinical signs
addScene(10, (t, s) => {
  const L = s.L, cx = 600, cy = 540, sc = 0.92;
  plasma(t, { dark: 0.5 }); motes(t, { cx: t * 6, a: 0.6 });
  const w1 = ['қызба', 'әлсіздік', 'тамақтың', 'лимфа', 'бауыр'].map((w) => wt(s, 1, w));
  const w2 = [wt(s, 2, 'бөртпе'), wt(s, 2, 'күлгін')], w3 = ['көрудің', 'пневмония', 'энцефалит', 'басқа'].map((w) => wt(s, 3, w));
  const fev = ss(t, w1[0], w1[0] + 0.6), wk = ss(t, w1[1], w1[1] + 0.6), late = ss(t, L[3].a - 0.3, L[3].a + 0.5);
  const z = 1 + 0.04 * pr(t, 0, s.d);
  cam(z, 0, 0, () => {
    glow(DOTO, cx, cy, 560, 0.28 * fev * (0.75 + 0.25 * Math.sin(t * 4)));
    body(cx, cy, sc, { a: lerp(1, 0.62, wk) * (1 - 0.12 * wk * (0.5 + 0.5 * Math.sin(t * 1.6))), glowCol: fev > 0 ? `rgba(255,${lerp(200, 140, fev)},${lerp(220, 90, fev)},.75)` : 'rgba(255,200,220,.6)' });
    const P = (px, py) => bp(cx, cy, sc, px, py), pu = 0.8 + 0.2 * Math.sin(t * 4);
    const th = ss(t, w1[2], w1[2] + 0.5); { const [x, y] = P(300, 190); glow(DOTR, x, y, 60, th * pu); }
    const ln = ss(t, w1[3], w1[3] + 0.8);
    [[262, 200], [338, 200], [212, 268], [388, 268], [255, 612], [345, 612]].forEach(([a, b]) => { const [x, y] = P(a, b); glow(DOTV, x, y, 50 * ln, ln); X.save(); X.globalAlpha *= ln; X.fillStyle = '#c45cff'; X.beginPath(); X.arc(x, y, 5 + 12 * ln, 0, TAU); X.fill(); X.restore(); });
    const lv = ss(t, w1[4], w1[4] + 1.0);
    if (lv > 0) { X.save(); X.globalAlpha *= lv * 0.85; X.shadowColor = '#ffb050'; X.shadowBlur = 30;
      let [x, y] = P(262, 410); X.fillStyle = '#ff9a5a'; X.beginPath(); X.ellipse(x, y, lerp(50, 80, lv) * sc, lerp(32, 50, lv) * sc, -0.2, 0, TAU); X.fill();
      [x, y] = P(346, 415); X.fillStyle = '#ff6a7e'; X.beginPath(); X.ellipse(x, y, lerp(26, 42, lv) * sc, lerp(36, 56, lv) * sc, 0.3, 0, TAU); X.fill(); X.restore(); }
    // immunocompromised: eyes, lungs, brain
    const e1 = ss(t, w3[0], w3[0] + 0.5), e2 = ss(t, w3[1], w3[1] + 0.8), e3 = ss(t, w3[2], w3[2] + 0.6);
    [[275, 100], [325, 100]].forEach(([a, b]) => { const [x, y] = P(a, b); glow(DOTC, x, y, 34, e1 * pu); });
    const r = rng(5); [[255, 300], [345, 300]].forEach(([a, b]) => { for (let k = 0; k < 6; k++) { const [x, y] = P(a + (r() - 0.5) * 70, b + (r() - 0.5) * 120); glow(DOT, x, y, 34, e2 * 0.22); glow(DOTR, x, y, 30, e2 * 0.35); } });
    { const [x, y] = P(300, 82); glow(DOTV, x, y, 110, e3 * pu); glow(DOTR, x, y, 70, e3 * 0.6); }
  });
  // skin inset
  const ia = ss(t, L[2].a - 0.3, L[2].a + 0.4) * (1 - ss(t, L[3].a - 0.4, L[3].a + 0.1));
  view(ia, () => {
    const ix = 1400, iy = 520, ir = 300, [ax, ay] = bp(cx, cy, sc * z, 140, 520);
    X.save(); X.strokeStyle = 'rgba(255,255,255,.7)'; X.lineWidth = 2.5; X.setLineDash([8, 8]); X.beginPath(); X.moveTo(ax, ay); X.lineTo(ix - ir * 0.97, iy + 60); X.stroke(); X.restore();
    X.save(); X.beginPath(); X.arc(ix, iy, ir, 0, TAU); X.clip();
    X.drawImage(TIS1, 300, 60, 900, 460, ix - ir * 1.4, iy - ir * 1.05, ir * 2.8, ir * 2.2);
    X.fillStyle = 'rgba(255,200,210,.25)'; X.fillRect(ix - ir, iy - ir, ir * 2, ir * 2);
    const rr = rng(66);
    for (let k = 0; k < 46; k++) { const x = ix + (rr() - 0.5) * ir * 1.8, y = iy + (rr() - 0.5) * ir * 1.8, a = pr(t, w2[0] + k * 0.03, w2[0] + k * 0.03 + 0.3);
      dot(DOTR, x, y, 14 + rr() * 10, a * 0.8); }
    for (let k = 0; k < 7; k++) { const x = ix + (rr() - 0.5) * ir * 1.3, y = iy + (rr() - 0.5) * ir * 1.3, a = E.outBack(pr(t, w2[1] + k * 0.12, w2[1] + k * 0.12 + 0.6)), R = (18 + rr() * 22) * a;
      if (R > 0) { const g = X.createRadialGradient(x - R * 0.3, y - R * 0.3, 1, x, y, R); g.addColorStop(0, '#d9b0ff'); g.addColorStop(0.6, '#8a3fc4'); g.addColorStop(1, '#4a1670'); X.fillStyle = g; X.beginPath(); X.arc(x, y, R, 0, TAU); X.fill(); } }
    X.restore();
    X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 4; X.beginPath(); X.arc(ix, iy, ir, 0, TAU); X.stroke();
    txt('Бөртпе', ix - 175, iy + ir + 50, { size: 36, w: 700, a: pr(t, w2[0], w2[0] + 0.4) });
    txt('Күлгін түйіндер', ix + 135, iy + ir + 50, { size: 36, w: 700, a: pr(t, w2[1], w2[1] + 0.4) });
  });
  const ttl = ss(t, L[0].a, L[0].a + 0.5) * (1 - ss(t, L[2].a - 0.5, L[2].a));
  txt('Клиникалық белгілер', 1120, 170, { size: 56, align: 'left', a: ttl });
  ['Ұзаққа созылған қызба', 'Әлсіздік', 'Тамақтың ауыруы', 'Лимфа түйіндерінің ұлғаюы', 'Бауыр мен көкбауыр үлкеюі'].forEach((n, k) => chip(n, 1120, 290 + k * 96, t, w1[k], { t1: L[2].a, size: 32 }));
  txt('Иммунитеті төмен адамдарда', 1100, 210, { size: 44, align: 'left', a: late });
  ['Көрудің бұзылуы', 'Пневмония', 'Энцефалит', 'Басқа мүшелердің зақымдануы'].forEach((n, k) => chip(n, 1120, 330 + k * 100, t, w3[k], { size: 32, accent: '#a88bff' }));
});

// 11. Blood test
addScene(11, (t, s) => {
  const L = s.L, w = ['лейкопения', 'лимфоцитоз', 'атипиялық'].map((x) => wt(s, 0, x)), q = ss(t, L[1].a - 0.2, L[1].a + 0.6);
  X.fillStyle = '#0c0408'; X.fillRect(0, 0, W, H);
  const cx = 1180, cy = 530, R = 420, drift = t * 9;
  X.save(); X.beginPath(); X.arc(cx, cy, R, 0, TAU); X.clip();
  const fb = (1 - E.out3(pr(t, 0.2, 1.8))) * 12; if (fb > 0.3) X.filter = `blur(${fb.toFixed(1)}px)`;
  X.fillStyle = '#f7e6ea'; X.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  const r = rng(31);
  for (let k = 0; k < 95; k++) { const x = cx - R - 60 + ((r() * (2 * R + 120) + drift) % (2 * R + 120)), y = cy - R + r() * 2 * R, d = 70 + r() * 16; X.drawImage(RBC, x - d * 0.625, y - d * 0.625, d * 1.25, d * 1.25); }
  const wbc = (x, y, cr, nr, cyto, nuc) => { X.fillStyle = cyto; X.beginPath(); X.arc(x, y, cr, 0, TAU); X.fill(); X.fillStyle = nuc; X.beginPath(); X.ellipse(x + 3, y, nr, nr * 0.9, 0.4, 0, TAU); X.fill(); };
  const lymph = [[cx - 220, cy - 160], [cx + 60, cy - 250], [cx - 120, cy + 190], [cx + 250, cy + 40]];
  lymph.forEach(([x, y]) => wbc(x + drift * 0.3, y, 44, 36, '#c9d7f5', '#4b2d8f'));
  const at = [cx + 30 + drift * 0.3, cy + 40]; wbc(at[0], at[1], 92, 44, '#9fcdee', '#3d2a86');
  X.restore();
  X.strokeStyle = '#2a0e18'; X.lineWidth = 10; X.beginPath(); X.arc(cx, cy, R, 0, TAU); X.stroke();
  const vg = X.createRadialGradient(cx, cy, R * 0.75, cx, cy, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  X.fillStyle = vg; X.beginPath(); X.arc(cx, cy, R, 0, TAU); X.fill();
  view(1 - q * 0.6, () => {
    const lp = ss(t, w[1], w[1] + 0.5);
    lymph.forEach(([x, y]) => { X.save(); X.globalAlpha *= lp; X.strokeStyle = '#7fe0ff'; X.lineWidth = 4; X.beginPath(); X.arc(x + drift * 0.3, y, 60, 0, TAU); X.stroke(); X.restore(); });
    const ap = ss(t, w[2], w[2] + 0.5); X.save(); X.globalAlpha *= ap; X.strokeStyle = '#ffd08a'; X.lineWidth = 5; X.setLineDash([12, 10]); X.beginPath(); X.arc(at[0], at[1], 116, 0, TAU); X.stroke(); X.restore();
    chip('Лейкопения', 70, 380, t, w[0], { size: 34 });
    chip('Лимфоцитоз', 70, 490, t, w[1], { size: 34, accent: '#7fe0ff' });
    chip('Атипиялық мононуклеарлар', 70, 600, t, w[2], { size: 30, accent: '#ffd08a' });
  });
  txt('Қан талдауы', 70, 230, { size: 54, align: 'left', a: ss(t, 0.4, 1) * (1 - q * 0.6) });
  if (q > 0) { const e = E.outBack(q); X.save(); X.translate(cx, cy); X.scale(e, e); txt('?', 0, 10, { size: 420, a: 0.6 * q }); X.restore(); }
  label('Бір белгі нақты вирусты көрсетпейді', t, L[1].a + 0.3, s.d + 1, { y: 1010, size: 40, x: 760 });
});

// 12. Diagnosis
addScene(12, (t, s) => {
  const L = s.L, ph = [0, L[1].a, L[2].a, L[3].a].map((v, i) => (i ? v - 0.25 : -9));
  const pa = (i) => ss(t, ph[i] - 0.3, ph[i] + 0.3) * (i < 3 ? 1 - ss(t, ph[i + 1] - 0.3, ph[i + 1] + 0.3) : 1);
  darkBg('#5a1d42', '#14040c'); motes(t, { cx: t * 8, a: 0.5 });
  view(pa(0), () => {
    const tm = wt(s, 0, 'бірге'), p = E.inOut(pr(t, L[0].a + 0.2, tm)), fl = ss(t, tm, tm + 0.3) * (1 - ss(t, tm + 0.5, tm + 1.6));
    [['КЛИНИКА', -1], ['ЗЕРТХАНА', 1]].forEach(([n, sg]) => {
      const x = W / 2 + sg * lerp(560, 230, p), y = 450;
      X.save(); X.globalAlpha *= pr(t, L[0].a - 0.3, L[0].a + 0.3);
      rrect(x - 220, y - 110, 440, 220, 30); X.fillStyle = 'rgba(255,255,255,.1)'; X.fill(); X.strokeStyle = 'rgba(255,220,235,.6)'; X.lineWidth = 2; X.stroke(); X.restore();
      txt(n, x, y, { size: 52, a: pr(t, L[0].a - 0.3, L[0].a + 0.3) });
    });
    glow(DOTA, W / 2, 450, 300, fl);
    txt('ДИАГНОЗ', W / 2, 720, { size: 80, ls: 10, a: ss(t, tm + 0.2, tm + 0.8), col: '#ffe2b0' });
  });
  view(pa(1), () => {
    const wm = wt(s, 1, 'IgM'), wg = wt(s, 1, 'IgG');
    X.save(); rrect(150, 250, 760, 520, 34); X.fillStyle = 'rgba(255,255,255,.1)'; X.fill(); X.strokeStyle = 'rgba(255,220,235,.5)'; X.lineWidth = 2; X.stroke(); X.restore();
    const r = rng(14);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) {
      const x = 205 + i * 59, y = 305 + j * 59, on = r(), tt = L[1].a + 0.3 + (i + j) * 0.06, p = pr(t, tt, tt + 0.5);
      X.fillStyle = 'rgba(255,240,245,.16)'; X.beginPath(); X.arc(x, y, 22, 0, TAU); X.fill();
      if (on > 0.35) { X.save(); X.globalAlpha *= p; X.fillStyle = `rgb(255,${Math.round(150 + on * 80)},${Math.round(60 + on * 50)})`; X.beginPath(); X.arc(x, y, 19, 0, TAU); X.fill(); X.restore(); }
    }
    txt('Серология', 530, 830, { size: 40, w: 700 });
    const vx = 1430, vy = 500;
    spr(VIR, vx, vy, 200, { rot: t * 0.1 });
    const pm = E.out3(pr(t, wm - 0.4, wm + 0.6)), pg = E.out3(pr(t, wg - 0.4, wg + 0.6));
    igm(lerp(1850, vx + 165, pm), lerp(860, vy + 150, pm), 1.3, t * 0.2, pr(t, wm - 0.4, wm));
    ab(lerp(1050, vx - 175, pg), lerp(160, vy - 130, pg), 1.7, 2.3, pr(t, wg - 0.4, wg));
    txt('IgM', vx + 270, vy + 250, { size: 44, a: pr(t, wm, wm + 0.4), col: '#d3c6ff' });
    txt('IgG', vx - 290, vy - 220, { size: 44, a: pr(t, wg, wg + 0.4), col: '#a6f0fa' });
  });
  view(pa(2), () => {
    const w = ['ДНҚ-сын', 'РНҚ-сын', 'провирустық'].map((x) => wt(s, 2, x)), n = Math.floor(clamp((t - L[2].a) / 0.9, 0, 3));
    for (let c = 0; c < 2 ** n; c++) { const off = (c - (2 ** n - 1) / 2) * lerp(150, 70, n / 3); helix(140, 860, 520 + off, 34, t, { a: c === 0 ? 1 : 0.6, phase: c * 0.7, wav: 140 }); }
    const gx = 1040, gy = 260, gw = 760, gh = 500;
    X.save(); X.strokeStyle = 'rgba(255,255,255,.45)'; X.lineWidth = 2; X.beginPath(); X.moveTo(gx, gy); X.lineTo(gx, gy + gh); X.lineTo(gx + gw, gy + gh); X.stroke();
    X.setLineDash([10, 10]); X.strokeStyle = 'rgba(255,208,138,.6)'; X.beginPath(); X.moveTo(gx, gy + gh * 0.62); X.lineTo(gx + gw, gy + gh * 0.62); X.stroke(); X.restore();
    const cp = pr(t, L[2].a + 0.2, L[2].a + L[2].d * 0.9);
    X.save(); X.strokeStyle = '#7fe6f2'; X.lineWidth = 6; X.shadowColor = '#7fe6f2'; X.shadowBlur = 20; X.beginPath();
    for (let u = 0; u <= cp; u += 0.01) X.lineTo(gx + u * gw, gy + gh - gh * 0.9 / (1 + Math.exp(-(u - 0.55) * 12)));
    X.stroke(); X.restore();
    txt('ПТР', gx + gw / 2, 190, { size: 56 });
    ['ДНҚ', 'РНҚ', 'Провирустық ДНҚ'].forEach((nm, k) => chip(nm, [1040, 1250, 1460][k], 860, t, w[k], { size: 32, accent: '#7fe6f2' }));
  });
  view(pa(3), () => {
    const w = ['жүктеме', 'авидтілігі', 'саны', 'морфологиялық'].map((x) => wt(s, 3, x));
    ['Вирустық жүктеме', 'Антиденелер авидтілігі', 'Иммундық жасушалар саны', 'Тін морфологиясы'].forEach((nm, k) => {
      const x = k % 2 ? 1000 : 340, y = k < 2 ? 200 : 560, p = E.out3(pr(t, w[k], w[k] + 0.6)), a = pr(t, w[k], w[k] + 0.3);
      if (a <= 0) return;
      X.save(); X.globalAlpha *= a; X.translate(0, (1 - p) * 40);
      rrect(x, y, 580, 300, 28); X.fillStyle = 'rgba(255,255,255,.1)'; X.fill(); X.strokeStyle = 'rgba(255,220,235,.5)'; X.lineWidth = 2; X.stroke();
      X.save(); rrect(x + 30, y + 30, 520, 170, 16); X.clip();
      if (k === 0) [0.3, 0.45, 0.62, 0.8, 0.95].forEach((v, i) => { X.fillStyle = '#ff5a72'; X.fillRect(x + 80 + i * 90, y + 200 - 150 * v * p, 56, 150 * v * p); });
      else if (k === 1) { X.translate(0, 0); spr(VIR, x + 330, y + 115, 90); ab(x + 220, y + 115, 1.4, Math.PI / 2); ab(x + 440, y + 115, 1.4, -Math.PI / 2);
        X.strokeStyle = 'rgba(255,208,138,.8)'; X.lineWidth = 3; for (let i = 1; i < 4; i++) { X.beginPath(); X.arc(x + 330, y + 115, 50 + i * 14, -0.6, 0.6); X.stroke(); X.beginPath(); X.arc(x + 330, y + 115, 50 + i * 14, Math.PI - 0.6, Math.PI + 0.6); X.stroke(); } }
      else if (k === 2) { for (let i = 0; i < 10; i++) for (let j = 0; j < 3; j++) spr(CELL.T, x + 75 + i * 48, y + 65 + j * 50, 40); }
      else X.drawImage(TIS1, 200, 140, 900, 300, x + 30, y + 30, 520, 170);
      X.restore();
      txt(nm, x + 290, y + 250, { size: 32, w: 700 });
      X.restore();
    });
  });
});

// 13. Oncology
addScene(13, (t, s) => {
  const L = s.L, tg = wt(s, 1, 'өзгертіп'), tlp = wt(s, 1, 'лимфопролиферативті'), w = ['лимфомалармен', 'лейкемиямен', 'Капоши'].map((x) => wt(s, 2, x));
  const pn = ss(t, L[2].a - 0.4, L[2].a + 0.6);
  plasma(t, { dark: 0.15 }); motes(t, { cx: t * 10 });
  view(1 - pn * 0.75, () => cam(1 - 0.08 * pn, 0, 0, () => {
    const cx = 960, cy = 500;
    const dv = E.inOut(pr(t, L[0].a + 0.6, L[0].a + 3.2)) * (1 - pr(t, tg, tg + 0.01));
    if (t < tg) {
      const sep = dv * 150;
      X.save(); X.globalAlpha *= 0.6 * (1 - Math.abs(dv - 0.5) * 2) * (dv > 0 ? 1 : 0); X.fillStyle = '#f09ab0'; X.fillRect(cx - sep, cy - 60 * (1 - dv), sep * 2, 120 * (1 - dv)); X.restore();
      spr(CELL.P, cx - sep, cy, 300); if (dv > 0) spr(CELL.P, cx + sep, cy, 300);
    } else {
      const n = Math.min(110, Math.floor(2 * Math.pow(2, (t - tg) * 1.35)));
      for (let i = n - 1; i >= 0; i--) {
        const an = i * 2.39996, rad = 58 * Math.sqrt(i), born = tg + Math.log2(Math.max(1, i / 2 + 1)) / 1.35, e = E.outBack(pr(t, born, born + 0.5));
        const x = cx + Math.cos(an) * rad + nz(i + t, 1) * 10, y = cy + Math.sin(an) * rad * 0.8 + nz(i * 2 + t, 3) * 10;
        spr(i % 3 ? CELL.P : CELL.M, x, y, 120 * e, { rot: i });
      }
      glow(DOTA, cx, cy, 120, 0.8 * (0.7 + 0.3 * Math.sin(t * 5)) * (1 - pr(t, tg + 3, tg + 5)));
    }
  }));
  label('Инфекциядан тыс', t, L[0].a + 0.2, tg - 0.2);
  label('Бақылаусыз бөліну', t, tg, L[2].a - 0.2);
  chip('Лимфопролиферативті · онкологиялық аурулар', W / 2, 110, t, tlp, { align: 'center', t1: L[2].a - 0.2, size: 32 });
  ['Лимфома', 'Лейкемия', 'Капоши саркомасы'].forEach((nm, k) => {
    const x = 120 + k * 580, y = 240, p = E.out3(pr(t, w[k] - 0.2, w[k] + 0.6)), a = pr(t, w[k] - 0.2, w[k] + 0.2);
    if (a <= 0) return;
    X.save(); X.globalAlpha *= a; X.translate((1 - p) * 120, 0);
    rrect(x, y, 520, 520, 30); X.fillStyle = '#2a0a1c'; X.fill();
    X.save(); X.clip();
    const r = rng(k + 50);
    if (k === 0) { const g = X.createRadialGradient(x + 260, y + 260, 20, x + 260, y + 260, 280); g.addColorStop(0, '#d98ab0'); g.addColorStop(1, '#5a1838'); X.fillStyle = g; X.fillRect(x, y, 520, 520);
      X.save(); X.beginPath(); X.ellipse(x + 260, y + 260, 200, 150, 0.2, 0, TAU); X.clip(); for (let i = 0; i < 70; i++) spr(CELL.T, x + 70 + r() * 380, y + 120 + r() * 280, 52 + r() * 14); X.restore();
      X.strokeStyle = 'rgba(255,220,235,.7)'; X.lineWidth = 6; X.beginPath(); X.ellipse(x + 260, y + 260, 200, 150, 0.2, 0, TAU); X.stroke(); }
    else if (k === 1) { X.fillStyle = '#8a2b50'; X.fillRect(x, y, 520, 520); const g = X.createLinearGradient(0, y + 130, 0, y + 390); g.addColorStop(0, '#5a1430'); g.addColorStop(0.5, '#e07a95'); g.addColorStop(1, '#5a1430'); X.fillStyle = g; X.fillRect(x, y + 130, 520, 260);
      for (let i = 0; i < 40; i++) { const xx = x - 40 + ((r() * 600 + t * 60 * (0.6 + r() * 0.6)) % 600), yy = y + 160 + r() * 200; if (i % 4 === 0) X.drawImage(RBC, xx - 30, yy - 30, 60, 60); else spr(CELL.M, xx, yy, 44 + r() * 12); } }
    else { X.drawImage(TIS1, 600, 200, 600, 300, x, y, 520, 520); X.fillStyle = 'rgba(255,190,200,.2)'; X.fillRect(x, y, 520, 520);
      for (let i = 0; i < 6; i++) { const xx = x + 80 + r() * 360, yy = y + 80 + r() * 360, R = 40 + r() * 50; const g = X.createRadialGradient(xx, yy, 4, xx, yy, R); g.addColorStop(0, 'rgba(110,30,120,.95)'); g.addColorStop(0.7, 'rgba(150,50,130,.7)'); g.addColorStop(1, 'rgba(150,50,130,0)'); X.fillStyle = g; X.beginPath(); X.ellipse(xx, yy, R * 1.3, R, r() * 3, 0, TAU); X.fill(); } }
    X.restore();
    X.strokeStyle = 'rgba(255,220,235,.6)'; X.lineWidth = 2; rrect(x, y, 520, 520, 30); X.stroke();
    X.restore();
    txt(nm, x + 260 + (1 - p) * 120, 830, { size: 42, a });
  });
});

// 14. Finale
addScene(14, (t, s) => {
  const z = lerp(1.3, 0.95, E.out3(pr(t, 0, s.d)));
  plasma(t, { dark: 0.2 + 0.55 * ss(t, 0.5, 3) }); motes(t, { cx: t * 20 });
  cam(z, 0, 0, () => { const r = rng(8); for (let k = 0; k < 6; k++) spr(VIR, 200 + r() * 1500, 200 + r() * 700, 50 + r() * 60, { rot: t * 0.2 + k, a: 0.6, blur: 2 }); });
  tissueBand({ y: H - 300 + (z - 1) * 300, shift: t * 40, scale: z, blur: 4, a: 0.7 });
  tissueBand({ y: 230 - (z - 1) * 300, flip: true, shift: t * 60, scale: z * 1.2, blur: 10, img: TIS2, a: 0.7 });
  blackout(0.35 * ss(t, 0.5, 3));
  txt('Иммунотропты вирустар', W / 2, 470, { size: 88, a: ss(t, 1.2, 2.2) });
  const lw = E.inOut(pr(t, 1.8, 2.8)) * 520;
  X.save(); X.strokeStyle = 'rgba(255,255,255,.6)'; X.lineWidth = 2; X.beginPath(); X.moveTo(W / 2 - lw / 2, 545); X.lineTo(W / 2 + lw / 2, 545); X.stroke(); X.restore();
  txt('Персистенция · Латенттілік · Реактивация · Диагностика', W / 2, 610, { size: 34, w: 600, a: ss(t, 2.4, 3.2) });
  blackout(ss(t, s.d - 1.4, s.d));
}, { dur: 7.5 });

// ---------- compositing ----------
function drawScene(i, t) {
  const s = SC[i]; X.save(); X.fillStyle = '#000'; X.fillRect(0, 0, W, H); s.draw(t - s.a, s); X.restore();
}
function post(t, f) {
  const v = X.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, 'rgba(20,0,8,0)'); v.addColorStop(1, 'rgba(20,0,8,.55)');
  X.fillStyle = v; X.fillRect(0, 0, W, H);
  X.save(); X.globalAlpha = 0.05; X.globalCompositeOperation = 'overlay';
  X.fillStyle = X.createPattern(GRAIN[f % 3], 'repeat'); X.translate((f * 37) % 256, (f * 53) % 256); X.fillRect(-256, -256, W + 512, H + 512); X.restore();
}
window.renderFrame = (f) => {
  const t = f / FPS;
  let i = SC.findIndex((s) => t < s.a + s.d); if (i < 0) i = SC.length - 1;
  const s = SC[i], nb = i < SC.length - 1 && t > s.a + s.d - XF / 2, pb = i > 0 && t < s.a + XF / 2;
  X = MAIN;
  if (nb || pb) {
    const A = nb ? i : i - 1, B = A + 1, b = SC[A].a + SC[A].d, p = clamp((t - (b - XF / 2)) / XF), e = E.inOut(p);
    X = BA.getContext('2d'); drawScene(A, t); X = BB.getContext('2d'); drawScene(B, t); X = MAIN;
    X.save(); X.translate(W / 2, H / 2); const zb = lerp(1.1, 1, E.out3(p)); X.scale(zb, zb); X.translate(-W / 2, -H / 2);
    if (e < 0.97) X.filter = `blur(${((1 - e) * 8).toFixed(1)}px)`; X.drawImage(BB, 0, 0); X.restore();
    X.save(); X.globalAlpha = 1 - e; if (e > 0.03) X.filter = `blur(${(e * 14).toFixed(1)}px)`;
    X.translate(W / 2, H / 2); const za = lerp(1, 1.45, e); X.scale(za, za); X.translate(-W / 2, -H / 2); X.drawImage(BA, 0, 0); X.restore();
  } else drawScene(i, t);
  post(t, f);
};

window.FPS = FPS;
window.DURATION = T;
window.TIMELINE = { lines: LINES, cuts: SC.slice(1).map((s) => s.a) };
window.ready = Promise.all(['500', '600', '700', '800'].map((w) => document.fonts.load(`${w} 40px Montserrat`, 'ӘәҒғҚқҢңӨөҰұҮүІі'))).then(() => { window.renderFrame(0); return true; });
