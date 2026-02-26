// ─── STATE ───────────────────────────────────────────────────────────
let loadedFont = null;
let currentSVG = "";
let currentColor = "#ffffff";
let currentMode = "stroke"; // 'stroke' | 'sweep'
let currentTimingMode = "stagger"; // 'stagger' | 'sequential'
let currentSVGOnly = "";
let currentCSSOnly = "";
let stateInitialized = false; // prevents saveState from firing during init

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
bindRange("fillSpeed", "fillSpeedVal", 1, 2);

// ─── COLOR ───────────────────────────────────────────────────────────
document.querySelectorAll(".color-swatch").forEach((sw) => {
  sw.addEventListener("click", () => {
    document
      .querySelectorAll(".color-swatch")
      .forEach((s) => s.classList.remove("active"));
    sw.classList.add("active");
    currentColor = sw.dataset.color;
    saveState();
  });
});

document.getElementById("customColor").addEventListener("input", (e) => {
  currentColor = e.target.value;
  document
    .querySelectorAll(".color-swatch")
    .forEach((s) => s.classList.remove("active"));
  saveState();
});

// Save to recent when the color picker dialog is confirmed (change fires on close)
document.getElementById("customColor").addEventListener("change", (e) => {
  saveRecentColor(e.target.value);
});

// ─── RECENT COLORS ───────────────────────────────────────────────────
const RECENT_KEY = "svg-animator-recent-colors";
const MAX_RECENT = 7;

function loadRecentColors() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecentColor(hex) {
  let recent = loadRecentColors();
  recent = [hex, ...recent.filter((c) => c !== hex)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  renderRecentColors(recent);
}

function renderRecentColors(recent) {
  const section = document.getElementById("recentColorsSection");
  const row = document.getElementById("recentColorsRow");
  if (!recent || recent.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  row.innerHTML = "";
  recent.forEach((hex) => {
    const sw = document.createElement("div");
    sw.className = "color-swatch";
    sw.style.background = hex;
    sw.dataset.color = hex;
    sw.addEventListener("click", () => {
      document
        .querySelectorAll(".color-swatch")
        .forEach((s) => s.classList.remove("active"));
      sw.classList.add("active");
      currentColor = hex;
    });
    row.appendChild(sw);
  });
}

// Render any saved recent colors on load
renderRecentColors(loadRecentColors());

// ─── PERSIST STATE ────────────────────────────────────────────────────
const STATE_KEY = "svg-animator-state";

function saveState() {
  if (!stateInitialized) return;
  localStorage.setItem(
    STATE_KEY,
    JSON.stringify({
      text: document.getElementById("textInput").value,
      color: currentColor,
      fontSize: document.getElementById("fontSize").value,
      letterSpacing: document.getElementById("letterSpacing").value,
      strokeWidth: document.getElementById("strokeWidth").value,
      drawSpeed: document.getElementById("drawSpeed").value,
      fillSpeed: document.getElementById("fillSpeed").value,
      animDelay: document.getElementById("animDelay").value,
      timingMode: currentTimingMode,
      renderMode: currentMode,
    }),
  );
}

function loadState() {
  let state;
  try {
    state = JSON.parse(localStorage.getItem(STATE_KEY));
  } catch {
    return;
  }
  if (!state) return;

  if (state.text !== undefined)
    document.getElementById("textInput").value = state.text;

  ["fontSize", "letterSpacing", "strokeWidth", "drawSpeed", "fillSpeed", "animDelay"].forEach((id) => {
    if (state[id] !== undefined) {
      const el = document.getElementById(id);
      el.value = state[id];
      el.dispatchEvent(new Event("input"));
    }
  });

  if (state.color) {
    currentColor = state.color;
    document.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("active"));
    const match = [...document.querySelectorAll(".color-swatch")].find(
      (s) => s.dataset.color === state.color,
    );
    if (match) {
      match.classList.add("active");
    } else {
      // Custom color — update the picker's value so it reflects the saved color
      document.getElementById("customColor").value = state.color;
    }
  }

  if (state.timingMode) setTimingMode(state.timingMode);
  if (state.renderMode) setMode(state.renderMode);
}

// Wire up save on all slider and text changes
["fontSize", "letterSpacing", "strokeWidth", "drawSpeed", "fillSpeed", "animDelay"].forEach((id) => {
  document.getElementById(id).addEventListener("input", saveState);
});
document.getElementById("textInput").addEventListener("input", saveState);

// ─── MODE ─────────────────────────────────────────────────────────────
function setMode(m) {
  currentMode = m;
  document.getElementById("modeMask").classList.toggle("active", m === "sweep");
  document
    .getElementById("modeStroke")
    .classList.toggle("active", m === "stroke");
  document.getElementById("fillSpeedRow").style.display =
    m === "stroke" ? "block" : "none";
  saveState();
}

// ─── TIMING MODE ──────────────────────────────────────────────────────
function setTimingMode(m) {
  currentTimingMode = m;
  document
    .getElementById("timingStagger")
    .classList.toggle("active", m === "stagger");
  document
    .getElementById("timingSequential")
    .classList.toggle("active", m === "sequential");
  document.getElementById("delayRow").style.display =
    m === "stagger" ? "block" : "none";
  saveState();
}

// ─── PIPELINE HELPERS ───────────────────────────────────────────────────
function splitSubPaths(pathData) {
  if (!pathData) return [];
  // Split before each M or m move command — each starts a new sub-path
  const parts = pathData.trim().split(/(?=[Mm])/);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

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

    const subPaths = splitSubPaths(svgPath).map((pd) => ({
      pathData: pd,
      pathLength: 0,
    }));
    chars.push({ ch, pathData: svgPath, subPaths, bbox, x, advanceWidth });
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
    c.subPaths.forEach((sp) => {
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", sp.pathData);
      svg.appendChild(path);
      try {
        sp.pathLength = path.getTotalLength();
      } catch (e) {
        sp.pathLength = 0;
      }
    });
    c.pathLength = Math.max(...c.subPaths.map((s) => s.pathLength), 0);
  });

  document.body.removeChild(svg);
}

function buildStrokeOnlySVG(chars, params) {
  const {
    color,
    strokeWidth,
    speed,
    fillSpeed,
    delay,
    timingMode,
    minX,
    minY,
    renderW,
    renderH,
  } = params;

  // Sub-paths shorter than this fraction of the letter's longest stroke are "dots"
  // (diacritics, dots on i/j, punctuation dots, etc.) and are drawn last.
  const DOT_THRESHOLD = 0.2;

  // Pre-process each letter: sort sub-paths longest→shortest, split into main vs dots.
  const letterData = chars.map((c) => {
    const sorted = [...c.subPaths].sort((a, b) => b.pathLength - a.pathLength);
    const maxLen = sorted[0]?.pathLength || 0;
    const cutoff = maxLen * DOT_THRESHOLD;
    // First index where length drops below cutoff = start of dots; -1 means all main.
    let dotsStart = sorted.findIndex((sp) => sp.pathLength < cutoff);
    if (dotsStart === -1) dotsStart = sorted.length;
    const mainLen = sorted
      .slice(0, dotsStart)
      .reduce((s, sp) => s + sp.pathLength, 0);
    return { sorted, dotsStart, mainLen };
  });

  // Build CSS
  let style = "@keyframes draw { to { stroke-dashoffset: 0; } }\n";
  let accumulatedDelay = 0;

  chars.forEach((c, i) => {
    const { sorted, dotsStart, mainLen } = letterData[i];
    const letterBaseDelay =
      timingMode === "sequential" ? accumulatedDelay : i * delay;

    // Sequential timing advances by sum-of-main-strokes so next letter starts
    // as soon as the last main stroke finishes (dots draw simultaneously with next letter).
    if (timingMode === "sequential") accumulatedDelay += mainLen / speed;

    // Main strokes fire one after another (longest first).
    // Dots use the full main-body duration divided by fillSpeed so the user can tune the bleed.
    const dotDuration = (mainLen / (speed * fillSpeed)).toFixed(3);
    let intraDelay = 0;
    sorted.forEach((sp, j) => {
      const spLen = sp.pathLength || 0;
      const isMain = j < dotsStart;
      const duration = isMain ? (spLen / speed).toFixed(3) : dotDuration;
      // Dots all start together after the last main stroke finishes.
      const startDelay = (
        letterBaseDelay + (isMain ? intraDelay : mainLen / speed)
      ).toFixed(3);
      style += `.letter-${i}-sub-${j} { stroke-dasharray: ${spLen}; stroke-dashoffset: ${spLen}; animation: draw ${duration}s linear ${startDelay}s forwards; }\n`;
      if (isMain) intraDelay += spLen / speed;
    });
  });

  // Emit paths in sorted order (longest first = drawn underneath; dots on top).
  let paths = "";
  chars.forEach((c, i) => {
    letterData[i].sorted.forEach((sp, j) => {
      paths += `<path class="letter-${i}-sub-${j}" d="${sp.pathData}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>\n`;
    });
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${renderW} ${renderH}" width="${renderW}" height="${renderH}">\n  <style>\n${style}  </style>\n${paths}</svg>`;
  return svg;
}

function buildSweepRevealSVG(chars, params) {
  const { color, speed, delay, timingMode, minX, minY, renderW, renderH } =
    params;
  const padding = 10;

  // Compute per-letter timing (no CSS needed — animation is SMIL inline on the rect)
  let accumulatedDelay = 0;
  const timings = chars.map((c, i) => {
    const bbox = c.bbox;
    const totalWidth = bbox.x2 - bbox.x1 + padding * 2;
    const duration = totalWidth / speed;
    const delayVal = timingMode === "sequential" ? accumulatedDelay : i * delay;
    accumulatedDelay += duration;
    return { totalWidth, duration, delayVal };
  });

  // defs: one clipPath per letter, rect starts at width=0 and grows via SMIL animate.
  // Using clipPath+SMIL avoids CSS-in-SVG-innerHTML scoping issues that break mask animations.
  let defs = "<defs>\n";
  chars.forEach((c, i) => {
    const bbox = c.bbox;
    const { totalWidth, duration, delayVal } = timings[i];
    const x = (bbox.x1 - padding).toFixed(2);
    const y = (bbox.y1 - padding).toFixed(2);
    const h = (bbox.y2 - bbox.y1 + padding * 2).toFixed(2);
    defs += `  <clipPath id="clip-${i}" clipPathUnits="userSpaceOnUse">\n`;
    defs += `    <rect x="${x}" y="${y}" width="0" height="${h}">\n`;
    defs += `      <animate attributeName="width" from="0" to="${totalWidth.toFixed(2)}" dur="${duration.toFixed(3)}s" begin="${delayVal.toFixed(3)}s" fill="freeze"/>\n`;
    defs += `    </rect>\n`;
    defs += `  </clipPath>\n`;
  });
  defs += "</defs>\n";

  // paths — clip-path reveals each letter from left to right
  let paths = "";
  chars.forEach((c, i) => {
    paths += `<path d="${c.pathData}" fill="${color}" clip-path="url(#clip-${i})"/>\n`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${renderW} ${renderH}" width="${renderW}" height="${renderH}">\n${defs}${paths}</svg>`;
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
  const fillSpeed = parseFloat(document.getElementById("fillSpeed").value);
  const delay = parseFloat(
    (parseInt(document.getElementById("animDelay").value) * 0.01).toFixed(3),
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
      fillSpeed,
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
  const totalSubPaths = chars.reduce(
    (sum, c) => sum + (c.subPaths ? c.subPaths.length : 1),
    0,
  );
  document.getElementById("statPaths").textContent = totalSubPaths;
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
      cssCode.textContent =
        currentCSSOnly ||
        "/* No CSS — animation is embedded in the SVG (SMIL) */";
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

// initialize mode UI to match default state, then restore persisted state
setMode("stroke");
setTimingMode("sequential");
loadState();
stateInitialized = true;

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
