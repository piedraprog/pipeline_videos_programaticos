# From a reference video to a style recipe

1. **Get the video** (e.g. an Instagram/TikTok link). Download it only for internal analysis, e.g. `yt-dlp <url> -o references/<name>/ref.mp4`. Do not publish it or put it in the repo (`.gitignore`).
2. **Extract frames:**
   - Overview: `ffmpeg -i ref.mp4 -vf fps=2,scale=360:-1,tile=8x6 sheet.png`
   - Every cut: `ffmpeg -i ref.mp4 -vf "select='gt(scene,0.3)',showinfo" -vsync vfr cut%03d.png`
3. **Measure:**
   - Average shot length: count the cuts ÷ duration. Use it to choose BPM and timing.
   - Transition type (hard cut, wipe, zoom, match cut).
   - Color: `ffmpeg -i ref.mp4 -vf palettegen pal.png`. Map those colors to the brand's palette roles; never copy the reference's colors as-is.
   - Typography: classify it (condensed/serif/rounded/mono) and look for a free equivalent (Google Fonts, TTF in `engines/gsap/fonts/`).
   - Text entry: per letter or per word; slam / wipe / pop / blur.
   - Camera: static / drift / punch-in. Texture: grain, paper, glow.
   - Audio: tempo (`aubio tempo ref.mp4` or count beats) and character (punchy, minimal, playful…).
4. **Write `styles/<name>.json`** mapping each observation to the fields in `styles/README.md`. Add a `notes` field with the source link and what was taken from it.
5. **Validate:** a plan with `"style":"<name>"` + `--qa-only` + contact sheet. Compare it side by side with `sheet.png` from the reference.

Rule: take the *grammar* (rhythm, transitions, hierarchy), not the assets (logos, footage, exact copy).
