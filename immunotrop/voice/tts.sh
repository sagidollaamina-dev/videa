#!/usr/bin/env bash
# Synthesizes voice/sNN.wav (one per line of script.tsv: scene<TAB>text) and writes src/voice.js.
# Usage: PIPER=path/to/piper MODEL=path/to/kk-issai-high.onnx bash voice/tts.sh   (run from immunotrop/)
set -euo pipefail
SPK=${SPK:-1}; LS=${LS:-0.98}
i=0
while IFS=$'\t' read -r scene text; do
  i=$((i+1)); n=$(printf %02d $i)
  # pronunciation fixes for abbreviations (screen text keeps the originals)
  say=$(printf '%s' "$text" | sed -e 's/Т-лимфоцит/Тэ-лимфоцит/g; s/В-лимфоцит/Вэ-лимфоцит/g' \
    -e 's/АИТВ/А-И-Тэ-Вэ/g; s/ПТР/Пэ-Тэ-Эр/g; s/IgM/иммуноглобулин эм/g; s/IgG/иммуноглобулин жэ/g' \
    -e 's/ДНҚ-сын/Дэ-Эн-Қа-сын/g; s/РНҚ-сын/Эр-Эн-Қа-сын/g')
  echo "$say" | "$PIPER" -m "$MODEL" -s "$SPK" --length-scale "$LS" -f voice/s$n.wav 2>/dev/null
done < voice/script.tsv
python3 - <<'PY'
import json, subprocess
rows = [l.rstrip('\n').split('\t') for l in open('voice/script.tsv', encoding='utf8') if l.strip()]
out = []
for i, (sc, txt) in enumerate(rows, 1):
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f'voice/s{i:02d}.wav']))
    out.append([int(sc), round(d, 3), txt])
open('src/voice.js', 'w', encoding='utf8').write('// generated from voice/script.tsv + voice/sNN.wav: [scene, seconds, text]\nwindow.VOICE = ' + json.dumps(out, ensure_ascii=False) + ';\n')
PY
echo "src/voice.js updated"
