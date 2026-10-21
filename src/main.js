// Motion video "4 мазхаба": every frame is a pure function of time, rendered by render.mjs.
const W = 1080, H = 1920, FPS = 30;

// ---------- math ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pr = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  out3: (t) => 1 - Math.pow(1 - t, 3),
  inOut3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- palette ----------
const MAD = { hanafi: '#3b8cff', maliki: '#e2a955', shafii: '#8fd3ff', hanbali: '#f5d9a6' };
const IDS = {
  hanafi: ['792', '398', '860', '417', '762', '795', '004', '586', '356', '050', '008', '070'],
  maliki: ['504', '012', '732', '788', '434', '478', '466', '562', '686', '729', '148'],
  shafii: ['818', '400', '275', '887', 'Somaliland', '706', '262', '458', '096', '360'],
  hanbali: ['682', '634'],
};

// ---------- projection (matches build-map.mjs) ----------
const R = PROJ.scale, L0 = (PROJ.center[0] * Math.PI) / 180;
const Y0 = Math.log(Math.tan(Math.PI / 4 + (PROJ.center[1] * Math.PI) / 360));
const proj = (lon, lat) => [R * ((lon * Math.PI) / 180 - L0), -R * (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) - Y0)];

// ---------- timeline ----------
const SCENES = [];
let T = 0;
const VOICE_LEAD = 0.15;
const scene = (d, opts, f) => {
  const v = (window.VOICE || [])[SCENES.length] || 0;
  d = Math.max(d, v + VOICE_LEAD + (opts.final ? 1.4 : 0.45));
  SCENES.push({ a: T, b: T + d, d, voice: v, ...opts, f }); T += d;
};

// ---------- UI pieces (return HTML strings) ----------
const row = (y, inner, style = '') => `<div class="row" style="top:${y}px;${style}">${inner}</div>`;

function words(text, lt, start, { stagger = 0.06, dur = 0.5 } = {}) {
  let i = 0;
  return text.split(' ').map((w) => {
    if (w === '|') return '<br>';
    const s = start + i++ * stagger;
    const p = E.out3(pr(lt, s, s + dur));
    const acc = w.startsWith('*');
    const ww = acc ? w.slice(1) : w;
    const blur = (1 - p) * 10;
    return `<span class="w${acc ? ' acc' : ''}" style="opacity:${p.toFixed(3)};transform:translateY(${((1 - p) * 38).toFixed(1)}px)${blur > 0.1 ? `;filter:blur(${blur.toFixed(1)}px)` : ''}">${ww}</span>`;
  }).join(' ');
}

function slam(text, lt, start, { size = 150, cls = 'grad', dur = 0.5, glow = 'rgba(232,200,140,.35)' } = {}) {
  const p = pr(lt, start, start + dur);
  const e = E.outExpo(p);
  if (p <= 0) return '';
  const blur = (1 - e) * 18;
  return `<div class="slam ${cls}" style="font-size:${size}px;opacity:${clamp(p * 3)};transform:scale(${lerp(1.7, 1, e).toFixed(3)});filter:${blur > 0.1 ? `blur(${blur.toFixed(1)}px) ` : ''}drop-shadow(0 0 28px ${glow}) drop-shadow(0 8px 0 rgba(0,0,0,.35))">${text}</div>`;
}

function pop(lt, start, dur = 0.5) {
  const p = pr(lt, start, start + dur);
  return { p, e: E.outBack(p), o: clamp(p * 2.2), b: (1 - E.out3(p)) * 10 };
}
const fx = (b) => (b > 0.1 ? `filter:blur(${b.toFixed(1)}px);` : '');

function tag(text, lt, start) {
  const { e, o, b } = pop(lt, start, 0.45);
  if (o <= 0) return '';
  return `<span class="tag" style="display:inline-block;opacity:${o};transform:scale(${lerp(0.7, 1, e)});${fx(b)}">${text}</span>`;
}
function pill(text, lt, start) {
  const { e, o } = pop(lt, start, 0.5);
  if (o <= 0) return '';
  return `<span class="pill" style="opacity:${o};transform:translateY(${(1 - e) * 30}px) scale(${lerp(0.8, 1, e)})">${text}</span>`;
}
function card(y, w, title, sub, lt, start, { ts = 54 } = {}) {
  const { e, o, b } = pop(lt, start, 0.55);
  if (o <= 0) return '';
  return `<div class="card" style="left:50%;top:${y}px;width:${w}px;opacity:${o};transform:translateX(-50%) translateY(${(1 - e) * 50}px) scale(${lerp(0.85, 1, e)});${fx(b)}">
    <h3 style="font-size:${ts}px">${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>`;
}
function caption(text, lt, start, end, y = 1440) {
  if (lt < start || lt > end) return '';
  const pb = E.out3(pr(lt, start, start + 0.28));
  const out = pr(lt, end - 0.2, end);
  const chars = [...text];
  const n = Math.floor(clamp((lt - start - 0.18) * 48, 0, chars.length));
  const cursor = n < chars.length && Math.floor(lt * 5) % 2 === 0;
  return `<div class="cap" style="top:${y}px;opacity:${1 - out};transform:translateX(-50%) scaleX(${pb})"><span style="visibility:hidden;position:absolute">${text}</span>${chars.slice(0, n).join('')}${cursor ? '<i></i>' : ''}<span style="visibility:hidden">${chars.slice(n).join('')}</span></div>`;
}
function typed(text, lt, start, cps = 22) {
  const chars = [...text];
  const n = Math.floor(clamp((lt - start) * cps, 0, chars.length));
  return chars.slice(0, n).join('') + `<span style="visibility:hidden">${chars.slice(n).join('')}</span>`;
}

function starPts(r1, r2) {
  const pts = [];
  for (let k = 0; k < 16; k++) {
    const r = k % 2 ? r2 : r1, a = ((k * 22.5 - 90) * Math.PI) / 180;
    pts.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}
const STAR = starPts(96, 76);
function medal(ar, size, { rot = 0, col = '#3b8cff', fs = 40 } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="-110 -110 220 220" style="overflow:visible;display:block">
    <circle r="106" fill="none" stroke="${col}" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="2 6" transform="rotate(${rot})"/>
    <g transform="rotate(${rot * 0.4})"><polygon points="${STAR}" fill="url(#medFill)" stroke="${col}" stroke-width="2.4" style="filter:drop-shadow(0 0 12px ${col})"/></g>
    <circle r="64" fill="url(#medInner)" stroke="#e8d5b0" stroke-opacity=".65" stroke-width="1.4"/>
    <circle r="57" fill="none" stroke="#e8d5b0" stroke-opacity=".25" stroke-width="1"/>
    <text y="${(fs * 0.3).toFixed(1)}" text-anchor="middle" font-family="Amiri" font-weight="700" font-size="${fs}" fill="#f6eedf" style="filter:drop-shadow(0 0 6px rgba(143,208,255,.6))">${ar}</text></svg>`;
}
function medalAt(cx, cy, size, ar, col, fs, lt, start, name) {
  const { e, o, b } = pop(lt, start, 0.55);
  if (o <= 0) return '';
  const s = lerp(0.3, 1, e);
  return `<div style="position:absolute;left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;opacity:${o};transform:scale(${s}) rotate(${(1 - e) * -40}deg);${fx(b)}">${medal(ar, size, { rot: lt * 18, col, fs })}</div>` +
    (name ? `<div class="medn" style="position:absolute;left:${cx - 200}px;width:400px;text-align:center;top:${cy + size / 2 + 6}px;opacity:${o}">${name}</div>` : '');
}

function book(ar, lt, start, top = 290) {
  const p = pr(lt, start, start + 0.7), e = E.out3(p);
  if (p <= 0) return '';
  const sw = lerp(-200, 640, pr(lt, start + 0.4, start + 1.3));
  return `<div class="book" style="top:${top}px;opacity:${clamp(p * 2)};transform:perspective(1400px) rotateY(${((1 - e) * -40).toFixed(1)}deg) rotateX(${((1 - e) * 12).toFixed(1)}deg) scale(${lerp(0.75, 1, e).toFixed(3)})">
    <svg viewBox="-110 -110 220 220" width="420" height="420" style="position:absolute;left:40px;top:80px;opacity:.16"><polygon points="${STAR}" fill="none" stroke="#e8d5b0" stroke-width="1.5" transform="rotate(${lt * 10})"/><polygon points="${starPts(70, 55)}" fill="none" stroke="#8fd0ff" stroke-width="1" transform="rotate(${-lt * 14})"/></svg>
    <div class="in"><div class="ar" style="font-size:118px;text-shadow:0 0 30px rgba(143,208,255,.7)">${ar}</div>
    <div style="font:600 22px Montserrat;letter-spacing:.4em;color:#c9a46c;margin-top:18px">✦ ✦ ✦</div></div>
    <div class="sweep" style="left:${sw}px"></div></div>`;
}

// ---------- SVG overlay pieces (screen space) ----------
function bez(a, b, bend) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
  return [mx - dy * bend, my + dx * bend];
}
function qpt(a, c, b, t) {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}
function arc(svg, a, b, p, { bend = 0.22, col = '#e8d5b0', w = 3.5, dash = false } = {}) {
  if (p <= 0) return;
  const c = bez(a, b, bend);
  let len = 0, prev = a;
  for (let i = 1; i <= 24; i++) { const q = qpt(a, c, b, i / 24); len += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; }
  const d = `M${a[0]} ${a[1]}Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`;
  const off = len * (1 - p);
  svg.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w * 4}" stroke-opacity=".22" stroke-linecap="round" stroke-dasharray="${len} ${len}" stroke-dashoffset="${off}" filter="url(#glow)"/>`);
  const da = dash ? `stroke-dasharray="10 12" opacity="${clamp(p * 1.5)}"` : `stroke-dasharray="${len} ${len}" stroke-dashoffset="${off}"`;
  svg.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" ${da}/>`);
  if (p < 1) {
    const h = qpt(a, c, b, p);
    svg.push(`<circle cx="${h[0]}" cy="${h[1]}" r="26" fill="url(#dotGlow)"/><circle cx="${h[0]}" cy="${h[1]}" r="6" fill="#fff"/>`);
  } else {
    // arrowhead
    const q = qpt(a, c, b, 0.94), ang = Math.atan2(b[1] - q[1], b[0] - q[0]);
    const s = 16, l = [b[0] - s * Math.cos(ang - 0.5), b[1] - s * Math.sin(ang - 0.5)], r = [b[0] - s * Math.cos(ang + 0.5), b[1] - s * Math.sin(ang + 0.5)];
    svg.push(`<path d="M${l[0]} ${l[1]}L${b[0]} ${b[1]}L${r[0]} ${r[1]}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
}
function dot(svg, x, y, p, lt, col = '#fff6e4') {
  if (p <= 0) return;
  const e = E.outBack(p);
  for (let k = 0; k < 2; k++) {
    const ph = ((lt * 0.9 + k * 0.5) % 1);
    svg.push(`<circle cx="${x}" cy="${y}" r="${(10 + ph * 46) * e}" fill="none" stroke="#8fd0ff" stroke-width="2" stroke-opacity="${(1 - ph) * 0.7 * clamp(p * 2)}"/>`);
  }
  svg.push(`<circle cx="${x}" cy="${y}" r="${40 * e}" fill="url(#dotGlow)" opacity="${clamp(p * 2)}"/>`);
  svg.push(`<circle cx="${x}" cy="${y}" r="${8 * e}" fill="${col}"/>`);
}
function marker(o, pt, label, p, lt, { size = 92, side = 1 } = {}) {
  if (p <= 0) return;
  const [x, y] = pt;
  dot(o.svg, x, y, p, lt);
  const lp = E.out3(pr(p, 0.25, 1));
  const kx = x + side * 46 * lp, ky = y - 46 * lp, ex = kx + side * 60 * lp;
  o.svg.push(`<path d="M${x} ${y}L${kx} ${ky}L${ex} ${ky}" fill="none" stroke="#e8d5b0" stroke-width="2.4" opacity="${lp}"/>`);
  const lx = side > 0 ? ex + 14 : ex - 14;
  o.html.push(`<div class="lbl" style="font-size:${size}px;top:${ky - size * 0.62}px;${side > 0 ? `left:${lx}px` : `right:${W - lx}px`};opacity:${lp};transform:translateX(${(1 - lp) * side * -30}px);${fx((1 - lp) * 8)}">${label}</div>`);
}
function small(o, pt, label, p, { dx = 22, dy = -18, size = 46, anchor = 'left' } = {}) {
  if (p <= 0) return;
  const e = E.out3(p);
  const st = anchor === 'left' ? `left:${pt[0] + dx}px` : `right:${W - pt[0] + dx}px`;
  o.html.push(`<div class="lbl" style="font-size:${size}px;${st};top:${pt[1] + dy - size * 0.6}px;opacity:${e};transform:translateY(${(1 - e) * 16}px)">${label}</div>`);
}

// ---------- scenes ----------
const C = (n) => MAP.cities[n];
const ARN = { hanafi: 'أبو حنيفة', maliki: 'مالك', shafii: 'الشافعي', hanbali: 'أحمد' };
const ARF = { hanafi: 30, maliki: 46, shafii: 36, hanbali: 46 };

// 1. Hook
scene(3.2, { cam: [44, 27.5, 0.95, -4], cam2: [42.5, 26, 1.3, -2] }, (lt, o) => {
  o.html.push('<div class="shade"></div>');
  o.html.push(row(560, `<div class="it" style="font-size:60px">${words('Почему у мусульман', lt, 0.15)}</div>`));
  o.html.push(row(620, slam('4', lt, 0.6, { size: 430, cls: 'gradb', glow: 'rgba(59,140,255,.8)' })));
  o.html.push(row(1065, slam('МАЗХАБА', lt, 0.85, { size: 150 })));
  o.html.push(row(1280, pill('если религия одна?', lt, 1.45)));
});

// 2. Medina
scene(2.8, { cam: [39.6, 22.2, 2.7, 3], cam2: [39.6, 22.4, 3.0, 2] }, (lt, o) => {
  o.html.push(row(200, tag('VII ВЕК', lt, 0.2)));
  marker(o, o.S(C('medina')), 'Медина', pr(lt, 0.35, 0.95), lt, { size: 100 });
  o.html.push(card(1060, 700, 'Пророк Мухаммад ﷺ', 'учит сподвижников Корану и Сунне', lt, 0.85));
  o.html.push(caption('Медина. Отсюда знание начинает свой путь', lt, 1.15, 2.8));
});

// 3. Companions spread
scene(3.0, { cam: [39.5, 27, 1.45, -3], cam2: [39.5, 27, 1.6, -1] }, (lt, o) => {
  o.html.push(row(220, `<div class="ttl" style="font-size:74px">${words('Сподвижники разъехались | по *городам', lt, 0.1)}</div>`));
  const m = o.S(C('medina'));
  dot(o.svg, m[0], m[1], 1, lt);
  small(o, m, 'Медина', 1, { size: 50, dy: 10 });
  const T = [['mecca', 'Мекка', 0.2, 1], ['kufa', 'Куфа', -0.25, 1], ['basra', 'Басра', -0.2, -1], ['damascus', 'Дамаск', -0.25, 1], ['fustat', 'Египет', 0.25, 1]];
  T.forEach(([n, l, bend, side], i) => {
    const s = 0.45 + i * 0.18, p = E.inOut3(pr(lt, s, s + 0.55));
    const b = o.S(C(n));
    arc(o.svg, m, b, p, { bend, w: 3 });
    const q = pr(lt, s + 0.5, s + 0.8);
    dot(o.svg, b[0], b[1], q, lt);
    small(o, b, l, q, side > 0 ? { size: 44 } : { size: 44, anchor: 'right' });
  });
  o.html.push(caption('И вместе с ними по миру разошлось знание', lt, 1.55, 3.0));
});

// 4. What is a madhab
scene(3.0, { dim: true }, (lt, o) => {
  o.html.push('<div class="shade"></div>');
  const p = E.out3(pr(lt, 0.05, 0.6));
  o.html.push(row(400, `<div class="ar" style="font-size:230px;opacity:${p};transform:scale(${lerp(1.3, 1, p)});${fx((1 - p) * 14)}text-shadow:0 0 40px rgba(59,140,255,.9),0 0 90px rgba(59,140,255,.5)">مَذْهَب</div>`));
  o.html.push(row(790, slam('МАЗХАБ', lt, 0.5, { size: 160 })));
  o.html.push(row(985, `<div class="sans acc" style="font-size:52px;font-weight:700">${typed('= «путь»', lt, 1.0, 16)}</div>`));
  o.html.push(card(1110, 900, 'Школа понимания Корана и Сунны', 'как выводить решения: от намаза и поста до торговли и семьи', lt, 1.4, { ts: 50 }));
});

// 5. Four imams
const GRID = [['hanafi', 'Абу Ханифа', 290, 700], ['maliki', 'Малик', 790, 700], ['shafii', 'аш-Шафии', 290, 1160], ['hanbali', 'Ахмад', 790, 1160]];
scene(1.8, { dim: true }, (lt, o) => {
  o.html.push(row(220, `<div class="ttl" style="font-size:88px">${words('4 великих *имама', lt, 0.05)}</div>`));
  GRID.forEach(([k, name, x, y], i) => o.html.push(medalAt(x, y, 360, ARN[k], MAD[k], ARF[k], lt, 0.2 + i * 0.12, name.toUpperCase())));
});

// Chapter intro (city + medal + card)
function intro(o, lt, num, title, city, cityName, k, name, sub, cap) {
  o.html.push(row(200, tag(`${num} · ${title}`, lt, 0.1)));
  marker(o, o.S(C(city)), cityName, pr(lt, 0.35, 0.95), lt, { size: 96 });
  o.html.push(medalAt(540, 990, 250, ARN[k], MAD[k], ARF[k], lt, 0.6));
  o.html.push(card(1140, 760, name, sub, lt, 0.85, { ts: 62 }));
  o.html.push(caption(cap, lt, 1.1, 99));
}
function spread(o, lt, label, title, cap) {
  o.html.push(row(200, tag(label, lt, 0.1)));
  o.html.push(row(275, `<div class="ttl" style="font-size:64px">${words(title, lt, 0.2)}</div>`));
  o.html.push(caption(cap, lt, 0.9, 99));
}

// 6. Abu Hanifa
scene(2.6, { cam: [44.4, 29.2, 3.0, -3], cam2: [44.4, 29.4, 3.3, -1] }, (lt, o) =>
  intro(o, lt, '01', 'ХАНАФИТСКИЙ МАЗХАБ', 'kufa', 'Куфа', 'hanafi', 'Абу Ханифа', 'Нуман ибн Сабит · 699–767', 'Куфа, 699 год. Рождается будущий великий имам'));

const CHAIN = [['Абдуллах ибн Масуд', 'сподвижник Пророка ﷺ'], ['Алькама ан-Нахаи'], ['Ибрахим ан-Нахаи'], ['Хаммад ибн Абу Сулейман'], ['АБУ ХАНИФА']];
scene(3.2, { dim: true }, (lt, o) => {
  o.html.push(row(220, `<div class="ttl" style="font-size:80px">${words('Откуда его *знание?', lt, 0.05)}</div>`));
  const tops = [420, 610, 770, 930, 1110], hs = [118, 88, 88, 88, 112];
  CHAIN.forEach(([n, s], i) => {
    const { e, o: op, b } = pop(lt, 0.25 + i * 0.3, 0.45);
    if (op <= 0) return;
    const main = i === CHAIN.length - 1;
    o.html.push(`<div class="node${main ? ' main' : ''}" style="top:${tops[i]}px;opacity:${op};transform:scale(${lerp(0.6, 1, e)});${fx(b)}"><b>${n}</b>${s ? `<small>${s}</small>` : ''}</div>`);
  });
  for (let i = 0; i < CHAIN.length - 1; i++) {
    const s = 0.45 + i * 0.3, p = E.inOut3(pr(lt, s, s + 0.32));
    const side = i % 2 ? -1 : 1, x = 540 + side * 300;
    const a = [x, tops[i] + hs[i] / 2], b = [x, tops[i + 1] + hs[i + 1] / 2];
    arc(o.svg, a, b, p, { bend: side * 0.9, w: 4, col: '#8fd0ff' });
  }
  o.html.push(caption('Знание передавалось от учителя к ученику — без разрывов', lt, 1.9, 99));
});

scene(2.8, { cam: [62, 37, 0.55, 0], cam2: [62, 37, 0.6, 2], hl: ['hanafi'] }, (lt, o) => {
  spread(o, lt, 'ХАНАФИТЫ', 'Самый распространённый | мазхаб *в *мире', 'Казахстан, Средняя Азия, Турция, Пакистан, Индия');
  o.html.push(row(1270, pill('метод: кыяс и рассуждение (рай)', lt, 0.9)));
});

// 7. Malik
scene(2.6, { cam: [39.6, 21.8, 3.0, 3], cam2: [39.6, 22, 3.3, 1] }, (lt, o) =>
  intro(o, lt, '02', 'МАЛИКИТСКИЙ МАЗХАБ', 'medina', 'Медина', 'maliki', 'Малик ибн Анас', '711–795 · всю жизнь прожил в Медине', 'Его называли «Имамом Дар аль-Хиджры» — имамом Медины'));

function bookScene(o, lt, ar, title, line, cardT, cardS) {
  o.html.push('<div class="shade"></div>');
  o.html.push(book(ar, lt, 0.05));
  o.html.push(row(925, slam(title, lt, 0.45, { size: 92 })));
  o.html.push(row(1045, `<div class="sans" style="font-size:34px;font-weight:500">${words(line, lt, 0.7, { stagger: 0.04 })}</div>`));
  o.html.push(card(1150, 860, cardT, cardS, lt, 1.1, { ts: 46 }));
}
scene(2.6, { dim: true }, (lt, o) => bookScene(o, lt, 'الموطأ', '«Аль-Муватта»', 'один из первых сборников хадисов и фикха', 'Его метод', 'опора на живую практику жителей Медины'));

scene(2.6, { cam: [6, 24, 0.78, -2], cam2: [6, 24, 0.84, 0], hl: ['maliki'] }, (lt, o) =>
  spread(o, lt, 'МАЛИКИТЫ', 'Северная и | *Западная *Африка', 'Марокко, Алжир, Тунис, Ливия, Судан, Мавритания, Мали'));

// 8. Shafii
scene(3.0, { cam: [34.47, 33.5, 3.1, 0], cam2: [34.47, 33.3, 3.4, 2], dimUntil: 1.3 }, (lt, o) => {
  o.html.push(row(200, tag('03 · ШАФИИТСКИЙ МАЗХАБ', lt, 0.05)));
  o.html.push(row(450, `<div class="it" style="font-size:52px">${words('В год, когда умер Абу Ханифа…', lt, 0.1, { stagger: 0.05 })}</div>`));
  o.html.push(row(530, slam('767', lt, 0.45, { size: 300 })));
  o.html.push(row(880, `<div class="ttl" style="font-size:60px">${words('…в Газе родился *аш-Шафии', lt, 1.3)}</div>`));
  marker(o, o.S(C('gaza')), 'Газа', pr(lt, 1.5, 2.0), lt, { size: 80 });
  o.html.push(caption('Мухаммад ибн Идрис аш-Шафии, 767–820', lt, 1.9, 99));
});

const ROUTE = [['gaza', 'Газа'], ['mecca', 'Мекка'], ['medina', 'Медина'], ['baghdad', 'Багдад'], ['fustat', 'Египет']];
const ROUTE_CAP = ['Мекка — с детства учит Коран и арабский язык', 'Медина — ученик имама Малика', 'Ирак — учится у аш-Шайбани, ученика Абу Ханифы', 'Египет — здесь он завершает свою школу'];
scene(4.0, { cam: [37.5, 26.5, 1.5, -2], cam2: [37.5, 26.7, 1.62, 0] }, (lt, o) => {
  o.html.push(row(220, `<div class="ttl" style="font-size:80px">${words('Путь длиной *в *жизнь', lt, 0.05)}</div>`));
  const pts = ROUTE.map(([n]) => o.S(C(n)));
  const sides = [-1, 1, 1, 1, -1];
  dot(o.svg, pts[0][0], pts[0][1], pr(lt, 0.05, 0.4), lt);
  small(o, pts[0], 'Газа', pr(lt, 0.1, 0.4), { size: 44, anchor: 'right' });
  const step = (o.d - 0.9) / 4;
  for (let i = 0; i < 4; i++) {
    const s = 0.3 + i * step, p = E.inOut3(pr(lt, s, s + 0.5));
    arc(o.svg, pts[i], pts[i + 1], p, { bend: i % 2 ? -0.3 : 0.3, w: 3.5, col: '#8fd0ff' });
    const q = pr(lt, s + 0.45, s + 0.75);
    dot(o.svg, pts[i + 1][0], pts[i + 1][1], q, lt);
    small(o, pts[i + 1], ROUTE[i + 1][1], q, sides[i + 1] > 0 ? { size: 44 } : { size: 44, anchor: 'right' });
    o.html.push(caption(ROUTE_CAP[i], lt, s + 0.25, i < 3 ? s + step + 0.25 : 99));
  }
});

scene(2.6, { dim: true }, (lt, o) => bookScene(o, lt, 'الرسالة', '«Ар-Рисаля»', 'первая книга об основах фикха', 'Его метод', 'соединил подходы Медины и Ирака'));

scene(2.8, { cam: [48, 10, 0.62, 0], cam2: [95, 4, 0.5, 0], hl: ['shafii'] }, (lt, o) =>
  spread(o, lt, 'ШАФИИТЫ', 'От Египта | до *Индонезии', 'Египет, Йемен, Сомали, Малайзия, Индонезия, Дагестан'));

// 9. Ahmad
scene(2.6, { cam: [44.36, 30.6, 3.0, -3], cam2: [44.36, 30.8, 3.3, -1] }, (lt, o) =>
  intro(o, lt, '04', 'ХАНБАЛИТСКИЙ МАЗХАБ', 'baghdad', 'Багдад', 'hanbali', 'Ахмад ибн Ханбаль', '780–855 · ученик аш-Шафии', 'Багдад — столица халифата Аббасидов'));

scene(2.4, { dim: true }, (lt, o) => {
  o.html.push('<div class="shade"></div>');
  const p = E.out3(pr(lt, 0, 0.8));
  o.html.push(row(330, `<div class="ar" style="font-size:270px;opacity:${p * 0.22};transform:scale(${lerp(1.2, 1, p)})">المسند</div>`));
  o.html.push(row(540, `<div class="it" style="font-size:54px">${words('в его «Муснаде» около', lt, 0.1)}</div>`));
  const n = Math.round(E.out3(pr(lt, 0.35, 1.4)) * 300) * 100;
  const cp = pr(lt, 0.3, 0.5);
  if (cp > 0) o.html.push(row(640, `<div class="gradb" style="font-size:230px;opacity:${cp};filter:drop-shadow(0 0 30px rgba(59,140,255,.8))">${n.toLocaleString('ru-RU')}</div>`));
  o.html.push(row(900, slam('ХАДИСОВ', lt, 1.1, { size: 120 })));
  o.html.push(caption('Один из крупнейших сборников хадисов в истории', lt, 1.3, 99));
});

scene(2.6, { dim: true }, (lt, o) => {
  o.html.push('<div class="shade"></div>');
  for (let i = 0; i < 7; i++) {
    const p = E.out3(pr(lt, i * 0.04, 0.45 + i * 0.04));
    o.html.push(`<div style="position:absolute;top:0;left:${60 + i * 160}px;width:16px;height:1920px;background:linear-gradient(90deg,#0c1834,#2a3f6a,#0c1834);opacity:${0.55 * p};transform:translateY(${(1 - p) * -1920}px)"></div>`);
  }
  o.html.push(row(560, `<div class="ttl" style="font-size:78px">${words('Его пытались *сломать', lt, 0.25)}</div>`));
  o.html.push(row(720, slam('Он не отступил', lt, 0.9, { size: 112, cls: 'gradb', glow: 'rgba(59,140,255,.8)' })));
  o.html.push(card(930, 900, 'Михна', 'учёных заставляли отказаться от своих убеждений. Тюрьма и плеть не изменили его слов', lt, 1.3, { ts: 54 }));
});

scene(2.2, { cam: [47.5, 23.5, 1.45, 2], cam2: [47.5, 23.5, 1.6, 0], hl: ['hanbali'] }, (lt, o) =>
  spread(o, lt, 'ХАНБАЛИТЫ', 'Аравийский | *полуостров', 'Саудовская Аравия и Катар'));

// 10. Connections
const NET = { hanafi: [260, 640], maliki: [820, 640], shafii: [540, 1010], hanbali: [540, 1390] };
scene(4.4, { dim: true }, (lt, o) => {
  o.html.push(row(200, `<div class="ttl" style="font-size:70px">${words('Они не были *соперниками', lt, 0.1)}</div>`));
  o.html.push(row(300, `<div class="sans" style="font-size:40px;color:#cfe3ff">${words('они были учителями и учениками', lt, 1.0, { stagger: 0.05 })}</div>`));
  const names = { hanafi: 'АБУ ХАНИФА', maliki: 'МАЛИК', shafii: 'АШ-ШАФИИ', hanbali: 'АХМАД' };
  Object.entries(NET).forEach(([k, [x, y]], i) => o.html.push(medalAt(x, y, 220, ARN[k], MAD[k], ARF[k], lt, 0.3 + i * 0.15, names[k])));
  const edge = (a, b, ra, rb) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); const ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d; return [[a[0] + ux * ra, a[1] + uy * ra], [b[0] - ux * rb, b[1] - uy * rb]]; };
  const links = [['maliki', 'shafii', 1.4, 'учитель', false, -0.18], ['hanafi', 'shafii', 1.9, 'через аш-Шайбани', true, 0.18], ['shafii', 'hanbali', 2.4, 'учитель', false, 0]];
  links.forEach(([f, to, s, lab, dash, bend]) => {
    s *= o.d / 4.4;
    const [a, b] = edge(NET[f], NET[to], 150, 135);
    const p = E.inOut3(pr(lt, s, s + 0.5));
    arc(o.svg, a, b, p, { bend, col: dash ? '#e8d5b0' : '#8fd0ff', w: 3.5, dash });
    const q = E.out3(pr(lt, s + 0.3, s + 0.6));
    if (q > 0) {
      const m = qpt(a, bez(a, b, bend), b, 0.5);
      const left = f === 'shafii' ? m[0] + 30 : f === 'hanafi' ? m[0] - 330 : m[0] + 20;
      o.html.push(`<div class="sans" style="position:absolute;left:${left}px;top:${m[1] - 22}px;font-size:28px;width:${f === 'hanafi' ? 300 : 220}px;white-space:nowrap;text-align:${f === 'hanafi' ? 'right' : 'left'};color:${dash ? '#e8d5b0' : '#8fd0ff'};opacity:${q}">${lab}</div>`);
    }
  });
});

// 11. All four on the map
const LEG = [['hanafi', 'Ханафиты'], ['maliki', 'Маликиты'], ['shafii', 'Шафииты'], ['hanbali', 'Ханбалиты']];
scene(4.0, { cam: [51.5, 17, 0.25, 0], cam2: [51.5, 17, 0.272, 0], hl: ['hanafi', 'maliki', 'shafii', 'hanbali'] }, (lt, o) => {
  o.html.push(row(220, `<div class="ttl" style="font-size:62px">${words('Сегодня почти все сунниты | следуют *одному *из *четырёх', lt, 0.1, { stagger: 0.05 })}</div>`));
  LEG.forEach(([k, n], i) => {
    const { e, o: op } = pop(lt, 0.7 + i * 0.15, 0.45);
    if (op <= 0) return;
    const x = i % 2 ? 580 : 150, y = 1300 + Math.floor(i / 2) * 90;
    o.html.push(`<div class="sans" style="position:absolute;left:${x}px;top:${y}px;font-size:40px;font-weight:700;opacity:${op};transform:translateY(${(1 - e) * 20}px);display:flex;align-items:center;gap:20px">
      <span style="width:30px;height:30px;border-radius:50%;background:${MAD[k]};box-shadow:0 0 18px ${MAD[k]}"></span>${n}</div>`);
  });
});

// 12. Finale
scene(6.0, { dim: true, final: true }, (lt, o) => {
  const p = E.out3(pr(lt, 0.2, 1.0));
  o.html.push(`<div style="position:absolute;left:${540 - 330}px;top:${980 - 330}px;width:660px;height:660px;border-radius:50%;opacity:${p};transform:scale(${lerp(0.5, 1, p) * (1 + Math.sin(lt * 2) * 0.02)});background:radial-gradient(circle,rgba(143,208,255,.42),rgba(59,140,255,.16) 45%,transparent 70%)"></div>`);
  o.html.push(row(880, `<div class="ar" style="font-size:86px;opacity:${p};text-shadow:0 0 30px rgba(143,208,255,.9)">القرآن والسنة</div>`));
  o.html.push(row(1015, `<div class="sans" style="font-size:30px;letter-spacing:.3em;font-weight:700;opacity:${p}">КОРАН И СУННА</div>`));
  ['hanafi', 'maliki', 'shafii', 'hanbali'].forEach((k, i) => {
    const ang = ((i * 90 - 45 + lt * 14) * Math.PI) / 180;
    o.html.push(medalAt(540 + Math.cos(ang) * 340, 980 + Math.sin(ang) * 340, 170, ARN[k], MAD[k], ARF[k], lt, 0.5 + i * 0.12));
  });
  o.html.push(row(190, slam('Четыре пути', lt, 0.9, { size: 104 })));
  o.html.push(row(320, `<div class="ttl" style="font-size:70px">${words('— один *источник', lt, 1.4)}</div>`));
  o.html.push(row(1470, pill('Сохрани и отправь тому, кто спрашивал', lt, 2.6)));
});

const DUR = T;

// ---------- camera ----------
const KF = [];
{
  let last = null;
  for (const s of SCENES) {
    if (s.cam) {
      const a = proj(s.cam[0], s.cam[1]), b = proj(s.cam2[0], s.cam2[1]);
      const A = { x: a[0], y: a[1], z: s.cam[2], r: s.cam[3] }, B = { x: b[0], y: b[1], z: s.cam2[2], r: s.cam2[3] };
      if (!KF.length) KF.push({ t: 0, ...A }); else KF.push({ t: s.a + 0.6, ...A });
      KF.push({ t: s.b, ...B });
      last = B;
    } else {
      KF.push({ t: s.a + 0.01, ...last });
      KF.push({ t: s.b, ...last, z: last.z * 1.06 });
      last = { ...last, z: last.z * 1.06 };
    }
  }
}
function camAt(t) {
  if (t <= KF[0].t) return KF[0];
  for (let i = 0; i < KF.length - 1; i++) {
    const a = KF[i], b = KF[i + 1];
    if (t <= b.t) {
      const d = b.t - a.t, p = pr(t, a.t, b.t), e = d <= 0.65 ? E.inOut3(p) : E.sine(p);
      return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), e)), r: lerp(a.r, b.r, e) };
    }
  }
  return KF[KF.length - 1];
}
function toScreen(pt, c) {
  const dx = (pt[0] - c.x) * c.z, dy = (pt[1] - c.y) * c.z, a = (c.r * Math.PI) / 180;
  return [W / 2 + dx * Math.cos(a) - dy * Math.sin(a), H / 2 + dx * Math.sin(a) + dy * Math.cos(a)];
}

// ---------- map dimming & highlights ----------
const DIMS = [];
for (const s of SCENES) {
  const iv = s.dim ? [s.a, s.b] : s.dimUntil ? [s.a, s.a + s.dimUntil] : null;
  if (!iv) continue;
  const prev = DIMS[DIMS.length - 1];
  if (prev && Math.abs(prev[1] - iv[0]) < 0.01) prev[1] = iv[1]; else DIMS.push(iv);
}
function dimAt(t) {
  let d = 0;
  for (const [a, b] of DIMS) d = Math.max(d, Math.min(E.sine(pr(t, a - 0.1, a + 0.3)), 1 - E.sine(pr(t, b - 0.15, b + 0.2))));
  return d;
}
function hlAt(id, t) {
  let v = 0, col = null;
  for (const s of SCENES) {
    if (!s.hl) continue;
    for (const k of s.hl) {
      const i = IDS[k].indexOf(id);
      if (i < 0) continue;
      const st = s.a + 0.35 + i * 0.07 + s.hl.indexOf(k) * 0.15;
      const a = Math.min(E.out3(pr(t, st, st + 0.4)), 1 - pr(t, s.b, s.b + 0.3));
      if (a > v) { v = a; col = MAD[k]; }
    }
  }
  return [v, col];
}

// ---------- build static DOM ----------
const $ = (id) => document.getElementById(id);
const shapeById = Object.fromEntries(MAP.shapes.map((s) => [s.id, s.d]));
const HL_IDS = [...new Set(Object.values(IDS).flat())].filter((id) => shapeById[id]);
const lightPath = (lo, hi) => MAP.lights.filter((l) => l[2] >= lo && l[2] < hi).map(([x, y]) => `M${x} ${y}h0`).join('');
$('cam').innerHTML =
  `<g id="countries">${MAP.shapes.map((s) => `<path d="${s.d}"/>`).join('')}</g>` +
  `<g id="hl" style="filter:drop-shadow(0 0 10px rgba(143,208,255,.55))">${HL_IDS.map((id) => `<path data-id="${id}" d="${shapeById[id]}"/>`).join('')}</g>` +
  `<path class="lt" d="${lightPath(0, 2)}" stroke="#e8c98f" stroke-opacity=".07" stroke-width="11"/>` +
  `<path class="lt" d="${lightPath(0, 0.35)}" stroke="#f3e2c0" stroke-opacity=".35" stroke-width="2"/>` +
  `<path class="lt" d="${lightPath(0.35, 0.7)}" stroke="#f6e8cc" stroke-opacity=".6" stroke-width="2.6"/>` +
  `<path class="lt" d="${lightPath(0.7, 2)}" stroke="#fff7e6" stroke-opacity=".95" stroke-width="3.2"/>` +
  `<g id="labels">${MAP.labels.map((l) => `<text x="${l.p[0]}" y="${l.p[1]}" font-size="${l.s}">${l.t}</text>`).join('')}</g>`;
const hlEls = [...document.querySelectorAll('#hl path')];

const PARTS = Array.from({ length: 44 }, () => ({ x: rnd(), y: rnd(), s: 3 + rnd() * rnd() * 22, sp: 0.01 + rnd() * 0.03, ph: rnd() * 6.28, blue: rnd() < 0.55, a: 0.25 + rnd() * 0.55 }));
const CUTS = SCENES.slice(1).map((s) => s.a);

// ---------- frame ----------
window.renderFrame = (frame) => {
  const t = frame / FPS;
  const cam = camAt(t), prev = camAt(Math.max(0, t - 1 / FPS));
  const speed = Math.hypot((cam.x - prev.x) * cam.z, (cam.y - prev.y) * cam.z) + Math.abs(Math.log(cam.z / prev.z)) * 900;
  const dim = dimAt(t);
  const fin = SCENES[SCENES.length - 1];
  const finDim = pr(t, fin.a, fin.a + 0.5);

  $('cam').setAttribute('transform', `translate(${W / 2} ${H / 2}) rotate(${cam.r}) scale(${cam.z}) translate(${-cam.x} ${-cam.y})`);
  const mb = Math.min(12, speed * 0.05) + dim * 5;
  const mapEl = $('map');
  mapEl.style.opacity = (clamp(t / 0.5) * lerp(1, 0.22, dim) * lerp(1, 0.4, finDim)).toFixed(3);
  mapEl.style.filter = mb > 0.2 ? `blur(${mb.toFixed(1)}px)` : '';
  $('labels').style.opacity = clamp((cam.z - 0.45) / 0.35).toFixed(3);
  for (const el of hlEls) {
    const [v, col] = hlAt(el.dataset.id, t);
    if (v <= 0.001) { el.style.fill = 'transparent'; el.style.stroke = 'transparent'; continue; }
    el.style.fill = col; el.style.fillOpacity = (v * (col === MAD.hanafi || col === MAD.shafii ? 0.42 : 0.5)).toFixed(3);
    el.style.stroke = col; el.style.strokeOpacity = v.toFixed(3);
  }

  $('patRect').setAttribute('transform', `rotate(${t * 2} 540 960) translate(${t * 6} ${t * -10})`);
  $('pattern').style.opacity = (0.35 + dim * 0.65).toFixed(3);

  // particles
  $('parts').innerHTML = PARTS.map((q) => {
    const x = q.x * W + Math.sin(t * 0.5 + q.ph) * 40;
    const y = (((q.y * H - t * q.sp * H) % H) + H) % H;
    const c = q.blue ? '143,208,255' : '232,213,176';
    const a = q.a * (0.6 + 0.4 * Math.sin(t * 1.3 + q.ph));
    return `<div class="pt" style="left:${x - q.s}px;top:${y - q.s}px;width:${q.s * 2}px;height:${q.s * 2}px;background:radial-gradient(circle,rgba(${c},${a}) 0%,rgba(${c},0) 70%)${q.s > 14 ? ';filter:blur(3px)' : ''}"></div>`;
  }).join('');

  // overlay scenes
  let out = '';
  for (const s of SCENES) {
    if (t < s.a || t >= s.b) continue;
    const lt = t - s.a;
    const o = { svg: [], html: [], d: s.d, S: (pt) => toScreen(pt, cam) };
    s.f(lt, o);
    const ein = E.out3(pr(t, s.a, s.a + 0.28)), eout = pr(t, s.b - 0.2, s.b);
    const op = ein * (1 - eout), sc = lerp(1.07, 1, ein) * lerp(1, 1.05, eout), bl = (1 - ein) * 10 + eout * 8;
    const st = (op < 0.999 ? `opacity:${op.toFixed(3)};` : '') + (bl > 0.1 ? `filter:blur(${bl.toFixed(1)}px);` : '') + (Math.abs(sc - 1) > 0.001 ? `transform:scale(${sc.toFixed(4)})` : '');
    out += `<div class="layer" style="${st}"><svg class="ovs" width="${W}" height="${H}">${o.svg.join('')}</svg>${o.html.join('')}</div>`;
  }
  $('ov').innerHTML = out;

  let fl = 0;
  for (const c of CUTS) fl = Math.max(fl, Math.exp(-Math.pow((t - c) / 0.09, 2)));
  $('flash').style.opacity = (fl * 0.42).toFixed(3);
  $('black').style.opacity = Math.max(1 - pr(t, 0, 0.3), pr(t, DUR - 0.6, DUR)).toFixed(3);
};

window.DURATION = DUR;
window.TIMELINE = SCENES.map((s) => ({ a: s.a, voice: s.voice, lead: VOICE_LEAD }));
window.FPS = FPS;
window.ready = (async () => {
  const fams = ['900 40px "Playfair Display"', '800 40px "Playfair Display"', '700 40px "Playfair Display"', '600 40px "Playfair Display"', 'italic 500 40px "Playfair Display"',
    '400 40px Montserrat', '500 40px Montserrat', '600 40px Montserrat', '700 40px Montserrat', '400 40px Amiri', '700 40px Amiri'];
  await Promise.all(fams.flatMap((f) => [document.fonts.load(f, 'АБВабв'), document.fonts.load(f, 'ABC123'), document.fonts.load(f, 'أبو حنيفة ﷺ')]));
  await document.fonts.ready;
  return true;
})();
