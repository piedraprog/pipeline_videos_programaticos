# Third-party notices

The MIT license in `LICENSE` covers the source code of this repository only.
The items below keep their own terms.

## Brand assets (not licensed)

Everything under `brands/` (logos, wordmarks, palettes, messaging, screenshots)
belongs to its respective owner and is included only as a working example of a
brand kit. It is **not** covered by the MIT license. Do not reuse those assets;
replace them with your own brand kit.

## Fonts (SIL Open Font License 1.1)

| Files | Font |
|---|---|
| `engines/gsap/fonts/Anton.ttf` | Anton |
| `engines/gsap/fonts/DMMono.ttf` | DM Mono |
| `engines/gsap/fonts/Fraunces.ttf`, `Fraunces-Italic.ttf` | Fraunces |
| `engines/gsap/fonts/Fredoka.ttf` | Fredoka |
| `engines/gsap/fonts/ISerif.ttf` | Instrument Serif |
| `engines/gsap/fonts/Inter.ttf` | Inter |
| `demos/studio-store/fonts/manrope.ttf` | Manrope |

Copyright notices and the full license text are in `engines/gsap/fonts/OFL.txt`
and `demos/studio-store/fonts/OFL.txt`.

## Dependencies with non-open-source licenses

These are installed from npm and are not redistributed in this repository. You
accept their terms when you install and use them.

- **GSAP** — Webflow's Standard "No Charge" GSAP License
  (https://gsap.com/standard-license). Free, including commercial use, with
  restrictions on building tools that compete with Webflow's visual animation
  products. It is not an OSI open-source license.
- **Remotion** — Remotion License
  (https://github.com/remotion-dev/remotion/blob/main/LICENSE.md). Free for
  individuals, non-profits and for-profit organizations with up to 3 employees.
  Larger companies need a Remotion Company License. Only the Remotion engine
  (`templates/`, `bun run render -- <project>`) uses it; the GSAP engine does
  not.

All other dependencies are listed in `package.json` and `requirements.txt` with
their own licenses.
