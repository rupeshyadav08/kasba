"""Colossal Tales end screen (10 s, 1920x1080) for YouTube end-screen elements.

  python3 scripts/cinema-endcard.py BACKGROUND OUT.mp4 "Next episode title" [--logo PATH] [--secs 10]

BACKGROUND is a still or a video (its last frame is used), blurred and darkened.
Left: "NEXT EPISODE" + title above an empty 16:9 frame where YouTube's video element goes.
Right: an empty circle where YouTube's Subscribe element goes, with "SUBSCRIBE".
Bottom: handles. The overlay fades in over the first second. Silent audio track.
"""
import argparse
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("bg"); ap.add_argument("out"); ap.add_argument("title")
ap.add_argument("--logo", default="/mnt/project-files/ai-channel/colossal-tales-profile-800.png")
ap.add_argument("--secs", type=float, default=10)
ap.add_argument("--handle", default="@colossaltales")
a = ap.parse_args()
F = os.path.join(os.path.dirname(__file__), "..", "cinema", "fonts")
W, H = 1920, 1080
GOLD, WHITE = (240, 195, 106, 255), (255, 255, 255, 255)
tmp = tempfile.mkdtemp()

ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(ov)
cinzel = lambda s: ImageFont.truetype(os.path.join(F, "Cinzel.ttf"), s)
lora = lambda s: ImageFont.truetype(os.path.join(F, "Lora.ttf"), s)

def centre(x, y, text, font, fill, spacing=0):
    if spacing:
        text = (" " * spacing).join(text)
    w = d.textlength(text, font=font)
    d.text((x - w / 2, y), text, font=font, fill=fill)

# logo, top centre, rounded
logo = Image.open(a.logo).convert("RGBA").resize((170, 170), Image.LANCZOS)
m = Image.new("L", logo.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, 169, 169), 28, fill=255)
ov.paste(logo, (W // 2 - 85, 50), m)

# left column: next episode
lx = 560
centre(lx, 300, "NEXT EPISODE", cinzel(34), GOLD, spacing=1)
centre(lx, 350, a.title, lora(52), WHITE)
box = (lx - 360, 440, lx + 360, 440 + 405)
d.rounded_rectangle(box, 18, outline=(255, 255, 255, 150), width=3)
cy = (box[1] + box[3]) // 2
d.polygon([(lx - 22, cy - 28), (lx - 22, cy + 28), (lx + 30, cy)], fill=(255, 255, 255, 110))

# right column: subscribe
rx, ry, r = 1400, 640, 170
d.ellipse((rx - r, ry - r, rx + r, ry + r), outline=(255, 255, 255, 170), width=4)
centre(rx, 300, "SUBSCRIBE", cinzel(34), GOLD, spacing=1)
centre(rx, 350, "Don't miss the next episode", lora(40), WHITE)

# bottom: handles
centre(W // 2, 960, f"YouTube  ·  Instagram   {a.handle}", lora(34), (255, 255, 255, 210))
ovp = os.path.join(tmp, "ov.png"); ov.save(ovp)

# background: last frame of a video, or a still
bgp = os.path.join(tmp, "bg.png")
if a.bg.lower().endswith((".mp4", ".mov", ".mkv")):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-sseof", "-0.2", "-i", a.bg, "-frames:v", "1", "-update", "1", bgp], check=True)
else:
    bgp = a.bg
vf = (f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},gblur=sigma=22,"
      f"eq=brightness=-0.22:saturation=0.8,vignette=PI/4,zoompan=z='1+0.0006*on':d={int(a.secs*24)}:s={W}x{H}:fps=24,"
      f"format=yuva420p[bg];[1:v]format=rgba,fade=t=in:st=0.3:d=0.9:alpha=1[ov];[bg][ov]overlay=0:0,format=yuv420p,settb=1/24[v]")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", bgp, "-loop", "1", "-i", ovp,
                "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-filter_complex", vf,
                "-map", "[v]", "-map", "2:a", "-t", str(a.secs), "-r", "24", "-c:v", "libx264", "-crf", "18",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", a.out], check=True)
print("end card:", a.out)
