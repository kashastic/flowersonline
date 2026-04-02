'use strict';

/* ═══════════════════════════════════════════════════
   FLOWER CATALOGUE
═══════════════════════════════════════════════════ */
const FLOWERS = [
  { id: 'rose',      label: 'Rose'           },
  { id: 'tulip',     label: 'Tulip'          },
  { id: 'sunflower', label: 'Sunflower'      },
  { id: 'daisy',     label: 'Daisy'          },
  { id: 'lily',      label: 'Lily'           },
  { id: 'cherry',    label: 'Cherry Blossom' },
  { id: 'lavender',  label: 'Lavender'       },
  { id: 'peony',     label: 'Peony'          },
];

const MAX = 15;
const GOLDEN_ANGLE = 2.39996; // 137.508° — sunflower spiral

/* ═══════════════════════════════════════════════════
   BOUQUET STATE  (ordered array, not a dict)
   Each entry: { id, key }  — key is permanent unique ID
   Position 0 = center/apex of dome, grows outward.
═══════════════════════════════════════════════════ */
let bouquetState = [];
let nextKey = 0;

/* ── DOM caches for smooth transitions ── */
const miniFlowerEls = new Map();   // key → <div> in mini preview

/* ═══════════════════════════════════════════════════
   PHYLLOTAXIS LAYOUT
   Generates tight, natural dome positions using the
   golden-angle sunflower spiral.
   maxR: max radius from center for the given count.
   xScale: horizontal compression (makes dome look natural).
   domeSlope: how much outer flowers drop (dome curvature).
═══════════════════════════════════════════════════ */
function phyllotaxis(count, { maxR = 80, xScale = 0.78, domeSlope = 0.30 } = {}) {
  const positions = [];
  if (count === 0) return positions;

  // k scales so that the outermost flower sits at maxR
  const k = count > 1 ? maxR / Math.sqrt(count - 1) : 0;

  for (let i = 0; i < count; i++) {
    const r  = k * Math.sqrt(i);
    const θ  = i * GOLDEN_ANGLE;

    const x     = r * Math.cos(θ) * xScale;   // horizontal spread
    const y     = r * domeSlope;               // dome drop (outward = lower)
    const z     = Math.round(100 - r);         // z-index (center in front)

    positions.push({ x, y, z, r });
  }
  return positions;
}

/* ═══════════════════════════════════════════════════
   URL ENCODE / DECODE
═══════════════════════════════════════════════════ */
function encode(flowers, message) {
  const json  = JSON.stringify({ flowers, message });
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}
function decode(str) {
  try {
    const bin   = atob(str);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}
function detectMode() {
  const b = new URLSearchParams(location.search).get('b');
  if (b) { const d = decode(b); if (d) return { mode: 'viewer', data: d }; }
  return { mode: 'builder' };
}

/* ═══════════════════════════════════════════════════
   BUILDER — GRID
═══════════════════════════════════════════════════ */
function buildGrid() {
  const grid = document.getElementById('flowerGrid');
  FLOWERS.forEach(f => {
    const card = document.createElement('div');
    card.className = 'flower-card';
    card.dataset.id = f.id;
    card.innerHTML = `
      <svg width="64" height="80" viewBox="0 0 80 100" overflow="visible" aria-hidden="true"><use href="#svg-${f.id}"/></svg>
      <div class="flower-name">${f.label}</div>
      <div class="flower-badge" id="badge-${f.id}">0</div>`;
    card.addEventListener('click',       () => onAdd(f.id));
    card.addEventListener('contextmenu', e  => { e.preventDefault(); onRemove(f.id); });
    grid.appendChild(card);
  });
}

/* ─── Add / Remove ─── */
function onAdd(id) {
  if (bouquetState.length >= MAX) { toast(`Bouquet full — max ${MAX} flowers 🌸`); return; }
  bouquetState.push({ id, key: nextKey++ });
  syncBadges();
  updateMini();
  syncBar();
}

function onRemove(id) {
  // Remove the LAST added instance of this flower type
  for (let i = bouquetState.length - 1; i >= 0; i--) {
    if (bouquetState[i].id === id) {
      const [removed] = bouquetState.splice(i, 1);
      removeMiniEl(removed.key);
      break;
    }
  }
  syncBadges();
  updateMini();
  syncBar();
}

function syncBadges() {
  const counts = {};
  bouquetState.forEach(f => { counts[f.id] = (counts[f.id] || 0) + 1; });
  FLOWERS.forEach(f => {
    const n = counts[f.id] || 0;
    document.getElementById(`badge-${f.id}`).textContent = n;
    document.getElementById(`badge-${f.id}`).classList.toggle('show', n > 0);
    document.querySelector(`[data-id="${f.id}"]`)?.classList.toggle('active', n > 0);
  });
}

function syncBar() {
  const t = bouquetState.length;
  document.getElementById('totalCount').textContent = t;
  document.getElementById('countBar').style.width = `${(t / MAX) * 100}%`;
}

/* ═══════════════════════════════════════════════════
   MINI BOUQUET PREVIEW
   Uses DOM diffing so flowers smoothly slide to new
   positions instead of re-rendering from scratch.
═══════════════════════════════════════════════════ */
const MINI_W  = 52;   // px — flower element width
const MINI_H  = 65;   // px — flower element height
const MINI_CX = 95;   // center-x of .mini-flowers container
const MINI_CY = 118;  // center-y (base of dome, flowers bloom up)
const MINI_MAX_R = 58;

function updateMini() {
  const count = bouquetState.length;
  const empty   = document.getElementById('miniEmpty');
  const wrapper = document.getElementById('miniBouquet');

  if (count === 0) {
    empty.style.display   = '';
    wrapper.style.display = 'none';
    return;
  }
  empty.style.display   = 'none';
  wrapper.style.display = '';

  const container = document.getElementById('miniFlowers');
  const positions = phyllotaxis(count, { maxR: MINI_MAX_R, xScale: 0.76, domeSlope: 0.28 });

  bouquetState.forEach(({ id, key }, i) => {
    const pos  = positions[i];
    const left = MINI_CX + pos.x - MINI_W * 0.5;
    const top  = MINI_CY + pos.y - MINI_H;          // base of flower at (cx+x, cy+y)

    if (miniFlowerEls.has(key)) {
      // ── Update position (CSS transition handles animation) ──
      const el = miniFlowerEls.get(key);
      el.style.left   = `${left}px`;
      el.style.top    = `${top}px`;
      el.style.zIndex = pos.z;
    } else {
      // ── Create new flower element ──
      const el = document.createElement('div');
      el.className = 'mini-flower-item';
      el.style.cssText = `
        position:absolute;
        left:${left}px; top:${top}px;
        z-index:${pos.z};
        width:${MINI_W}px;
        transform-origin:bottom center;
        opacity:0;
        transform:scale(0) rotate(-18deg);
      `;
      el.innerHTML = `<svg width="${MINI_W}" height="${MINI_H}" viewBox="0 0 80 100" overflow="visible"><use href="#svg-${id}"/></svg>`;
      container.appendChild(el);
      miniFlowerEls.set(key, el);

      // Trigger pop-in on next frame
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity   = '1';
        el.style.transform = 'scale(1) rotate(0deg)';
      }));
    }
  });
}

function removeMiniEl(key) {
  const el = miniFlowerEls.get(key);
  if (!el) return;
  el.style.opacity   = '0';
  el.style.transform = 'scale(0) rotate(10deg)';
  setTimeout(() => { el.remove(); miniFlowerEls.delete(key); }, 400);
}

/* ═══════════════════════════════════════════════════
   MESSAGE + BUTTONS
═══════════════════════════════════════════════════ */
function setupMessage() {
  const ta = document.getElementById('messageInput');
  const cc = document.getElementById('charCount');
  ta.addEventListener('input', () => { cc.textContent = ta.value.length; });
}

function setupButtons() {
  document.getElementById('generateBtn').addEventListener('click', copyLink);
  document.getElementById('previewBtn').addEventListener('click', openPreview);
}

function getPayload() {
  // Convert bouquetState to {id, count} format for URL encoding
  const counts = {};
  bouquetState.forEach(f => { counts[f.id] = (counts[f.id] || 0) + 1; });
  const flowers = Object.entries(counts).map(([id, count]) => ({ id, count }));
  const message = document.getElementById('messageInput').value.trim();
  return { flowers, message };
}

function copyLink() {
  const { flowers, message } = getPayload();
  if (!flowers.length) { toast('Pick at least one flower first 🌸'); return; }
  const url = `${location.origin}${location.pathname}?b=${encode(flowers, message)}`;
  navigator.clipboard.writeText(url)
    .then(() => toast('Link copied — send it to her ✦'))
    .catch(() => {
      const inp = Object.assign(document.createElement('input'), { value: url });
      document.body.appendChild(inp); inp.select(); document.execCommand('copy'); inp.remove();
      toast('Link copied — send it to her ✦');
    });
}

function openPreview() {
  const { flowers, message } = getPayload();
  if (!flowers.length) { toast('Pick at least one flower first 🌸'); return; }
  window.open(`${location.origin}${location.pathname}?b=${encode(flowers, message)}`, '_blank');
}

/* ═══════════════════════════════════════════════════
   VIEWER
═══════════════════════════════════════════════════ */
const VIEW_W    = 92;    // flower element width  in viewer
const VIEW_H    = 115;   // flower element height in viewer
const VIEW_CX   = 160;   // center-x of .vflowers container  (half of 320px)
const VIEW_CY   = 220;   // center-y (base of dome)
const VIEW_MAX_R = 108;

function runViewer(data) {
  document.getElementById('builder').style.display = 'none';
  document.getElementById('viewer').style.display  = '';

  startPetalCanvas();

  // Expand flowers list (count → repeated ids)
  const flowers = [];
  data.flowers.forEach(({ id, count }) => {
    for (let i = 0; i < count; i++) flowers.push(id);
  });
  // Shuffle for visual variety
  for (let i = flowers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flowers[i], flowers[j]] = [flowers[j], flowers[i]];
  }

  const count     = flowers.length;
  const positions = phyllotaxis(count, { maxR: VIEW_MAX_R, xScale: 0.76, domeSlope: 0.30 });
  const stage     = document.getElementById('vFlowers');

  // Build elements — bloom in sequentially
  flowers.forEach((id, i) => {
    const pos  = positions[i];
    const left = VIEW_CX + pos.x - VIEW_W * 0.5;
    const top  = VIEW_CY + pos.y - VIEW_H;

    const el = document.createElement('div');
    el.className = 'vflower';
    el.style.cssText = `
      position:absolute;
      left:${left}px; top:${top}px;
      z-index:${pos.z};
      width:${VIEW_W}px;
      transform-origin:bottom center;
      --sway-dur:${3.2 + (i % 6) * 0.35}s;
      --sway-delay:${0.8 + i * 0.06}s;
    `;
    el.innerHTML = `<svg width="${VIEW_W}" height="${VIEW_H}" viewBox="0 0 80 100" overflow="visible"><use href="#svg-${id}"/></svg>`;
    stage.appendChild(el);

    setTimeout(() => {
      el.classList.add('bloom');
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'scale(1)';
        el.classList.remove('bloom');
        el.classList.add('sway');
      }, 800);
    }, 500 + i * 160);
  });

  // Wrap + bow reveal
  const wrapDelay = 500 + count * 160 + 250;
  setTimeout(() => {
    document.getElementById('vWrap').classList.add('reveal');
    setTimeout(() => {
      document.querySelector('.vbow').classList.add('reveal');
      document.getElementById('bouquetTilt').classList.add('swaying');
    }, 350);
  }, wrapDelay);

  // Message
  const msgDelay = wrapDelay + 550;
  const msgEl = document.getElementById('viewerMessage');
  if (data.message) {
    msgEl.textContent = `"${data.message}"`;
  } else {
    msgEl.style.display = 'none';
  }
  setTimeout(() => {
    document.getElementById('bouquet3dWrapper').classList.add('arrive');
    setTimeout(() => {
      document.getElementById('viewerMessageWrap').classList.add('reveal');
    }, msgDelay - 200);
  }, 200);

  document.getElementById('backBtn').addEventListener('click', () => {
    location.href = location.pathname;
  });
}

/* ═══════════════════════════════════════════════════
   PETAL CANVAS
═══════════════════════════════════════════════════ */
const PETAL_COLORS = [
  '#ffc0d0','#ffadc2','#f4a0b4','#f8d0e4',
  '#e8c0e8','#d4b0f0','#c8e0f8','#fef0a0',
  '#ffd8b8','#ffe8c0','#d4f0d4',
];

function startPetalCanvas() {
  const canvas = document.getElementById('petalCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, petals = [];

  const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const spawn = () => {
    const size  = 5 + Math.random() * 13;
    const color = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
    petals.push({ x: Math.random() * W, y: -size,
      vx: (Math.random() - 0.5) * 1.2, vy: 0.5 + Math.random() * 1.3,
      rot: Math.random() * 360, vrot: (Math.random() - 0.5) * 2.8,
      size, color, life: 0 });
  };

  let lastSpawn = 0;
  const frame = ts => {
    ctx.clearRect(0, 0, W, H);
    if (ts - lastSpawn > 320) { spawn(); if (Math.random() < 0.4) spawn(); lastSpawn = ts; }
    petals = petals.filter(p => p.y < H + 20);
    petals.forEach(p => {
      p.life += 0.016;
      const alpha = Math.min(0.7, p.life * 2) * (p.y > H * 0.88 ? (H - p.y) / (H * 0.12) : 1);
      p.x  += p.vx + Math.sin(p.life * 1.3) * 0.45;
      p.y  += p.vy;
      p.rot += p.vrot;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 3;
      ctx.fill();
      ctx.restore();
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* ═══════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════ */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  const { mode, data } = detectMode();
  if (mode === 'viewer') {
    runViewer(data);
  } else {
    buildGrid();
    setupMessage();
    setupButtons();
  }
});
