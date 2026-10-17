// Compute Wars — Onda 5 (5.2.4): save em 3 slots + autosave a cada 2 min de jogo, com miniatura do minimapa. Browser: window.Saves; Node: require('./saves.js').
// Chaves: cw_slot_<k> (estado serializado) e cw_slot_<k>_meta ({ t, at, faction, size, players, campaign, thumb }), k em 1, 2, 3, auto.
(function (root) {
  const NODE = typeof module !== 'undefined';
  const SE = NODE ? require('./engine.js') : root.Engine;
  const SLOTS = ['1', '2', '3', 'auto'], AUTO_EVERY = 120;
  let LS = NODE ? null : (() => { try { return root.localStorage; } catch (e) { return null; } })();
  const key = (k) => 'cw_slot_' + k, mkey = (k) => key(k) + '_meta';
  const get = (k) => { try { return LS ? LS.getItem(k) : null; } catch (e) { return null; } };
  const NO_ROOM = 'Sem espaço no navegador: apague um slot ou replays antigos';
  const metaOf = (s, thumb) => ({ t: s.t, at: Date.now(), faction: s.players[0].faction, size: (s.opts && s.opts.size) || (s.W === 54 ? 'small' : s.W === 108 ? 'large' : 'medium'), players: s.players.length, campaign: s.campaign ? s.campaign.i + 1 : 0, thumb: thumb || '' });

  // grava o estado e depois a meta; se o estado não couber, o navegador mantém o valor anterior do slot (nada muda)
  function write(k, s, thumb) {
    if (!SLOTS.includes(k)) return 'Slot inválido';
    if (s.spectate) return 'Replays não são salvos como partida';
    if (!LS) return 'Armazenamento do navegador indisponível';
    try { LS.setItem(key(k), SE.serialize(s)); } catch (e) { return /quota/i.test(e.name + e.message) ? NO_ROOM : 'Não foi possível salvar'; }
    const m = metaOf(s, thumb);
    try { LS.setItem(mkey(k), JSON.stringify(m)); } catch (e) { m.thumb = ''; try { LS.setItem(mkey(k), JSON.stringify(m)); } catch (e2) { try { LS.removeItem(mkey(k)); } catch (e3) {} } } // sem a meta, o slot aparece sem detalhes (nunca com os de outro save)
    return '';
  }
  // R20: o save único da versão anterior (cw_save) vai para o slot 1 ou o primeiro livre; sem slot livre, fica onde está
  function migrate() {
    const old = get('cw_save'); if (!old) return;
    const k = SLOTS.find((x) => !get(key(x))); if (!k) return;
    let m = { t: 0, at: Date.now(), faction: '', size: 'medium', players: 2, campaign: 0, thumb: '' }; try { m = metaOf(SE.deserialize(old)); } catch (e) {}
    try { LS.setItem(key(k), old); LS.setItem(mkey(k), JSON.stringify(m)); LS.removeItem('cw_save'); } catch (e) {}
  }
  function list() { migrate(); return SLOTS.map((k) => { let m = null; if (get(key(k))) { try { m = JSON.parse(get(mkey(k)) || '{}') || {}; } catch (e) { m = {}; } } return { k, meta: m }; }); }
  const any = () => list().some((x) => x.meta);
  function read(k) { migrate(); const j = SLOTS.includes(k) && get(key(k)); if (!j) return null; try { return SE.deserialize(j); } catch (e) { return null; } }
  function remove(k) { try { LS.removeItem(key(k)); LS.removeItem(mkey(k)); } catch (e) {} }
  // R14: autosave quando o tempo de jogo cruza um múltiplo de 2 min; partida nova (ou carregada) recomeça do tempo atual
  let autoS = null, autoN = 0;
  function tick(s) {
    if (!s || s.spectate || s.winner !== null) return null;
    const n = Math.floor(s.t / AUTO_EVERY); if (s !== autoS) { autoS = s; autoN = n; return null; }
    if (n <= autoN) return null; autoN = n;
    return write('auto', s, thumb());
  }
  const thumb = () => { if (NODE || typeof mini === 'undefined') return ''; try { const c = document.createElement('canvas'); c.width = 96; c.height = 72; const k = mini.height / 186; c.getContext('2d').drawImage(mini, 0, 12 * k, mini.width, mini.height - 12 * k, 0, 0, 96, 72); /* sem a etiqueta do modo do minimapa */ return c.toDataURL('image/jpeg', 0.7); } catch (e) { return ''; } };
  const Saves = { SLOTS, AUTO_EVERY, list, any, read, write, remove, tick, useStore: (st) => { LS = st; autoS = null; } };
  if (NODE) { module.exports = Saves; return; }
  root.Saves = Saves;

  // ---- UI: modal de slots (menu da partida e lobby) ----
  const $s = (id) => document.getElementById(id), SIZE_N = { small: 'Pequeno', medium: 'Médio', large: 'Grande' };
  const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const when = (at) => { const d = new Date(at); return at ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '—'; };
  const el = document.createElement('div'); el.id = 'saves'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'saves-h'); document.body.appendChild(el);
  let mode = 'load', wasPaused = null, pending = null, back = null;
  function card(k, m) {
    const name = k === 'auto' ? 'Autosave' : `Slot ${k}`, fac = m && m.faction ? (typeof FNAME !== 'undefined' && FNAME[m.faction]) || m.faction : '—', ask = pending && pending[1] === k;
    const btn = (a, label, cls, off) => `<button class="${cls}" data-a="${a}" data-k="${k}"${off ? ' disabled' : ''}>${ask && pending[0] === a ? 'Confirmar' : label}</button>`;
    return `<section class="slot${m ? '' : ' empty'}"><h3>${name}${k === 'auto' ? ' <small>a cada 2 min</small>' : ''}</h3>
      <div class="thumb">${m && m.thumb ? `<img src="${m.thumb}" alt="Minimapa do ${name}">` : `<span>${m ? 'Sem miniatura' : 'Vazio'}</span>`}</div>
      ${m ? `<dl><dt>Facção</dt><dd>${fac}</dd><dt>Mapa</dt><dd>${SIZE_N[m.size] || 'Médio'}${m.players > 2 ? ` · ${m.players} jogadores` : ''}</dd><dt>Tempo</dt><dd>${m.campaign ? `Missão ${m.campaign} · ` : ''}${clock(m.t || 0)}</dd><dt>Salvo em</dt><dd>${when(m.at)}</dd></dl>` : '<p class="none">Nenhuma partida salva</p>'}
      <div class="act">${mode === 'save' ? (k === 'auto' ? '<span class="ro">Automático</span>' : btn('save', m ? 'Sobrescrever' : 'Salvar aqui', 'cta', false)) : btn('load', 'Carregar', 'cta', !m)}${m ? btn('del', 'Apagar', 'tb', false) : ''}</div></section>`;
  }
  function render(msg, bad) {
    el.innerHTML = `<div class="box"><h1 id="saves-h">${mode === 'save' ? 'SALVAR PARTIDA' : 'CARREGAR PARTIDA'}</h1><div class="slots">${list().map(({ k, meta }) => card(k, meta)).join('')}</div>
      <p class="msg${bad ? ' bad' : ''}" id="saves-msg" role="status">${msg || ''}</p><div class="foot"><button class="tb" data-a="close">Voltar <kbd>Esc</kbd></button></div></div>`;
  }
  const focusOn = (sel) => { const b = el.querySelector(sel) || el.querySelector('button:not([disabled])'); if (b) b.focus(); };
  function open(m) {
    if (m === 'save' && (!S || S.spectate)) { toast('Replays não são salvos como partida', 'info'); return; }
    const mn = document.getElementById('menu'), fromMenu = mn && mn.contains(document.activeElement); if (mn) { mn.classList.remove('open'); document.getElementById('menubtn').setAttribute('aria-expanded', false); } /* menu não fica cortado atrás do modal */
    mode = m; pending = null; back = fromMenu ? document.getElementById('menubtn') : document.activeElement;
    const inGame = S && S.winner === null && $s('overlay').style.display === 'none'; wasPaused = inGame ? paused : null; if (inGame) paused = true; // R15: pausa enquanto escolhe
    render(); el.classList.add('open'); focusOn(m === 'save' ? '[data-a=save]' : '[data-a=load]:not([disabled])'); SFX.click();
  }
  function close(silent) { el.classList.remove('open'); if (wasPaused !== null) paused = wasPaused; wasPaused = null; if (!silent) SFX.click(); if (back && back.focus && document.contains(back)) back.focus(); }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return; const { a, k } = b.dataset;
    if (a === 'close') return close();
    if ((a === 'del' || (a === 'save' && list().find((x) => x.k === k).meta)) && !(pending && pending[0] === a && pending[1] === k)) { pending = [a, k]; render(a === 'del' ? `Apagar o ${k === 'auto' ? 'autosave' : 'slot ' + k}? Clique em Confirmar.` : `Sobrescrever o slot ${k}? Clique em Confirmar.`); focusOn(`[data-a=${a}][data-k="${k}"]`); SFX.click(); return; }
    pending = null;
    if (a === 'save') { const err = write(k, S, thumb()); render(err || `Partida salva no slot ${k}`, !!err); focusOn(`[data-a=save][data-k="${k}"]`); (err ? SFX.deny : SFX.confirm)(); if (!err) toast('Partida salva', 'info'); }
    else if (a === 'load') { const st = read(k); if (!st) { render('Save corrompido: não foi possível carregar', true); SFX.deny(); return; } wasPaused = null; close(true); begin(st); topBuilt = false; toast('Partida carregada', 'info'); }
    else if (a === 'del') { remove(k); render(`${k === 'auto' ? 'Autosave apagado' : 'Slot ' + k + ' apagado'}`); focusOn('button'); SFX.click(); if (typeof startScreen === 'function' && $s('overlay').style.display !== 'none' && !any()) { const lb = $s('loadbtn'); if (lb) lb.remove(); } }
  });
  // captura: com o modal aberto nenhuma tecla chega ao jogo (Tab, Enter e Espaço seguem nos botões); Esc fecha
  addEventListener('keydown', (e) => { if (!el.classList.contains('open')) return; e.stopImmediatePropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } }, true);
  addEventListener('keyup', (e) => { if (el.classList.contains('open')) e.stopImmediatePropagation(); }, true);
  Saves.open = open; Saves.close = close; Saves.tick = (s) => { const err = tick(s); if (err) toast(`Autosave falhou: ${err}`, 'alert'); return err; };
  root.saveGame = () => open('save'); root.loadGame = () => open('load'); // botões do menu da partida (ui-panel.js) abrem os slots

  document.head.insertAdjacentHTML('beforeend', `<style>
  #saves { position:fixed; inset:0; z-index:20; display:none; align-items:center; justify-content:center; background:rgba(5,8,12,.78); padding:16px; } #saves.open { display:flex; }
  #saves .box { width:min(1120px, 100%); max-height:100%; overflow:auto; background:rgba(7,11,17,.96); border:4px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #000, 0 24px 80px rgba(0,0,0,.85); padding:16px 24px 18px; }
  #saves h1 { text-align:center; font:700 30px var(--display); letter-spacing:.3em; background:linear-gradient(180deg,#fff6d2 0%,var(--m1) 28%,var(--m2) 52%,var(--m3) 72%,var(--m1) 100%); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 2px 0 #2a1b05); margin-bottom:14px; }
  #saves .slots { display:grid; grid-template-columns:repeat(4, 1fr); gap:14px; }
  #saves .slot { display:flex; flex-direction:column; gap:8px; padding:10px; background:linear-gradient(180deg,var(--enamel2),var(--enamel)); border:2px solid var(--m3); box-shadow:inset 0 1px 0 rgba(255,255,255,.06), inset 0 0 14px rgba(0,0,0,.75), 0 0 0 1px #000; }
  #saves .slot.empty { opacity:.82; } #saves .slot h3 { font:700 13px var(--display); letter-spacing:.2em; text-transform:uppercase; color:var(--m1); text-shadow:0 1px 0 #000; } #saves .slot h3 small { font:500 10px var(--mono); letter-spacing:0; text-transform:none; color:#8f9bb0; }
  #saves .thumb { aspect-ratio:4/3; display:flex; align-items:center; justify-content:center; background:#05080b; border:2px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, inset 0 0 18px rgba(0,0,0,.9); }
  #saves .thumb img { width:100%; height:100%; object-fit:cover; image-rendering:auto; } #saves .thumb span { font:700 12px var(--label); letter-spacing:.2em; text-transform:uppercase; color:#5d6878; }
  #saves dl { display:grid; grid-template-columns:auto 1fr; gap:2px 10px; font:500 13px var(--body); } #saves dt { font:700 10px var(--label); letter-spacing:1px; text-transform:uppercase; color:#8f9bb0; align-self:center; } #saves dd { color:var(--ivory); }
  #saves .none { font:500 13px var(--body); color:#7d8796; min-height:72px; } #saves .act { display:flex; gap:8px; margin-top:auto; min-height:36px; } #saves .cta { background:var(--brass); color:#1a1206; border:1px solid #2a1b05; font:700 12px var(--label); letter-spacing:2px; text-transform:uppercase; cursor:pointer; box-shadow:inset 0 1px 0 rgba(255,255,255,.55), inset 0 -2px 0 rgba(0,0,0,.35), 0 0 0 1px #000, 0 4px 10px rgba(0,0,0,.7), 0 0 12px var(--glow); text-shadow:0 1px 0 rgba(255,255,255,.35); transition:transform .08s, filter .12s; } #saves .cta:hover:not(:disabled) { transform:translateY(-1px); filter:brightness(1.08); }
  #saves .act .cta { flex:1; padding:9px 10px; } #saves .act .cta:disabled { opacity:.45; cursor:default; filter:grayscale(.6); }
  #saves .act .tb { height:auto; padding:0 10px; font-size:11px; } #saves .ro { flex:1; font:700 10px var(--label); letter-spacing:.2em; text-transform:uppercase; color:#7d8796; align-self:center; text-align:center; }
  #saves .msg { min-height:20px; margin:12px 0 4px; text-align:center; font:600 13px var(--label); letter-spacing:1px; color:var(--own); } #saves .msg.bad { color:var(--danger); }
  #saves .foot { display:flex; justify-content:center; } #saves .foot kbd { font:500 10px var(--mono); color:#8f9bb0; text-transform:none; }
  @media (max-width:1100px) { #saves .slots { grid-template-columns:repeat(2, 1fr); } }
  </style>`);
})(typeof window !== 'undefined' ? window : globalThis);
