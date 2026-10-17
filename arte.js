// Compute Wars — Onda 5 / arte: decoração do mapa (5.1.5), cursores (5.1.2) e estilo do logo (5.1.4). Carregado por index.html antes de ui-world.js; no Node só a geração da decoração (test.js).
// A decoração é só da UI: derivada da semente e do terreno, nunca gravada no estado (save, replay e simulação não a veem).
const ARTE = (() => {
  const TYPES = ['neonpole', 'pipe', 'crystalbox', 'workbench', 'streetsign', 'vent', 'books', 'barrel', 'antenna', 'column', 'crystals', 'holosign'];
  const FILES = ['neonpole', 'pipe', 'crystalbox', 'workbench', 'streetsign', 'vent', 'books', 'barrel', 'antenna', 'column']; /* têm assets/p_<tipo>.png; os outros são procedurais (pôr o nome aqui troca por imagem) */
  const THEME = [['pipe', 'vent', 'barrel', 'workbench', 'antenna'], ['neonpole', 'streetsign', 'holosign', 'column', 'books'], ['crystals', 'crystalbox', 'crystals', 'column']]; // industrial, urbano, hextech
  const TALL = ['neonpole', 'antenna', 'streetsign', 'column', 'holosign'];
  const size = (t) => (TALL.includes(t) ? 48 : 35);
  // hash inteiro -> [0,1) e ruído de valor suavizado; nada de Math.random (mesma semente, mesma decoração)
  const h32 = (a, b, c) => { let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, -2048144789)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sm = (t) => t * t * (3 - 2 * t), mix = (a, b, t) => a + (b - a) * t;
  const noise = (k, x, y, N) => { const i = Math.floor(x / N), j = Math.floor(y / N), fx = sm(x / N - i), fy = sm(y / N - j), L = (a, b) => h32(k, a, b); return mix(mix(L(i, j), L(i + 1, j), fx), mix(L(i, j + 1), L(i + 1, j + 1), fx), fy); };
  const cache = new WeakMap();
  function props(s, E) {
    if (cache.has(s)) return cache.get(s);
    const T = E.TILE, W = s.W, H = s.H, sd = (s.seed | 0) * 31 + 7, out = [];
    const hqs = s.ents.filter((e) => e.type === 'hq'), rd = E.roads(s);
    const segD = (px, py, r) => { const dx = r.x2 - r.x1, dy = r.y2 - r.y1, u = Math.max(0, Math.min(1, ((px - r.x1) * dx + (py - r.y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - r.x1 - u * dx, py - r.y1 - u * dy); };
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const n = noise(sd, x, y, 10); if (h32(sd + 1, x, y) >= Math.max(0, (n - 0.56) * 2.4)) continue; // densidade por ruído: manchas e vazios
      let ok = true; for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (s.grid[(y + dy) * W + x + dx]) { ok = false; break; }
      const px = (x + 0.5) * T, py = (y + 0.5) * T;
      if (!ok || hqs.some((h) => Math.hypot(h.x - px, h.y - py) < 5 * T) || rd.some((r) => segD(px, py, r) < 2 * T) || out.some((p) => Math.hypot(p.x - px, p.y - py) < 2.5 * T)) continue;
      const b = s.biome ? s.biome[y * W + x] : 0, th = Math.floor(Math.max(0, Math.min(0.999, (noise(sd + 2, x, y, 13) - 0.5) * 2.4 + 0.5 + [0, -0.3, 0.3][b || 0])) * 3); // tema por ruído; bioma Foundry puxa para industrial, Hextech para cristais
      const list = THEME[th];
      out.push({ type: list[Math.floor(h32(sd + 3, x, y) * list.length)], x: px, y: py, f: h32(sd + 4, x, y) < 0.5, sc: 0.9 + h32(sd + 5, x, y) * 0.2 });
    }
    cache.set(s, out); return out;
  }
  // prédio erguido depois da geração: o 3x3 cobre o footprint e a praça de 1 tile
  const clear = (s, E, p) => { const W = s.W, tx = Math.floor(p.x / E.TILE), ty = Math.floor(p.y / E.TILE); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (s.grid[(ty + dy) * W + tx + dx]) return false; for (const e of s.ents) if (e.type === 'hq' && Math.hypot(e.x - p.x, e.y - p.y) < 10 * E.TILE) return false; return true; }; /* base limpa: nada de decoração a menos de 10 tiles de um HQ (poluía a base, feedback do dono) */
  if (typeof document === 'undefined') return { TYPES, props, clear };

  for (const t of FILES) if (!IMG['p_' + t]) load('p_' + t, `assets/p_${t}.png`); /* load/IMG do index.html: pôr o nome em FILES basta para trocar o procedural pela imagem */
  // ---- desenho procedural (mesma moldura 128x128 e ancoragem das imagens: base em y≈120) ----
  const proc = {};
  const lg = (g, x0, y0, x1, y1, stops) => { const r = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => r.addColorStop(i / (stops.length - 1), c)); return r; };
  const path = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  const grain = (g, k) => { const id = g.getImageData(0, 0, 128, 128), d = id.data; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { const n = (h32(k, i, 7) - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0); }; // grão de pintura: não fica chapado ao lado dos sprites pintados
  const DRAW = {
    crystals(g) { // aglomerado de cristais hextech ametista saindo de rocha escura
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(64, 116, 44, 10, 0, 0, 7); g.fill();
      path(g, [[20, 118], [24, 104], [36, 94], [52, 90], [70, 93], [88, 88], [104, 98], [110, 112], [106, 119]]); g.fillStyle = lg(g, 0, 88, 0, 120, ['#77707e', '#46404d', '#1b1820']); g.fill(); g.strokeStyle = '#0a080d'; g.lineWidth = 2.5; g.stroke();
      for (const f of [[[26, 104], [36, 95], [52, 91], [48, 102]], [[70, 94], [88, 89], [103, 99], [86, 103]]]) { path(g, f); g.fillStyle = 'rgba(255,255,255,.13)'; g.fill(); } // faces de cima da rocha
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(48, 102); g.lineTo(54, 112); g.lineTo(50, 118); g.moveTo(86, 103); g.lineTo(80, 113); g.stroke();
      const shard = (x, y, w, h, a) => { g.save(); g.translate(x, y); g.rotate(a); const tip = -h, sh = -h * 0.8;
        path(g, [[-w / 2, 0], [-w / 2, sh], [0, tip], [0, 0]]); g.fillStyle = lg(g, -w / 2, 0, 0, 0, ['#4b2391', '#a77cf5']); g.fill(); // face iluminada
        path(g, [[0, 0], [0, tip], [w / 2, sh], [w / 2, 0]]); g.fillStyle = lg(g, 0, 0, w / 2, 0, ['#6a3fc0', '#26104f']); g.fill(); // face na sombra
        path(g, [[-w / 2, 0], [-w / 2, sh], [0, tip], [w / 2, sh], [w / 2, 0]]); g.strokeStyle = '#140829'; g.lineWidth = 2; g.stroke();
        g.strokeStyle = 'rgba(245,235,255,.95)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -3); g.lineTo(0, tip + 2); g.stroke(); // aresta de luz
        g.fillStyle = 'rgba(255,255,255,.55)'; path(g, [[-w / 2 + 1.5, sh + 2], [0, tip + 3], [-w / 2 + 1.5, sh + 9]]); g.fill();
        g.restore(); };
      for (const s of [[40, 104, 10, 38, -0.5], [92, 102, 9, 34, 0.5], [54, 100, 14, 64, -0.2], [78, 100, 13, 54, 0.24], [66, 104, 16, 82, 0.03], [32, 112, 6, 16, -0.9], [100, 112, 6, 14, 0.85], [60, 110, 7, 20, -0.5]]) shard(...s);
      g.globalCompositeOperation = 'lighter'; const r = g.createRadialGradient(64, 98, 2, 64, 98, 34); r.addColorStop(0, 'rgba(180,130,255,.5)'); r.addColorStop(1, 'rgba(180,130,255,0)'); g.fillStyle = r; g.fillRect(20, 60, 90, 60); g.globalCompositeOperation = 'source-over';
      grain(g, 11);
    },
    holosign(g) { // placa holográfica: projetor de latão no chão e painel âmbar flutuante (sem texto: glifo de chip e barras)
      g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(64, 116, 28, 7, 0, 0, 7); g.fill();
      const brass = (x0, x1) => lg(g, x0, 0, x1, 0, ['#3a2709', '#C9A04E', '#f3d98f', '#C9A04E', '#4a3410']);
      path(g, [[42, 116], [44, 100], [84, 100], [86, 116]]); g.fillStyle = brass(42, 86); g.fill(); g.strokeStyle = '#140e05'; g.lineWidth = 2; g.stroke(); // corpo do projetor
      g.fillStyle = '#2a1d0b'; g.fillRect(44, 106, 40, 3); for (const x of [48, 58, 70, 80]) { g.fillStyle = '#f3d98f'; g.beginPath(); g.arc(x, 112, 1.6, 0, 7); g.fill(); }
      g.beginPath(); g.ellipse(64, 100, 22, 6, 0, 0, 7); g.fillStyle = lg(g, 0, 94, 0, 106, ['#f3d98f', '#7a5c22']); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(64, 99, 8, 2.6, 0, 0, 7); g.fillStyle = '#ffd08a'; g.fill(); // lente
      g.globalCompositeOperation = 'lighter'; path(g, [[58, 99], [70, 99], [102, 60], [26, 60]]); g.fillStyle = lg(g, 0, 99, 0, 60, ['rgba(255,170,70,.55)', 'rgba(255,170,70,.06)']); g.fill(); // cone de luz
      const px = 22, py = 12, pw = 84, ph = 48;
      g.fillStyle = 'rgba(255,150,50,.32)'; g.fillRect(px, py, pw, ph);
      g.fillStyle = 'rgba(255,190,110,.18)'; for (let y = py + 1; y < py + ph; y += 3) g.fillRect(px, y, pw, 1); // linhas de varredura
      g.strokeStyle = 'rgba(255,214,150,.95)'; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, pw - 2, ph - 2); g.lineWidth = 1; g.strokeStyle = 'rgba(255,214,150,.5)'; g.strokeRect(px + 4, py + 4, pw - 8, ph - 8);
      g.strokeStyle = '#fff1d6'; g.lineWidth = 2; g.strokeRect(px + 10, py + 12, 22, 22); g.strokeRect(px + 16, py + 18, 10, 10); // glifo de chip
      for (const k of [0, 1, 2]) { g.beginPath(); g.moveTo(px + 15 + k * 6, py + 8); g.lineTo(px + 15 + k * 6, py + 12); g.moveTo(px + 15 + k * 6, py + 34); g.lineTo(px + 15 + k * 6, py + 38); g.stroke(); }
      g.fillStyle = '#fff1d6'; for (const [y, w] of [[14, 38], [24, 28], [34, 34]]) g.fillRect(px + 40, py + y, w, 4);
      g.globalCompositeOperation = 'source-over'; grain(g, 13);
    },
  };
  function procImg(t) { if (!DRAW[t]) return null; if (!proc[t]) { const c = document.createElement('canvas'); c.width = c.height = 128; DRAW[t](c.getContext('2d')); proc[t] = c; } return proc[t]; }
  // luz noturna por tipo: ponto em fração da moldura (fx, fy), raio relativo, cor
  const GLOW = { neonpole: [0.62, 0.14, 0.32, '127,230,240'], crystalbox: [0.5, 0.4, 0.42, '90,150,255'], crystals: [0.5, 0.62, 0.55, '170,120,255'], holosign: [0.5, 0.28, 0.6, '255,160,60'] };
  function glow(ctx, x, y, s, t, flip, night) {
    const g = GLOW[t]; if (!g || night <= 0) return; const gx = x + (g[0] - 0.5) * (flip ? -s : s), gy = y + 12 - s + g[1] * s, r = g[2] * s;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); rg.addColorStop(0, `rgba(${g[3]},${0.55 * night})`); rg.addColorStop(1, `rgba(${g[3]},0)`); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(gx, gy, r, 0, 7); ctx.fill(); ctx.restore();
  }

  // ---- cursores (5.1.2): 1x 32 px + 2x 64 px; o primeiro valor é o recuo de quem não aceita image-set, o nativo é o recuo de imagem que não carrega ----
  const CUR = { default: [2, 2, 'default'], select: [2, 2, 'pointer'], move: [16, 16, 'move'], attack: [16, 16, 'crosshair'], gather: [8, 8, 'pointer'], build: [10, 10, 'copy'], invalid: [16, 16, 'not-allowed'], repair: [9, 9, 'pointer'] };
  const cur = (k) => { const [x, y, fb] = CUR[k], u = `url(assets/cursors/${k}.png)`; return `cursor:${u} ${x} ${y}, ${fb} !important; cursor:image-set(${u} 1x, url(assets/cursors/${k}@2x.png) 2x) ${x} ${y}, ${fb} !important;`; };
  document.head.insertAdjacentHTML('beforeend', `<style>
  *, *::before, *::after { ${cur('default')} }
  button:not(:disabled), [role=button], .fac, .cmd:not(:disabled), #log div, select, label, a[href], input[type=range], input[type=checkbox], #mini, .key { ${cur('select')} }
  input[type=text], input[type=number], input:not([type]), textarea { cursor:text !important; } #minigrip { cursor:ew-resize !important; } .cw-m.locked { cursor:not-allowed !important; }
  ${Object.keys(CUR).map((k) => `#c[data-cur=${k}] { ${cur(k)} }`).join('\n  ')}
  #overlay h1.logo { margin:0; background:none; line-height:0; } #overlay h1.logo img { display:block; width:min(1400px, 82vw); height:auto; max-height:15vh; margin:0 auto; object-fit:contain; filter:drop-shadow(0 6px 14px rgba(0,0,0,.85)); }
</style>`);
  return { TYPES, FILES, props, clear, size, procImg, glow };
})();
if (typeof module !== 'undefined') module.exports = ARTE;
