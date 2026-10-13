// 3.3.3 Tutorial guiado: 8 passos que concluem observando S; recorte escuro sobre o alvo (mundo -> tela ou cartão do painel) e seta.
// Script clássico carregado depois do principal: partilha S, sel, cam, zoom, buildCat, mode e os helpers do index.html. Tem o próprio rAF (zero toques em loop/draw).
const Tutorial = (() => {
  const p0 = () => S.players[0], mine = (f) => S.ents.filter((e) => e.owner === 0 && f(e));
  const eng = () => mine((e) => e.type === 'engineer'), bld = (t) => mine((e) => e.kind === 'building' && e.type === t)[0];
  const mil = () => mine((e) => e.kind === 'unit' && e.type !== 'engineer' && !E.UNITS[e.type].hero);
  const cards = () => [...document.querySelectorAll('#actions .cmd')];
  const card = (key) => cards().find((b) => b.querySelector('kbd') && b.querySelector('kbd').textContent === String(key));
  const cardLabel = (txt) => cards().find((b) => b.querySelector('.t').textContent === txt);
  const selIs = (f) => selected().some(f);
  const nearest = (f) => { const h = myHQ(); return S.ents.filter(f).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0]; };
  const rivalHQ = () => S.ents.find((e) => e.type === 'hq' && e.owner === 1);
  let st = null; // { game, i, base }
  const STEPS = [
    { t: 'Selecione um Engineer', d: 'Clique num Engineer, ou arraste uma caixa em volta dos três.', done: () => engineers().length > 0, at: () => eng()[0] },
    { t: 'Colete Dados', d: 'Com os Engineers selecionados, clique com o botão direito no lago verde de Dados.', done: () => eng().some((u) => u.task.kind === 'gather' || u.task.kind === 'return'), at: () => engineers().length ? nearest((e) => e.kind === 'resource' && e.rtype === 'data') : eng()[0] },
    { t: 'Treine um Engineer', d: 'Clique no Lab HQ e pressione 1 (ou clique no cartão Engineer). Mais Engineers coletam mais rápido.', done: () => myHQ().queue.some((q) => q.type === 'engineer') || p0().stats.trained > st.base, at: () => selIs((e) => e.type === 'hq') ? card(1) : myHQ() },
    { t: 'Construa um Server Rack', d: 'Selecione um Engineer, pressione E (Economia) e depois R, e clique num terreno livre. Cada Rack dá +5 de população.', done: () => !!bld('rack'), at: () => !engineers().length ? eng()[0] : ghost ? null : buildCat === 'eco' ? card('R') : card('E') || card('B') },
    { t: 'Construa um Training Cluster', d: 'Com um Engineer: W (Militar) e depois C, e clique perto do HQ. Custa 150 Pesquisa: se faltar, mande Engineers ao arquivo âmbar.', done: () => !!bld('cluster'), at: () => !engineers().length ? eng()[0] : ghost ? null : buildCat === 'mil' ? card('C') : card('W') || card('B') },
    { t: 'Treine um Modelo', d: 'Quando o Cluster ficar pronto, clique nele e pressione 1.', done: () => mil().length > 0 || mine((b) => b.type === 'cluster').some((b) => b.queue.length), at: () => selIs((e) => e.type === 'cluster' && e.built) ? card(1) : bld('cluster') },
    { t: 'Avance de era', d: 'Clique no HQ e no cartão da próxima era (250 Dados, 150 Pesquisa). Engineers ociosos? Mande-os coletar.', done: () => p0().era > 1 || myHQ().queue.some((q) => q.kind === 'advance'), at: () => selIs((e) => e.type === 'hq') ? cardLabel(E.ERAS[p0().era]) : myHQ() },
    { t: 'Ataque', d: 'Selecione o Modelo, pressione A e clique no chão em direção à base rival (siga a seta).', done: () => mil().some((u) => /attack/.test(u.task.kind)), at: () => mode === 'attack' ? rivalHQ() : selIs((u) => u.kind === 'unit' && u.type !== 'engineer') ? card('A') : mil()[0] || bld('cluster') },
  ];
  const el = (id) => document.getElementById(id);
  function show() { const s = STEPS[st.i]; st.base = p0().stats.trained; el('tut-box').querySelector('b').textContent = `Passo ${st.i + 1}/8 · ${s.t}`; el('tut-box').querySelector('p').textContent = s.d; }
  function place(t) {
    const hole = el('tut-hole'), arrow = el('tut-arrow'); if (!t) { hole.style.display = arrow.style.display = 'none'; return; }
    let x, y, w, h; const W = innerWidth, top = 44 * uiScale, bot = innerHeight - PANEL_H;
    if (t instanceof Element) { const r = t.getBoundingClientRect(); x = r.left; y = r.top; w = r.width; h = r.height; }
    else { const r = (t.kind === 'building' ? Math.max(t.w, t.h) * T * 0.75 : 36) * zoom, cx = (t.x - cam.x) * zoom, cy = (t.y - cam.y) * zoom - (t.kind === 'unit' ? 10 * zoom : 0); x = cx - r; y = cy - r; w = h = 2 * r; }
    const cx = x + w / 2, cy = y + h / 2, off = cx < 0 || cx > W || cy < top || cy > bot;
    hole.style.display = off ? 'none' : 'block'; Object.assign(hole.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    // seta 26 px acima do recorte apontando para baixo; alvo fora da área de jogo: seta na borda, girada para o alvo
    let ax = cx, ay = y - 26; if (off) { ax = Math.max(24, Math.min(W - 24, cx)); ay = Math.max(top + 24, Math.min(bot - 24, cy)); }
    const ang = Math.atan2(cy - ay, cx - ax) * 180 / Math.PI;
    arrow.style.display = 'block'; arrow.style.left = ax + 'px'; arrow.style.top = ay + 'px'; arrow.style.setProperty('--a', ang + 'deg');
  }
  function tick() {
    if (!st || S !== st.game || S.winner !== null) return stop();
    let s = STEPS[st.i], ok, at = null; try { ok = s.done(); at = ok ? null : s.at(); } catch (e) { return stop(); } // ex.: HQ destruído
    if (ok) { st.i++; if (st.i >= STEPS.length) { stop(); toast('Tutorial concluído: a base é sua', 'info'); bannerShow('Tutorial concluído', 'Agora é com você: destrua o Lab HQ rival'); return; } show(); SFX.confirm(); }
    else place(at);
    requestAnimationFrame(tick);
  }
  function start() { if (!S) return; st = { game: S, i: 0, base: 0 }; el('tut').hidden = false; show(); place(null); requestAnimationFrame(tick); }
  function stop() { st = null; el('tut').hidden = true; }
  function skip() { if (!st) return; st.i++; if (st.i >= STEPS.length) return stop(); show(); SFX.click(); }
  el('tut-next').onclick = skip; el('tut-quit').onclick = () => { stop(); SFX.click(); };
  return { start, stop, skip, get step() { return st ? st.i : -1; } };
})();
