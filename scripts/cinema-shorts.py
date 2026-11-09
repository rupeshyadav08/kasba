#!/usr/bin/env python3
"""Cut vertical 9:16 Shorts out of a finished 16:9 episode.

Usage: python3 scripts/cinema-shorts.py cinema/mira-ep1.shorts.json [only_id]

Plan file:
{
  "episode": "/path/episode.mp4",          # finished 1920x1080 episode
  "srt": "/path/episode.srt",               # English subtitles of the episode (burned in)
  "out_dir": "/path/shorts",
  "end_tag": ["FULL EPISODE ON YOUTUBE", "Colossal Tales"],
  "shorts": [
    {"id": "s1-bell",
     "hook": ["SHE RANG AN OLD BELL...", "AND THE HILL WOKE UP"],
     "pieces": [                            # cut together in order
        {"in": 5.0, "out": 7.5, "x": [[5.0, 0.5]], "subs": false},
        {"in": 44.0, "out": 76.0, "x": [[44, 0.45], [69, 0.75], [72, 0.45]]}
     ]}
  ]
}
"x" = keyframes [episode_time, centre] where centre is 0 (left edge) .. 1 (right edge)
of the 16:9 frame; the 9:16 window glides linearly between keyframes.
"""
import json, os, re, subprocess, sys, tempfile

FONT = os.path.join(os.path.dirname(__file__), "..", "cinema", "fonts", "Anton.ttf")
FONT = os.path.abspath(FONT)
W, H = 1080, 1920
# window taken from the 1920x1080 source: top band only, which also drops the
# generator's sparkle mark in the bottom-right corner
SRC_W, SRC_H = 1920, 1080
CY, CH = 10, 960
CW = CH * 9 // 16  # 540


def srt_cues(path):
    cues = []
    if not path or not os.path.exists(path):
        return cues
    def sec(s):
        h, m, r = s.split(":"); s2, ms = r.split(",")
        return int(h) * 3600 + int(m) * 60 + int(s2) + int(ms) / 1000
    for block in re.split(r"\n\s*\n", open(path, encoding="utf-8").read().strip()):
        lines = block.strip().splitlines()
        if len(lines) < 3:
            continue
        a, b = [sec(x.strip()) for x in lines[1].split("-->")]
        cues.append((a, b, "\n".join(lines[2:])))
    return cues


def x_expr(keys, t0):
    """Piecewise-linear crop x (pixels) as an ffmpeg expression of t (piece-relative)."""
    span = SRC_W - CW
    pts = [(k[0] - t0, min(max(k[1] * SRC_W - CW / 2, 0), span)) for k in sorted(keys)]
    if len(pts) == 1:
        return f"{pts[0][1]:.1f}"
    expr = f"{pts[-1][1]:.1f}"
    for (ta, xa), (tb, xb) in reversed(list(zip(pts, pts[1:]))):
        seg = f"({xa:.1f}+({xb:.1f}-{xa:.1f})*(t-{ta:.3f})/{max(tb - ta, 0.001):.3f})"
        expr = f"if(lt(t,{tb:.3f}),{seg},{expr})"
    return f"if(lt(t,{pts[0][0]:.3f}),{pts[0][1]:.1f},{expr})"


def text_filter(tmp, name, text, size, y, start, end, color="white", border=7):
    p = os.path.join(tmp, name)
    open(p, "w", encoding="utf-8").write(text)
    return (f"drawtext=fontfile={FONT}:textfile={p}:fontsize={size}:fontcolor={color}:"
            f"borderw={border}:bordercolor=black@0.9:line_spacing=10:x=(w-text_w)/2:y={y}:"
            f"enable='between(t,{start:.3f},{end:.3f})'")


def make(plan, s):
    ep, cues = plan["episode"], srt_cues(plan.get("srt"))
    out = os.path.join(plan["out_dir"], f"{s['id']}.mp4")
    tmp = tempfile.mkdtemp()
    args, fc, labels = [], [], []
    timeline = []  # (episode_in, episode_out, short_start)
    t = 0.0
    for i, p in enumerate(s["pieces"]):
        args += ["-ss", f"{p['in']}", "-t", f"{p['out'] - p['in']}", "-i", ep]
        d = p["out"] - p["in"]
        xe = x_expr(p.get("x", [[p["in"], 0.5]]), p["in"]).replace(",", "\\,")
        fc.append(f"[{i}:v]setpts=PTS-STARTPTS,fps=24,crop={CW}:{CH}:'{xe}':{CY},"
                  f"scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p[v{i}]")
        fa = min(0.25, d / 4)
        fc.append(f"[{i}:a]asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:d={fa},"
                  f"afade=t=out:st={d - fa:.3f}:d={fa}[a{i}]")
        labels.append(f"[v{i}][a{i}]")
        timeline.append((p["in"], p["out"], t))
        t += d
    total = t
    n = len(s["pieces"])
    fc.append("".join(labels) + f"concat=n={n}:v=1:a=1[vc][ac]")

    draw = []
    hook = s.get("hook")
    hook_end = s.get("hook_len", 2.6)
    if hook:
        draw.append(text_filter(tmp, "hook1.txt", hook[0], 92, 250, 0, hook_end))
        if len(hook) > 1:
            draw.append(text_filter(tmp, "hook2.txt", hook[1], 104, 370, 0, hook_end, color="#FFCD3C"))
    k = 0
    for a, b, txt in cues:  # subtitles, moved onto the short's timeline
        for (ein, eout, st), p in zip(timeline, s["pieces"]):
            lo, hi = max(a, ein), min(b, eout)
            # skip pieces marked "subs": false (hook flashes) and lines that are mostly cut off
            if not p.get("subs", True) or hi - lo < 0.5 * (b - a):
                continue
            ss, se = st + lo - ein, st + hi - ein
            if hook and ss < hook_end:
                ss = max(ss, 0)
            draw.append(text_filter(tmp, f"c{k}.txt", txt.replace("PAPA: ", "").replace("NANI: ", "")
                                    .replace("MIRA: ", "").upper(), 60, 1330, ss, se))
            k += 1
    tag = plan.get("end_tag")
    if tag:
        e0 = total - 2.8
        draw.append(text_filter(tmp, "tag1.txt", tag[0], 80, 760, e0, total + 1))
        draw.append(text_filter(tmp, "tag2.txt", tag[1], 64, 870, e0, total + 1, color="#FFCD3C"))
    vf = ",".join(draw) if draw else "null"
    fc.append(f"[vc]{vf},fade=t=out:st={total - 0.4:.3f}:d=0.4[vo]")
    fc.append("[ac]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[ao]")
    os.makedirs(plan["out_dir"], exist_ok=True)
    cmd = ["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", ";".join(fc),
           "-map", "[vo]", "-map", "[ao]", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
           "-pix_fmt", "yuv420p", "-r", "24", "-c:a", "aac", "-b:a", "192k",
           "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    print(f"{out}: {total:.1f} s")


if __name__ == "__main__":
    plan = json.load(open(sys.argv[1]))
    only = sys.argv[2] if len(sys.argv) > 2 else None
    for s in plan["shorts"]:
        if only and s["id"] != only:
            continue
        make(plan, s)
