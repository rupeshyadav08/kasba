"""Edit an AI cinema episode from an edit list (JSON) with ffmpeg.

  python3 scripts/cinema-episode.py cinema/mira-ep1.edit.json out.mp4

Edit list:
{
  "clips_dir": "...", "narr_dir": "...", "music_dir": "...",
  "zoom": 1.04,                       # hides the Gemini sparkle in the corner
  "shots": [{"file": "ep1-A1.mp4", "in": 0, "out": 10, "join": "dissolve", "join_len": 1.0}, ...],
      # join = how this shot starts: "cut" or "dissolve" (cross-fade picture and sound)
  "narration": [{"file": "n01.wav", "at": 4.5}, ...],     # seconds on the episode timeline
  "music": [{"file": "m1.mp3", "at": 0, "in": 0, "len": 14, "fade_in": 1, "fade_out": 3}, ...],
  "music_db": -20, "duck_db": -9,                         # music level, extra dip under narration
  "clip_db": 0, "end_card": {"text": "...", "len": 3}
}
Clip audio (Veo/Omni dialogue and effects) is kept; narration sits on top; music ducks under narration.
Output: 1920x1080 24 fps, one warm grade + light grain over everything, loudness -14 LUFS.
"""
import json
import os
import subprocess
import sys

e = json.load(open(sys.argv[1]))
out = sys.argv[2]
cd, nd, md = e["clips_dir"], e.get("narr_dir", ""), e.get("music_dir", "")
zoom = e.get("zoom", 1.04)
W, H = 1920, 1080

args, fc = [], []
n = 0
# --- picture + clip sound, shot by shot
v_prev = a_prev = None
t = 0.0  # running timeline length
starts = []  # where each shot starts on the timeline
for i, s in enumerate(e["shots"]):
    args += ["-i", os.path.join(cd, s["file"])]
    d = s["out"] - s["in"]
    zw, zh = int(W * zoom) // 2 * 2, int(H * zoom) // 2 * 2
    fc.append(f"[{n}:v]trim={s['in']}:{s['out']},setpts=PTS-STARTPTS,fps=24,scale={zw}:{zh}:flags=lanczos,"
              f"crop={W}:{H},setsar=1,format=yuv420p,settb=1/24[v{i}]")
    fc.append(f"[{n}:a]atrim={s['in']}:{s['out']},asetpts=PTS-STARTPTS,aresample=48000,"
              f"aformat=channel_layouts=stereo,volume={e.get('clip_db', 0)}dB[a{i}]")
    n += 1
    if v_prev is None:
        starts.append(0.0)
        v_prev, a_prev, t = f"v{i}", f"a{i}", d
        continue
    if s.get("join", "cut") == "dissolve":
        L = s.get("join_len", 1.0)
        starts.append(t - L)
        fc.append(f"[{v_prev}][v{i}]xfade=transition=fade:duration={L}:offset={t - L:.3f}[vx{i}]")
        fc.append(f"[{a_prev}][a{i}]acrossfade=d={L}:c1=tri:c2=tri[ax{i}]")
        t = t - L + d
    else:
        starts.append(t)
        fc.append(f"[{v_prev}][{a_prev}][v{i}][a{i}]concat=n=2:v=1:a=1[vc{i}][ax{i}]")
        fc.append(f"[vc{i}]settb=1/24,fps=24[vx{i}]")
        t = t + d
    v_prev, a_prev = f"vx{i}", f"ax{i}"
total = t

def when(x):  # "at" is on the timeline, or relative to a shot when "shot" is given
    return max(0.0, starts[x["shot"]] + x["at"] if "shot" in x else x["at"])


# --- end card (fade to black + title)
ec = e.get("end_card")
if ec:
    L = ec.get("len", 3)
    txt = ec["text"].replace("'", "’").replace(":", "\\:")
    font = ec.get("font", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf")
    fc.append(f"color=c=black:s={W}x{H}:r=24:d={L},format=yuv420p,drawtext=fontfile={font}:text='{txt}':"
              f"fontsize=56:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:alpha='min(1,t/0.8)',settb=1/24[vend]")
    fc.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{L}[aend]")
    fc.append(f"[{v_prev}][vend]xfade=transition=fade:duration=1:offset={total - 1:.3f}[vfin]")
    fc.append(f"[{a_prev}][aend]acrossfade=d=1[afin]")
    v_prev, a_prev, total = "vfin", "afin", total - 1 + L

# --- one look over everything: gentle warm grade, soft vignette, light grain
fc.append(f"[{v_prev}]eq=contrast=1.04:saturation=1.06:gamma=0.98,colorbalance=rs=0.02:bs=-0.02,"
          f"vignette=PI/6,noise=alls=4:allf=t,format=yuv420p[vout]")

# --- narration bus
narr = e.get("narration", [])
mix = [f"[{a_prev}]"]
if narr:
    labels = []
    for k, ln in enumerate(narr):
        args += ["-i", os.path.join(nd, ln["file"])]
        ms = int(when(ln) * 1000)
        fc.append(f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,volume={ln.get('db', 0)}dB,"
                  f"adelay={ms}|{ms}[n{k}]")
        labels.append(f"[n{k}]")
        n += 1
    fc.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,apad,atrim=0:{total:.3f},asplit=2[narr][narrkey]")
# --- music bus, ducked under narration
mus = e.get("music", [])
if mus:
    labels = []
    for k, m in enumerate(mus):
        args += ["-i", os.path.join(md, m["file"])]
        ms = int(when(m) * 1000)
        fo = m.get("fade_out", 2)
        fc.append(f"[{n}:a]atrim={m.get('in', 0)}:{m.get('in', 0) + m['len']},asetpts=PTS-STARTPTS,aresample=48000,"
                  f"aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-2,afade=t=in:d={m.get('fade_in', 1)},"
                  f"afade=t=out:st={m['len'] - fo}:d={fo},adelay={ms}|{ms}[m{k}]")
        labels.append(f"[m{k}]")
        n += 1
    fc.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0,apad,atrim=0:{total:.3f},"
              f"volume={e.get('music_db', -20)}dB[mraw]")
    if narr:
        fc.append(f"[mraw][narrkey]sidechaincompress=threshold=0.02:ratio=6:attack=80:release=600[mus]")
    else:
        fc.append("[mraw]anull[mus]")
    mix.append("[mus]")
if narr:
    mix.append("[narr]")
fc.append("".join(mix) + f"amix=inputs={len(mix)}:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")

cmd = ["ffmpeg", "-y", "-v", "error", *args, "-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]",
       "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out]
subprocess.run(cmd, check=True)
print(f"{out}: {total:.1f} s")
for i, (s0, sh) in enumerate(zip(starts, e["shots"])):
    print(f"  shot {i:2d} {sh['file']:<22} starts {s0:6.1f} s")
