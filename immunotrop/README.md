# Иммунотропты вирустар — 2.5D медицинская анимация

Видео 1920×1080, 24 fps, ≈4:01, казахская озвучка (Piper, голос ISSAI M1). Сценарий и раскадровка — `storyboard.html`.

- `voice/script.tsv` — текст озвучки: `номер сцены<TAB>фраза`, одна фраза на строку
- `voice/tts.sh` — синтез `voice/sNN.wav` и `src/voice.js` (длительности фраз задают длительности сцен)
- `src/main.js` — все 14 сцен; каждая анимация привязана ко времени слов в озвучке (`wt(сцена, фраза, 'слово')`)
- `render.mjs` — рендер кадров в Chromium, сборка MP4, микс голоса, фонового эмбиента и «вжухов» на переходах

```bash
npm install                               # в корне репозитория (шрифты, playwright-core)
python3 -m venv tts && tts/bin/pip install piper-tts
curl -LO https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-kk-issai-high.tar.gz && tar xzf voice-kk-issai-high.tar.gz
cd immunotrop
PIPER=../tts/bin/piper MODEL=../kk-issai-high.onnx bash voice/tts.sh   # SPK=1 — мужской голос, LS — темп
node render.mjs --stills 5,30,100          # пробные кадры в out/
node render.mjs                            # out/immunotrop.mp4
```
