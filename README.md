# SVG Text Animator

A browser-based tool that converts text into animated SVG paths. Load any font, type your text, tweak the parameters, and export self-contained SVG + CSS ready to drop into any project.

## Features

- **Font loading** — drag-and-drop or browse for `.ttf`, `.otf`, `.woff`, or `.woff2` files
- **Two render modes**
  - **Stroke Only** — draws each letter's outline using `stroke-dashoffset` animation; compound paths (e.g. dots on *i*, holes in *O*) animate simultaneously and correctly
  - **Sweep Reveal** — reveals letters left-to-right using an SVG mask sweep
- **Two timing modes**
  - **Sequential** — each letter starts after the previous one finishes
  - **Stagger** — all letters start with a fixed offset between them
- **Typography controls** — font size, letter spacing, stroke width
- **Animation controls** — draw speed (px/s), fill speed multiplier, delay between letters
- **Color picker** — preset swatches, custom color input, and a persisted recent-colors history
- **Split code view** — SVG markup and CSS animation shown in separate panels, each with Copy and Download buttons
- **State persistence** — all settings saved to `localStorage` and restored on reload
- **One-click export** — download the full animated `.svg`

## Usage

1. Open the app in any modern browser (no install or build step needed)
2. Drop a font file onto the font drop zone
3. Type your text in the text area
4. Adjust color, typography, and animation settings
5. Click **▶ Generate**
6. Preview the animation, then copy or download the SVG / CSS

## Tech Stack

| Layer | Detail |
|---|---|
| Font parsing | [opentype.js](https://opentype.js.org/) v1.3.4 |
| Animation | Pure CSS (`stroke-dashoffset` / SVG mask) |
| Runtime | Vanilla HTML + CSS + JavaScript — zero dependencies, no build step |
| Deployment | GitHub Actions → GitHub Pages |

## How It Works

1. **Glyph extraction** — opentype.js converts each character to an SVG path string
2. **Sub-path splitting** — compound paths (letter + accent, counter shapes) are split on `M`/`m` move commands into individual `<path>` elements so each can be measured and timed independently
3. **Length measurement** — each sub-path's `getTotalLength()` is measured in a hidden SVG to compute a duration proportional to path length at the chosen speed (px/s)
4. **SVG + CSS generation** — paths are written with `stroke-dasharray` / `stroke-dashoffset` keyframes (Stroke Only) or mask-clip keyframes (Sweep Reveal), with per-letter delays derived from the chosen timing mode
5. **Code split** — the output is split into a bare SVG markup block and a standalone CSS block so they can be used together or embedded separately

## Project Structure

```
svg-text-animator.html   # Single-page app UI
script.js                # All JS — state, pipeline, SVG builders, UI wiring
styles.css               # Styling
.github/workflows/
  deploy.yml             # GitHub Pages deployment
```

## License

MIT
