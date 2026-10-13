// Compute Wars — desenho do mundo: terreno em cache, névoa, unidades, prédios, efeitos (draw). Carregado por index.html.
// ---- terreno em cache ----
let groundCv = null;
function buildGround() {
  const settled = (n) => IMG[n] && IMG[n].complete; if (!['t1', 'tp_base', 'tp_moss', 'tp_plaza', 'tp_road', 'tc_base', 'tc_ink', ...BIOME_TEX.flat()].every(settled)) return; // espera o fim do carregamento (ok ou erro)
  const base = img('tp_base') || img('t1'), moss = img('tp_moss'); if (!base) return;
  groundCv = document.createElement('canvas'); groundCv.width = E.MAP_W * T; groundCv.height = E.MAP_H * T; const g = groundCv.getContext('2d'), GW = groundCv.width, GH = groundCv.height;
  const pat = (c, im, sc, rot) => { const p = c.createPattern(im, 'repeat'); if (p.setTransform) p.setTransform(new DOMMatrix().rotate(rot || 0).scale(sc)); return p; };
  const GRADE = 'saturate(1.2) contrast(1.12) brightness(.82)'; // texturas geradas vieram claras e lavadas: grading vivo (SC2/WC3)
  g.filter = GRADE; g.fillStyle = pat(g, base, img('tp_base') ? 0.5 : 1); g.fillRect(0, 0, GW, GH);
  if (img('tp_base')) { g.globalAlpha = 0.4; g.fillStyle = pat(g, base, 0.71, 31); g.fillRect(0, 0, GW, GH); g.globalAlpha = 1; } // 2a camada incomensuravel quebra a repeticao
  // ruído de valor suavizado para misturar a segunda textura
  const N = 9, lat = []; let sd = S.seed * 7919 + 13; const rnd = () => (sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let j = 0; j <= Math.ceil(E.MAP_H / N) + 1; j++) { lat[j] = []; for (let i = 0; i <= Math.ceil(E.MAP_W / N) + 1; i++) lat[j][i] = rnd(); }
  const sm = (t) => t * t * (3 - 2 * t);
  const LW = lat[0].length, LH = lat.length; const L = (j, i) => lat[((j % LH) + LH) % LH][((i % LW) + LW) % LW];
  const noise = (x, y) => { const i = Math.floor(x / N), j = Math.floor(y / N), fx = sm(x / N - i), fy = sm(y / N - j); const a = L(j, i), b = L(j, i + 1), c = L(j + 1, i), d = L(j + 1, i + 1); return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy; };
  // mascaras a 1 px/tile ampliadas com suavizacao: manchas lisas, sem quadrados de tile
  const lowres = (fn) => { const c = document.createElement('canvas'); c.width = E.MAP_W; c.height = E.MAP_H; const cc = c.getContext('2d'), id = cc.createImageData(E.MAP_W, E.MAP_H); for (let y = 0; y < E.MAP_H; y++) for (let x = 0; x < E.MAP_W; x++) id.data.set(fn(x, y), (y * E.MAP_W + x) * 4); cc.putImageData(id, 0, 0); return c; };
  // camada = textura recortada por mascara 1 px/tile ampliada (alpha 0..255); usada pelo musgo e pelos biomas
  const blend = (im, sc, mask) => { const lc = document.createElement('canvas'); lc.width = GW; lc.height = GH; const l = lc.getContext('2d'); l.filter = 'saturate(1.15) contrast(1.08)'; l.fillStyle = pat(l, im, sc); l.fillRect(0, 0, GW, GH); l.filter = 'none'; l.globalCompositeOperation = 'destination-in'; l.imageSmoothingEnabled = true; l.drawImage(lowres((x, y) => [255, 255, 255, Math.max(0, Math.min(255, mask(x, y)))]), 0, 0, GW, GH); g.drawImage(lc, 0, 0); };
  const detail = (x, y) => (0.7 * noise(x + 0.5, y + 0.5) + 0.3 * noise(x * 2.3 + 7, y * 2.3 + 3) - 0.5) * 4 * 255;
  const moss2 = moss || img('t2'); if (moss2) blend(moss2, moss ? 0.5 : 1, detail);
  // 3.1.4: biomas novos por tile (mascara dura a 1 px/tile, suavizada pela ampliacao: transicao ~1 tile, sem costura); textura ausente => fica Plato
  const bio = (b) => (x, y) => S.biome[y * E.MAP_W + x] === b ? 255 : 0;
  for (let b = 1; b <= 2; b++) { const [tb, td] = BIOME_TEX[b].map(img); if (!tb) continue; blend(tb, 0.5, bio(b)); if (td) blend(td, 0.5, (x, y) => bio(b)(x, y) && detail(x + 11, y + 5)); }
  const chq = S.ents.filter((h) => h.type === 'hq' && S.players[h.owner] && S.players[h.owner].faction === 'commons'), cdist = (x, y) => Math.min(...chq.map((h) => Math.hypot(x + 0.5 - h.x / T, y + 0.5 - h.y / T))); // 4.1.3: praça de pedra e cobre da Commons, raio 9 tiles com borda de 2
  if (chq.length && img('tc_base')) { blend(img('tc_base'), 0.5, (x, y) => (11 - cdist(x, y)) / 2 * 255); if (img('tc_ink')) blend(img('tc_ink'), 0.5, (x, y) => Math.min((11 - cdist(x, y)) / 2 * 255, detail(x + 3, y + 17))); }
  g.filter = 'none';
  // manchas de grande escala (so a oitava lenta do ruido): quente/frio em overlay, nao escurece
  g.globalCompositeOperation = 'overlay'; g.imageSmoothingEnabled = true; g.drawImage(lowres((x, y) => { const v = noise(x * 0.8 + 50, y * 0.8 + 80); return v > 0.5 ? [255, 180, 90, Math.min(110, (v - 0.5) * 320)] : [30, 120, 70, Math.min(130, (0.5 - v) * 400)]; }), 0, 0, GW, GH); g.globalCompositeOperation = 'source-over';
  for (let y = 0; y < E.MAP_H; y++) for (let x = 0; x < E.MAP_W; x++) if (S.grid[y * E.MAP_W + x] === 3) rubble(g, x, y, rnd);
  // estradas HQ -> grupos da base: terra batida da cor do chao, borda irregular (varios tracos tremidos + blur), sulco fraco
  const rd = E.roads(S); if (rd.length) {
    const rc = document.createElement('canvas'); rc.width = GW; rc.height = GH; const r = rc.getContext('2d'), mk = document.createElement('canvas'); mk.width = GW; mk.height = GH; const m = mk.getContext('2d');
    const rpat = img('tp_road') ? pat(r, img('tp_road'), 1, 90) : '#8a7858', W2 = 1.8 * T;
    r.filter = GRADE; for (const s of rd) { const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); r.save(); r.translate(s.x1, s.y1); r.rotate(Math.atan2(s.y2 - s.y1, s.x2 - s.x1)); r.fillStyle = rpat; r.fillRect(-W2, -W2, L + 2 * W2, 2 * W2); r.restore(); } r.filter = 'none'; // sulcos da textura seguem a direção do trecho
    m.filter = 'blur(6px)'; m.lineCap = 'round'; m.strokeStyle = '#fff'; for (let k = 0; k < 5; k++) { m.lineWidth = W2 * (0.55 + 0.5 * rnd()); m.beginPath(); for (const s of rd) { const jx = (rnd() - 0.5) * 14, jy = (rnd() - 0.5) * 14; m.moveTo(s.x1 + jx, s.y1 + jy); m.lineTo(s.x2 - jx, s.y2 + jy); } m.stroke(); }
    r.globalCompositeOperation = 'destination-in'; r.drawImage(mk, 0, 0);
    g.save(); g.filter = 'blur(9px)'; g.globalAlpha = 0.22; g.strokeStyle = '#000'; g.lineWidth = 2.4 * T; g.lineCap = 'round'; g.beginPath(); for (const s of rd) { g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); } g.stroke(); g.restore(); // sulco escuro nas bordas
    g.globalAlpha = 0.9; g.drawImage(rc, 0, 0); g.globalAlpha = 1;
  }
  // decal de campo: sombra escura sob o deposito, com leve tinta do recurso
  for (const f of S.fields) { const gr = g.createRadialGradient(f.x, f.y, T, f.x, f.y, 2.6 * T); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, 2.6 * T, 0, 7); g.fill(); g.globalAlpha = 0.12; g.fillStyle = RCOL[f.rtype]; g.beginPath(); g.arc(f.x, f.y, 2 * T, 0, 7); g.fill(); g.globalAlpha = 1; }
  const vg = g.createRadialGradient(GW / 2, GH / 2, GW * 0.4, GW / 2, GH / 2, GW * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = vg; g.fillRect(0, 0, GW, GH);
}
function rubble(g, x, y, rnd) { // pedras arredondadas da cor do chao, com sombra de contato e luz no topo-esquerda
  const cx = x * T + 16, cy = y * T + 18; g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx + 2, cy + 5, 16, 9, 0, 0, 7); g.fill();
  for (let k = 0; k < 3; k++) { const rx = cx - 8 + rnd() * 16, ry = cy - 6 + rnd() * 10, r = 4 + rnd() * 6, hue = 32 + rnd() * 12; const gr = g.createRadialGradient(rx - r * 0.4, ry - r * 0.5, r * 0.2, rx, ry, r); gr.addColorStop(0, `hsl(${hue},28%,66%)`); gr.addColorStop(1, `hsl(${hue},22%,34%)`); g.fillStyle = gr; g.beginPath(); g.ellipse(rx, ry, r, r * 0.75, rnd() * 3, 0, 7); g.fill(); } }
// Névoa (2.5.2): canvas a 16 px/tile com 2 tiles de margem; máscaras 1 px/tile ampliadas com suavização dão o gradiente.
const FOG_F = 16, FOG_P = 2, FOG_W = E.MAP_W + 2 * FOG_P, FOG_H = E.MAP_H + 2 * FOG_P;
const fogCv = document.createElement('canvas'); fogCv.width = FOG_W * FOG_F; fogCv.height = FOG_H * FOG_F; const fctx = fogCv.getContext('2d'); let fogStamp = -1, fogPat = null;
const fogMaskU = document.createElement('canvas'), fogMaskN = document.createElement('canvas'), fogTmp = document.createElement('canvas'); for (const c of [fogMaskU, fogMaskN]) { c.width = FOG_W; c.height = FOG_H; } fogTmp.width = fogCv.width; fogTmp.height = fogCv.height;
const satCv = document.createElement('canvas'); satCv.width = fogCv.width; satCv.height = fogCv.height; const sctx = satCv.getContext('2d'); // máscara cinza do explorado-fora-da-visão: blend 'saturation' dessatura o que está embaixo (2.5.2)
function fogPattern() { // pergaminho técnico: hexágonos (período 55x32 px de mundo) a 4x, com grão para nunca ficar chapado
  const k = 4, c = document.createElement('canvas'); c.width = 220; c.height = 127; const g = c.getContext('2d'), a = 220 / 3, sq = Math.sqrt(3) * a / 2;
  g.fillStyle = '#05080b'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = '#080c11'; g.lineWidth = 1.6 * k; g.lineJoin = 'round'; // hex quase imperceptivel (contraste ~3/255)
  const hex = (cx, cy) => { g.beginPath(); for (let i = 0; i < 6; i++) { const t = i * Math.PI / 3; g.lineTo(cx + a * Math.cos(t), cy + a * Math.sin(t)); } g.closePath(); g.stroke(); };
  for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) { hex(i * 3 * a, j * 2 * sq); hex(i * 3 * a + 1.5 * a, j * 2 * sq + sq); }
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data; let sd = 12345; for (let i = 0; i < d.length; i += 4) { sd = (sd * 1664525 + 1013904223) >>> 0; const n = ((sd >>> 24) % 5) - 2; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
  return c;
}
function fogMask(c, test) { const g = c.getContext('2d'), id = g.createImageData(FOG_W, FOG_H), d = id.data; for (let y = 0; y < FOG_H; y++) for (let x = 0; x < FOG_W; x++) { const mx = Math.min(E.MAP_W - 1, Math.max(0, x - FOG_P)), my = Math.min(E.MAP_H - 1, Math.max(0, y - FOG_P)); d[(y * FOG_W + x) * 4 + 3] = test(my * E.MAP_W + mx) ? 255 : 0; } g.putImageData(id, 0, 0); }
function buildFog() {
  const W = fogCv.width, H = fogCv.height, sm = (c, blur) => { fctx.imageSmoothingEnabled = true; fctx.filter = blur ? `blur(${blur}px)` : 'none'; fctx.drawImage(c, 0, 0, W, H); fctx.filter = 'none'; };
  fogMask(fogMaskU, (i) => !S.seen[i]); fogMask(fogMaskN, (i) => !S.vis[i]);
  sctx.globalCompositeOperation = 'source-over'; sctx.clearRect(0, 0, W, H); sctx.imageSmoothingEnabled = true; sctx.filter = 'blur(5px)'; sctx.drawImage(fogMaskN, 0, 0, W, H); sctx.filter = 'none'; sctx.globalCompositeOperation = 'source-in'; sctx.fillStyle = '#808080'; sctx.fillRect(0, 0, W, H);
  fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, W, H);
  // 1) explorado e fora da visão: azul-noite a 55%
  sm(fogMaskN, 8); fctx.globalCompositeOperation = 'source-in'; fctx.fillStyle = 'rgba(10,18,36,.4)'; fctx.fillRect(0, 0, W, H);
  // 2) brilho da facção: máscara larga (24 px de mundo = 12 px aqui) menos a própria máscara => banda no lado explorado
  const t = fogTmp.getContext('2d'); t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); t.imageSmoothingEnabled = true; t.filter = 'blur(10px)'; t.drawImage(fogMaskU, 0, 0, W, H); t.filter = 'none';
  t.globalCompositeOperation = 'destination-out'; t.filter = 'blur(3px)'; t.drawImage(fogMaskU, 0, 0, W, H); t.filter = 'none'; t.globalCompositeOperation = 'source-in'; t.fillStyle = ownerCol(0); t.fillRect(0, 0, W, H);
  fctx.globalCompositeOperation = 'source-over'; fctx.globalAlpha = 0.5; fctx.drawImage(fogTmp, 0, 0); fctx.globalAlpha = 1;
  // 3) inexplorado: textura hexagonal recortada pela máscara suave
  t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); if (!fogPat) fogPat = t.createPattern(fogPattern(), 'repeat'); t.save(); t.scale(FOG_F / T / 4, FOG_F / T / 4); t.fillStyle = fogPat; t.fillRect(0, 0, W * 4 * T / FOG_F, H * 4 * T / FOG_F); t.restore();
  t.globalCompositeOperation = 'destination-in'; t.filter = 'blur(7px)'; t.drawImage(fogMaskU, 0, 0, W, H); t.filter = 'none'; t.globalCompositeOperation = 'source-over'; // transicao ~2 tiles
  fctx.drawImage(fogTmp, 0, 0);
}

// ---- render ----
function plate(e, selectedNow, hovered) {
  const r = plateR(e), col = ownerCol(e.owner), y = e.y + 7;
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.ellipse(e.x + 2, y + 3, r * 1.6, r * 0.8, 0, 0, 7); ctx.fill(); // sombra de contato forte: unidade destaca do chao claro
  const g = ctx.createRadialGradient(e.x - r * 0.3, y - r * 0.2, 1, e.x, y, r * 1.4); const base = e.owner === -1 ? ['#3a2160', '#1a0e30'] : e.owner === 0 ? ({ citadel: ['#12505c', '#0b2f36'], foundry: ['#34520f', '#1b2a0c'], commons: ['#1f5546', '#0e2a22'] })[S.players[0].faction] : E.isEnemy(S, 0, e.owner) ? ['#5a1a1a', '#2c0b0b'] : ['#173a6a', '#0b1c36']; g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.x, y, r * 1.35, r * 0.68, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = selectedNow || hovered ? 1 : 0.92; if (cbMode && e.owner !== 0) ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.ellipse(e.x, y, r * 1.35, r * 0.68, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; // 3.3.7: rival tracejado
  if (selectedNow) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(e.x, y, r * 1.7, r * 0.86, 0, 0, 7); ctx.stroke(); }
  ctx.font = 'bold 15px IBM Plex Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = '#000'; const gl = GLYPH[E.UNITS[e.type].cls]; ctx.strokeText(gl, e.x, y + 0.5); ctx.fillStyle = '#F2E9D8'; ctx.fillText(gl, e.x, y + 0.5); ctx.textBaseline = 'alphabetic';
}
let plazaPat = null;
function plaza(e) { // pavimento 1 tile além do footprint, mosaico ancorado no canto (sem costura), borda suave + linha da facção
  const m = T, x = e.tx * T - m, y = e.ty * T - m, w = e.w * T + 2 * m, h = e.h * T + 2 * m, c = 14;
  if (plazaPat === null && IMG.tp_plaza.complete) { const im = img('tp_plaza'); if (im) { const pc = document.createElement('canvas'); pc.width = pc.height = im.width / 2; const p = pc.getContext('2d'); p.filter = 'saturate(1.15) brightness(1.02)'; p.drawImage(im, 0, 0, pc.width, pc.height); plazaPat = ctx.createPattern(pc, 'repeat'); } else plazaPat = '#6a7382'; } // grading uma vez (filtro por frame e caro)
  ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(w - c, 0); ctx.lineTo(w, c); ctx.lineTo(w, h - c); ctx.lineTo(w - c, h); ctx.lineTo(c, h); ctx.lineTo(0, h - c); ctx.lineTo(0, c); ctx.closePath();
  ctx.fillStyle = plazaPat || '#6a7382'; ctx.fill(); ctx.clip();
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 16; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 6; ctx.strokeRect(-2, -2, w + 4, h + 4); ctx.shadowBlur = 0; // sombra interna fraca integra ao chao
  ctx.lineWidth = 1.5; ctx.strokeStyle = ownerCol(e.owner); ctx.globalAlpha = 0.45; ctx.strokeRect(3, 3, w - 6, h - 6); ctx.globalAlpha = 1;
  ctx.restore();
}
// 3.1.2: prédio vivo. Brilho pulsante ('lighter') e vapor só quando há fila ou obra; parado fica quieto.
function drawLive(e, bx, by, size, now) {
  const busy = e.queue.length > 0 || !e.built; if (!busy) return;
  const gl = e.built && img(`bg_${S.players[e.owner].faction}_${e.type}`);
  if (gl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now * 4 + e.id); ctx.drawImage(gl, bx, by, size, size); ctx.restore(); }
  for (let i = 0; i < 3; i++) { const t = (now * 0.5 + i / 3 + e.id * 0.17) % 1; ctx.fillStyle = `rgba(225,230,235,${0.35 * (1 - t)})`; ctx.beginPath(); ctx.arc(e.x + (i - 1) * size * 0.14 + Math.sin(t * 5 + i) * 4, by + size * 0.3 - t * 38, 4 + t * 9, 0, 7); ctx.fill(); }
}
// 3.1.1: desenha a unidade com a folha animada do estado (idle/walk/attack); sem folha, sprite estático com o lunge antigo
function drawUnit(e, sp, sz, isSel, isHover, col) {
  const base = e.type === 'engineer' ? `${S.players[e.owner < 0 ? 0 : e.owner].faction}_engineer` : e.type, st = E.animState(S, e), sh = img(`a_${base}_${st}`) || img(`a_${base}_idle`);
  const lg = !sh && e.lunge && S.t - e.lunge < 0.18 ? Math.sin((S.t - e.lunge) / 0.18 * Math.PI) * 7 : 0;
  ctx.save(); ctx.translate(e.x + lg * (e.facing || 1), e.y - lg * 0.4); if (e.facing === -1) ctx.scale(-1, 1); if (e.owner === -1) ctx.filter = 'hue-rotate(250deg) saturate(1.7)'; if (isSel || isHover) { ctx.shadowColor = col; ctx.shadowBlur = 14; }
  if (sh && img(`a_${base}_${st}`)) {
    const f = st === 'attack' ? Math.min(5, Math.floor((S.t - e.lunge) / 0.5 * 6)) : Math.floor(S.t * (st === 'walk' ? 12 : 4) + e.id * 3) % 6, d = sz * 128 / 118, bob = st === 'walk' ? -Math.abs(Math.sin(Math.PI * f / 3)) * 1.5 : 0;
    ctx.drawImage(sh, f * 128, 0, 128, 128, -d / 2, -d + 12 + d * 4 / 128 + bob, d, d);
  } else ctx.drawImage(sp, -sz / 2, -sz + 12, sz, sz);
  ctx.restore();
}
// 3.1.3: amanhecer -> dia -> noite em 20 min e volta (ping-pong de 40 min). So o chao recebe a tinta (multiply); pecas ficam intactas => legivel. Noite = (170,182,222) ~ 72% da luminancia do dia.
const dayPhase = () => 1 - Math.abs(((S.t / 1200) % 2) - 1), nightOf = () => Math.max(0, Math.min(1, (dayPhase() - 0.3) / 0.45)); // noite plena a partir de 15:00
function dayTint() { const f = dayPhase(), n = nightOf(), d = Math.max(0, 1 - f / 0.25), c = [[255, 228, 200], [255, 255, 255], [170, 182, 222]]; return `rgb(${c[1].map((v, i) => Math.round((v + (c[0][i] - v) * d) * (1 - n) + c[2][i] * n)).join(',')})`; }
function drawRes(sp, e, s) { s *= e.sc || 1; ctx.save(); ctx.translate(e.x, 0); if (e.flip) ctx.scale(-1, 1); ctx.drawImage(sp, -s / 2, e.y + 10 - s, s, s); ctx.restore(); }
function drawProp(e) { const im = img('p_' + e.p.type); if (!im) return; const s = (['neonpole', 'antenna', 'streetsign', 'column'].includes(e.p.type) ? 48 : 35) * e.p.sc; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(e.x + 2, e.y + 9, s * 0.3, s * 0.12, 0, 0, 7); ctx.fill(); ctx.save(); ctx.translate(e.x, 0); if (e.p.f) ctx.scale(-1, 1); ctx.drawImage(im, -s / 2, e.y + 12 - s, s, s); ctx.restore(); } // 65% do tamanho antigo: nao compete com unidades
function draw() {
  const W = cv.width, H = cv.height, now = performance.now() / 1000;
  ctx.fillStyle = '#04070b'; ctx.fillRect(0, 0, W, H);
  if (!groundCv) buildGround();
  ctx.save(); ctx.scale(zoom, zoom); ctx.translate(-cam.x, -cam.y);
  const tx0 = Math.max(0, Math.floor(cam.x / T)), ty0 = Math.max(0, Math.floor(cam.y / T)), tx1 = Math.min(E.MAP_W, Math.ceil((cam.x + W / zoom) / T)), ty1 = Math.min(E.MAP_H, Math.ceil((cam.y + H / zoom) / T));
  if (groundCv) ctx.drawImage(groundCv, tx0 * T, ty0 * T, (tx1 - tx0) * T, (ty1 - ty0) * T, tx0 * T, ty0 * T, (tx1 - tx0) * T, (ty1 - ty0) * T); else { ctx.fillStyle = '#15221a'; ctx.fillRect(tx0 * T, ty0 * T, (tx1 - tx0) * T, (ty1 - ty0) * T); }
  const wm = toWorld(mouse.x, mouse.y); hoverEnt = (mouse.y > 44 && mouse.y < H - PANEL_H) ? entAt(wm.x, wm.y) : null;
  const ents = S.ents.filter((e) => e.x > cam.x - 140 && e.x < cam.x + W / zoom + 140 && e.y > cam.y - 180 && e.y < cam.y + H / zoom + 140 && seenAt(e) && (e.kind === 'building' || visible(e))).concat(S.props.filter((p) => p.x > cam.x - 60 && p.x < cam.x + W / zoom + 60 && p.y > cam.y - 60 && p.y < cam.y + H / zoom + 80 && seenAt(p)).map((p) => ({ kind: 'prop', x: p.x, y: p.y, p }))).sort((a, b) => (a.kind === 'building' ? a.y + a.h * T / 2 : a.y) - (b.kind === 'building' ? b.y + b.h * T / 2 : b.y));
  // camada de chão: footprints, placas, marcadores de ordem
  for (const e of ents) if (e.kind === 'building' && !E.BUILDINGS[e.type].wall && !E.BUILDINGS[e.type].gate) plaza(e);
  const night = nightOf(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = dayTint(); ctx.fillRect(tx0 * T, ty0 * T, (tx1 - tx0) * T, (ty1 - ty0) * T); ctx.globalCompositeOperation = 'source-over'; // 3.1.3: luz do dia sobre chao + pracas
  for (const e of ents) {
    if (e.kind === 'prop') continue;
    const isSel = sel.includes(e.id), isHover = hoverEnt === e;
    if (e.kind === 'building') { const x = e.tx * T, y = e.ty * T, w = e.w * T, h = e.h * T, col = ownerCol(e.owner); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); ctx.fillStyle = { citadel: 'rgba(201,160,78,.14)', foundry: 'rgba(184,116,74,.16)', commons: 'rgba(90,163,139,.16)' }[S.players[e.owner].faction]; ctx.fillRect(x, y, w, h); ctx.strokeStyle = col; ctx.globalAlpha = isSel || isHover ? 1 : 0.55; ctx.lineWidth = isSel ? 3 : 1.5; if (cbMode && e.owner !== 0) ctx.setLineDash([8, 5]); ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.fillStyle = col; [[x + 2, y + 2], [x + w - 8, y + 2], [x + 2, y + h - 8], [x + w - 8, y + h - 8]].forEach(([cx, cy]) => ctx.fillRect(cx, cy, 6, 6)); }
    else if (e.kind === 'resource') { const pulse = 0.5 + 0.5 * Math.sin(now * 2 + e.id); ctx.fillStyle = RCOL[e.rtype]; ctx.globalAlpha = 0.07 + 0.07 * pulse + night * 0.22; ctx.beginPath(); ctx.ellipse(e.x, e.y + 8, 20 + night * 16, 10 + night * 8, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; if (isSel || isHover) { ctx.strokeStyle = RCOL[e.rtype]; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y + 8, 22, 11, 0, 0, 7); ctx.stroke(); } }
    else plate(e, isSel, isHover);
  }
  for (const o of orders) { const a = 1 - o.t / 0.9; const col = { move: ownerCol(0), attack: '#FF5A5A', gather: '#E8C547', build: '#E8C547', rally: ownerCol(0) }[o.kind]; ctx.globalAlpha = Math.max(0, a); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(o.x, o.y, 6 + (1 - a) * 22, 3 + (1 - a) * 11, 0, 0, 7); ctx.stroke(); ctx.fillStyle = col; ctx.fillRect(o.x - 1, o.y - 18 * a, 2, 18 * a); if (o.kind !== 'move') { ctx.beginPath(); ctx.moveTo(o.x + 1, o.y - 18 * a); ctx.lineTo(o.x + 11, o.y - 14 * a); ctx.lineTo(o.x + 1, o.y - 10 * a); ctx.fill(); } ctx.globalAlpha = 1; }
  // camada de peças
  for (const e of ents) {
    if (e.kind === 'prop') { drawProp(e); continue; }
    const isSel = sel.includes(e.id), isHover = hoverEnt === e; const sp = spriteOf(e);
    if (e.kind === 'resource') { if (sp) { const s = 48 * (0.85 + 0.15 * e.amount / E.RES[e.rtype].amount); drawRes(sp, e, s); } else { ctx.fillStyle = RCOL[e.rtype]; ctx.fillRect(e.x - 12, e.y - 12, 24, 24); } if (isHover || isSel) label(e.x, e.y - 44, `${RNAME[e.rtype]} ${e.amount}`, RCOL[e.rtype]); }
    else if (e.kind === 'building') {
      const d = E.BUILDINGS[e.type], size = Math.max(e.w, e.h) * T * 1.35, bx = e.x - size / 2, by = e.y + e.h * T / 2 - size * 0.93;
      if (sp) { if (!e.built) { ctx.globalAlpha = 0.28; ctx.drawImage(sp, bx, by, size, size); ctx.globalAlpha = 1; ctx.save(); ctx.beginPath(); ctx.rect(bx, by + size * (1 - e.progress), size, size * e.progress); ctx.clip(); ctx.drawImage(sp, bx, by, size, size); ctx.restore(); ctx.strokeStyle = '#E8C547'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.strokeRect(e.tx * T + 1, e.ty * T + 1, e.w * T - 2, e.h * T - 2); ctx.setLineDash([]); } else { if (isSel || isHover) { ctx.save(); ctx.shadowColor = ownerCol(e.owner); ctx.shadowBlur = 18; ctx.drawImage(sp, bx, by, size, size); ctx.restore(); } else ctx.drawImage(sp, bx, by, size, size); } }
      else { ctx.fillStyle = '#2a3140'; ctx.fillRect(e.tx * T + 2, e.ty * T + 2, e.w * T - 4, e.h * T - 4); }
      drawLive(e, bx, by, size, now);
      if (night > 0 && e.built) { const gl = img(`bg_${S.players[e.owner].faction}_${e.type}`); if (gl) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = night * 0.7; ctx.drawImage(gl, bx, by, size, size); ctx.restore(); } } // 3.1.3: luzes acesas a noite
      if (d.align && isSel) ring(e.x, e.y, d.align.radius * T, 'rgba(63,209,122,.4)');
      if (d.atk && isSel) ring(e.x, e.y, (d.range + E.mods(S.players[e.owner]).towerRange) * T, 'rgba(255,90,90,.4)');
      if (e.hp < e.maxHp || !e.built || isSel || isHover) bar(e.x - e.w * T / 2 + 2, e.ty * T + e.h * T - 6, e.w * T - 4, e.built ? e.hp / e.maxHp : e.progress, e.built ? (e.hp / e.maxHp > 0.35 ? '#3FD17A' : '#FF5A5A') : '#E8C547', 5);
      if (e.queue.length) bar(e.x - e.w * T / 2 + 2, e.ty * T + e.h * T, e.w * T - 4, 1 - e.queue[0].left / e.queue[0].total, ownerCol(e.owner), 3);
      if (e.queue.length) queueThumbs(e);
      if (isHover || isSel) label(e.x, e.ty * T - 10, `${d.name}${E.isEnemy(S, 0, e.owner) ? ' · rival' : e.owner !== 0 ? ' · aliado' : ''}`, ownerCol(e.owner));
      if (e.rally && isSel) { ctx.strokeStyle = ownerCol(0); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.rally.x, e.rally.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = ownerCol(0); ctx.fillRect(e.rally.x - 1, e.rally.y - 18, 2, 18); ctx.beginPath(); ctx.moveTo(e.rally.x + 1, e.rally.y - 18); ctx.lineTo(e.rally.x + 12, e.rally.y - 14); ctx.lineTo(e.rally.x + 1, e.rally.y - 10); ctx.fill(); }
    } else {
      const d = E.UNITS[e.type], sz = unitSize(e), buffed = e.buff && e.buff.until > S.t, col = ownerCol(e.owner);
      if (d.hero) { const pr = plateR(e) * 1.35; ctx.strokeStyle = '#E8C547'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now * 3); ctx.beginPath(); ctx.ellipse(e.x, e.y + 7, pr + 6 + Math.sin(now * 3) * 2, (pr + 6) * 0.5, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      if (buffed) { ctx.fillStyle = 'rgba(232,197,71,.28)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 4, sz / 2.2, sz / 4.5, 0, 0, 7); ctx.fill(); }

      if (sp) drawUnit(e, sp, sz, isSel, isHover, col);
      else { ctx.beginPath(); ctx.arc(e.x, e.y, sz / 4, 0, 7); ctx.fillStyle = col; ctx.fill(); }
      if (e.carry) { ctx.fillStyle = RCOL[e.carryType]; ctx.shadowColor = RCOL[e.carryType]; ctx.shadowBlur = 6; ctx.fillRect(e.x + sz / 3, e.y - sz / 2, 6, 6); ctx.shadowBlur = 0; }
      const top = e.y - sz + 8;
      if (e.hp < e.maxHp || isSel || isHover) bar(e.x - 14, top, 28, e.hp / e.maxHp, e.hp / e.maxHp > 0.35 ? '#3FD17A' : '#FF5A5A', 4);
      if (e.align !== null && (isSel || isHover || e.align <= 1)) { const max = E.mods(S.players[e.owner < 0 ? 0 : e.owner]).alignMax; for (let i = 0; i < max; i++) { ctx.fillStyle = i < e.align ? '#E8C547' : 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - max * 2.5 + i * 5, top - 6, 4, 3); } }
      if (d.hero) { const lvl = E.heroLevel(e); ctx.fillStyle = '#E8C547'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x + sz / 2 - 6, top + 2, 9, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ctx.font = 'bold 11px IBM Plex Mono, monospace'; ctx.textAlign = 'center'; ctx.fillText(lvl, e.x + sz / 2 - 6, top + 6); if (isSel || isHover) label(e.x, top - 12, E.HEROES[e.type].titles[Math.min(3, Math.floor(lvl / 3))], '#E8C547'); }
      else if (isHover && !isSel) label(e.x, top - 10, `${d.name}${e.owner === -1 ? ' · Misaligned' : E.isEnemy(S, 0, e.owner) ? ' · rival' : e.owner !== 0 ? ' · aliado' : ''}`, col);
    }
  }
  // reliquias de Dataset (guardadas ficam sobre o Lab; carregadas, sobre o Engineer)
  for (const r of S.relics) { if (!S.seen[Math.floor(r.y / T) * E.MAP_W + Math.floor(r.x / T)] || (r.by != null && !visible(E.byId(S, r.by) || r))) continue; drawRelic(r, now); }
  // projéteis
  for (const pr of S.projectiles) { if (!S.vis[Math.floor(pr.y / T) * E.MAP_W + Math.floor(pr.x / T)]) continue; const col = ownerCol(pr.owner); ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 10;
    if (pr.kind === 'shell') { const d = Math.hypot(pr.tx - pr.x, pr.ty - pr.y), tot = pr.t * pr.speed + d, f = Math.min(1, pr.t * pr.speed / tot), arc = Math.sin(f * Math.PI) * 70; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, 6, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#FFB347'; ctx.beginPath(); ctx.arc(pr.x, pr.y - arc, 5, 0, 7); ctx.fill(); }
    else { const dx = pr.tx - pr.x, dy = pr.ty - pr.y, d = Math.hypot(dx, dy) || 1; ctx.strokeStyle = col; ctx.lineWidth = pr.kind === 'beam' ? 3 : 2; ctx.beginPath(); ctx.moveTo(pr.x - dx / d * 14, pr.y - dy / d * 14); ctx.lineTo(pr.x, pr.y); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pr.x, pr.y, 2.5, 0, 7); ctx.fill(); }
    ctx.restore(); }
  // efeitos
  for (const f of fx) {
    const a = Math.max(0, 1 - f.t / f.dur); ctx.globalAlpha = a;
    if (f.kind === 'ring') { ctx.strokeStyle = f.col; ctx.lineWidth = f.w || 3; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.2 + 0.8 * (1 - a)), f.r * (0.2 + 0.8 * (1 - a)) * 0.6, 0, 0, 7); ctx.stroke(); }
    else if (f.kind === 'shot') { ctx.strokeStyle = f.col; ctx.lineWidth = 2; ctx.shadowColor = f.col; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(f.x1, f.y1 - 14); ctx.lineTo(f.x2, f.y2 - 10); ctx.stroke(); ctx.shadowBlur = 0; }
    else if (f.kind === 'spark') { ctx.fillStyle = f.col; for (let i = 0; i < 6; i++) { const ang = i * 1.05 + f.seed; const r = 3 + (1 - a) * 18; ctx.fillRect(f.x + Math.cos(ang) * r - 1.5, f.y - 10 + Math.sin(ang) * r * 0.6 - 1.5, 3, 3); } }
    else if (f.kind === 'boom') { ctx.fillStyle = f.col; ctx.beginPath(); ctx.ellipse(f.x, f.y - 6, 10 + (1 - a) * 30, 6 + (1 - a) * 16, 0, 0, 7); ctx.fill(); }
    else if (f.kind === 'text') { ctx.fillStyle = f.col; ctx.font = `700 ${f.size || 13}px Cinzel, serif`; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.fillText(f.text, f.x, f.y - (1 - a) * 26); ctx.shadowBlur = 0; }
    else if (f.kind === 'ghost' && img(f.an)) { const d = f.sz * 128 / 118; ctx.globalAlpha = Math.min(1, (2 - f.t) / 0.8); ctx.drawImage(img(f.an), Math.min(5, Math.floor(f.t / 0.75 * 6)) * 128, 0, 128, 128, f.x - d / 2, f.y - d + 12 + d * 4 / 128, d, d); ctx.globalAlpha = 1; } // 3.1.1: sequência de morte (0,75 s) e some
    else if (f.kind === 'ghost') { const sp = img(f.img); if (sp) { ctx.globalAlpha = a * 0.8; ctx.filter = 'grayscale(1)'; ctx.drawImage(sp, f.x - f.sz / 2, f.y - f.sz + 12 + (1 - a) * 10, f.sz, f.sz); ctx.filter = 'none'; } }
    else if (f.kind === 'burst') { ctx.strokeStyle = f.col; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const ang = i * 0.628; const r0 = 10 + (1 - a) * 40, r1 = r0 + 12; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(ang) * r0, f.y - 20 + Math.sin(ang) * r0 * 0.7); ctx.lineTo(f.x + Math.cos(ang) * r1, f.y - 20 + Math.sin(ang) * r1 * 0.7); ctx.stroke(); } }
    ctx.globalAlpha = 1;
  }
  // névoa suave
  if (fogStamp === -1 || S.fogTimer < fogStamp) buildFog(); fogStamp = S.fogTimer; // só reconstrói quando a visão foi recalculada
  ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = 0.8; ctx.drawImage(satCv, -FOG_P * T, -FOG_P * T, FOG_W * T, FOG_H * T); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(fogCv, -FOG_P * T, -FOG_P * T, FOG_W * T, FOG_H * T);
  if (wallDrag && ghost) for (const [tx, ty] of wallLine(wallDrag, wm)) { const ok = E.canPlace(S, ghost, tx, ty); ctx.fillStyle = ok ? 'rgba(63,209,122,.35)' : 'rgba(255,90,90,.45)'; ctx.fillRect(tx * T, ty * T, T, T); }
  // fantasma de construção
  if (ghost) { const d = E.BUILDINGS[ghost]; const tx = Math.floor(wm.x / T) - Math.floor(d.w / 2), ty = Math.floor(wm.y / T) - Math.floor(d.h / 2); const ok = E.canPlace(S, ghost, tx, ty);
    const sp = img(`b_${S.players[0].faction}_${ghost}`); if (sp) { ctx.globalAlpha = 0.65; const size = Math.max(d.w, d.h) * T * 1.35; ctx.drawImage(sp, (tx + d.w / 2) * T - size / 2, (ty + d.h) * T - size * 0.93, size, size); ctx.globalAlpha = 1; }
    ctx.fillStyle = ok ? 'rgba(63,209,122,.3)' : 'rgba(255,90,90,.4)'; ctx.fillRect(tx * T, ty * T, d.w * T, d.h * T); ctx.strokeStyle = ok ? '#3FD17A' : '#FF5A5A'; ctx.lineWidth = 2; ctx.strokeRect(tx * T, ty * T, d.w * T, d.h * T);
    if (d.atk) ring((tx + d.w / 2) * T, (ty + d.h / 2) * T, d.range * T, 'rgba(255,90,90,.45)'); if (d.align) ring((tx + d.w / 2) * T, (ty + d.h / 2) * T, d.align.radius * T, 'rgba(63,209,122,.45)');
    label((tx + d.w / 2) * T, ty * T - 10, ok ? d.name : 'Terreno ocupado', ok ? '#3FD17A' : '#FF5A5A'); }
  ctx.restore();
  // 3.1.3: chuva acida (200 tracos reciclados no viewport, posicao = hash do indice + tempo), so com S.weather === 'rain'
  if (S.weather === 'rain') { const vh0 = viewH(); ctx.save(); ctx.beginPath(); ctx.rect(0, 44, W, vh0); ctx.clip(); ctx.fillStyle = 'rgba(120,200,60,.06)'; ctx.fillRect(0, 44, W, vh0); ctx.strokeStyle = 'rgba(190,255,120,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < 200; i++) { const x = ((i * 977) % W + now * 90) % W, y = 44 + ((i * 1399) % 1000 / 1000 * vh0 + now * (700 + (i % 5) * 80)) % vh0; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16); } ctx.stroke(); ctx.restore(); }
  { const held = S.relics.filter((r) => r.lab != null).map((r) => E.byId(S, r.lab)).filter(Boolean), mine = held.filter((l) => !E.isEnemy(S, 0, l.owner)).length, theirs = held.length - mine;
    if (held.length) { const m = S.mono.owner >= 0, txt = `Datasets: você ${mine}/5 · rival ${theirs}/5${m ? ` · Monopólio de Dados (${S.mono.owner === 0 ? 'você' : 'rival'}): ${Math.ceil(E.MONO - S.mono.t)} s` : ''}`; ctx.save(); ctx.font = '700 12px IBM Plex Sans Condensed, Arial Narrow, sans-serif'; const w = ctx.measureText(txt).width + 20, x = W / 2 - w / 2; ctx.fillStyle = 'rgba(8,12,18,.85)'; ctx.fillRect(x, 50, w, 20); ctx.fillStyle = m ? (S.mono.owner === 0 ? '#3FD17A' : '#FF5A5A') : '#E8C547'; ctx.fillRect(x, 50, 3, 20); ctx.fillStyle = '#F2E9D8'; ctx.textAlign = 'center'; ctx.fillText(txt, W / 2, 64); ctx.restore(); } }
  if (mouse.down) { ctx.strokeStyle = ownerCol(0); ctx.lineWidth = 1; ctx.strokeRect(mouse.down.x, mouse.down.y, mouse.x - mouse.down.x, mouse.y - mouse.down.y); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(mouse.down.x, mouse.down.y, mouse.x - mouse.down.x, mouse.y - mouse.down.y); }
  if (paused) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 44, W, viewH()); ctx.fillStyle = '#C9A04E'; ctx.font = '700 40px Cinzel, serif'; ctx.textAlign = 'center'; ctx.fillText('PAUSADO', W / 2, H / 2 - 70); ctx.font = '500 15px EB Garamond, serif'; ctx.fillStyle = '#F2E9D8'; ctx.fillText('Espaço para continuar', W / 2, H / 2 - 40); }
  cv.style.cursor = ghost ? 'copy' : mode ? 'crosshair' : hoverEnt && hoverEnt.owner !== 0 && hoverEnt.kind !== 'resource' && sel.length ? 'crosshair' : hoverEnt ? 'pointer' : 'default';
  const ml = $('modeline'); ml.style.display = mode ? 'block' : 'none'; if (mode) ml.textContent = { attack: 'Ataque-mover: clique no alvo ou no chão', patrol: 'Patrulha: clique no destino', rally: 'Ponto de encontro: clique no mapa' }[mode];
  // minimapa
  mctx.fillStyle = '#05080b'; mctx.fillRect(0, 0, 240, 186); const sx = 240 / (E.MAP_W * T), sy = 186 / (E.MAP_H * T), tsx = 240 / E.MAP_W, tsy = 186 / E.MAP_H;
  // 3.5.3: modos terreno (biomas) / unidades / economia; ping de ataque 3 s; waypoints; arrasto direito
  for (let y = 0; y < E.MAP_H; y++) for (let x = 0; x < E.MAP_W; x++) { const i = y * E.MAP_W + x; if (!S.seen[i]) continue; const c = S.grid[i] === 3 ? '#2a2e33' : miniMode ? '#2a3038' : E.BIOMES[S.biome[i]].col; mctx.fillStyle = S.vis[i] ? c : dimCol(c); mctx.fillRect(x * tsx, y * tsy, tsx + 0.5, tsy + 0.5); }
  for (const e of S.ents) { if (!seenAt(e) || (e.kind === 'unit' && !visible(e)) || (miniMode === 1 && e.kind === 'resource') || (miniMode === 2 && e.kind === 'unit')) continue; const eco = e.kind === 'building' && (E.BUILDINGS[e.type].drop || E.BUILDINGS[e.type].market); mctx.fillStyle = e.kind === 'resource' ? RCOL[e.rtype] : ownerCol(e.owner);
    if (e.kind === 'building') { if (miniMode !== 2 || eco) mctx.fillRect(e.tx * tsx, e.ty * tsy, e.w * tsx, e.h * tsy); mctx.strokeStyle = miniMode === 2 && !eco ? ownerCol(e.owner) : '#000'; mctx.lineWidth = 0.5; mctx.strokeRect(e.tx * tsx, e.ty * tsy, e.w * tsx, e.h * tsy); } else { const r = (e.kind === 'resource' ? 2.5 : E.UNITS[e.type].hero ? 4 : 2.2) * (miniMode ? 1.5 : 1); mctx.fillRect(e.x * sx - r / 2, e.y * sy - r / 2, r, r); } }
  for (const r of S.relics) if (S.seen[Math.floor(r.y / T) * E.MAP_W + Math.floor(r.x / T)]) { mctx.fillStyle = RELIC_COL[r.id]; mctx.beginPath(); mctx.arc(r.x * sx, r.y * sy, 3, 0, 7); mctx.fill(); }
  if (S.lastHit && S.t - S.lastHit.t < 3 && S.lastHit.t > 0 && Math.floor(now * 4) % 2) { const h = E.byId(S, S.lastHit.tgt); if (h && h.owner === 0) { mctx.strokeStyle = '#FF5A5A'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(S.lastHit.x * sx, S.lastHit.y * sy, 7, 0, 7); mctx.stroke(); } }
  mctx.strokeStyle = ownerCol(0); mctx.lineWidth = 1; camWps.forEach((w, i) => { mctx.beginPath(); mctx.moveTo(w.x * sx, w.y * sy - 4); mctx.lineTo(w.x * sx + 4, w.y * sy); mctx.lineTo(w.x * sx, w.y * sy + 4); mctx.lineTo(w.x * sx - 4, w.y * sy); mctx.closePath(); mctx.stroke(); if (i) { mctx.beginPath(); mctx.moveTo(camWps[i - 1].x * sx, camWps[i - 1].y * sy); mctx.lineTo(w.x * sx, w.y * sy); mctx.stroke(); } });
  if (miniR && miniR.cx != null) { mctx.strokeStyle = '#FF5A5A'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.moveTo(miniR.x * sx, miniR.y * sy); mctx.lineTo(miniR.cx * sx, miniR.cy * sy); mctx.stroke(); }
  mctx.strokeStyle = 'rgba(255,255,255,.85)'; mctx.lineWidth = 1; mctx.strokeRect(cam.x * sx, (cam.y + 44 / zoom) * sy, vw() * sx, viewH() / zoom * sy);
  mctx.fillStyle = 'rgba(8,12,18,.8)'; mctx.fillRect(0, 0, 78, 12); mctx.fillStyle = '#F2E9D8'; mctx.font = '700 9px IBM Plex Sans Condensed, Arial Narrow, sans-serif'; mctx.textAlign = 'left'; mctx.fillText('M · ' + MINI_MODES[miniMode], 3, 9);
  const hv = $('hover'); if (hoverEnt && !sel.includes(hoverEnt.id)) { hv.style.display = 'block'; hv.style.left = (mouse.x + 16) + 'px'; hv.style.top = (mouse.y + 14) + 'px'; hv.innerHTML = `${entName(hoverEnt)}${hoverEnt.kind === 'resource' ? ` · ${hoverEnt.amount}` : hoverEnt.kind === 'unit' ? ` · ${GLYPH[E.UNITS[hoverEnt.type].cls]} ${CLSNAME[E.UNITS[hoverEnt.type].cls]}` : ''}${hoverEnt.owner === -1 ? ' · Misaligned' : hoverEnt.owner > 0 ? (E.isEnemy(S, 0, hoverEnt.owner) ? ' · rival' : ' · aliado') : ''}`; hv.style.borderColor = hoverEnt.kind === 'resource' ? RCOL[hoverEnt.rtype] : ownerCol(hoverEnt.owner); } else hv.style.display = 'none';
}
// fila no mundo: até 3 miniaturas sobre a barra de progresso (a 1ª, em produção, com borda); +N se houver mais
function queueThumbs(e) {
  const n = Math.min(3, e.queue.length), z = 20, x0 = e.x - e.w * T / 2 + 2, y0 = e.ty * T + e.h * T - z - 4;
  for (let i = 0; i < n; i++) { const q = e.queue[i], x = x0 + i * (z + 2); ctx.fillStyle = 'rgba(8,12,18,.85)'; ctx.fillRect(x, y0, z, z); const im = q.kind === 'unit' ? img(unitImgName({ type: q.type, owner: e.owner })) : null;
    if (im) ctx.drawImage(im, x + 1, y0 + 1, z - 2, z - 2); else { ctx.fillStyle = '#E8C547'; ctx.font = '700 12px IBM Plex Sans Condensed, Arial Narrow, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(q.kind === 'advance' ? '⟰' : '⚗', x + z / 2, y0 + z - 5); }
    ctx.strokeStyle = i ? 'rgba(255,255,255,.35)' : ownerCol(e.owner); ctx.lineWidth = i ? 1 : 2; ctx.strokeRect(x + 0.5, y0 + 0.5, z - 1, z - 1); }
  if (e.queue.length > 3) { ctx.fillStyle = '#F2E9D8'; ctx.font = '700 11px IBM Plex Sans Condensed, Arial Narrow, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('+' + (e.queue.length - 3), x0 + 3 * (z + 2), y0 + z - 5); }
}
const RELIC_COL = ['#7FE6F0', '#FF9F5A', '#C07AFF', '#FF6AA8', '#F2E9D8'];
function drawRelic(r, now) {
  const sp = img('relic_' + r.id), y = r.y - 14 - (r.lab != null ? 26 : 0) + Math.sin(now * 2 + r.id) * 3, sz = r.lab != null ? 30 : 36;
  ctx.save(); ctx.shadowColor = RELIC_COL[r.id]; ctx.shadowBlur = 16; ctx.globalAlpha = r.by != null ? 0.95 : 1;
  if (sp) ctx.drawImage(sp, r.x - sz / 2, y - sz / 2, sz, sz);
  else { ctx.fillStyle = RELIC_COL[r.id]; ctx.beginPath(); ctx.moveTo(r.x, y - sz / 2); ctx.lineTo(r.x + sz / 3, y); ctx.lineTo(r.x, y + sz / 2); ctx.lineTo(r.x - sz / 3, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.restore();
  if (r.by == null && r.lab == null && Math.hypot(r.x - toWorld(mouse.x, mouse.y).x, r.y - toWorld(mouse.x, mouse.y).y) < 30) label(r.x, y - 26, `Dataset: ${r.name} (clique-direito com Engineer)`, RELIC_COL[r.id]);
}
function bar(x, y, w, f, col, h) { ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h); }
function ring(x, y, r, col) { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
function label(x, y, text, col) { ctx.font = '700 11px IBM Plex Sans Condensed, Arial Narrow, sans-serif'; const w = ctx.measureText(text).width + 12; ctx.fillStyle = 'rgba(8,12,18,.85)'; ctx.fillRect(x - w / 2, y - 9, w, 15); ctx.fillStyle = col; ctx.fillRect(x - w / 2, y - 9, 2, 15); ctx.fillStyle = '#F2E9D8'; ctx.textAlign = 'center'; ctx.fillText(text, x + 1, y + 2); }
