"""Adds a Sarvam voiceover to a finished AI cinema video (video.mp4 -> video.mp4).

Usage: python scripts/cinema-voice.py <text file> <trim seconds> <language code>
Cuts the first <trim> seconds, speaks the text with Sarvam's Bulbul voice and lays it over the
picture. If the voice runs longer than the picture, the last frame is held. Needs SARVAM_API_KEY.
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request

text = open(sys.argv[1], encoding="utf-8").read().strip()
trim = float(sys.argv[2])
lang = sys.argv[3]


def tts(model, speaker):
    body = {"text": text, "target_language_code": lang, "language_code": lang, "model": model,
            "pace": float(os.environ.get("SARVAM_PACE", "0.95")), "speech_sample_rate": 24000}
    if speaker:
        body["speaker"] = speaker
    req = urllib.request.Request("https://api.sarvam.ai/text-to-speech", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "api-subscription-key": os.environ["SARVAM_API_KEY"]})
    with urllib.request.urlopen(req, timeout=120) as r:
        return base64.b64decode(json.load(r)["audios"][0])


# Newest voice first; fall back to older Bulbul voices if a model or speaker name is refused.
tries = [(os.environ.get("SARVAM_MODEL", "bulbul:v4-flash"), os.environ.get("SARVAM_SPEAKER", "")),
         ("bulbul:v3", ""), ("bulbul:v2", "abhilash")]
for model, speaker in tries:
    try:
        open("voice.wav", "wb").write(tts(model, speaker))
        print("sarvam ok:", model, speaker or "(default voice)")
        break
    except Exception as e:  # noqa: BLE001
        detail = e.read().decode()[:300] if hasattr(e, "read") else str(e)
        print("sarvam failed:", model, speaker, detail)
else:
    sys.exit("no Sarvam voice worked")


def dur(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", f]).decode())


lead = 0.4  # breath before the first word
pic = dur("video.mp4") - trim
voice = dur("voice.wav") + lead
hold = max(0.0, voice + 0.6 - pic)  # hold the last frame if the voice needs longer
print(f"picture {pic:.1f}s, voice {voice:.1f}s, holding last frame {hold:.1f}s")
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error", "-ss", str(trim), "-i", "video.mp4", "-i", "voice.wav",
    "-filter_complex",
    f"[0:v]setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={hold:.2f}[v];"
    f"[1:a]adelay={int(lead * 1000)}:all=1,apad,afade=t=out:st={pic + hold - 0.5:.2f}:d=0.5[a]",
    "-map", "[v]", "-map", "[a]", "-t", f"{pic + hold:.2f}",
    "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", "voiced.mp4"], check=True)
os.replace("voiced.mp4", "video.mp4")
print("final", dur("video.mp4"), "s")
