# Scene pictures for the faceless story Shorts (scripts/story-short.py) on a Modal GPU (free
# monthly credit). One vertical picture per shot in the spec's "shots" lists, all in one house
# style: cute cartoon characters in a 3D miniature world.
#   modal run gpu/story_images.py --spec stories/eiffel-tower.json --out imgs/ --seed 3
# Needs MODAL_TOKEN_ID / MODAL_TOKEN_SECRET. Model: Stable Diffusion XL base 1.0 (CreativeML
# OpenRAIL++-M licence, commercial use allowed), cached in the kasba-model-cache volume.
import json

import modal

app = modal.App("kasba-story-images")
cache = modal.Volume.from_name("kasba-model-cache", create_if_missing=True)
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch==2.4.1", "diffusers==0.30.3", "transformers==4.44.2", "accelerate==0.34.2", "safetensors==0.4.5",
)

STYLE = (
    "3D cartoon diorama, cute stylized cartoon characters with big expressive eyes in a detailed 3D "
    "miniature world, tilt-shift photography, clay and plastic toy look, vibrant saturated colours, "
    "dramatic cinematic lighting, depth of field, high detail, vertical composition, subject in the centre"
)
NEGATIVE = (
    "text, letters, words, caption, watermark, logo, signature, photorealistic, realistic photo, "
    "ugly, deformed, extra limbs, extra fingers, blurry, low quality, dark, gore, nsfw"
)


@app.function(image=image, gpu=["L4", "A10G", "L40S", "T4"], volumes={"/cache": cache}, timeout=1800)
def render(prompts: list[str], seed: int) -> list[bytes]:
    import io

    import torch
    from diffusers import StableDiffusionXLPipeline

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16, variant="fp16",
        use_safetensors=True, cache_dir="/cache/hf",
    ).to("cuda")
    cache.commit()
    out = []
    for i, p in enumerate(prompts):
        img = pipe(
            f"{p}, {STYLE}", negative_prompt=NEGATIVE, width=768, height=1344, num_inference_steps=32,
            guidance_scale=7.0, generator=torch.Generator("cuda").manual_seed(seed * 1000 + i),
        ).images[0]
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        out.append(buf.getvalue())
    return out


@app.local_entrypoint()
def main(spec: str, out: str = "imgs/", seed: int = 3):
    import os

    data = json.load(open(spec, encoding="utf-8"))
    cast = data.get("cast", "")
    prompts, names = [], []
    for i, line in enumerate(data["lines"]):
        for j, shot in enumerate(line["shots"]):
            # "{hero}" in a shot is replaced by the spec's "cast" text, so the main character looks the same.
            prompts.append(shot.replace("{hero}", cast))
            names.append(f"{i:02d}-{j}.png")
    os.makedirs(out, exist_ok=True)
    for name, png in zip(names, render.remote(prompts, seed)):
        with open(f"{out}{name}", "wb") as f:
            f.write(png)
        print("saved", out + name)
