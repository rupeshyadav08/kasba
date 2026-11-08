"""Narrator lines for an AI cinema episode with Kokoro-82M (Apache-2.0, runs on CPU).
Usage: python scripts/cinema-narrate.py cinema/<name>.audio.json audio/
Writes audio/<voice>/<line id>.wav (24 kHz) for every voice in the plan, so the editor can pick one."""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro import KPipeline

plan = json.load(open(sys.argv[1]))
out = sys.argv[2]
pipes = {}
for voice in plan["voices"]:
    lang = voice[0]  # 'a' American, 'b' British
    pipes.setdefault(lang, KPipeline(lang_code=lang))
    os.makedirs(f"{out}{voice}", exist_ok=True)
    for line in plan["narration"]:
        parts = [a for _, _, a in pipes[lang](line["text"], voice=voice, speed=plan.get("speed", 0.92))]
        sf.write(f"{out}{voice}/{line['id']}.wav", np.concatenate(parts), 24000)
        print(voice, line["id"], "done")
