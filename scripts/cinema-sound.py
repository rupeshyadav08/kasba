"""Lays MMAudio sound effects (one per clip) and a MusicGen music bed under a finished video.

Usage: python scripts/cinema-sound.py <clips dir> <sound dir> <trim seconds>
Writes video.mp4 (effects + music) and video-sfx.mp4 (effects only) from video.mp4, cutting the
first <trim> seconds. Clip offsets match the 0.5 s cross-fades used when the clips were joined.
"""
import glob
import subprocess
import sys

clips, sound, trim = sys.argv[1], sys.argv[2], float(sys.argv[3])


def dur(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", f]).decode())


files = sorted(glob.glob(f"{clips}*.mp4"))
offsets, off = [], 0.0
for i, f in enumerate(files):
    offsets.append(off)
    off += dur(f) - 0.5
total = dur("video.mp4")

inputs, parts = [], []
for i, off in enumerate(offsets):
    inputs += ["-i", f"{sound}sfx{i + 1:02d}.flac"]
    parts.append(f"[{i}:a]aresample=48000,afade=t=in:d=0.3,afade=t=out:st=4.4:d=0.6,"
                 f"adelay={int(off * 1000)}:all=1[s{i}]")
n = len(offsets)
sfx = "".join(f"[s{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0[sfx]"
inputs += ["-i", f"{sound}music.wav"]
music = f"[{n}:a]aresample=48000,volume=0.35,afade=t=out:st={total - 2:.2f}:d=2[mus]"


def render(graph, label, out):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", graph,
                    "-map", label, "-t", f"{total:.2f}", "-ar", "48000", f"{out}.wav"], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(trim), "-i", "video.mp4",
                    "-ss", str(trim), "-i", f"{out}.wav", "-map", "0:v", "-map", "1:a",
                    "-af", f"afade=t=in:d=0.2,loudnorm=I=-14:TP=-1.5",
                    "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", "-movflags", "+faststart", f"{out}.tmp.mp4"], check=True)


base = ";".join(parts) + ";" + sfx
render(base + ";" + music + ";[sfx][mus]amix=inputs=2:normalize=0[out]", "[out]", "full")
render(base, "[sfx]", "sfxonly")
subprocess.run(["mv", "full.tmp.mp4", "video.mp4"], check=True)
subprocess.run(["mv", "sfxonly.tmp.mp4", "video-sfx.mp4"], check=True)
print("video.mp4", dur("video.mp4"), "s; video-sfx.mp4", dur("video-sfx.mp4"), "s")
