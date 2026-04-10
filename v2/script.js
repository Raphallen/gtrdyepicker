const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const magCanvas = document.getElementById('magCanvas');
const magCtx = magCanvas.getContext('2d');
const magnifier = document.getElementById('magnifier');
const bigSwatch = document.getElementById('bigSwatch');
const dropZone = document.getElementById('dropZone');

let currentRGB = null;
let palette = [];
let img = null;
let pendingLoad = null;
let dragSrcIdx = null;
let lastDeleted = null; // for undo
let zoomLevel = 1;
const ZOOM_MIN = 0.5, ZOOM_MAX = 5, ZOOM_STEP = 0.2;

// pan state
let isPanning = false;
let panStart = null;
let panOffset = { x: 0, y: 0 };

// ─── IMAGE LOADING ────────────────────────────────────────────────────────────
document.getElementById('browseBtn').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('changeImage').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', e => loadImageFile(e.target.files[0]));

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) loadImageFile(e.dataTransfer.files[0]);
});
document.getElementById('canvasArea').addEventListener('dragover', e => e.preventDefault());
document.getElementById('canvasArea').addEventListener('drop', e => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) loadImageFile(e.dataTransfer.files[0]);
});

function loadImageFile(file) {
  if (!file || !['image/png', 'image/jpeg'].includes(file.type)) return;
  img = new Image();
  img.onload = () => {
    zoomLevel = 1;
    panOffset = { x: 0, y: 0 };
    fitCanvas();
    canvas.style.display = 'block';
    dropZone.classList.add('hidden');
    document.getElementById('toolbar').classList.add('visible');
  };
  img.src = URL.createObjectURL(file);
}

function fitCanvas() {
  const area = document.getElementById('canvasArea');
  const scale = Math.min(area.clientWidth / img.width, area.clientHeight / img.height, 1);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  applyZoom();
}
window.addEventListener('resize', () => { if (img) fitCanvas(); });

function applyZoom() {
  canvas.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`;
  canvas.style.transformOrigin = 'center center';
  document.getElementById('zoomLabel').textContent = `${Math.round(zoomLevel * 100)}%`;
}

function zoomIn()  { zoomLevel = Math.min(+(zoomLevel + ZOOM_STEP).toFixed(2), ZOOM_MAX); applyZoom(); }
function zoomOut() { zoomLevel = Math.max(+(zoomLevel - ZOOM_STEP).toFixed(2), ZOOM_MIN); applyZoom(); }
function zoomReset() { zoomLevel = 1; panOffset = { x: 0, y: 0 }; applyZoom(); }

document.getElementById('canvasArea').addEventListener('wheel', e => {
  if (!img) return;
  e.preventDefault();
  e.deltaY < 0 ? zoomIn() : zoomOut();
}, { passive: false });

// ─── PAN (Shift + drag) ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Shift' && img) canvas.style.cursor = 'grab';
});
document.addEventListener('keyup', e => {
  if (e.key === 'Shift') { canvas.style.cursor = 'crosshair'; isPanning = false; }
});

canvas.addEventListener('mousedown', e => {
  if (!e.shiftKey) return;
  isPanning = true;
  panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  canvas.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', e => {
  if (!isPanning) return;
  panOffset.x = e.clientX - panStart.x;
  panOffset.y = e.clientY - panStart.y;
  applyZoom();
});

document.addEventListener('mouseup', e => {
  if (!isPanning) return;
  isPanning = false;
  canvas.style.cursor = e.shiftKey ? 'grab' : 'crosshair';
});

// ─── PICKING ──────────────────────────────────────────────────────────────────
canvas.addEventListener('click', e => {
  if (e.shiftKey) return;
  const rgb = getPixel(e);
  currentRGB = rgb;
  updateDisplay(rgb);
  updateSuggestions(rgb);
  addToPalette(rgb);
});

canvas.addEventListener('mousemove', e => {
  updateDisplay(getPixel(e));
  showMagnifier(e);
});

canvas.addEventListener('mouseleave', () => {
  magnifier.style.display = 'none';
  if (currentRGB) updateDisplay(currentRGB);
  else resetDisplay();
});

function getPixel(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
  const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
  const d = ctx.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data;
  return [d[0], d[1], d[2]];
}

function showMagnifier(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  magnifier.style.display = 'block';
  magnifier.style.left = e.clientX + 'px';
  magnifier.style.top = e.clientY + 'px';
  const zoom = 6, mw = 80, mh = 80;
  magCtx.clearRect(0, 0, mw, mh);
  magCtx.imageSmoothingEnabled = false;
  magCtx.drawImage(canvas, x - mw / zoom / 2, y - mh / zoom / 2, mw / zoom, mh / zoom, 0, 0, mw, mh);
}

// ─── COLOR MATH ───────────────────────────────────────────────────────────────
// Used only internally for rendering swatches
function rgbToCss(r, g, b) { return `rgb(${r},${g},${b})`; }

// Converts RGB to game values (0–512 scale)
function rgbToGame(r, g, b) {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const delta = max - min;
  let hue = 0, sat = 0;
  const val = max;
  if (delta !== 0) {
    sat = delta / max;
    if (max === rf)      hue = ((gf - bf) / delta) % 6;
    else if (max === gf) hue = ((bf - rf) / delta) + 2;
    else                 hue = ((rf - gf) / delta) + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  return [
    Math.min(Math.round(hue / 360 * 512), 512),
    Math.min(Math.round(sat * 512), 512),
    Math.min(Math.round(val * 512), 512),
  ];
}

// Convert game values back to RGB for rendering
function gameToRgb(c, i, b) {
  const hue = (c / 512) * 360;
  const sat = i / 512;
  const val = b / 512;
  if (sat === 0) {
    const v = Math.round(val * 255);
    return [v, v, v];
  }
  const h6 = hue / 60;
  const f = h6 - Math.floor(h6);
  const p = val * (1 - sat);
  const q = val * (1 - f * sat);
  const t = val * (1 - (1 - f) * sat);
  let r, g, bv;
  switch (Math.floor(h6) % 6) {
    case 0: r = val; g = t;   bv = p; break;
    case 1: r = q;   g = val; bv = p; break;
    case 2: r = p;   g = val; bv = t; break;
    case 3: r = p;   g = q;   bv = val; break;
    case 4: r = t;   g = p;   bv = val; break;
    default: r = val; g = p;  bv = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(bv * 255)];
}

function rotateC(c, delta) { return ((c + delta) % 512 + 512) % 512; }

// ─── DISPLAY ──────────────────────────────────────────────────────────────────
function updateDisplay([r, g, b]) {
  const [c, i, bv] = rgbToGame(r, g, b);
  bigSwatch.style.background = rgbToCss(r, g, b);
  bigSwatch.classList.add('has-color');
  document.getElementById('valC').textContent = c;
  document.getElementById('valI').textContent = i;
  document.getElementById('valB').textContent = bv;
  document.getElementById('barC').style.width = `${(c / 512) * 100}%`;
  document.getElementById('barI').style.width = `${(i / 512) * 100}%`;
  document.getElementById('barI').style.background = rgbToCss(r, g, b);
  document.getElementById('barB').style.width = `${(bv / 512) * 100}%`;
  document.getElementById('copyFullBtn').textContent = `COPY  ${c}  /  ${i}  /  ${bv}`;
}

function resetDisplay() {
  bigSwatch.style.background = 'var(--surface2)';
  bigSwatch.classList.remove('has-color');
  ['valC', 'valI', 'valB'].forEach(id => document.getElementById(id).textContent = '—');
  document.getElementById('copyFullBtn').textContent = 'COPY  —  /  —  /  —';
  document.getElementById('barC').style.width = '0%';
  document.getElementById('barI').style.width = '0%';
  document.getElementById('barB').style.width = '0%';
}

// ─── SUGGESTED COLORS ─────────────────────────────────────────────────────────
function getSuggestions(r, g, b) {
  const [c, i, bv] = rgbToGame(r, g, b);
  return [
    { label: 'LIGHT TONE', entries: [[c, Math.max(i - 100, 10), Math.min(bv + 130, 512)], [c, Math.max(i - 150, 5), Math.min(bv + 200, 512)]] },
    { label: 'DARK TONE',  entries: [[c, Math.min(i + 50, 512), Math.max(bv - 100, 10)], [c, Math.min(i + 30, 512), Math.max(bv - 180, 5)]] },
    { label: 'SOFT MATCH', entries: [[rotateC(c, 85), Math.max(i - 80, 10), Math.min(bv + 50, 512)], [rotateC(c, -85), Math.max(i - 80, 10), Math.min(bv + 50, 512)]] },
    { label: 'NEUTRAL',    entries: [[c, Math.max(i - 250, 5), Math.min(bv + 100, 490)], [0, 0, Math.min(bv + 150, 500)]] },
  ];
}

function updateSuggestions(rgb) {
  document.getElementById('harmoniesEmpty').style.display = 'none';
  const grid = document.getElementById('harmoniesGrid');
  grid.style.display = 'flex';
  grid.innerHTML = '';

  const allEntries = [];

  getSuggestions(...rgb).forEach(({ label, entries }) => {
    const row = document.createElement('div');
    row.className = 'harmony-row';

    const lbl = document.createElement('div');
    lbl.className = 'harmony-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const wrap = document.createElement('div');
    wrap.className = 'harmony-swatches';

    entries.forEach(([nc, ni, nb]) => {
      const [r, g, b] = gameToRgb(nc, ni, nb);
      allEntries.push([r, g, b]);
      const sw = document.createElement('div');
      sw.className = 'harmony-swatch';
      sw.style.background = rgbToCss(r, g, b);

      const tip = document.createElement('div');
      tip.className = 'swatch-tip';
      tip.textContent = `${nc}  /  ${ni}  /  ${nb}`;
      sw.appendChild(tip);

      // hover preview without adding
      sw.addEventListener('mouseenter', () => updateDisplay([r, g, b]));
      sw.addEventListener('mouseleave', () => { if (currentRGB) updateDisplay(currentRGB); else resetDisplay(); });

      sw.addEventListener('click', () => {
        currentRGB = [r, g, b];
        updateDisplay([r, g, b]);
        updateSuggestions([r, g, b]);
        addToPalette([r, g, b]);
      });
      wrap.appendChild(sw);
    });

    row.appendChild(wrap);
    grid.appendChild(row);
  });

  // Add All button
  const addAllRow = document.createElement('div');
  addAllRow.style.cssText = 'display:flex;justify-content:flex-end;margin-top:4px;';
  const addAllBtn = document.createElement('button');
  addAllBtn.className = 'add-all-btn';
  addAllBtn.textContent = '+ Add All';
  addAllBtn.addEventListener('click', () => {
    let added = 0;
    allEntries.forEach(([r, g, b]) => {
      const [c, i, bv] = rgbToGame(r, g, b);
      if (!palette.some(p => p.c === c && p.i === i && p.bv === bv)) {
        palette.push({ r, g, b, c, i, bv, name: '', note: '' });
        added++;
      }
    });
    renderPalette();
    showToast(added ? `${added} suggestion${added > 1 ? 's' : ''} added` : 'All already in palette');
  });
  addAllRow.appendChild(addAllBtn);
  grid.appendChild(addAllRow);
}

// ─── PALETTE ──────────────────────────────────────────────────────────────────
function addToPalette([r, g, b]) {
  const [c, i, bv] = rgbToGame(r, g, b);
  const idx = palette.findIndex(p => p.c === c && p.i === i && p.bv === bv);
  if (idx !== -1) {
    const items = document.querySelectorAll('.palette-item');
    if (items[idx]) {
      items[idx].classList.remove('flash');
      void items[idx].offsetWidth;
      items[idx].classList.add('flash');
      items[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    showToast('Color already in palette');
    return;
  }
  palette.push({ r, g, b, c, i, bv, name: '', note: '' });
  renderPalette();
  showToast(`Color ${c}  ·  Intensity ${i}  ·  Brightness ${bv}`);
}

function renderPalette() {
  const list = document.getElementById('paletteList');
  const empty = document.getElementById('paletteEmpty');
  document.getElementById('paletteCount').textContent = palette.length;
  if (!palette.length) {
    empty.style.display = 'flex';
    [...list.children].forEach(el => { if (el !== empty) el.remove(); });
    return;
  }
  empty.style.display = 'none';
  [...list.children].forEach(el => { if (el !== empty) el.remove(); });

  palette.forEach((color, idx) => {
    const item = document.createElement('div');
    item.className = 'palette-item';
    item.tabIndex = 0;
    item.draggable = true;
    item.innerHTML = `
      <div class="item-drag" title="Drag to reorder">⠿</div>
      <div class="item-swatch" style="background:${rgbToCss(color.r, color.g, color.b)}"></div>
      <div class="item-info">
        <div class="item-game">C ${color.c}  ·  I ${color.i}  ·  B ${color.bv}</div>
        <div class="item-name" id="name-${idx}" onclick="editName(${idx})">${color.name || '<span style="color:var(--muted)">click to name…</span>'}</div>
        <div class="item-note" id="note-${idx}" onclick="editNote(${idx})">${color.note || '<span style="color:var(--muted)">add a note…</span>'}</div>
      </div>
      <div class="item-actions">
        <button class="item-action-btn" title="Copy values" onclick="copyItemValues(${idx})">⎘</button>
        <button class="item-action-btn" title="Duplicate" onclick="duplicateColor(${idx})">⧉</button>
        <button class="item-delete" title="Remove" onclick="removeColor(${idx})">✕</button>
      </div>
    `;

    item.addEventListener('click', e => {
      if (e.target.classList.contains('item-delete') || e.target.classList.contains('item-action-btn') || e.target.tagName === 'INPUT' || e.target.classList.contains('item-drag')) return;
      currentRGB = [color.r, color.g, color.b];
      updateDisplay(currentRGB);
      updateSuggestions(currentRGB);
      document.getElementById('harmoniesGrid').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    item.addEventListener('keydown', e => {
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeColor(idx); }
      if (e.key === 'Enter') { currentRGB = [color.r, color.g, color.b]; updateDisplay(currentRGB); updateSuggestions(currentRGB); }
    });
    item.addEventListener('dragstart', e => { dragSrcIdx = idx; item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragend', () => { dragSrcIdx = null; document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom')); });
    item.addEventListener('dragover', e => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      const mid = item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2;
      item.classList.remove('drag-over-top', 'drag-over-bottom');
      item.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over-top', 'drag-over-bottom'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const mid = item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2;
      let target = e.clientY < mid ? idx : idx + 1;
      if (dragSrcIdx < target) target--;
      const moved = palette.splice(dragSrcIdx, 1)[0];
      palette.splice(target, 0, moved);
      renderPalette();
    });

    list.appendChild(item);
  });
}

function copyItemValues(i) {
  const p = palette[i];
  navigator.clipboard.writeText(`${p.c} / ${p.i} / ${p.bv}`).then(() => showToast(`Copied: ${p.c} / ${p.i} / ${p.bv}`));
}

function editName(i) {
  const el = document.getElementById(`name-${i}`);
  const input = document.createElement('input');
  input.value = palette[i].name;
  input.placeholder = 'name this color…';
  input.addEventListener('blur', () => { palette[i].name = input.value.trim(); renderPalette(); if (palette[i].name) showToast('Name saved'); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = palette[i].name; input.blur(); } });
  el.innerHTML = ''; el.appendChild(input); input.focus();
}

function editNote(i) {
  const el = document.getElementById(`note-${i}`);
  const input = document.createElement('input');
  input.value = palette[i].note;
  input.placeholder = 'add a note…';
  input.addEventListener('blur', () => { palette[i].note = input.value.trim(); renderPalette(); if (palette[i].note) showToast('Note saved'); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = palette[i].note; input.blur(); } });
  el.innerHTML = ''; el.appendChild(input); input.focus();
}

function removeColor(i) {
  lastDeleted = { entry: { ...palette[i] }, idx: i };
  palette.splice(i, 1);
  renderPalette();
  showToastWithUndo('Color removed', () => {
    palette.splice(lastDeleted.idx, 0, lastDeleted.entry);
    lastDeleted = null;
    renderPalette();
  });
}

function duplicateColor(i) {
  const copy = { ...palette[i], name: palette[i].name ? palette[i].name + ' (copy)' : '' };
  palette.splice(i + 1, 0, copy);
  renderPalette();
  showToast('Color duplicated');
}

function clearPalette() {
  if (!palette.length) return;
  if (confirm('Clear all colors from the palette?')) { palette = []; renderPalette(); }
}

// ─── COPY ─────────────────────────────────────────────────────────────────────
function copyChannel(ch) {
  if (!currentRGB) return;
  const [c, i, bv] = rgbToGame(...currentRGB);
  const map = { c: ['Color', c], i: ['Intensity', i], b: ['Brightness', bv] };
  const [label, val] = map[ch];
  navigator.clipboard.writeText(String(val)).then(() => showToast(`${label} = ${val} copied`));
}

function copyFull() {
  if (!currentRGB) return;
  const [c, i, bv] = rgbToGame(...currentRGB);
  navigator.clipboard.writeText(`${c} / ${i} / ${bv}`).then(() => {
    const btn = document.getElementById('copyFullBtn');
    btn.textContent = 'COPIED!'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = `COPY  ${c}  /  ${i}  /  ${bv}`; btn.classList.remove('copied'); }, 1500);
  });
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
function saveAsJSON() {
  if (!palette.length) { showToast('Palette is empty'); return; }
  const data = {
    name: 'TRFA Palette',
    savedAt: new Date().toISOString(),
    colors: palette.map(p => ({ color: p.c, intensity: p.i, brightness: p.bv, name: p.name, note: p.note }))
  };
  download('trfa-palette.json', JSON.stringify(data, null, 2), 'application/json');
  flashSaveBtn('json-btn');
  showToast('Saved as JSON');
}

function saveAsPNG() {
  if (!palette.length) { showToast('Palette is empty'); return; }
  const cols = Math.min(palette.length, 4);
  const rows = Math.ceil(palette.length / cols);
  const sw = 160, sh = 100, labelH = 52;
  const oc = document.createElement('canvas');
  oc.width = sw * cols;
  oc.height = (sh + labelH) * rows + 10;
  const oc2 = oc.getContext('2d');
  oc2.fillStyle = '#fdf6f0';
  oc2.fillRect(0, 0, oc.width, oc.height);
  palette.forEach((p, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * sw, y = row * (sh + labelH);
    oc2.fillStyle = rgbToCss(p.r, p.g, p.b);
    oc2.fillRect(x, y, sw, sh);
    oc2.textAlign = 'center';
    oc2.fillStyle = '#e8623a'; oc2.font = 'bold 10px monospace';
    oc2.fillText(`C ${p.c}  I ${p.i}  B ${p.bv}`, x + sw / 2, y + sh + 14);
    if (p.name) {
      oc2.fillStyle = '#3d1f10'; oc2.font = 'bold 10px monospace';
      oc2.fillText(p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name, x + sw / 2, y + sh + 28);
    }
    if (p.note) {
      oc2.fillStyle = '#a07060'; oc2.font = 'italic 9px monospace';
      oc2.fillText(p.note.length > 22 ? p.note.slice(0, 21) + '…' : p.note, x + sw / 2, y + sh + 42);
    }
  });
  oc.toBlob(blob => { download('trfa-palette.png', blob, 'image/png', true); flashSaveBtn('png-btn'); showToast('Saved as PNG'); });
}

function flashSaveBtn(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.classList.add('saved');
  setTimeout(() => btn.classList.remove('saved'), 500);
}

function download(name, data, type, isBlob = false) {
  const a = document.createElement('a');
  a.download = name;
  a.href = isBlob ? URL.createObjectURL(data) : URL.createObjectURL(new Blob([data], { type }));
  a.click();
}

// ─── LOAD PALETTE ─────────────────────────────────────────────────────────────
document.getElementById('paletteFileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const raw = JSON.parse(ev.target.result);
      const arr = Array.isArray(raw) ? raw : (raw.colors || []);
      const colors = arr.map(entry => {
        const c = entry.color ?? entry.c;
        const i = entry.intensity ?? entry.i;
        const b = entry.brightness ?? entry.b;
        if (typeof c === 'number' && typeof i === 'number' && typeof b === 'number') {
          const [r, g, bv] = gameToRgb(c, i, b);
          return { r, g, b: bv, c, i, bv, name: entry.name || '', note: entry.note || '' };
        }
        return null;
      }).filter(Boolean);

      if (!colors.length) { showToast('No valid colors found in file'); return; }

      pendingLoad = colors;
      document.getElementById('loadModalDesc').textContent =
        `Found ${colors.length} color${colors.length > 1 ? 's' : ''} — add to your palette or replace it entirely.`;
      const preview = document.getElementById('loadPreview');
      preview.innerHTML = '';
      colors.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'modal-swatch';
        sw.style.background = rgbToCss(c.r, c.g, c.b);
        sw.title = `C ${c.c}  I ${c.i}  B ${c.b}`;
        preview.appendChild(sw);
      });
      document.getElementById('loadModal').classList.add('open');
    } catch (err) {
      showToast('Invalid JSON file');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

function applyLoad(mode) {
  if (!pendingLoad) return;
  if (mode === 'replace') {
    palette = pendingLoad.slice();
    showToast(`Palette replaced with ${palette.length} colors`);
  } else {
    let added = 0;
    pendingLoad.forEach(c => {
      if (!palette.some(p => p.c === c.c && p.i === c.i && p.bv === c.bv)) {
        palette.push(c); added++;
      }
    });
    showToast(added ? `${added} color${added > 1 ? 's' : ''} merged into palette` : 'All colors already in palette');
  }
  renderPalette();
  closeLoadModal();
}

function closeLoadModal() {
  document.getElementById('loadModal').classList.remove('open');
  pendingLoad = null;
}

document.getElementById('loadModal').addEventListener('click', e => {
  if (e.target === document.getElementById('loadModal')) closeLoadModal();
});

// ─── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${msg}</span>`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function showToastWithUndo(msg, undoFn) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${msg}</span><button class="toast-undo" onclick="(${undoFn.toString()})();this.closest('.toast').classList.remove('show')">UNDO</button>`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}
