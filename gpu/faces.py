# Makes candidate faces for Kasba's AI news presenter on a Modal GPU (free $30 a month credit).
# The faces are invented by the model; prompts describe a professional anchor, never a real person.
#   modal run gpu/faces.py --n 4 --seed 1 --out anchor/
# Needs MODAL_TOKEN_ID / MODAL_TOKEN_SECRET. Model: Stable Diffusion XL base 1.0 (CreativeML
# OpenRAIL++-M licence, commercial use allowed), cached in a Modal volume after the first run.
import modal

app = modal.App("kasba-anchor-faces")
cache = modal.Volume.from_name("kasba-model-cache", create_if_missing=True)
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch==2.4.1", "diffusers==0.30.3", "transformers==4.44.2", "accelerate==0.34.2", "safetensors==0.4.5",
)

PROMPT = (
    "photo of an Indian woman television news presenter, about 30 years old, professional and friendly, "
    "wearing a formal navy blue blazer, hair neatly tied back, looking straight at the camera, "
    "head and shoulders, centred, plain soft blue studio background, soft even lighting, "
    "sharp focus, natural skin texture, photorealistic, 85mm portrait"
)
NEGATIVE = (
    "cartoon, illustration, painting, 3d render, celebrity, cleavage, revealing clothes, low cut, "
    "glamour, text, watermark, logo, extra fingers, deformed face, blurry, side view, sunglasses"
)


@app.function(image=image, gpu="L4", volumes={"/cache": cache}, timeout=1500)
def faces(n: int, seed: int) -> list[bytes]:
    import io

    import torch
    from diffusers import StableDiffusionXLPipeline

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16, variant="fp16",
        use_safetensors=True, cache_dir="/cache/hf",
    ).to("cuda")
    cache.commit()
    out = []
    for i in range(n):
        img = pipe(
            PROMPT, negative_prompt=NEGATIVE, width=832, height=1024, num_inference_steps=35,
            guidance_scale=6.5, generator=torch.Generator("cuda").manual_seed(seed * 100 + i),
        ).images[0]
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        out.append(buf.getvalue())
    return out


@app.local_entrypoint()
def main(n: int = 4, seed: int = 1, out: str = "anchor/"):
    import os

    os.makedirs(out, exist_ok=True)
    for i, png in enumerate(faces.remote(n, seed), start=1):
        path = f"{out}face-{seed}-{i}.png"
        with open(path, "wb") as f:
            f.write(png)
        print("saved", path)
