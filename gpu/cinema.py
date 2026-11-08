# Wordless AI cinema clips for the separate worldwide channel (not Kasba news): Wan 2.2 T2V-A14B
# (Apache-2.0) on a Modal GPU makes one 5-second vertical shot per prompt; shots run in parallel.
#   modal run gpu/cinema.py --shots shots.json --out clips/
# shots.json: ["prompt for shot 1", "prompt for shot 2", ...]. The ~120 GB weights are downloaded
# once into a Modal volume by a CPU function. Paid from Modal's free monthly credit.
import json
import os

import modal

app = modal.App("ai-cinema")
weights = modal.Volume.from_name("ai-cinema-weights", create_if_missing=True)
CKPT = "/weights/Wan2.2-T2V-A14B"

image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "ffmpeg", "libgl1", "libglib2.0-0")
    .run_commands(
        "pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu124",
        "git clone https://github.com/Wan-Video/Wan2.2 /wan",
        "cd /wan && grep -v flash_attn requirements.txt > /tmp/req.txt && pip install -r /tmp/req.txt",
        "pip install packaging ninja && pip install flash-attn==2.7.4.post1 --no-build-isolation",
        "pip install 'huggingface_hub[cli]'",
    )
)

STYLE = ("Photorealistic cinematic film still in motion, epic scale, volumetric light, dramatic clouds, "
         "shallow depth of field, rich colour grading, smooth camera movement, 8k detail.")


@app.function(image=image, volumes={"/weights": weights}, timeout=7200)
def download():
    if not os.path.exists(f"{CKPT}/configuration.json") and not os.path.exists(f"{CKPT}/config.json"):
        import subprocess
        subprocess.run(["huggingface-cli", "download", "Wan-AI/Wan2.2-T2V-A14B", "--local-dir", CKPT], check=True)
        weights.commit()
    print(sorted(os.listdir(CKPT)))


@app.function(image=image, gpu=["H100", "A100-80GB", "H200"], volumes={"/weights": weights}, timeout=3600)
def shot(prompt: str, seed: int, size: str = "720*1280") -> bytes:
    import subprocess
    import time

    os.makedirs("/work", exist_ok=True)
    t = time.time()
    subprocess.run(
        ["python", "generate.py", "--task", "t2v-A14B", "--size", size, "--ckpt_dir", CKPT,
         "--offload_model", "True", "--convert_model_dtype", "--base_seed", str(seed),
         "--prompt", f"{prompt} {STYLE}", "--save_file", "/work/out.mp4"],
        cwd="/wan", check=True,
    )
    print(f"shot took {time.time() - t:.0f} s")
    with open("/work/out.mp4", "rb") as f:
        return f.read()


@app.local_entrypoint()
def main(shots: str, out: str = "clips/", seed: int = 7):
    download.remote()
    prompts = json.load(open(shots))
    os.makedirs(out, exist_ok=True)
    for i, video in enumerate(shot.starmap([(p, seed + i) for i, p in enumerate(prompts)])):
        with open(f"{out}{i + 1:02d}.mp4", "wb") as f:
            f.write(video)
        print("saved", f"{out}{i + 1:02d}.mp4")
