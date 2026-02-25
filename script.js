// ─── STATE ───────────────────────────────────────────────────────────
let loadedFont = null;
let currentSVG = "";
let currentColor = "#ffffff";
let currentMode = "mask"; // 'mask' | 'stroke'

// ─── FONT LOADING ────────────────────────────────────────────────────
const fontFile = document.getElementById("fontFile");
const fontDrop = document.getElementById("fontDrop");
const fontNameEl = document.getElementById("fontName");
const fontError = document.getElementById("fontError");

fontFile.addEventListener("change", (e) => loadFontFile(e.target.files[0]));

fontDrop.addEventListener("dragover", (e) => {
  e.preventDefault();
  fontDrop.classList.add("dragover");
});
fontDrop.addEventListener("dragleave", () =>
  fontDrop.classList.remove("dragover"),
);
fontDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  fontDrop.classList.remove("dragover");
  const f = e.dataTransfer.files[0];
  if (f) loadFontFile(f);
});

async function loadFontFile(file) {
  fontError.style.display = "none";
  try {
    const buf = await file.arrayBuffer();
    loadedFont = opentype.parse(buf);
    fontNameEl.textContent = loadedFont.names.fullName?.en || file.name;
    fontNameEl.style.display = "block";
    fontDrop.querySelector(".drop-text").style.opacity = "0.4";
  } catch (e) {
    fontError.style.display = "block";
    loadedFont = null;
  }
}

// ─── RANGE DISPLAY ───────────────────────────────────────────────────
function bindRange(id, displayId, factor = 1, decimals = 0) {
  const input = document.getElementById(id);
  const display = document.getElementById(displayId);
  const update = () => {
    const v = (parseFloat(input.value) * factor).toFixed(decimals);
    display.textContent = v;
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty("--val", pct + "%");
  };
  input.addEventListener("input", update);
  update();
}

bindRange("fontSize", "sizeVal");
bindRange("letterSpacing", "spacingVal");
bindRange("strokeWidth", "strokeWidthVal");
bindRange("animDuration", "durationVal", 0.1, 1);
bindRange("animDelay", "delayVal", 0.01, 2);

// ─── COLOR ───────────────────────────────────────────────────────────
document.querySelectorAll(".color-swatch").forEach((sw) => {
  sw.addEventListener("click", () => {
    document
      .querySelectorAll(".color-swatch")
      .forEach((s) => s.classList.remove("active"));
    sw.classList.add("active");
    currentColor = sw.dataset.color;
  });
});

document.getElementById("customColor").addEventListener("input", (e) => {
  currentColor = e.target.value;
  document
    .querySelectorAll(".color-swatch")
    .forEach((s) => s.classList.remove("active"));
});

// ─── MODE ─────────────────────────────────────────────────────────────
function setMode(m) {
  currentMode = m;
  document.getElementById("modeMask").classList.toggle("active", m === "mask");
  document
    .getElementById("modeStroke")
    .classList.toggle("active", m === "stroke");
}

// ─── CORE: GENERATE SVG ──────────────────────────────────────────────
function generate() {
  const text = document.getElementById("textInput").value.trim();
  if (!text) return alert("Enter some text first.");
  if (!loadedFont) return alert("Please load a font file (.ttf or .otf).");

  const fontSize = parseInt(document.getElementById("fontSize").value);
  const letterSpacing = parseInt(
    document.getElementById("letterSpacing").value,
  );
  const strokeWidth = parseInt(document.getElementById("strokeWidth").value);
  const duration = (
    parseInt(document.getElementById("animDuration").value) * 0.1
  ).toFixed(2);
  const delay = (
    parseInt(document.getElementById("animDelay").value) * 0.01
  ).toFixed(3);
  const easing = document.getElementById("easing").value;

  // Build glyph path data per character
  const scale = fontSize / loadedFont.unitsPerEm;
  const ascender = loadedFont.ascender * scale;
  const descender = loadedFont.descender * scale;
  const baseline = ascender;

  // Collect per-char path data
  let x = 0;
  const chars = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") {
      const spaceGlyph = loadedFont.charToGlyph(" ");
      x +=
        (spaceGlyph.advanceWidth || loadedFont.unitsPerEm * 0.3) * scale +
        letterSpacing;
      continue;
    }

    const glyph = loadedFont.charToGlyph(ch);
    if (!glyph || !glyph.path) {
      x += fontSize * 0.5 + letterSpacing;
      continue;
    }

    const pathData = glyph.getPath(x, baseline, fontSize);
    const svgPath = pathData.toPathData(3);
    const bbox = pathData.getBoundingBox();
    const advanceWidth =
      (glyph.advanceWidth || loadedFont.unitsPerEm * 0.5) * scale;

    chars.push({ ch, pathData: svgPath, bbox, x, advanceWidth });
    x += advanceWidth + letterSpacing;
  }

  if (chars.length === 0) return alert("No renderable characters found.");

  // Viewbox
  const allBboxes = chars.map((c) => c.bbox).filter((b) => b && isFinite(b.x1));
  const minX = Math.min(...allBboxes.map((b) => b.x1)) - 10;
  const maxX = Math.max(...allBboxes.map((b) => b.x2)) + 10;
  const minY = Math.min(...allBboxes.map((b) => b.y1)) - 10;
  const maxY = Math.max(...allBboxes.map((b) => b.y2)) + 10;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  const renderW = Math.max(vbW, 100);
  const renderH = Math.max(vbH, 40);

  const totalDuration =
    parseFloat(duration) * chars.length +
    parseFloat(delay) * (chars.length - 1);

  // Build SVG
  let svg = "";
  const maskStrokeColor = "#ffffff";

  if (currentMode === "mask") {
    // MASKED FILL approach: text filled below, white stroke mask on top animates
    const masks = chars
      .map((c, i) => {
        const id = `m${i}`;
        const len = estimatePathLength(c.bbox);
        const animDelaySec = (i * parseFloat(delay)).toFixed(3);
        return `    <mask id="${id}">
      <path class="mask-path" d="${c.pathData}"
        stroke="${maskStrokeColor}" stroke-width="${strokeWidth * 1.5}"
        fill="${maskStrokeColor}"
        stroke-linejoin="round" stroke-linecap="round"
        style="stroke-dasharray:${len};stroke-dashoffset:${len};animation:draw ${duration}s ${easing} ${animDelaySec}s forwards"/>
    </mask>`;
      })
      .join("\n");

    const filledPaths = chars
      .map(
        (c, i) =>
          `  <path d="${c.pathData}" fill="${currentColor}" mask="url(#m${i})"/>`,
      )
      .join("\n");

    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${renderW} ${renderH}" width="${renderW}" height="${renderH}">
  <defs>
${masks}
  </defs>
  <style>
    @keyframes draw {
      to { stroke-dashoffset: 0; }
    }
  </style:src>
${filledPaths}
</svg>`;
  } else {
    // STROKE ONLY approach: just animate the outline stroke
    const paths = chars
      .map((c, i) => {
        const len = estimatePathLength(c.bbox);
        const animDelaySec = (i * parseFloat(delay)).toFixed(3);
        return `  <path d="${c.pathData}" fill="none"
    stroke="${currentColor}" stroke-width="${strokeWidth}"
    stroke-linejoin="round" stroke-linecap="round"
    style="stroke-dasharray:${len};stroke-dashoffset:${len};animation:draw ${duration}s ${easing} ${animDelaySec}s forwards"/>`;
      })
      .join("\n");

    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${renderW} ${renderH}" width="${renderW}" height="${renderH}">
  <style>
    @keyframes draw {
      to { stroke-dashoffset: 0; }
    }
  </style>
${paths}
</svg>`;
  }

  currentSVG = svg;

  // Update preview
  document.getElementById("placeholder").style.display = "none";
  const container = document.getElementById("preview-svg-container");
  container.innerHTML = svg;
  document.getElementById("replayBtn").style.display = "block";

  // Update code view
  document.getElementById("codeContent").textContent = formatSVGCode(svg);

  // Update status
  document.getElementById("statPaths").textContent = chars.length;
  document.getElementById("statViewbox").textContent =
    `${Math.round(renderW)}×${Math.round(renderH)}`;
  document.getElementById("statMode").textContent =
    currentMode === "mask" ? "Masked Fill" : "Stroke Only";
  document.getElementById("statSize").textContent =
    `~${(svg.length / 1024).toFixed(1)}kb`;

  document.getElementById("downloadBtn").disabled = false;
}

// Estimate path length from bounding box (good enough for dasharray)
function estimatePathLength(bbox) {
  if (!bbox || !isFinite(bbox.x1)) return 2000;
  const w = Math.abs(bbox.x2 - bbox.x1);
  const h = Math.abs(bbox.y2 - bbox.y1);
  // Perimeter approx: 2*(w+h) * 1.5 for curves
  return Math.round(2 * (w + h) * 2.2);
}

// ─── REPLAY ──────────────────────────────────────────────────────────
function replayAnimation() {
  const container = document.getElementById("preview-svg-container");
  container.innerHTML = "";
  requestAnimationFrame(() => {
    container.innerHTML = currentSVG;
  });
}

// ─── TABS ─────────────────────────────────────────────────────────────
function switchTab(tab, el) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");

  const previewArea = document.getElementById("previewArea");
  const codeView = document.getElementById("code-view");

  if (tab === "preview") {
    previewArea.style.display = "flex";
    codeView.style.display = "none";
    document.getElementById("replayBtn").style.display = currentSVG
      ? "block"
      : "none";
  } else {
    previewArea.style.display = "none";
    codeView.style.display = "block";
    document.getElementById("replayBtn").style.display = "none";
    if (currentSVG) {
      document.getElementById("codeContent").textContent = currentSVG;
    } else {
      document.getElementById("codeContent").textContent =
        "// Generate first to see SVG code";
    }
  }
}

// ─── DOWNLOAD ────────────────────────────────────────────────────────
function downloadSVG() {
  if (!currentSVG) return;
  const blob = new Blob([currentSVG], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "animated-text.svg";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── UTILS ───────────────────────────────────────────────────────────
function formatSVGCode(svg) {
  return svg;
}

// Auto-generate on Enter in textarea (Shift+Enter = newline but we don't support multiline)
document.getElementById("textInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    generate();
  }
});
