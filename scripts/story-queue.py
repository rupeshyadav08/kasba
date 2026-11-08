#!/usr/bin/env python3
"""Which story Shorts to make next, and when YouTube should publish them.

  python scripts/story-queue.py plan   -> prints "<story> <publishAt ISO>" lines for the open slots
  python scripts/story-queue.py mark <story> <publishAt>   -> records it in stories/posted.json

Slots are IST clock times from STORY_SLOTS (default "22:00,05:30"). A slot counts as open when it is
at least 50 minutes away (time to render and upload) and no posted story already holds it, so a
back-up run on the same day does nothing. Stories go in stories/order.txt order, then file-name order, skipping posted ones.
"""
import datetime as dt
import glob
import json
import os
import sys

IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
LOG = "stories/posted.json"


def load():
    return json.load(open(LOG, encoding="utf-8")) if os.path.exists(LOG) else []


def plan():
    posted = load()
    used = {p["story"] for p in posted}
    taken = {p["publishAt"] for p in posted}
    now = dt.datetime.now(IST)
    # Fill every slot in the next STORY_DAYS days (default 2), so a day's worth is always queued
    # ahead and one failed run doesn't leave a gap.
    days = int(os.environ.get("STORY_DAYS", "2"))
    slots = []
    for s in os.environ.get("STORY_SLOTS", "22:00,05:30").split(","):
        h, m = map(int, s.strip().split(":"))
        for d in range(days + 1):
            t = now.replace(hour=h, minute=m, second=0, microsecond=0) + dt.timedelta(days=d)
            if now + dt.timedelta(minutes=50) <= t <= now + dt.timedelta(days=days):
                slots.append(t)
    slots.sort()
    stories = [os.path.splitext(os.path.basename(f))[0] for f in sorted(glob.glob("stories/*.json"))
               if not f.endswith("posted.json")]
    # stories/order.txt (one name per line) goes first; the rest follow in file-name order.
    first = [l.strip() for l in open("stories/order.txt")] if os.path.exists("stories/order.txt") else []
    first = [s for s in first if s in stories]
    queue = [s for s in first + [s for s in stories if s not in first] if s not in used]
    for t in slots:
        iso = t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if iso in taken or not queue:
            continue
        print(queue.pop(0), iso)


def mark(story, publish_at):
    posted = load()
    posted.append({"story": story, "publishAt": publish_at, "made": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")})
    json.dump(posted, open(LOG, "w", encoding="utf-8"), indent=1)


if __name__ == "__main__":
    if sys.argv[1] == "plan":
        plan()
    else:
        mark(sys.argv[2], sys.argv[3])
