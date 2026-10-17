// Compute Wars — Onda 5 nav: 5.5.1 seleção por tipo (Ctrl+duplo clique) e por classe (Ctrl+Shift+clique) no mapa inteiro,
// 5.5.2 barra de grupos 1-9 com miniatura e contagem, 5.5.3 rolagem pela borda com zona morta e aceleração (Opções em lobby.js).
// Só interface: não muda estado, save nem replay. Browser: window.Nav, gancho Nav.tick(real, sp) no loop; Node: require('./nav.js') (funções puras).
(function (root) {
  const NODE = typeof module !== 'undefined';
  const NE = NODE ? require('./engine.js') : root.Engine;
  const mine = (S, owner) => S.ents.filter((u) => u.kind === 'unit' && u.owner === owner); // guarnecidos não estão em S.ents
  const unitClass = (type) => NE.UNITS[type].hero ? 'hero' : NE.UNITS[type].cls === 'worker' ? 'eco' : 'mil';
  const byType = (S, owner, type) => mine(S, owner).filter((u) => u.type === type).map((u) => u.id);
  const byClass = (S, owner, type) => { const c = unitClass(type); return mine(S, owner).filter((u) => unitClass(u.type) === c).map((u) => u.id); };
  function groupInfo(S, ids) { // membros vivos e o do tipo mais comum (empate: o primeiro do grupo)
    const es = (ids || []).map((id) => NE.byId(S, id)).filter(Boolean), n = {};
    for (const e of es) n[e.type] = (n[e.type] || 0) + 1;
    return { ids: es.map((e) => e.id), n: es.length, top: es.reduce((a, e) => (!a || n[e.type] > n[a.type] ? e : a), null) };
  }
  const ACCEL = [[1, 1, 1], [0.5, 1.6, 1.2], [0.5, 2.5, 0.8]]; // Constante, Suave, Rápida: [início, teto, segundos até o teto]
  function edgeMul(held, deadMs, accel) { // multiplicador da velocidade da borda; 0 durante a zona morta
    const dead = Math.max(0, +deadMs || 0) / 1000; if (held < dead) return 0;
    const [a, b, T] = ACCEL[accel] || ACCEL[1]; return a + (b - a) * Math.min(1, (held - dead) / T);
  }
  const Nav = { unitClass, byType, byClass, groupInfo, edgeMul, ACCEL };
  if (NODE) { module.exports = Nav; return; }
  root.Nav = Nav;

  document.head.insertAdjacentHTML('beforeend', `<style>
  #groups { position:absolute; right:100%; bottom:calc(100% + 13px); margin-right:4px; display:flex; gap:4px; }
  #groups:empty { display:none; }
  #groups button { position:relative; width:54px; height:54px; padding:0; cursor:pointer; overflow:hidden; border:2px solid; border-image:var(--metal) 1; background:radial-gradient(circle at 50% 40%,var(--enamel),var(--enamel2) 80%); box-shadow:inset 0 0 0 1px #000, inset 0 0 12px rgba(0,0,0,.8), 0 0 0 1px #000, 0 4px 12px rgba(0,0,0,.85); transition:transform .08s, filter .12s; }
  #groups button:hover { filter:brightness(1.3); }
  #groups button:focus-visible { outline:2px solid var(--m1); outline-offset:2px; }
  #groups button.on { transform:translateY(-5px); box-shadow:inset 0 0 0 1px #000, inset 0 0 10px var(--glow), 0 0 0 2px var(--own), 0 0 14px var(--glow), 0 4px 12px rgba(0,0,0,.85); }
  #groups img { position:absolute; inset:3px 3px 8px; width:calc(100% - 6px); height:calc(100% - 11px); object-fit:contain; filter:drop-shadow(0 2px 2px #000); pointer-events:none; }
  #groups i { position:absolute; inset:0; font:22px/50px var(--display); font-style:normal; color:var(--m2); text-align:center; }
  #groups .k { position:absolute; top:0; left:0; min-width:16px; padding:1px 3px; background:linear-gradient(180deg,var(--m2),var(--m3)); color:#140d03; font:700 12px/14px var(--display); text-align:center; box-shadow:0 0 0 1px #000; }
  #groups .n { position:absolute; right:2px; bottom:1px; font:600 13px var(--mono); color:var(--ivory); text-shadow:0 1px 0 #000, 0 0 4px #000, 0 0 2px #000; }
  </style>`);

  // ---- 5.5.1: Ctrl/Cmd + botão esquerdo inicia o arrasto do mapa em index.html, então a seleção de lá não age; aqui só sem arrasto ----
  let down = null, lastCtrl = null; /* duplo clique próprio (350 ms, como index.html): o evento dblclick some se veio clique logo antes (detail 3, 4...) */
  function pick(e, fn) {
    if (!S || S.winner !== null) return; const w = toWorld(e.offsetX, e.offsetY), t = entAt(w.x, w.y);
    if (!t || t.kind !== 'unit' || t.owner !== 0) return; /* R3: alvo que não é seu não mexe na seleção */
    const ids = fn(S, 0, t.type), c = unitClass(t.type); select(ids); SFX.click();
    toast(fn === byType ? `Mapa inteiro: ${ids.length} × ${E.UNITS[t.type].name}` : `Mapa inteiro: ${ids.length} ${{ mil: ids.length > 1 ? 'militares' : 'militar', eco: ids.length > 1 ? 'trabalhadores' : 'trabalhador', hero: 'herói' }[c]}`, 'info');
  }
  cv.addEventListener('mousedown', (e) => { down = e.button === 0 ? { x: e.offsetX, y: e.offsetY } : null; });
  cv.addEventListener('mouseup', (e) => {
    const d = down; down = null; if (e.button !== 0 || !d || !(e.ctrlKey || e.metaKey) || Math.hypot(e.offsetX - d.x, e.offsetY - d.y) >= 5) return;
    if (e.shiftKey) { lastCtrl = null; return pick(e, byClass); }
    if (IS_MAC && !e.metaKey) return; /* no Mac, Ctrl+clique é ordem (index.html); tipo no mapa inteiro é Cmd+duplo clique */
    const now = performance.now(), l = lastCtrl; lastCtrl = { t: now, x: e.offsetX, y: e.offsetY };
    if (l && now - l.t < 350 && Math.hypot(e.offsetX - l.x, e.offsetY - l.y) < 8) { lastCtrl = null; pick(e, byType); }
  });

  // ---- 5.5.2: barra acima do painel, terminando no minimapa (filha de #miniwrap: acompanha largura, zoom da UI e inert) ----
  const bar = document.createElement('div'); bar.id = 'groups'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Grupos de controle'); $('miniwrap').appendChild(bar);
  let sig = null;
  const thumb = (e) => e.kind === 'building' ? `assets/b_${S.players[e.owner].faction}_${e.type}.png` : E.UNITS[e.type].hero ? `assets/ui_portrait_${e.type}.png` : `assets/${unitImgName(e)}.png`;
  const glyph = (e) => e.kind === 'building' ? '■' : GLYPH[E.UNITS[e.type].cls];
  function renderBar() {
    const rows = []; for (let k = 1; k <= 9; k++) { const g = groupInfo(S, groups[k]); if (g.n) rows.push([k, g, g.ids.join() === sel.join()]); }
    const s2 = rows.map(([k, g, on]) => `${k}:${g.n}:${g.top.type}:${on}`).join('|'); if (s2 === sig) return; sig = s2;
    bar.innerHTML = rows.map(([k, g, on]) => { const name = entName(g.top), what = g.n === 1 ? name : `${g.n} membros, maioria ${name}`;
      return `<button data-g="${k}" class="${on ? 'on' : ''}" aria-pressed="${on}" aria-label="Grupo ${k}: ${what}" data-tip="<b>Grupo ${k}</b><small>${what}. Clique seleciona, duplo clique centraliza. Tecla ${k}; Ctrl+${k} redefine.</small>"><i aria-hidden="true">${glyph(g.top)}</i><img src="${thumb(g.top)}" alt="" onerror="this.remove()"><span class="k">${k}</span><span class="n">${g.n}</span></button>`; }).join('');
  }
  const groupBtn = (e) => { const b = e.target.closest('button[data-g]'); return b && S ? groupInfo(S, groups[b.dataset.g]) : null; };
  bar.addEventListener('mousedown', (e) => e.preventDefault()); /* clique não tira o foco do jogo */
  bar.addEventListener('click', (e) => { const g = groupBtn(e); if (!g || !g.n) return; select(g.ids); SFX.click(); sig = null; });
  bar.addEventListener('dblclick', (e) => { const g = groupBtn(e); if (g && g.n) { const u = E.byId(S, g.ids[0]); centerOn(u.x, u.y); } });

  // ---- 5.5.3 + tick ----
  const atEdge = (x, y) => x <= 2 || x >= cv.width - 2 || y <= 2 || y >= cv.height - 2;
  let since = null, barT = 1; /* hora do evento em que o cursor chegou à borda (a zona morta conta dali, não do quadro seguinte) */
  addEventListener('mousemove', (e) => { if (!atEdge(e.clientX, e.clientY)) since = null; else if (since == null) since = performance.now(); });
  Nav.tick = (real, sp) => {
    const at = OPT.edge && since != null && atEdge(mouse.x, mouse.y);
    const v = at ? sp * edgeMul((performance.now() - since) / 1000, OPT.edgeDead, OPT.edgeAccel) : 0;
    if (v) { if (mouse.x <= 2) cam.tx -= v; if (mouse.x >= cv.width - 2) cam.tx += v; if (mouse.y <= 2) cam.ty -= v; if (mouse.y >= cv.height - 2) cam.ty += v; }
    barT += real; if (barT >= 0.25) { barT = 0; renderBar(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
