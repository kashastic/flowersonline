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

/* ═══════════════════════════════════════════════════
   DOME POSITIONS — 3D bouquet cluster
   (x, y) = pixel offsets from cluster center
   z = CSS translateZ for depth (higher = closer to viewer)
   scale = size multiplier (depth cue)
═══════════════════════════════════════════════════ */
const DOME = [
  { x:   0, y: -55, z:  50, s: 1.10 },  // 1  center-front apex
  { x: -48, y: -38, z:  28, s: 1.00 },  // 2  left inner
  { x:  48, y: -38, z:  28, s: 1.00 },  // 3  right inner
  { x: -18, y: -78, z:  10, s: 0.94 },  // 4  upper-left mid
  { x:  18, y: -78, z:  10, s: 0.94 },  // 5  upper-right mid
  { x: -72, y: -14, z:  -2, s: 0.88 },  // 6  far left
  { x:  72, y: -14, z:  -2, s: 0.88 },  // 7  far right
  { x:   0, y: -18, z:  -8, s: 0.86 },  // 8  center back-mid
  { x: -40, y: -94, z: -14, s: 0.82 },  // 9  upper-far-left
  { x:  40, y: -94, z: -14, s: 0.82 },  // 10 upper-far-right
  { x:  -5, y: -106,z: -22, s: 0.78 },  // 11 top-left
  { x:   5, y: -108,z: -22, s: 0.78 },  // 12 top-right
  { x: -80, y: -54, z: -24, s: 0.75 },  // 13 far-left-high
  { x:  80, y: -54, z: -24, s: 0.75 },  // 14 far-right-high
  { x:   0, y:-120, z: -32, s: 0.72 },  // 15 very top
];

/* ═══════════════════════════════════════════════════
   URL ENCODE / DECODE
═══════════════════════════════════════════════════ */
function encode(flowers, message) {
  return btoa(unescape(encodeURIComponent(JSON.stringify({ flowers, message }))));
}

function decode(str) {
  try { return JSON.parse(decodeURIComponent(escape(atob(str)))); }
  catch { return null; }
}

function detectMode() {
  const b = new URLSearchParams(location.search).get('b');
  if (b) { const d = decode(b); if (d) return { mode: 'viewer', data: d }; }
  return { mode: 'builder' };
}

/* ═══════════════════════════════════════════════════
   BUILDER STATE
═══════════════════════════════════════════════════ */
const sel = {};

function total() { return Object.values(sel).reduce((s, n) => s + n, 0); }

/* ─── Build flower grid ─── */
function buildGrid() {
  const grid = document.getElementById('flowerGrid');
  FLOWERS.forEach(f => {
    const card = document.createElement('div');
    card.className = 'flower-card';
    card.dataset.id = f.id;
    card.innerHTML = `
      <svg width="64" height="80" aria-hidden="true" overflow="visible"><use href="#svg-${f.id}"/></svg>
      <div class="flower-name">${f.label}</div>
      <div class="flower-badge" id="badge-${f.id}">0</div>`;
    card.addEventListener('click', () => onAdd(f.id, card));
    card.addEventListener('contextmenu', e => { e.preventDefault(); onRemove(f.id, card); });
    grid.appendChild(card);
  });
}

function onAdd(id, card) {
  if (total() >= MAX) { toast(`Bouquet full (${MAX} max) 🌸`); return; }
  sel[id] = (sel[id] || 0) + 1;
  syncCard(id, card);
  renderMini();
  syncBar();
}

function onRemove(id, card) {
  if (!sel[id]) return;
  sel[id]--;
  if (!sel[id]) delete sel[id];
  syncCard(id, card);
  renderMini();
  syncBar();
}

function syncCard(id, card) {
  const n = sel[id] || 0;
  const badge = document.getElementById(`badge-${id}`);
  badge.textContent = n;
  badge.classList.toggle('show', n > 0);
  card.classList.toggle('active', n > 0);
}

function syncBar() {
  const t = total();
  document.getElementById('totalCount').textContent = t;
  document.getElementById('countBar').style.width = `${(t / MAX) * 100}%`;
}

/* ─── Mini bouquet preview ─── */
function renderMini() {
  const t = total();
  document.getElementById('miniEmpty').style.display   = t === 0 ? '' : 'none';
  document.getElementById('miniBouquet').style.display = t === 0 ? 'none' : '';
  if (t === 0) return;

  const list  = flatten();
  const wrap  = document.getElementById('miniFlowers');
  wrap.innerHTML = '';

  const baseSize = miniFlowerSize(list.length);
  const positions = miniDomePositions(list.length, 95, 65); // w=190, h=130 → half

  list.forEach((id, i) => {
    const pos  = positions[i];
    const size = Math.round(baseSize * (pos.s ?? 1));
    const el   = document.createElement('div');
    el.className = 'mini-flower-item popin';
    el.style.cssText = `
      left: ${90 + pos.x - size * 0.5}px;
      top:  ${110 + pos.y - size * 1.25 * 0.5}px;
      z-index: ${10 + (pos.z | 0)};
      animation-delay: ${i * 40}ms;
    `;
    el.innerHTML = `<svg width="${size}" height="${Math.round(size * 1.25)}" overflow="visible"><use href="#svg-${id}"/></svg>`;
    wrap.appendChild(el);
  });
}

function miniDomePositions(count, hw, hh) {
  return DOME.slice(0, count).map(p => ({
    x: p.x * hw / 100,
    y: p.y * hh / 100,
    z: p.z,
    s: p.s,
  }));
}

function miniFlowerSize(count) {
  if (count <= 3)  return 46;
  if (count <= 6)  return 40;
  if (count <= 10) return 34;
  return 30;
}

/* ─── Flatten selection ─── */
function flatten() {
  const list = [];
  FLOWERS.forEach(f => { for (let i = 0; i < (sel[f.id] || 0); i++) list.push(f.id); });
  return shuffle(list);
}

function shuffle(arr) {
  // Fisher-Yates shuffle for visual variety
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ─── Message input ─── */
function setupMessage() {
  const ta = document.getElementById('messageInput');
  const cc = document.getElementById('charCount');
  ta.addEventListener('input', () => { cc.textContent = ta.value.length; });
}

/* ─── Buttons ─── */
function setupButtons() {
  document.getElementById('generateBtn').addEventListener('click', copyLink);
  document.getElementById('previewBtn').addEventListener('click', openPreview);
}

function bouquetPayload() {
  const flowers = FLOWERS.filter(f => sel[f.id]).map(f => ({ id: f.id, count: sel[f.id] }));
  const message = document.getElementById('messageInput').value.trim();
  return { flowers, message };
}

function copyLink() {
  const { flowers, message } = bouquetPayload();
  if (!flowers.length) { toast('Pick at least one flower first 🌸'); return; }
  const url = `${location.origin}${location.pathname}?b=${encode(flowers, message)}`;
  navigator.clipboard.writeText(url)
    .then(() => toast('Link copied! Send it to her ✦'))
    .catch(() => {
      const inp = Object.assign(document.createElement('input'), { value: url });
      document.body.appendChild(inp); inp.select(); document.execCommand('copy'); inp.remove();
      toast('Link copied! Send it to her ✦');
    });
}

function openPreview() {
  const { flowers, message } = bouquetPayload();
  if (!flowers.length) { toast('Pick at least one flower first 🌸'); return; }
  window.open(`${location.origin}${location.pathname}?b=${encode(flowers, message)}`, '_blank');
}

/* ═══════════════════════════════════════════════════
   VIEWER
═══════════════════════════════════════════════════ */
function runViewer(data) {
  document.getElementById('builder').style.display = 'none';
  document.getElementById('viewer').style.display  = '';

  startPetalCanvas();

  const flowers = expandFlowers(data.flowers);

  // Phase 1: bouquet arrives
  setTimeout(() => {
    document.getElementById('bouquet3dWrapper').classList.add('arrive');
  }, 200);

  // Phase 2: flowers bloom
  const stage     = document.getElementById('vFlowers');
  const baseSize  = viewerFlowerSize(flowers.length);
  const positions = viewerPositions(flowers.length);

  flowers.forEach((id, i) => {
    const pos  = positions[i];
    const size = Math.round(baseSize * pos.s);
    const el   = document.createElement('div');
    el.className = 'vflower';

    // CSS custom properties for the keyframe compose trick
    const baseT = `translate3d(${pos.x}px, ${pos.y}px, ${pos.z}px)`;
    el.style.cssText = `
      left: ${130 + pos.x - size * 0.5}px;
      top:  ${160 + pos.y - size * 1.25}px;
      z-index: ${50 + Math.round(pos.z)};
      --base-transform: translate3d(${pos.x}px, ${pos.y}px, ${pos.z * 0.05}px);
      --sway-dur: ${3.2 + (i % 5) * 0.4}s;
      --sway-delay: ${0.8 + i * 0.05}s;
    `;
    el.innerHTML = `<svg width="${size}" height="${Math.round(size * 1.25)}" overflow="visible"><use href="#svg-${id}"/></svg>`;
    stage.appendChild(el);

    const delay = 700 + i * 200;
    setTimeout(() => {
      el.classList.add('bloom');
      setTimeout(() => {
        el.classList.remove('bloom');
        el.style.opacity = '1';
        el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, ${pos.z * 0.05}px)`;
        el.classList.add('sway');
      }, 800);
    }, delay);
  });

  // Phase 3: wrap appears
  const wrapDelay = 700 + flowers.length * 200 + 200;
  setTimeout(() => {
    document.getElementById('vWrap').classList.add('reveal');
    setTimeout(() => {
      document.querySelector('.vbow').classList.add('reveal');
      document.getElementById('bouquetTilt').classList.add('swaying');
    }, 400);
  }, wrapDelay);

  // Phase 4: message
  if (data.message) {
    document.getElementById('viewerMessage').textContent = `"${data.message}"`;
  } else {
    document.getElementById('viewerMessage').style.display = 'none';
  }

  const msgDelay = wrapDelay + 600;
  setTimeout(() => {
    document.getElementById('viewerMessageWrap').classList.add('reveal');
  }, msgDelay);

  // Back button
  document.getElementById('backBtn').addEventListener('click', () => {
    location.href = location.pathname;
  });
}

function expandFlowers(arr) {
  const list = [];
  arr.forEach(({ id, count }) => { for (let i = 0; i < count; i++) list.push(id); });
  return shuffle(list);
}

function viewerFlowerSize(count) {
  if (count <= 3)  return 96;
  if (count <= 6)  return 84;
  if (count <= 10) return 72;
  return 62;
}

function viewerPositions(count) {
  // Scale DOME coords to viewer bouquet size
  const hw = 130, hh = 100;
  return DOME.slice(0, count).map(p => ({
    x: p.x * hw / 100,
    y: p.y * hh / 100,
    z: p.z,
    s: p.s,
  }));
}

/* ═══════════════════════════════════════════════════
   PETAL CANVAS — floating petals background
═══════════════════════════════════════════════════ */
const PETAL_COLORS = [
  '#ffc0d0', '#ffadc2', '#f4a0b4', '#f8d0e4',
  '#e8c0e8', '#d4b0f0', '#b8d4f8', '#fef0a0',
  '#ffd8b8', '#fff5c0',
];

function startPetalCanvas() {
  const canvas = document.getElementById('petalCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H, petals = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Spawn petals
  function spawn() {
    const size  = 6 + Math.random() * 14;
    const color = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
    petals.push({
      x:    Math.random() * W,
      y:    -size,
      vx:   (Math.random() - 0.5) * 1.4,
      vy:   0.5 + Math.random() * 1.4,
      rot:  Math.random() * 360,
      vrot: (Math.random() - 0.5) * 3,
      size,
      color,
      alpha: 0,
      life:  0,
    });
  }

  let lastSpawn = 0;
  function frame(ts) {
    ctx.clearRect(0, 0, W, H);
    if (ts - lastSpawn > 380) { spawn(); lastSpawn = ts; }

    petals = petals.filter(p => p.y < H + 30 && p.alpha > -0.1);

    petals.forEach(p => {
      p.life += 0.016;
      p.alpha = Math.min(0.75, p.life * 2) * (p.y > H * 0.85 ? Math.max(0, (H - p.y) / (H * 0.15)) : 1);
      p.x   += p.vx + Math.sin(p.life * 1.4) * 0.5;
      p.y   += p.vy;
      p.rot += p.vrot;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.scale(1, 0.6);
      // Petal shape: rounded diamond
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 4;
      ctx.fill();
      ctx.restore();
    });

    requestAnimationFrame(frame);
  }
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
