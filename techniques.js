// Compute Wars — 4.3.3 Mão de Técnicas (canto inferior esquerdo) e categoria "Técnicas" do Compute Exchange. Carregado por index.html depois de ui-panel.js.
// Engine: E.TECHNIQUES, cmd buyTechnique/technique (4.1.2). Hooks: Techniques.tick() no loop (depois de draw) e Techniques.panel(b, cmd) no painel do Exchange.
const Techniques = (() => {
  let armed = null, drag = null, cat = null, last = '';
  const GLY = { unit: '◎', building: '■', area: '◌', none: '✦' };
  const ALVO = (t) => ({ unit: 'uma unidade (clique nela)', building: 'um prédio inimigo (clique nele)', area: `uma área de raio ${t.radius} (clique no chão)`, none: 'nenhum: aplica ao clicar na carta' })[t.target];
  const costTxt = (c) => Object.keys(c).map((k) => `${c[k]} ${RNAME[k]}`).join(' · ');
  const tip = (k, shop) => { const t = E.TECHNIQUES[k]; return `<b>${t.name}</b><small>${t.desc}.<br>Alvo: ${ALVO(t)}. ${shop ? 'Custo' : 'Custo pago'}: ${costTxt(t.cost)}.${shop ? ' Vai para a mão (máx. 3); uma compra a cada 45 s.' : ' Alvo a até 10 tiles de algo seu.'}</small>`; };
  document.head.insertAdjacentHTML('beforeend', `<style>
  #hand { position:fixed; left:max(14px, calc(50vw - 786px)); bottom:212px; z-index:3; display:none; gap:8px; align-items:flex-end; zoom:var(--ui); }
  #hand .th { position:absolute; left:0; top:-28px; font:700 11px var(--label); letter-spacing:2px; text-transform:uppercase; color:var(--m1); text-shadow:0 1px 0 #000, 0 0 6px #000; white-space:nowrap; pointer-events:none; }
  #hand .th span { color:#9aa6ba; letter-spacing:1px; }
  #hand .tslot, #hand .tcard { width:84px; height:126px; flex:none; border:3px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #000, 0 6px 16px rgba(0,0,0,.8); }
  #hand .tslot { background:radial-gradient(circle at 50% 40%,var(--enamel),var(--enamel2) 80%); opacity:.8; display:flex; align-items:center; justify-content:center; color:var(--m3); font:700 22px var(--display); }
  #hand .tcard { position:relative; padding:0; background:#07090d; cursor:pointer; overflow:hidden; transform-origin:0 100%; transition:transform .12s ease-out; }
  #hand .tcard img { width:100%; height:100%; object-fit:cover; display:block; pointer-events:none; }
  #hand .tcard b { position:absolute; left:0; right:0; bottom:0; padding:16px 3px 4px; background:linear-gradient(transparent, rgba(0,0,0,.92) 45%); font:700 9px/10px var(--display); letter-spacing:.5px; color:var(--m1); text-align:center; text-shadow:0 1px 0 #000; text-transform:uppercase; }
  #hand .tcard i { position:absolute; top:3px; right:3px; width:16px; height:16px; border-radius:50%; background:radial-gradient(circle at 40% 35%,var(--enamel),var(--enamel2)); box-shadow:0 0 0 1px var(--m2), 0 0 0 2px #000; font:700 10px/16px var(--display); font-style:normal; color:var(--m1); text-align:center; }
  #hand .tcard:hover, #hand .tcard:focus-visible { transform:scale(1.75); z-index:2; }
  #hand .tcard.armed { box-shadow:inset 0 0 0 1px #000, 0 0 0 2px var(--m1), 0 0 18px var(--glow), 0 6px 16px rgba(0,0,0,.8); transform:translateY(-10px); }
  #hand .tcard.armed:hover { transform:translateY(-10px) scale(1.75); }
  .cmd.tech .thumb img { width:42px; height:42px; object-fit:cover; border:1px solid var(--m3); } .cmd.tech .t { letter-spacing:0; font-size:9.5px; }
  @media (prefers-reduced-motion: reduce) { #hand .tcard { transition:none; } }
  </style>`);
  const hand = () => S.players[0].hand;
  function pick(i) { // carta sem alvo aplica direto; com alvo, arma (clicar de novo desarma)
    const t = E.TECHNIQUES[hand()[i]]; if (!t) return;
    if (t.target === 'none') return use(i);
    armed = armed === i ? null : i; SFX.click(); last = '';
  }
  function use(i, w) {
    const k = hand()[i], t = E.TECHNIQUES[k], c = { type: 'technique', key: k };
    if (t.target === 'area') { c.x = w.x; c.y = w.y; } else if (t.target !== 'none') { const e = entAt(w.x, w.y); if (e) c.target = e.id; }
    if (E.cmd(S, 0, c)) {
      const at = c.target ? E.byId(S, c.target) : w; armed = null; last = ''; SFX.confirm(); toast(`Técnica: ${t.name}`, 'info');
      if (at) fx.push({ kind: 'ring', x: at.x, y: at.y, r: (t.radius || 1.2) * T, t: 0, dur: 0.9, col: '#C07AFF', w: 4 });
      refreshPanel();
    } else { SFX.deny(); toast(`${t.name}: ${t.target === 'none' ? 'sem efeito agora' : 'alvo inválido ou fora de alcance (10 tiles de algo seu)'}`, 'alert'); }
  }
  function render() {
    const p = S.players[0], el = $('hand'), shop = S.ents.some((b) => b.kind === 'building' && b.owner === 0 && b.built && E.BUILDINGS[b.type].market);
    if (armed != null && !p.hand[armed]) armed = null;
    const wait = p.techBuyAt != null ? Math.ceil(E.TECH_BUY_CD - (S.t - p.techBuyAt)) : 0, key = [p.hand.join(), armed, shop].join('|');
    el.style.display = p.hand.length || shop ? 'flex' : 'none';
    const th = `Técnicas ${p.hand.length}/${E.HAND_MAX}${wait > 0 ? ` <span>· compra em ${wait} s</span>` : ''}`;
    if (key === last) { const h = el.firstChild; if (h && h.innerHTML !== th) h.innerHTML = th; return; } last = key; // só o rótulo muda a cada segundo: não recria a carta sob o mouse
    el.innerHTML = `<div class="th">${th}</div>` + [0, 1, 2].map((i) => { const k = p.hand[i], t = k && E.TECHNIQUES[k];
      return t ? `<button class="tcard${armed === i ? ' armed' : ''}" data-i="${i}" aria-label="${t.name}" aria-pressed="${armed === i}" data-tip="${tip(k).replace(/"/g, '&quot;')}"><img src="assets/cards/${k}.png" alt=""><b>${t.name}</b><i>${GLY[t.target]}</i></button>` : '<div class="tslot">✦</div>'; }).join('');
    el.querySelectorAll('.tcard').forEach((b) => { const i = +b.dataset.i;
      b.onmousedown = (e) => { if (e.button !== 0) return; e.preventDefault(); const t = E.TECHNIQUES[hand()[i]]; if (t && t.target !== 'none') drag = { i, x: e.clientX, y: e.clientY }; pick(i); };
      b.onclick = (e) => { if (e.detail === 0) pick(i); }; }); // teclado (Enter/Espaço)
  }
  function tick() {
    if (!S) return; render();
    if (cat != null && sel[0] !== cat) cat = null;
    if (armed == null) return;
    const t = E.TECHNIQUES[hand()[armed]], ml = $('modeline'); ml.style.display = 'block'; ml.textContent = `${t.name}: escolha ${ALVO(t)} · Esc cancela`; cv.style.cursor = 'crosshair';
    const w = toWorld(mouse.x, mouse.y); ctx.save(); ctx.scale(zoom, zoom); ctx.translate(-cam.x, -cam.y); ctx.strokeStyle = '#C07AFF'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    const r = t.target === 'area' ? t.radius * T : hoverEnt ? (hoverEnt.kind === 'building' ? Math.max(hoverEnt.w, hoverEnt.h) * T / 2 + 6 : 24) : 0, at = t.target === 'area' ? w : hoverEnt;
    if (r && at) { ctx.fillStyle = 'rgba(192,122,255,.12)'; ctx.beginPath(); ctx.ellipse(at.x, at.y, r, r * (t.target === 'area' ? 0.6 : 0.5), 0, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  // captura em window: só intercepta com carta armada / arrastada ou categoria aberta
  addEventListener('mousedown', (e) => { if (armed == null || !S || e.target !== cv || e.button === 1) return; e.stopImmediatePropagation(); e.preventDefault(); if (e.button === 2) { armed = null; last = ''; } else use(armed, toWorld(e.offsetX, e.offsetY)); }, true);
  addEventListener('mouseup', (e) => { const d = drag; drag = null; if (!d || e.button !== 0 || e.target !== cv || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12) return; e.stopImmediatePropagation(); armed = d.i; use(d.i, toWorld(e.offsetX, e.offsetY)); }, true); // arrastar a carta até o alvo
  addEventListener('keydown', (e) => { if (!S) return;
    if (e.key === 'Escape' && armed != null) { armed = null; last = ''; e.stopImmediatePropagation(); }
    else if (cat != null && (e.key === 'Escape' || e.key.toLowerCase() === 'b')) { cat = null; refreshPanel(); SFX.click(); e.stopImmediatePropagation(); } }, true);
  function buy(k) {
    const p = S.players[0], t = E.TECHNIQUES[k];
    if (E.cmd(S, 0, { type: 'buyTechnique', key: k })) { SFX.buy(); toast(`${t.name} na mão`, 'info'); return; }
    const wait = p.techBuyAt != null ? Math.ceil(E.TECH_BUY_CD - (S.t - p.techBuyAt)) : 0;
    SFX.deny(); toast(p.hand.length >= E.HAND_MAX ? 'Mão cheia: use uma carta antes (máx. 3)' : wait > 0 ? `Próxima compra de Técnica em ${wait} s` : why(t.cost) || 'Precisa de um Compute Exchange pronto', 'alert'); return false;
  }
  // painel do Exchange: fechado acrescenta a categoria; aberto ocupa a grade (true) com Voltar + 12 compras
  function panel(b, cmd) {
    const p = S.players[0];
    if (cat !== b.id) { cmd({ label: 'Técnicas', img: 'assets/cards/jailbreak.png', cls: 'tech', costHtml: `<span class="time">mão ${p.hand.length}/${E.HAND_MAX}</span>`, fn: () => { cat = b.id; SFX.click(); }, tip: '<b>Técnicas</b><small>Cartas do MLG de uso único. Compre aqui (até 3 na mão, uma a cada 45 s) e use pela mão, no canto inferior esquerdo.</small>' }); return false; }
    $('actions').innerHTML = ''; const wait = p.techBuyAt != null ? Math.ceil(E.TECH_BUY_CD - (S.t - p.techBuyAt)) : 0;
    cmd({ label: 'Voltar', glyph: '↩', key: 'B', fn: () => { cat = null; SFX.click(); } });
    for (const k in E.TECHNIQUES) cmd({ label: E.TECHNIQUES[k].name.replace('Hallucination', 'Hallu\u00ADcination').replace('Distributional', 'Distribu\u00ADtional'), img: `assets/cards/${k}.png`, cls: 'tech', costHtml: costHtml(E.TECHNIQUES[k].cost) + (wait > 0 ? `<span class="time">${wait} s</span>` : ''), fn: () => buy(k), tip: tip(k, true) });
    return true;
  }
  return { tick, panel };
})();
