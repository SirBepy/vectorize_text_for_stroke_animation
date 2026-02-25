# SVG Text Handwriting Animator

A browser-based tool that converts typed text + a custom font into an animated SVG with a **handwriting/draw-on effect** — the kind where an invisible pen progressively draws each letter.

---

## Background / Why This Exists

Standard SVG text-to-path tools (Inkscape, Photopea, etc.) produce filled outlines. The problem: the `stroke-dashoffset` animation trick — which is the standard way to create a "writing" effect — only works on **strokes**, not fills. A fill is either there or it isn't; you can't draw it progressively.

So to animate text being "written", you need the text paths to be **centerline strokes** (single-line pen paths), not filled outlines.

### Two Approaches (both should be supported)

**1. Stroke Only** — for monoline/single-stroke fonts. Animate `stroke-dashoffset` directly on the outline path. Clean and simple.

**2. Masked Fill** — for calligraphy/variable-width fonts (thick/thin strokes). Works by layering:
- Bottom layer: the filled letter in the desired color
- Top layer: a white stroke mask that animates across the letter, revealing it underneath

Reference: https://css-tricks.com/how-to-get-handwriting-animation-with-irregular-svg-strokes/

---

## What the Tool Should Do

### Input
- **Custom font** — user loads a `.ttf` or `.otf` file from their local machine
- **Text** — typed by the user (single line, no multiline needed for v1)
- **Color** — preset swatches + custom color picker
- **Font size**
- **Letter spacing**
- **Stroke width** (for the mask stroke / stroke-only mode)
- **Animation settings**: duration per letter, delay between letters, easing curve
- **Render mode toggle**: "Masked Fill" vs "Stroke Only"

### Output
- Live animated preview in the browser (with replay button)
- SVG code view (copyable)
- Download as `.svg` file — self-contained with embedded `<style>` and `@keyframes`, no external dependencies

---

## Technical Approach

Use **opentype.js** (CDN: `https://cdnjs.cloudflare.com/ajax/libs/opentype.js/1.3.4/opentype.min.js`) to:
1. Parse the uploaded font file from an `ArrayBuffer`
2. Call `font.charToGlyph(char).getPath(x, baseline, fontSize)` per character
3. Call `.toPathData()` to get the SVG `d` attribute string
4. Manually track x-advance: `glyph.advanceWidth * scale + letterSpacing`

### Masked Fill SVG structure
```svg
<svg>
  <defs>
    <mask id="m0">
      <path class="mask-path" d="..."
        stroke="white" stroke-width="[strokeWidth]"
        fill="white"
        style="stroke-dasharray:[len]; stroke-dashoffset:[len];
               animation: draw [duration]s [easing] [delay]s forwards"/>
    </mask>
  </defs>
  <style>
    @keyframes draw { to { stroke-dashoffset: 0; } }
  </style>
  <path d="..." fill="[color]" mask="url(#m0)"/>
</svg>
```

### Stroke Only SVG structure
```svg
<svg>
  <style>
    @keyframes draw { to { stroke-dashoffset: 0; } }
  </style>
  <path d="..." fill="none"
    stroke="[color]" stroke-width="[strokeWidth]"
    style="stroke-dasharray:[len]; stroke-dashoffset:[len];
           animation: draw [duration]s [easing] [delay]s forwards"/>
</svg>
```

### Path length
`stroke-dasharray` needs a value >= the actual path length to work. Options:
- **Estimated**: `2 * (bbox.width + bbox.height) * 2.2` — fast, works well for most glyphs
- **Accurate**: Inject paths into a hidden DOM SVG, call `path.getTotalLength()`, then generate final SVG — slower but precise

Recommend: estimate first, with an option or auto-fallback to DOM-based measurement.

---

## What's Missing / Open Questions

### Functionality gaps
1. **Accurate path lengths** — bounding-box estimation is imprecise. For complex glyphs (cursive, ligatures) the animation may cut off early or have visible gaps. DOM-based `getTotalLength()` after a hidden render would solve this.

2. **Multiline support** — not needed for v1 but consider it. Would require line-height config and baseline tracking.

3. **System font picker** — ideally the user could pick from fonts already installed on their OS rather than uploading a file every time. The Font Access API (`window.queryLocalFonts()`) can do this but requires a permissions prompt and Chrome 103+. Worth exploring as a progressive enhancement.

4. **Path direction / draw order** — opentype.js gives you the outline path, but the draw direction depends on how the font was authored. Some fonts draw letters in unexpected orders (e.g., the crossbar of an "A" before the legs). For v1 this is acceptable; for v2 you'd want manual path reordering per glyph.

5. **Ligature & kerning support** — opentype.js supports `font.kerningPairs` and GPOS tables. Manual x-advance with `letterSpacing` offset is an approximation. Real kerning would improve quality for display fonts.

6. **WOFF/WOFF2 support** — opentype.js doesn't natively parse WOFF2 (compressed). Would need a WOFF2 decompressor (e.g., `wawoff2` npm package) or just restrict to TTF/OTF.

7. **Animation preview background** — checkerboard is useful for transparent SVGs but you'd want a configurable preview bg color so you can see light text.

8. **Stroke color for mask** — in Masked Fill mode the mask stroke is always white. This means it only works on white/light backgrounds. The mask reveal color should ideally be calculated or overrideable.

### Nice-to-haves for v2
- Per-letter animation delay curve (ease in across the whole word, not per letter)
- Export as CSS + SVG separately (for devs who want to manage the animation themselves)
- Stagger direction: left-to-right, right-to-left, random
- GSAP export option (drawSVG plugin syntax)
- Copy as React component

---

## Dependencies
- `opentype.js` v1.3.4 — font parsing and glyph path extraction
- No other runtime dependencies needed; pure HTML/CSS/JS

---

## Scope for v1
Single HTML file, no build step, no framework. Load in browser, works offline.
