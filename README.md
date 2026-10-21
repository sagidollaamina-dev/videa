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

## Озвучка

Текст озвучки лежит в `voice/script.txt`: одна строка на одну сцену, по порядку. Голос: Piper, `ru-irinia-medium`
(скачивается с https://github.com/rhasspy/piper/releases/tag/v0.0.2).

```bash
python3 -m venv tts && tts/bin/pip install piper-tts
i=0; while IFS= read -r line; do i=$((i+1)); echo "$line" | tts/bin/piper -m ru-irinia-medium.onnx \
  --length-scale 0.88 --sentence-silence 0.12 -f voice/l$(printf %02d $i).wav; done < voice/script.txt
# длительности строк -> src/voice.js (сцены растягиваются под голос)
D=$(for f in voice/l*.wav; do printf "%s," $(ffprobe -v error -show_entries format=duration -of csv=p=0 $f); done)
echo "window.VOICE = [${D%,}];" > src/voice.js
node render.mjs
```
