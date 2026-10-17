// Onda 5 / ui: 5.3.3 histórico de notificações (tecla Y; N é o mapa inteiro e J o Alignment Lab). Últimos 50 eventos do S.log, clique ou Enter leva a câmera ao local.
const Notify = (() => {
  const MAX = 50; let list = [], forS = null, back = null, backAt = null;
  document.head.insertAdjacentHTML('beforeend', `<style>
  #history { position:fixed; top:54px; left:14px; z-index:6; width:460px; display:none; flex-direction:column; max-height:calc(100vh / var(--ui) - 280px); zoom:var(--ui); background:rgba(7,11,17,.96); border:3px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #000, 0 16px 40px rgba(0,0,0,.85); padding:10px 10px 8px; }
  #history.open { display:flex; } body:has(#history.open) #log, body:has(#history.open) #hand { visibility:hidden; } /* avisos e mão de Técnicas ficariam por trás do histórico */
  #history h2 { font:700 15px var(--display); letter-spacing:3px; color:var(--m1); text-align:center; text-shadow:0 1px 0 #000; }
  #history .sub { text-align:center; font:600 11px var(--label); letter-spacing:1px; text-transform:uppercase; color:#9aa6ba; margin:2px 0 8px; } #history .sub kbd { font:700 10px var(--mono); color:#1a1206; background:var(--brass); padding:0 4px; border:1px solid #000; }
  #history ol { list-style:none; padding:0 2px 0 0; margin:0; overflow-y:auto; display:flex; flex-direction:column; gap:3px; }
  #history .ev { width:100%; display:grid; grid-template-columns:44px 1fr auto; gap:8px; align-items:center; text-align:left; padding:5px 8px; background:linear-gradient(90deg,rgba(16,24,36,.95),rgba(10,15,22,.9)); border:1px solid var(--m4); border-left:3px solid var(--own); color:var(--ivory); font:15px/1.25 var(--body); cursor:pointer; }
  #history .ev:hover, #history .ev:focus-visible { background:rgba(28,40,58,.98); border-color:var(--m2); outline:none; box-shadow:0 0 0 1px var(--m1), 0 0 10px var(--glow); }
  #history .ev[aria-disabled="true"] { cursor:default; }
  #history .ev.alert { border-left-color:var(--danger); } #history .ev.hero, #history .ev.levelup, #history .ev.era { border-left-color:var(--m1); }
  #history time { font:500 12px var(--mono); color:#9aa6ba; } #history .go { font:700 10px var(--label); letter-spacing:1px; text-transform:uppercase; color:var(--m1); white-space:nowrap; }
  #history .none { font-style:italic; color:#9aa6ba; text-align:center; padding:12px; }
  </style>`);
  const el = document.createElement('div'); el.id = 'history'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-labelledby', 'history-h'); el.tabIndex = -1; document.body.appendChild(el);
  const sync = () => { if (S !== forS) { forS = S; list = S ? S.log.slice(-MAX) : []; } };
  const isOpen = () => el.classList.contains('open');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function render() {
    const items = list.slice().reverse(), f = el.contains(document.activeElement) ? [...el.querySelectorAll('.ev')].indexOf(document.activeElement) : -1;
    el.innerHTML = `<h2 id="history-h">HISTÓRICO</h2><p class="sub">${items.length ? `Últimos ${items.length} eventos · ` : ''}<kbd>Y</kbd> ou <kbd>Esc</kbd> fecha</p><ol>${items.length ? items.map((l, i) => `<li><button class="ev ${esc(l.kind)}" data-i="${i}"${l.x == null ? ' aria-disabled="true"' : ''}><time>${fmt(l.t)}</time><span>${esc(l.text)}</span>${l.x != null ? '<span class="go">ir para</span>' : ''}</button></li>`).join('') : '<li class="none">Nenhum evento ainda</li>'}</ol>`;
    el.querySelectorAll('.ev').forEach((b) => { b.onclick = () => { const l = items[+b.dataset.i]; if (l.x == null) return; centerOn(l.x, l.y); SFX.click(); close(); }; });
    if (f >= 0) { const evs = el.querySelectorAll('.ev'); if (evs.length) evs[Math.min(f, evs.length - 1)].focus({ preventScroll: true }); }
  }
  function push(l) { sync(); if (list.includes(l)) return; list.push(l); if (list.length > MAX) list.shift(); if (isOpen()) render(); }
  function open() { sync(); back = document.activeElement; const h = back && back.parentNode; backAt = h && h.id ? [h.id, [...h.children].indexOf(back)] : null; /* o painel recria os cartões a cada 0,4 s: guarda a posição */ el.classList.add('open'); render(); (el.querySelector('.ev') || el).focus({ preventScroll: true }); SFX.openCat(); }
  function close() { if (!isOpen()) return; el.classList.remove('open'); el.innerHTML = ''; const to = back && back.isConnected ? back : backAt && $(backAt[0]) && $(backAt[0]).children[backAt[1]]; if (to && to !== document.body && to.focus) to.focus({ preventScroll: true }); else if (document.activeElement) document.activeElement.blur(); back = backAt = null; }
  // captura: com o histórico aberto, nenhuma tecla chega aos atalhos do jogo (setas não rolam a câmera); Tab, Enter e Espaço seguem o padrão do navegador
  addEventListener('keydown', (e) => {
    if (!S || $('overlay').style.display !== 'none' || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || (typeof Options !== 'undefined' && Options.isOpen) || document.querySelector('#saves.open')) return; /* slots de save (saves.js) são modais */
    const y = e.key.toLowerCase() === 'y' && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!isOpen()) { if (y && !e.repeat && S.winner === null) { e.preventDefault(); e.stopImmediatePropagation(); open(); } return; }
    e.stopImmediatePropagation();
    if (y || e.key === 'Escape') { e.preventDefault(); close(); SFX.click(); return; }
    const d = { ArrowDown: 1, ArrowUp: -1, Home: -1e3, End: 1e3 }[e.key]; if (d == null) return;
    e.preventDefault(); const evs = [...el.querySelectorAll('.ev')]; if (!evs.length) return; const i = evs.indexOf(document.activeElement);
    evs[Math.max(0, Math.min(evs.length - 1, (i < 0 ? 0 : i) + d))].focus();
  }, true);
  addEventListener('mousedown', (e) => { if (isOpen() && !el.contains(e.target)) close(); });
  return { push, open, close, toggle: () => (isOpen() ? close() : open()), get isOpen() { return isOpen(); }, get list() { sync(); return list; } };
})();
