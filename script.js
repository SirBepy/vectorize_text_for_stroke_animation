// ─── STATE ───────────────────────────────────────────────────────────
let loadedFont = null;
let currentSVG = "";
let currentColor = "#ffffff";
let currentMode = "stroke"; // 'stroke' | 'sweep'
let currentTimingMode = "stagger"; // 'stagger' | 'sequential'
let currentSVGOnly = "";
let currentCSSOnly = "";

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
bindRange("strokeWidth", "strokeWidthVal", 1, 1);
bindRange("drawSpeed", "drawSpeedVal", 1, 0);
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
  document.getElementById("modeMask").classList.toggle("active", m === "sweep");
  document
    .getElementById("modeStroke")
    .classList.toggle("active", m === "stroke");
}

// ─── TIMING MODE ──────────────────────────────────────────────────────
function setTimingMode(m) {
  currentTimingMode = m;
  document.getElementById("timingStagger").classList.toggle("active", m === "stagger");
  document.getElementById("timingSequential").classList.toggle("active", m === "sequential");
  document.getElementById("delayRow").style.display = m === "stagger" ? "block" : "none";
}

// ─── PIPELINE HELPERS ───────────────────────────────────────────────────
function collectGlyphs(text, font, fontSize, letterSpacing) {
  const scale = fontSize / font.unitsPerEm;
  const ascender = font.ascender * scale;
  const baseline = ascender;

  let x = 0;
  const chars = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") {
      const spaceGlyph = font.charToGlyph(" ");
      x +=
        (spaceGlyph.advanceWidth || font.unitsPerEm * 0.3) * scale +
        letterSpacing;
      continue;
    }

    const glyph = font.charToGlyph(ch);
    if (!glyph || !glyph.path) {
      x += fontSize * 0.5 + letterSpacing;
      continue;
    }

    const pathData = glyph.getPath(x, baseline, fontSize);
    const svgPath = pathData.toPathData(3);
    const bbox = pathData.getBoundingBox();
    const advanceWidth = (glyph.advanceWidth || font.unitsPerEm * 0.5) * scale;

    chars.push({ ch, pathData: svgPath, bbox, x, advanceWidth });
    x += advanceWidth + letterSpacing;
  }

  // sort by x1 in bbox
  chars.sort((a, b) => a.bbox.x1 - b.bbox.x1);
  return chars;
}

function measurePathLengths(chars) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute(
    "style",
    "position:absolute;left:-9999px;top:-9999px;visibility:hidden",
  );
  document.body.appendChild(svg);

  chars.forEach((c) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", c.pathData);
    svg.appendChild(path);
    try {
      c.pathLength = path.getTotalLength();
    } catch (e) {
      c.pathLength = 0;
    }
  });

  document.body.removeChild(svg);
}

function buildStrokeOnlySVG(chars, params) {
  const { color, strokeWidth, speed, delay, timingMode, minX, minY, renderW, renderH } =
    params;

  // style block
  let style = "@keyframes draw { to { stroke-dashoffset: 0; } }\n";
  let accumulatedDelay = 0;
  chars.forEach((c, i) => {
    const len = c.pathLength || 0;
    const duration = (len / speed).toFixed(3);
    const animDelaySec = timingMode === "sequential"
      ? accumulatedDelay.toFixed(3)
      : (i * delay).toFixed(3);
    accumulatedDelay += len / speed;
    style += `.letter-${i} { stroke-dasharray: ${len}; stroke-dashoffset: ${len}; animation: draw ${duration}s linear ${animDelaySec}s forwards; }\n`;
  });

  // paths
  let paths = "";
  chars.forEach((c, i) => {
    paths += `<path class=\"letter-${i}\" d=\"${c.pathData}\" fill=\"none\" stroke=\"${color}\" stroke-width=\"${strokeWidth}\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>\n`;
  });

  const svg = `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"${minX} ${minY} ${renderW} ${renderH}\" width=\"${renderW}\" height=\"${renderH}\">\n  <style>\n${style}  </style>\n${paths}</svg>`;
  return svg;
}

function buildSweepRevealSVG(chars, params) {
  const { color, speed, delay, timingMode, minX, minY, renderW, renderH } =
    params;
  const padding = 10;

  // style block
  let style = "@keyframes sweep { to { stroke-dashoffset: 0; } }\n";
  let accumulatedDelay = 0;
  chars.forEach((c, i) => {
    const bbox = c.bbox;
    const len = (bbox.x2 - bbox.x1) + padding * 2;
    const duration = (len / speed).toFixed(3);
    const animDelaySec = timingMode === "sequential"
      ? accumulatedDelay.toFixed(3)
      : (i * delay).toFixed(3);
    accumulatedDelay += len / speed;
    style += `.sweep-${i} { stroke-dasharray: ${len}; stroke-dashoffset: ${len}; animation: sweep ${duration}s linear ${animDelaySec}s forwards; }\n`;
  });

  // defs (masks)
  let defs = "<defs>\n";
  chars.forEach((c, i) => {
    const bbox = c.bbox;
    const centerY = (bbox.y1 + bbox.y2) / 2;
    const coverageWidth = (bbox.y2 - bbox.y1) + padding * 2;
    const lineAttrs = `x1="${bbox.x1 - padding}" y1="${centerY}" x2="${bbox.x2 + padding}" y2="${centerY}"`;
    defs += `  <mask id="sweep-${i}" maskUnits="userSpaceOnUse">\n`;
    defs += `    <line class="sweep-${i}" ${lineAttrs} stroke="white" stroke-width="${coverageWidth}" stroke-linecap="square"/>\n`;
    defs += `  </mask>\n`;
  });
  defs += "</defs>\n";

  // paths
  let paths = "";
  chars.forEach((c, i) => {
    paths += `<path d="${c.pathData}" fill="${color}" mask="url(#sweep-${i})"/>\n`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${renderW} ${renderH}" width="${renderW}" height="${renderH}">\n  <style>\n${style}  </style>\n${defs}${paths}</svg>`;
  return svg;
}

function splitSVGAndCSS(combinedSVG) {
  const re = /<style>([\s\S]*?)<\/style>/;
  const match = combinedSVG.match(re);
  let css = "";
  let svgOnly = combinedSVG;
  if (match) {
    css = match[1];
    svgOnly = combinedSVG.replace(re, "");
  }
  currentCSSOnly = css;
  currentSVGOnly = svgOnly;
  return { svgOnly, cssOnly: css };
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
  const strokeWidth = parseFloat(document.getElementById("strokeWidth").value);
  const speed = parseInt(document.getElementById("drawSpeed").value);
  const delay = parseFloat(
    (parseInt(document.getElementById("animDelay").value) * 0.01).toFixed(3)
  );

  // collect glyphs, measure paths, build according to mode
  const chars = collectGlyphs(text, loadedFont, fontSize, letterSpacing);
  if (chars.length === 0) return alert("No renderable characters found.");

  // compute viewbox from bboxes
  const allBboxes = chars.map((c) => c.bbox).filter((b) => b && isFinite(b.x1));
  const minX = Math.min(...allBboxes.map((b) => b.x1)) - 10;
  const maxX = Math.max(...allBboxes.map((b) => b.x2)) + 10;
  const minY = Math.min(...allBboxes.map((b) => b.y1)) - 10;
  const maxY = Math.max(...allBboxes.map((b) => b.y2)) + 10;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  const renderW = Math.max(vbW, 100);
  const renderH = Math.max(vbH, 40);

  let svg = "";

  if (currentMode === "stroke") {
    measurePathLengths(chars);
    svg = buildStrokeOnlySVG(chars, {
      color: currentColor,
      strokeWidth,
      speed,
      delay,
      timingMode: currentTimingMode,
      minX,
      minY,
      renderW,
      renderH,
    });
  } else if (currentMode === "sweep") {
    svg = buildSweepRevealSVG(chars, {
      color: currentColor,
      speed,
      delay,
      timingMode: currentTimingMode,
      minX,
      minY,
      renderW,
      renderH,
    });
  }

  // split out css block
  splitSVGAndCSS(svg);
  currentSVG = svg;

  // Update preview
  document.getElementById("placeholder").style.display = "none";
  const container = document.getElementById("preview-svg-container");
  container.innerHTML = svg;
  document.getElementById("replayBtn").style.display = "block";

  // code view updates now handled by panels; no direct write here

  // Update status
  document.getElementById("statPaths").textContent = chars.length;
  document.getElementById("statViewbox").textContent =
    `${Math.round(renderW)}×${Math.round(renderH)}`;
  document.getElementById("statMode").textContent =
    currentMode === "sweep" ? "Sweep Reveal" : "Stroke Only";
  document.getElementById("statSize").textContent =
    `~${(svg.length / 1024).toFixed(1)}kb`;

  document.getElementById("downloadBtn").disabled = false;
  // enable code panel buttons
  document.getElementById("copySvgBtn").disabled = false;
  document.getElementById("downloadSvgBtn").disabled = false;
  document.getElementById("copyCssBtn").disabled = false;
  document.getElementById("downloadCssBtn").disabled = false;
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
    codeView.style.display = "flex";
    document.getElementById("replayBtn").style.display = "none";
    const svgCode = document.getElementById("svgCodeContent");
    const cssCode = document.getElementById("cssCodeContent");
    if (currentSVG) {
      svgCode.textContent =
        currentSVGOnly || "// Generate first to see SVG code";
      cssCode.textContent = currentCSSOnly || "/* Generate first to see CSS */";
    } else {
      svgCode.textContent = "// Generate first to see SVG code";
      cssCode.textContent = "/* Generate first to see CSS */";
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

// initialize mode UI to match default state
setMode("stroke");
setTimingMode("stagger");

// panel button wiring ---------------------------------------------------
const copySvgBtn = document.getElementById("copySvgBtn");
const downloadSvgBtn = document.getElementById("downloadSvgBtn");
const copyCssBtn = document.getElementById("copyCssBtn");
const downloadCssBtn = document.getElementById("downloadCssBtn");

copySvgBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(currentSVGOnly || "");
  const orig = copySvgBtn.textContent;
  copySvgBtn.textContent = "Copied!";
  setTimeout(() => (copySvgBtn.textContent = orig), 1500);
});

copyCssBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(currentCSSOnly || "");
  const orig = copyCssBtn.textContent;
  copyCssBtn.textContent = "Copied!";
  setTimeout(() => (copyCssBtn.textContent = orig), 1500);
});

downloadSvgBtn.addEventListener("click", () => {
  if (!currentSVGOnly) return;
  const blob = new Blob([currentSVGOnly], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "animated-text.svg";
  a.click();
  URL.revokeObjectURL(url);
});

downloadCssBtn.addEventListener("click", () => {
  if (!currentCSSOnly) return;
  const blob = new Blob([currentCSSOnly], { type: "text/css" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "animated-text.css";
  a.click();
  URL.revokeObjectURL(url);
});
