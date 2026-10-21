// Builds src/map-data.js: projected country paths, city coords and "night lights" for the video map.
import fs from 'node:fs';
import { geoMercator, geoPath, geoContains, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';

const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json', 'utf8'));
const countries = feature(topo, topo.objects.countries).features;

export const projection = geoMercator().center([45, 25]).scale(1800).translate([0, 0]);
const path = geoPath(projection).digits(1);

const inView = (f) => {
  const [lon, lat] = geoCentroid(f);
  return lon > -35 && lon < 155 && lat > -20 && lat < 70;
};

const shapes = countries.filter(inView).map((f) => ({ id: f.id || f.properties.name, d: path(f) }));

const P = (lon, lat) => projection([lon, lat]).map((v) => Math.round(v * 10) / 10);

const cities = {
  medina: P(39.61, 24.47), mecca: P(39.83, 21.42), kufa: P(44.4, 32.03), basra: P(47.8, 30.5),
  baghdad: P(44.36, 33.31), damascus: P(36.29, 33.51), fustat: P(31.23, 30.0), gaza: P(34.47, 31.5),
};

// Night lights: clusters around big cities + sparse scatter over land
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const hubs = [
  [39.61,24.47,1.2],[39.83,21.42,1.3],[39.2,21.5,1.2],[46.7,24.7,1.6],[50.1,26.3,1],[51.5,25.3,0.8],[55.3,25.2,1.2],[58.4,23.6,0.8],
  [44.36,33.31,1.6],[44.4,32.0,0.8],[47.8,30.5,1],[48,29.4,1],[36.29,33.51,1.1],[37.2,36.2,1],[35.5,33.9,0.8],[35.9,31.95,0.9],[34.8,32,0.9],
  [31.23,30.05,2],[29.9,31.2,1.2],[32.6,25.7,0.6],[31.3,27.2,0.6],[32.5,15.6,1],[44.2,15.35,1],[45,12.8,0.7],[45.3,2.05,0.8],[38.7,9,1],
  [28.97,41.0,1.8],[32.85,39.93,1.2],[27.1,38.4,1],[35.3,37,0.9],[51.4,35.7,1.8],[59.6,36.3,1],[51.7,32.6,1],[52.5,29.6,0.9],[46.3,38.1,0.9],
  [67,24.86,1.6],[74.3,31.5,1.4],[73,33.7,1],[71.5,34,0.9],[69.2,34.5,0.9],[77.2,28.6,2],[72.9,19.1,1.8],[78.5,17.4,1.3],[80.3,13.1,1.3],[88.4,22.6,1.6],[90.4,23.8,1.8],
  [69.24,41.3,1.2],[66.96,39.65,0.8],[64.4,39.8,0.6],[76.9,43.24,1.2],[71.4,51.17,1],[74.6,42.9,0.8],[68.8,38.55,0.8],[58.4,37.95,0.7],[49.9,40.4,1],[44.8,41.7,0.8],
  [47.5,43,0.7],[45.7,43.3,0.6],[49.1,55.8,0.9],[37.6,55.75,1.6],
  [106.8,-6.2,1.8],[112.75,-7.25,1.2],[110.4,-7,1],[98.7,3.6,1],[101.7,3.15,1.3],[103.8,1.35,0.9],[100.5,13.75,1.4],
  [-7.6,33.6,1.3],[-6.85,34,1],[-5,34,0.8],[-8,31.6,0.9],[3.06,36.75,1.3],[-0.6,35.7,0.9],[10.18,36.8,1.1],[13.2,32.9,0.9],[20.1,32.1,0.7],
  [-17.45,14.7,1],[-8,12.65,0.8],[-1.5,12.4,0.7],[2.1,13.5,0.7],[7.5,12,1],[3.4,6.5,1.4],[15,12.1,0.6],[-15.98,18.08,0.6],
];
const lights = [];
for (const [lon, lat, w] of hubs) {
  const n = Math.round(30 * w);
  for (let i = 0; i < n; i++) {
    const r = 0.35 * w;
    const p = P(lon + gauss() * r, lat + gauss() * r * 0.8);
    lights.push([p[0], p[1], Math.round((0.4 + rnd() * 0.6) * 100) / 100]);
  }
}
const land = countries.filter(inView);
let tries = 0;
while (lights.length < 4200 && tries < 60000) {
  tries++;
  const lon = -20 + rnd() * 160, lat = -10 + rnd() * 65;
  if (land.some((f) => geoContains(f, [lon, lat]))) {
    const p = P(lon, lat);
    lights.push([p[0], p[1], Math.round((0.15 + rnd() * 0.4) * 100) / 100]);
  }
}

const labels = [
  ['АРАВИЙСКИЙ ПОЛУОСТРОВ', 45, 21.5, 26], ['ИРАК', 43.5, 33.8, 20], ['СИРИЯ', 38.5, 35.2, 16], ['ИРАН', 54, 32.5, 24],
  ['ЕГИПЕТ', 29.5, 26.5, 22], ['ТУРЦИЯ', 34, 39, 22], ['ЙЕМЕН', 47, 15.6, 16], ['КРАСНОЕ МОРЕ', 37.6, 20.5, 11],
  ['ПЕРСИДСКИЙ ЗАЛИВ', 51.5, 27.2, 10], ['КАЗАХСТАН', 67, 48, 30], ['УЗБЕКИСТАН', 63.5, 41.6, 16], ['ПАКИСТАН', 69.5, 29, 22],
  ['ИНДИЯ', 79, 22, 30], ['АФГАНИСТАН', 66, 33.8, 16], ['МАРОККО', -6.5, 31.5, 18], ['АЛЖИР', 2.5, 28, 26], ['ЛИВИЯ', 17.5, 27, 24],
  ['ТУНИС', 9.5, 34.2, 11], ['МАВРИТАНИЯ', -10.5, 20.5, 16], ['МАЛИ', -2.5, 17.5, 16], ['СОМАЛИ', 46, 6, 16], ['СУДАН', 30, 16, 20],
  ['ИНДОНЕЗИЯ', 114, -2.5, 30], ['МАЛАЙЗИЯ', 102, 4.5, 16], ['САУДОВСКАЯ АРАВИЯ', 45, 24, 0], ['КАТАР', 51.2, 25.4, 0],
].map(([t, lon, lat, s]) => ({ t, p: P(lon, lat), s })).filter((l) => l.s > 0);

const out = `window.MAP = ${JSON.stringify({ shapes, cities, lights, labels })};
window.PROJ = ${JSON.stringify({ center: [45, 25], scale: 1800 })};
`;
fs.mkdirSync('src', { recursive: true });
fs.writeFileSync('src/map-data.js', out);
console.log('shapes', shapes.length, 'lights', lights.length, 'bytes', out.length, cities);
