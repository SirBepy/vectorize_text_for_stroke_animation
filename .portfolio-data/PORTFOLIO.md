## The What

A browser-based tool that turns any text into animated SVG paths. Load a .ttf or .otf font, type your text, tweak animation parameters, and export a self-contained SVG file with CSS keyframe animations baked in. Supports two render modes: stroke drawing (line-by-line outline animation) and sweep reveal (left-to-right fill wipe).

## The Why

Creating animated text SVGs by hand is tedious. You need to extract font paths, measure stroke lengths, calculate timing offsets, and write repetitive CSS. This tool automates the entire pipeline, letting you go from "I want animated text" to a production-ready SVG in seconds.

## The How

The core challenge is turning font glyphs into individually timed SVG paths. opentype.js parses the font binary and extracts path data per character. Each glyph's path is split on move commands into sub-paths, which are measured via `getTotalLength()` in a hidden SVG. Shorter sub-paths (dots, diacritics) are detected using a threshold ratio and animated separately from the main strokes, so an "i" draws its body first and then pops the dot. All timing is computed proportionally to path length at a user-defined speed (px/s), producing natural-looking draw animations regardless of font complexity.
