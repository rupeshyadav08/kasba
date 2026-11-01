# Speech-to-video with Wan 2.2 S2V-14B (Apache-2.0) on a Modal H100: the presenter photo speaks
# the voice clip with natural head and face movement. Costs about $4 an hour of GPU, so it is kept
# for a few big stories (3 every two weeks); everyday Shorts use gpu/lipsync.py.
#   modal run gpu/wan_s2v.py --face anchor.png --audio voice.wav --out talk.mp4
# The 14B weights (~40 GB) are downloaded once into a Modal volume by a CPU function.
import modal

app = modal.App("kasba-anchor-wan")
weights = modal.Volume.from_name("kasba-wan-weights", create_if_missing=True)
CKPT = "/weights/Wan2.2-S2V-14B"

image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "ffmpeg", "libgl1", "libglib2.0-0", "clang", "build-essential")
    .run_commands(
        "pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu124",
        "git clone https://github.com/Wan-Video/Wan2.2 /wan",
        "cd /wan && grep -v flash_attn requirements.txt > /tmp/req.txt && pip install -r /tmp/req.txt",
        "cd /wan && pip install -r requirements_s2v.txt",
        "pip install packaging ninja && pip install flash-attn==2.7.4.post1 --no-build-isolation",
        "pip install 'huggingface_hub[cli]' peft",
    )
)


@app.function(image=image, volumes={"/weights": weights}, timeout=3600)
def download():
    import os
    import subprocess

    if not os.path.exists(f"{CKPT}/config.json"):
        subprocess.run(["huggingface-cli", "download", "Wan-AI/Wan2.2-S2V-14B", "--local-dir", CKPT], check=True)
        weights.commit()
    print(sorted(os.listdir(CKPT)))


@app.function(image=image, gpu=["H100", "A100-80GB", "H200"], volumes={"/weights": weights}, timeout=3600)
def talk(face: bytes, audio: bytes, prompt: str, audio_ext: str = "wav", size: str = "480*832") -> bytes:
    import os
    import subprocess
    import time

    os.makedirs("/work", exist_ok=True)
    with open("/work/face.png", "wb") as f:
        f.write(face)
    with open(f"/work/voice.{audio_ext}", "wb") as f:
        f.write(audio)
    t = time.time()
    subprocess.run(
        ["python", "generate.py", "--task", "s2v-14B", "--size", size, "--ckpt_dir", CKPT,
         "--offload_model", "True", "--convert_model_dtype", "--prompt", prompt,
         "--image", "/work/face.png", "--audio", f"/work/voice.{audio_ext}", "--save_file", "/work/out.mp4"],
        cwd="/wan", check=True,
    )
    print(f"wan s2v took {time.time() - t:.0f} s")
    with open("/work/out.mp4", "rb") as f:
        return f.read()


PROMPT = ("A professional Indian woman news presenter in a navy blazer sits at a news desk in a bright "
          "TV studio, speaking clearly to the camera with calm, natural expressions and small hand gestures.")


@app.local_entrypoint()
def main(face: str, audio: str, out: str = "talk.mp4", prompt: str = PROMPT):
    download.remote()
    with open(face, "rb") as f:
        face_bytes = f.read()
    with open(audio, "rb") as f:
        audio_bytes = f.read()
    with open(out, "wb") as f:
        f.write(talk.remote(face_bytes, audio_bytes, prompt, audio.rsplit(".", 1)[-1]))
    print("saved", out)
