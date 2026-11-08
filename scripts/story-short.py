#!/usr/bin/env python3
"""Faceless story Short: scene pictures + voice + word-by-word captions + a 2-second hook.

  python scripts/story-short.py stories/<name>.json imgs/ out/ [voice ...]

Spec (stories/<name>.json):
  {"title": "...", "hook": "big text for the first 2 s", "lang": "en" | "hi",
   "cast": "how the main character looks (replaces {hero} in shot prompts)",
   "lines": [{"say": "one spoken sentence", "shots": ["picture prompt", ...]}, ...],
   "description": "...", "tags": ["..."]}
Pictures come from gpu/story_images.py as imgs/<line>-<shot>.png.
Voices: kokoro:<voice> (free, runs here, e.g. kokoro:am_michael, kokoro:hm_omega) or
edge:<voice> (free Microsoft voices, e.g. edge:en-US-AndrewMultilingualNeural).
For every voice asked for, writes out/<name>-<voice>.mp4 plus out/<name>.meta.json.
Pacing: the picture changes about every 2 s (each line's time is split over its shots, and long
shots get a second camera move), there is a whoosh on every cut and a boom on the first frame.
"""
import json
import os
import re
import subprocess
import sys
import wave

W, H, FPS = 1080, 1920, 30
MOVES = ["zoom_in", "pan_right", "zoom_out", "pan_left", "drift_up", "zoom_in_fast"]


def run(*cmd):
    subprocess.run(cmd, check=True)


def duration(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return float(out)


# ---------- voice ----------
_kokoro = {}


def say_kokoro(text, voice, path, lang):
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    code = {"en": "a" if not voice.startswith("b") else "b", "hi": "h"}[lang]
    if code not in _kokoro:
        _kokoro[code] = KPipeline(lang_code=code)
    parts = [audio for _, _, audio in _kokoro[code](text, voice=voice, speed=1.08)]
    sf.write(path, np.concatenate(parts), 24000)


def say_edge(text, voice, path):
    mp3 = path + ".mp3"
    run("edge-tts", "--voice", voice, "--rate", "+8%", "--text", text, "--write-media", mp3)
    run("ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-ar", "24000", "-ac", "1", path)


def voice_lines(spec, engine, voice, work):
    paths = []
    for i, line in enumerate(spec["lines"]):
        p = f"{work}v{i:02d}.wav"
        if engine == "test":  # silent stand-in, for checking the edit without a voice engine
            run("ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=220:r=24000",
                "-t", str(0.33 * len(line["say"].split())), p)
        elif engine == "kokoro":
            say_kokoro(line["say"], voice, p, spec.get("lang", "en"))
        else:
            say_edge(line["say"], voice, p)
        # Trim the silence at both ends so the lines run tight.
        t = p + ".t.wav"
        run("ffmpeg", "-y", "-loglevel", "error", "-i", p, "-af",
            "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
            "-ar", "48000", "-ac", "2", t)
        paths.append(t)
    return paths


# ---------- pictures ----------
def move_expr(move, n):
    """zoompan z/x/y for n frames on a picture that is already exactly W x H (zoompan keeps size)."""
    p = f"(on/{max(n - 1, 1)})"
    cx, cy = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    if move == "zoom_in":
        return f"1.05+0.13*{p}", cx, cy
    if move == "zoom_out":
        return f"1.18-0.13*{p}", cx, cy
    if move == "zoom_in_fast":  # punch in over the first 8 frames, then a slow drift
        return f"if(lt(on,8),1+0.22*on/8,1.22+0.04*{p})", cx, cy
    if move == "pan_right":
        return "1.18", f"(iw-iw/zoom)*{p}", cy
    if move == "pan_left":
        return "1.18", f"(iw-iw/zoom)*(1-{p})", cy
    if move == "drift_up":
        return "1.15", cx, f"(ih-ih/zoom)*(1-{p})"
    raise ValueError(move)


def shot_clip(img, secs, move, out):
    n = max(int(round(secs * FPS)), 2)
    z, x, y = move_expr(move, n)
    # Upscale first (2x) so the camera moves stay smooth, then zoompan back down to W x H.
    vf = (f"scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase:flags=lanczos,crop={W * 2}:{H * 2},"
          f"zoompan=z='{z}':x='{x}':y='{y}':d={n}:s={W}x{H}:fps={FPS},"
          f"eq=saturation=1.12:contrast=1.04,format=yuv420p")
    run("ffmpeg", "-y", "-loglevel", "error", "-i", img, "-vf", vf, "-frames:v", str(n),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-r", str(FPS), out)
    return n / FPS


# ---------- captions ----------
def ass_time(t):
    h, rem = divmod(max(t, 0), 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def captions(spec, line_times, path):
    font = "Noto Sans Devanagari" if spec.get("lang") == "hi" else "Anton"
    size = 92 if spec.get("lang") == "hi" else 104
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,1,0,1,7,3,5,70,70,0,1
Style: Hook,{font},{size + 18},&H0000E5FF,&H0000E5FF,&H00000000,&HC0000000,-1,0,0,0,100,100,1,0,1,9,4,8,60,60,230,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    hook = spec.get("hook")
    if hook:  # the hook sits at the top for the first 2.2 s and pops in
        ev.append(f"Dialogue: 2,{ass_time(0)},{ass_time(2.2)},Hook,,0,0,0,,{{\\fscx60\\fscy60\\t(0,140,\\fscx100\\fscy100)}}{hook.upper() if spec.get('lang') != 'hi' else hook}")
    for (start, end), line in zip(line_times, spec["lines"]):
        words = line["say"].split()
        weights = [len(re.sub(r"\W", "", w)) + 2 for w in words]
        total = sum(weights)
        t, times = start, []
        for wt in weights:
            d = (end - start) * wt / total
            times.append((t, t + d))
            t += d
        # Two or three words on screen at a time; the word being spoken is yellow and bigger.
        chunks, cur = [], []
        for i, w in enumerate(words):
            cur.append(i)
            if len(cur) == 3 or (len(cur) == 2 and len(w) > 7) or re.search(r"[.,!?।…]$", w):
                chunks.append(cur)
                cur = []
        if cur:
            chunks.append(cur)
        for ch in chunks:
            for k in ch:
                parts = []
                for j in ch:
                    w = words[j] if spec.get("lang") == "hi" else words[j].upper()
                    if j == k:
                        parts.append(f"{{\\c&H0000E5FF&\\fscx112\\fscy112}}{w}{{\\c&H00FFFFFF&\\fscx100\\fscy100}}")
                    else:
                        parts.append(w)
                pos = "{\\pos(540,1240)}"
                ev.append(f"Dialogue: 1,{ass_time(times[k][0])},{ass_time(times[k][1])},Cap,,0,0,0,,{pos}{' '.join(parts)}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(head + "\n".join(ev) + "\n")


# ---------- sound effects (made here, no samples needed) ----------
def sfx(work):
    whoosh, boom = f"{work}whoosh.wav", f"{work}boom.wav"
    run("ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anoisesrc=d=0.38:c=pink:a=0.6:r=48000",
        "-af", "highpass=f=500,lowpass=f=5000,afade=t=in:d=0.18,afade=t=out:st=0.18:d=0.2,volume=0.30", "-ac", "2", whoosh)
    run("ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=f=52:d=0.9:r=48000",
        "-af", "volume=0.9,afade=t=out:st=0.08:d=0.8", "-ac", "2", boom)
    return whoosh, boom


def build(spec_path, imgs, out, voice):
    spec = json.load(open(spec_path, encoding="utf-8"))
    name = os.path.splitext(os.path.basename(spec_path))[0]
    engine, vname = voice.split(":", 1)
    work = f"{out}work-{name}-{vname}/"
    os.makedirs(work, exist_ok=True)

    lines = voice_lines(spec, engine, vname, work)
    gap = 0.12
    # Voice track: lines back to back with a tiny gap.
    concat = "".join(f"file '{os.path.abspath(p)}'\nfile '{os.path.abspath(work)}/gap.wav'\n" for p in lines)
    run("ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo", "-t", str(gap), f"{work}gap.wav")
    open(f"{work}voice.txt", "w").write(concat)
    run("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{work}voice.txt", "-c", "pcm_s16le", f"{work}voice.wav")

    # Pictures: each line's time split over its shots; a shot longer than 2.6 s gets two moves.
    clips, cuts, line_times = [], [], []
    t, m = 0.0, 0
    for i, (line, vpath) in enumerate(zip(spec["lines"], lines)):
        d = duration(vpath) + gap
        line_times.append((t, t + d - gap))
        shots = line["shots"]
        per = d / len(shots)
        for j in range(len(shots)):
            img = f"{imgs}{i:02d}-{j}.png"
            pieces = [per / 2, per / 2] if per > 2.6 else [per]
            for piece in pieces:
                move = "zoom_in_fast" if not clips else MOVES[m % (len(MOVES) - 1)]
                m += 1
                c = f"{work}c{len(clips):03d}.mp4"
                got = shot_clip(img, piece, move, c)
                clips.append(c)
                if t > 0:
                    cuts.append(t)
                t += got
    open(f"{work}clips.txt", "w").write("".join(f"file '{os.path.abspath(c)}'\n" for c in clips))
    run("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{work}clips.txt", "-c", "copy", f"{work}pictures.mp4")

    captions(spec, line_times, f"{work}captions.ass")

    whoosh, boom = sfx(work)
    # Sound: voice + a boom on frame one + a whoosh just before every cut (+ optional music bed).
    inputs = ["-i", f"{work}pictures.mp4", "-i", f"{work}voice.wav", "-i", boom]
    graph = ["[2:a]adelay=0|0[b0]"]
    mix = ["[1:a]", "[b0]"]
    for k, c in enumerate(cuts):
        inputs += ["-i", whoosh]
        ms = max(int((c - 0.2) * 1000), 0)
        graph.append(f"[{3 + k}:a]adelay={ms}|{ms}[w{k}]")
        mix.append(f"[w{k}]")
    music = spec.get("music")
    if music and os.path.exists(music):
        inputs += ["-stream_loop", "-1", "-i", music]
        graph.append(f"[{3 + len(cuts)}:a]volume=0.12[mu]")
        mix.append("[mu]")
    graph.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[a]")
    fonts = os.path.abspath("scripts/fonts") if os.path.isdir("scripts/fonts") else "/usr/share/fonts"
    graph.append(f"[0:v]subtitles={work}captions.ass:fontsdir={fonts}[v]")
    final = f"{out}{name}-{vname}.mp4"
    run("ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(graph),
        "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final)
    print("made", final, round(duration(final), 1), "s")

    meta = {"title": spec["title"], "description": spec.get("description", ""), "tags": spec.get("tags", [])}
    json.dump(meta, open(f"{out}{name}.meta.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    spec_path, imgs, out, *voices = sys.argv[1:]
    os.makedirs(out, exist_ok=True)
    for v in voices or ["kokoro:am_michael"]:
        build(spec_path, imgs, out, v)
