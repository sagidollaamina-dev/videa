# 4 мазхаба — моушн-видео

Вертикальное видео 1080×1920, 30 fps, ~67 с. Сине-бежевая палитра.

- `src/main.js` — все сцены, тексты и тайминги (каждая сцена — блок `scene(длительность, {...}, ...)`)
- `src/index.html` — стили и шрифты
- `build-map.mjs` — генерирует карту `src/map-data.js`
- `render.mjs` — рендер кадров в Chromium и сборка MP4 через ffmpeg

```bash
npm install
node build-map.mjs            # один раз
node render.mjs --stills 2,15 # пробные кадры в out/
node render.mjs               # готовое видео: out/madhab.mp4
```
