# Makes the presenter's face speak a voice clip, on a Modal GPU, with SadTalker (Apache-2.0)
# and GFPGAN face clean-up. Input: one still photo + a WAV/MP3; output: an MP4 of the talking head.
#   modal run gpu/lipsync.py --face brand/anchor.png --audio voice.wav --out talk.mp4
import modal

app = modal.App("kasba-anchor-lipsync")
image = (
    modal.Image.from_registry("nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04", add_python="3.11")
    .apt_install("git", "ffmpeg", "libgl1", "libglib2.0-0", "wget")
    .run_commands(
        "pip install torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 --index-url https://download.pytorch.org/whl/cu118",
        "pip install numpy==1.23.5 face_alignment==1.3.5 imageio==2.19.3 imageio-ffmpeg==0.4.7 librosa==0.9.2"
        " numba==0.57.1 resampy==0.3.1 pydub==0.25.1 scipy==1.10.1 kornia==0.6.8 tqdm yacs==0.1.8 pyyaml"
        " joblib==1.1.0 scikit-image==0.20.0 facexlib==0.3.0 av safetensors",
        "pip install --no-build-isolation basicsr==1.4.2 gfpgan==1.3.8",
        "git clone https://github.com/OpenTalker/SadTalker /sadtalker",
        "cd /sadtalker && bash scripts/download_models.sh",
    )
)


@app.function(image=image, gpu=["L4", "A10G", "L40S", "T4"], timeout=1200)
def talk(face: bytes, audio: bytes, audio_ext: str = "wav") -> bytes:
    import glob
    import os
    import subprocess

    os.makedirs("/work", exist_ok=True)
    with open("/work/face.png", "wb") as f:
        f.write(face)
    with open(f"/work/voice.{audio_ext}", "wb") as f:
        f.write(audio)
    subprocess.run(
        ["python", "inference.py", "--driven_audio", f"/work/voice.{audio_ext}", "--source_image", "/work/face.png",
         "--result_dir", "/work/out", "--still", "--preprocess", "full", "--enhancer", "gfpgan", "--size", "512"],
        cwd="/sadtalker", check=True,
    )
    mp4 = max(glob.glob("/work/out/**/*.mp4", recursive=True), key=os.path.getmtime)
    with open(mp4, "rb") as f:
        return f.read()


@app.local_entrypoint()
def main(face: str, audio: str, out: str = "talk.mp4"):
    with open(face, "rb") as f:
        face_bytes = f.read()
    with open(audio, "rb") as f:
        audio_bytes = f.read()
    with open(out, "wb") as f:
        f.write(talk.remote(face_bytes, audio_bytes, audio.rsplit(".", 1)[-1]))
    print("saved", out)
