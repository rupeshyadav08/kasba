# Cinematic sound for finished AI cinema clips (separate worldwide channel, not Kasba news).
# MMAudio (MIT) watches each clip and makes matching sound effects; MusicGen (CC-BY-NC weights,
# fine for a test, swap before monetising) makes an epic music bed for the whole video.
#   modal run gpu/sound.py --clips clips/ --plan cinema/giant-tortoise.sound.json --out sound/
# plan: {"clips": ["sound prompt for clip 1", ...], "music": "music prompt", "seconds": 20}
import glob
import json
import os

import modal

app = modal.App("ai-cinema-sound")
cache = modal.Volume.from_name("ai-cinema-sound-weights", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg")
    .run_commands(
        "pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu124",
        # Pin torch so MMAudio's loose "torch>=2.5.1" doesn't pull a newer torch that breaks torchaudio.
        "printf 'torch==2.5.1\\ntorchvision==0.20.1\\ntorchaudio==2.5.1\\n' > /tmp/pin.txt",
        "git clone https://github.com/hkchengrex/MMAudio /mmaudio && cd /mmaudio && "
        "pip install -e . -c /tmp/pin.txt --extra-index-url https://download.pytorch.org/whl/cu124",
        "pip install transformers==4.46.3 scipy -c /tmp/pin.txt --extra-index-url https://download.pytorch.org/whl/cu124",
    )
    .env({"HF_HOME": "/cache/hf"})
)


@app.function(image=image, gpu="L40S", volumes={"/cache": cache}, timeout=3600)
def make(clips: list[bytes], prompts: list[str], music_prompt: str, seconds: float, seed: int) -> dict:
    import subprocess

    # MMAudio keeps its weights under ./weights and ./ext_weights; keep them in the volume.
    for d in ("weights", "ext_weights"):
        os.makedirs(f"/cache/{d}", exist_ok=True)
        if not os.path.islink(f"/mmaudio/{d}"):
            subprocess.run(["rm", "-rf", f"/mmaudio/{d}"])
            os.symlink(f"/cache/{d}", f"/mmaudio/{d}")

    out = {}
    for i, (clip, prompt) in enumerate(zip(clips, prompts)):
        os.makedirs("/work/out", exist_ok=True)
        for f in glob.glob("/work/out/*"):
            os.remove(f)
        open(f"/work/clip{i}.mp4", "wb").write(clip)
        subprocess.run(
            ["python", "demo.py", "--video", f"/work/clip{i}.mp4", "--prompt", prompt,
             "--negative_prompt", "speech, talking, voice, music, singing",
             "--duration", "5", "--seed", str(seed + i), "--output", "/work/out"],
            cwd="/mmaudio", check=True)
        flac = glob.glob("/work/out/*.flac")[0]
        out[f"sfx{i + 1:02d}.flac"] = open(flac, "rb").read()
        print("sound for clip", i + 1, "done")

    import scipy.io.wavfile
    import torch
    from transformers import AutoProcessor, MusicgenForConditionalGeneration

    proc = AutoProcessor.from_pretrained("facebook/musicgen-medium")
    model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-medium").to("cuda")
    torch.manual_seed(seed)
    inputs = proc(text=[music_prompt], padding=True, return_tensors="pt").to("cuda")
    audio = model.generate(**inputs, do_sample=True, guidance_scale=3.5, max_new_tokens=int(seconds * 50))
    rate = model.config.audio_encoder.sampling_rate
    scipy.io.wavfile.write("/work/music.wav", rate, audio[0, 0].float().cpu().numpy())
    out["music.wav"] = open("/work/music.wav", "rb").read()
    cache.commit()
    return out


@app.local_entrypoint()
def main(clips: str, plan: str, out: str = "sound/", seed: int = 7):
    p = json.load(open(plan))
    files = sorted(glob.glob(f"{clips}*.mp4"))
    result = make.remote([open(f, "rb").read() for f in files], p["clips"], p["music"], p.get("seconds", 20), seed)
    os.makedirs(out, exist_ok=True)
    for name, data in result.items():
        open(f"{out}{name}", "wb").write(data)
        print("saved", f"{out}{name}")


@app.function(image=image, gpu="L40S", volumes={"/cache": cache}, timeout=3600)
def music(cues: list[dict], seed: int) -> dict:
    """Music cues only (no clips): [{"id": "m1", "prompt": "...", "seconds": 30}, ...] -> {"m1.wav": bytes}."""
    import io

    import scipy.io.wavfile
    import torch
    from transformers import AutoProcessor, MusicgenForConditionalGeneration

    proc = AutoProcessor.from_pretrained("facebook/musicgen-medium")
    model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-medium").to("cuda")
    rate = model.config.audio_encoder.sampling_rate
    out = {}
    for i, cue in enumerate(cues):
        torch.manual_seed(seed + i)
        inputs = proc(text=[cue["prompt"]], padding=True, return_tensors="pt").to("cuda")
        audio = model.generate(**inputs, do_sample=True, guidance_scale=3.5,
                               max_new_tokens=int(min(cue.get("seconds", 30), 30) * 50))
        buf = io.BytesIO()
        scipy.io.wavfile.write(buf, rate, audio[0, 0].float().cpu().numpy())
        out[f"{cue['id']}.wav"] = buf.getvalue()
        print("music cue", cue["id"], "done")
    cache.commit()
    return out


@app.local_entrypoint()
def music_main(plan: str, out: str = "audio/", seed: int = 7):
    # modal run gpu/sound.py::music_main --plan cinema/mira-ep1.audio.json --out audio/
    result = music.remote(json.load(open(plan))["music"], seed)
    os.makedirs(out, exist_ok=True)
    for name, data in result.items():
        open(f"{out}{name}", "wb").write(data)
        print("saved", f"{out}{name}")
