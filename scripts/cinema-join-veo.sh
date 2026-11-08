#!/usr/bin/env bash
# Join Veo/Flow clips into one Short: crop Flow's black bars, fill 1080x1920,
# dip-to-black between clips, hook text for the first 2 s, a low boom at 0:00
# and under each cut, loudness -14 LUFS. Keeps Veo's own audio.
# Usage: cinema-join-veo.sh out.mp4 "Hook text" font.ttf clip1.mp4[:xshift] clip2.mp4[:xshift] ...
#   xshift = horizontal offset (px, can be negative) of the 9:16 crop from centre.
set -euo pipefail
out=$1; hook=$2; font=$3; shift 3
T=0.6   # transition length (s)
args=(); fc=""; n=0; offs=(); acc=0
for spec in "$@"; do
  f=${spec%%:*}; xs=0; [[ $spec == *:* ]] && xs=${spec##*:}
  args+=(-i "$f")
  # find the picture area inside the black bars
  crop=$(ffmpeg -i "$f" -vf cropdetect=24:2:0 -t 4 -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -1 | cut -d= -f2)
  IFS=: read cw ch cx cy <<<"$crop"
  w=$(( ch*9/16 )); w=$(( w - w%2 )); x=$(( cx + (cw-w)/2 + xs ))
  (( x < cx )) && x=$cx; (( x+w > cx+cw )) && x=$(( cx+cw-w ))
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  fc+="[$n:v]crop=$w:$ch:$x:$cy,scale=1080:1920:flags=lanczos,unsharp=5:5:0.6,setsar=1,fps=24,format=yuv420p,trim=0:$d,setpts=PTS-STARTPTS[v$n];"
  fc+="[$n:a]aresample=48000,atrim=0:$d,asetpts=PTS-STARTPTS[a$n];"
  offs+=("$d"); n=$((n+1))
done
# chain the transitions
vl="v0"; al="a0"; acc=${offs[0]}; booms=(0)
for ((i=1;i<n;i++)); do
  o=$(echo "$acc - $T" | bc -l)
  fc+="[$vl][v$i]xfade=transition=fadeblack:duration=$T:offset=$o[vx$i];"
  fc+="[$al][a$i]acrossfade=d=$T:c1=tri:c2=tri[ax$i];"
  vl="vx$i"; al="ax$i"; booms+=("$o"); acc=$(echo "$o + ${offs[$i]}" | bc -l)
done
# hook text, first 2 s, fades out; split into two lines at the middle word
read -ra words <<<"$hook"; h=$(( (${#words[@]}+1)/2 ))
l1="${words[*]:0:$h}"; l2="${words[*]:$h}"
dt="fontfile=$font:fontsize=110:fontcolor=white:borderw=5:bordercolor=black@0.7:shadowx=0:shadowy=6:shadowcolor=black@0.5:x=(w-text_w)/2:alpha='if(lt(t,1.6),1,max(0,1-(t-1.6)/0.4))':enable='lt(t,2)'"
fc+="[$vl]drawtext=$dt:text='${l1^^}':y=h*0.60,drawtext=$dt:text='${l2^^}':y=h*0.60+130[vout];"
# sub boom (45 Hz thump + rumble) at 0:00 and under each dip to black
boom="aevalsrc='0.9*sin(2*PI*42*t)*exp(-2.5*t)+0.5*sin(2*PI*28*t)*exp(-1.5*t)':s=48000:d=3,aformat=channel_layouts=stereo"
k=0; mix="[$al]"
for b in "${booms[@]}"; do
  ms=$(printf '%.0f' "$(echo "$b*1000" | bc -l)")
  fc+="$boom,adelay=$ms|$ms[b$k];"; mix+="[b$k]"; k=$((k+1))
done
fc+="${mix}amix=inputs=$((k+1)):normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]"
ffmpeg -y -v error "${args[@]}" -filter_complex "$fc" -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$out"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$out"
