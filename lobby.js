// Compute Wars — Onda 4 ui-lobby: 4.3.1 lobby, 4.3.2 opções, 4.5.1 teclado, 4.5.2 trackpad, 4.5.3 minimapa redimensionável.
// Carregado por último. Dono do contrato 5: begin(opts) e startScreen(). Sem `function begin` aqui: o hoisting apagaria a versão de index.html.
const OPT = { edge: true, wheel: 'pan' }; try { Object.assign(OPT, JSON.parse(localStorage.getItem('cw_opts') || '{}')); } catch (e) {}
const saveOpt = () => { try { localStorage.setItem('cw_opts', JSON.stringify(OPT)); } catch (e) {} };

// ---- contrato 5: begin(opts) cria a partida; begin(estado) segue como antes (saves, tutorial, roteiros) ----
const beginState = begin;
function makeGame(o) {
  const s = E.createGame(o);
  return s;
}
begin = (x, fresh) => { if (x && x.ents) return beginState(x, fresh); beginState(makeGame(x), true); speed = x.speed || 1; };

// ---- 4.3.1 lobby ----
const FAC_TXT = {
  citadel: ['Closed-source', 'The Citadel', 'Modelos caros em GPU e mais fortes. Herói Chanceler de Helios: Decreto dá +50% de ataque em área; a passiva restaura alinhamento.'],
  foundry: ['Open-source', 'The Foundry', 'Modelos baratos em GPU, pedem Pesquisa; Mistral é veloz. Herói Forgemaster: Overclock dá velocidade e ataque em área; a passiva acelera a coleta.'],
  commons: ['Acadêmica', 'The Commons', 'Modelos baratos, frágeis e de treino rápido, pagos em Pesquisa. Heroína A Arquivista: Revisão por Pares cura e fortalece em área; a passiva cura Modelos próximos.'],
};
const facTxt = (f) => FAC_TXT[f] || ['Facção', f[0].toUpperCase() + f.slice(1), E.HEROES[E.HERO[f]] ? `Herói ${E.HEROES[E.HERO[f]].titles[0]}.` : ''];
const MODES = { '1v1': [0, 1], '1v2': [0, 1, 1], '2v2': [0, 0, 1, 1], ffa: [0, 1, 2, 3] }; // time de cada vaga; vaga 0 é você
const MODE_N = { '1v1': '1v1', '1v2': '1v2', '2v2': '2v2', ffa: 'Todos contra todos' };
const DIFFS = [['easy', 'Fácil'], ['normal', 'Normal'], ['hard', 'Difícil'], ['insane', 'Insano']];
const VICT = [['conquest', 'Conquista', 'Destrua o Lab HQ rival'], ['agi', 'AGI', 'Conclua o AGI Deployment e resista 120 s'], ['monopoly', 'Monopólio', 'Guarde os 5 Datasets por 5 min'], ['points', 'Pontos', 'Maior placar aos 30 min']];
const SIZES = [['small', 'Pequeno', 0], ['medium', 'Médio', 1], ['large', 'Grande', 0]]; // MAP_W/MAP_H são constantes: só o Médio (72×54) existe
const SPEEDS = [0.5, 1, 1.5, 2, 3];
const COLORS = [['', 'Cor da facção'], ['#7FE6F0', 'Ciano'], ['#A8FF38', 'Lima'], ['#F2E9D8', 'Marfim'], ['#FF8FD8', 'Rosa']];
const newSeed = () => (Date.now() & 0xffff) || 7;
const LB = { mode: '1v1', slots: [], difficulty: 'normal', size: 'medium', biome: null, victory: ['conquest', 'agi', 'monopoly'], speed: 1, seed: newSeed(), color: '' };
function buildSlots() { const F = Object.keys(E.ROSTER), others = F.filter((f) => f !== chosen); LB.slots = MODES[LB.mode].map((team, i) => ({ team, faction: i ? (others.length ? others : F)[(i - 1) % (others.length || F.length)] : chosen })); }
const slotName = (i) => !i ? 'Você' : LB.slots[i].team === LB.slots[0].team ? 'Aliado' : `Rival ${LB.slots.slice(1, i + 1).filter((s) => s.team !== LB.slots[0].team).length}`;
const lobbyOpts = () => ({ seed: LB.seed, faction: chosen, difficulty: LB.difficulty, players: LB.slots.map((s, i) => ({ faction: i ? s.faction : chosen, team: s.team, ai: i > 0, name: slotName(i) })), victory: LB.victory.slice(), size: LB.size, ...(LB.biome != null ? { biome: LB.biome } : {}), ...(LB.color ? { color: LB.color } : {}), speed: LB.speed });
const slotCol = (i) => E.ownerColor({ players: LB.slots.map((s, k) => ({ id: k, team: s.team, faction: k ? s.faction : chosen, color: k ? undefined : LB.color || undefined })) }, i); // mesma regra da partida (engine)

// preview: a partida é gerada (sem iniciar) e desenhada como o minimapa (ui-world.js), mais anel numerado no HQ e legenda
function drawPreview() {
  const c = $('lb-prev'); if (!c) return; const g = c.getContext('2d'), s = makeGame(lobbyOpts()), W = c.width, H = c.height, tw = W / E.MAP_W, th = H / E.MAP_H, px = W / (E.MAP_W * T), py = H / (E.MAP_H * T);
  const col = (o) => (o >= 0 && s.players[o] && s.players[o].color) || E.ownerColor(s, o);
  for (let y = 0; y < E.MAP_H; y++) for (let x = 0; x < E.MAP_W; x++) { const i = y * E.MAP_W + x; g.fillStyle = s.grid[i] === 3 ? '#2a2e33' : E.BIOMES[s.biome[i]].col; g.fillRect(x * tw, y * th, tw + 0.5, th + 0.5); }
  for (const e of s.ents) { if (e.kind === 'resource') { g.fillStyle = RCOL[e.rtype]; g.fillRect(e.x * px - 1.5, e.y * py - 1.5, 3, 3); } else if (e.kind === 'building') { g.fillStyle = col(e.owner); g.fillRect(e.tx * tw, e.ty * th, e.w * tw, e.h * th); g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(e.tx * tw, e.ty * th, e.w * tw, e.h * th); } }
  for (const r of s.relics) { g.fillStyle = RELIC_COL[r.id]; g.beginPath(); g.arc(r.x * px, r.y * py, 3, 0, 7); g.fill(); }
  g.font = '700 11px IBM Plex Mono, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const h of s.ents.filter((e) => e.type === 'hq')) { const x = h.x * px, y = h.y * py; g.strokeStyle = col(h.owner); g.lineWidth = 2; g.beginPath(); g.arc(x, y, 13, 0, 7); g.stroke(); g.fillStyle = 'rgba(5,8,12,.85)'; g.beginPath(); g.arc(x, y - 22, 8, 0, 7); g.fill(); g.fillStyle = col(h.owner); g.fillText(h.owner + 1, x, y - 21.5); }
  const leg = `${SIZES.find((z) => z[0] === LB.size)[1]} · ${LB.biome == null ? 'Misto' : E.BIOMES[LB.biome].name} · semente ${LB.seed} · ${DIFFS.find((d) => d[0] === LB.difficulty)[1]}`;
  g.fillStyle = 'rgba(5,8,12,.82)'; g.fillRect(0, H - 18, W, 18); g.fillStyle = '#F2E9D8'; g.font = '600 11px IBM Plex Sans Condensed, Arial Narrow, sans-serif'; g.textBaseline = 'alphabetic'; g.fillText(leg.toUpperCase(), W / 2, H - 5);
  c.dataset.leg = leg;
}

const seg = (k, list, isOn) => `<span class="seg" role="group">${list.map(([v, n, en = 1, tip]) => `<button data-k="${k}" data-v="${v}" class="${isOn(v) ? 'on' : ''}" aria-pressed="${isOn(v)}"${en ? '' : ' disabled'}${tip ? ` title="${tip}"` : ''}>${n}${en ? '' : ' <small>em breve</small>'}</button>`).join('')}</span>`;
const opt = (list, cur) => list.map(([v, n]) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${n}</option>`).join('');
function renderLobby() {
  const el = $('lobby'); if (!el) return; const f = document.activeElement, fk = f && f.dataset && f.dataset.k ? `[data-k="${f.dataset.k}"]${f.dataset.v != null ? `[data-v="${f.dataset.v}"]` : ''}${f.dataset.i != null ? `[data-i="${f.dataset.i}"]` : ''}` : null;
  const F = Object.keys(E.ROSTER).map((x) => [x, facTxt(x)[1]]), teams = [0, 1, 2, 3].map((t) => [t, `Time ${t + 1}`]);
  el.innerHTML = `<div class="cfg"><h3>Partida personalizada</h3>
    <div class="row"><span class="sub">Modo</span>${seg('mode', Object.entries(MODE_N), (v) => v === LB.mode)}</div>
    <table class="slots"><tbody>${LB.slots.map((s, i) => `<tr><td><span class="badge" style="--c:${slotCol(i)}">${i + 1}</span>${slotName(i)}</td>
      <td>${i ? `<select data-k="fac" data-i="${i}" aria-label="Facção da vaga ${i + 1}">${opt(F, s.faction)}</select>` : `<span class="you">${facTxt(chosen)[1]}</span>`}</td>
      <td><select data-k="team" data-i="${i}" aria-label="Time da vaga ${i + 1}">${opt(teams, s.team)}</select></td>
      <td>${i ? '<span class="ai">IA</span>' : `<select data-k="color" aria-label="Sua cor">${opt(COLORS, LB.color)}</select>`}</td></tr>`).join('')}</tbody></table>
    <div class="row"><span class="sub">Dificuldade</span>${seg('diff', DIFFS, (v) => v === LB.difficulty)}</div>
    <div class="row"><span class="sub">Vitória</span>${seg('vic', VICT.map(([v, n, d]) => [v, n, 1, d]), (v) => LB.victory.includes(v))}</div>
    <div class="row"><span class="sub">Velocidade</span>${seg('speed', SPEEDS.map((v) => [v, String(v).replace('.', ',') + '×']), (v) => +v === LB.speed)}</div></div>
  <div class="map"><canvas id="lb-prev" width="288" height="216" role="img" aria-label="Preview do mapa"></canvas>
    <div class="row"><span class="sub">Tamanho</span>${seg('size', SIZES, (v) => v === LB.size)}</div>
    <div class="row"><span class="sub">Bioma</span><select data-k="biome" aria-label="Bioma">${opt([['', 'Misto'], ...E.BIOMES.map((b, i) => [i, b.name])], LB.biome == null ? '' : LB.biome)}</select>
      <span class="sub sm">Semente</span><input id="lb-seed" data-k="seed" type="number" min="1" max="65535" value="${LB.seed}" aria-label="Semente"><button class="tb" data-k="reseed" title="Sortear semente">Sortear</button></div></div>`;
  drawPreview(); const back = fk && el.querySelector(fk); if (back) back.focus();
}
function lobbyClick(e) {
  const b = e.target.closest('button[data-k]'); if (!b || b.disabled) return; const { k, v } = b.dataset;
  if (k === 'mode') { LB.mode = v; buildSlots(); } else if (k === 'diff') LB.difficulty = v; else if (k === 'size') LB.size = v; else if (k === 'speed') LB.speed = +v; else if (k === 'reseed') LB.seed = newSeed();
  else if (k === 'vic') { const on = LB.victory.includes(v); if (on && LB.victory.length === 1) { SFX.deny(); lobbyMsg('Deixe ao menos uma condição de vitória'); return; } LB.victory = on ? LB.victory.filter((x) => x !== v) : [...LB.victory, v]; }
  else return;
  lobbyMsg(''); SFX.click(); renderLobby();
}
function lobbyChange(e) {
  const t = e.target, k = t.dataset.k, i = +t.dataset.i;
  if (k === 'fac') LB.slots[i].faction = t.value; else if (k === 'team') LB.slots[i].team = +t.value; else if (k === 'color') LB.color = t.value; else if (k === 'biome') LB.biome = t.value === '' ? null : +t.value;
  else if (k === 'seed') { const n = Math.floor(+t.value); if (n >= 1 && n <= 65535) { LB.seed = n; drawPreview(); } else if (e.type === 'change') renderLobby(); return; } // inválida: ao sair do campo volta à semente em uso else return;
  SFX.click(); renderLobby();
}
const lobbyMsg = (m) => { const el = $('lb-msg'); if (el) el.textContent = m; };

function startScreen() {
  const ob = $('cw-obj'); if (ob) ob.style.display = 'none'; /* objetivos de missão não ficam no lobby */ Audio.stopAmbient(); const menuMusic = () => { if (Audio.unlock() && (!S || S.winner !== null)) Sound.start('menu'); }; if (Audio.ctx) menuMusic(); else addEventListener('pointerdown', menuMusic, { once: true }); /* 4.4.2 tema de menu (precisa de gesto para destravar o áudio) */ const o = $('overlay'); o.style.display = 'flex'; o.style.backgroundImage = 'url(assets/ui_title.jpg)'; document.body.dataset.f = chosen;
  let saved = null; try { saved = localStorage.getItem('cw_save'); } catch (e) {}
  if (!LB.slots.length) buildSlots();
  const F = Object.keys(E.ROSTER), extra = [[typeof Campaign !== 'undefined', 'cpbtn', 'Campanha', () => Campaign.open()], [typeof Replay !== 'undefined', 'rpbtn', 'Replays', () => Replay.open()], [typeof Profile !== 'undefined', 'pfbtn', 'Perfil', () => Profile.open()]].filter((x) => x[0]); // contrato 5: só se o global existir
  o.innerHTML = `<div class="title"><header><h1>COMPUTE WARS</h1><h2>AN AGE OF ENGINEERED INTELLIGENCE</h2></header>
    <footer><div class="factions" style="--n:${F.length}">${F.map((f) => { const t = facTxt(f); return `<div class="fac ${chosen === f ? 'sel' : ''}" data-f="${f}" tabindex="0" role="button" aria-pressed="${chosen === f}"><img src="assets/ui_emblem_${f}.png" alt="" onerror="this.style.visibility='hidden'"><img class="hero" src="assets/ui_portrait_${E.HERO[f]}.png" alt="" onerror="this.style.visibility='hidden'"><div><em>${t[0]}</em><b>${t[1]}</b><small>${t[2]}</small></div></div>`; }).join('')}</div>
    <div id="lobby"></div>
    <p class="lb-btns"><button class="cta" id="start">Iniciar partida</button>${saved ? '<button class="cta" id="loadbtn">Continuar jogo salvo</button>' : ''}<button class="cta" id="tutbtn">Tutorial</button>${extra.map(([, id, n]) => `<button class="cta" id="${id}">${n}</button>`).join('')}<button class="cta alt" id="optbtn">Opções</button></p><p id="lb-msg" role="status"></p></footer></div>`;
  $('tutbtn').onclick = () => { Audio.unlock(); begin(E.createGame({ faction: chosen, difficulty: 'easy', seed: 7 }), true); Tutorial.start(); }; // 3.3.3: partida fácil com semente fixa
  o.querySelectorAll('.fac').forEach((f) => { f.onclick = () => { chosen = f.dataset.f; document.body.dataset.f = chosen; o.querySelectorAll('.fac').forEach((x) => { x.classList.toggle('sel', x === f); x.setAttribute('aria-pressed', x === f); }); buildSlots(); renderLobby(); SFX.click(); }; f.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.click(); } }; });
  $('lobby').addEventListener('click', lobbyClick); $('lobby').addEventListener('change', lobbyChange); $('lobby').addEventListener('input', (e) => { if (e.target.dataset.k === 'seed') lobbyChange(e); });
  $('start').onclick = () => { Audio.unlock(); begin(lobbyOpts()); };
  if (saved) $('loadbtn').onclick = () => { Audio.unlock(); try { begin(E.deserialize(saved)); } catch (e) { lobbyMsg('Save corrompido: não foi possível carregar'); } };
  for (const [, id, , fn] of extra) $(id).onclick = () => { Audio.unlock(); fn(); };
  $('optbtn').onclick = () => { Options.open(); SFX.click(); };
  renderLobby();
}

// ---- 4.3.2 opções ----
const STANCE_DEF = Object.values(STANCE);
const KEY_ACT = [...Object.keys(HOTKEY).map((b) => [b, E.BUILDINGS[b].name, 'eng']), ...STANCE_DEF.map((v) => ['stance_' + v[0], `Postura ${v[1]}`, 'mil']), ['ability', 'Habilidade do herói', 'any'], ['ability2', 'Habilidade 2 do herói', 'mil']];
const KEY_DEF = Object.fromEntries([...Object.entries(HOTKEY), ...Object.entries(STANCE).map(([k, v]) => ['stance_' + v[0], k.toUpperCase()]), ['ability', HERO_KEY.ability], ['ability2', HERO_KEY.ability2]]);
// contexto: prédio = Engineers selecionados; militar = postura e habilidade 2; any = habilidade 1 (vale com qualquer seleção). Letras com uso fixo que vem antes no keydown:
const KEY_RES = { eng: 'APSHMNEWXFV', mil: 'TAPSHMNGU' }; KEY_RES.any = KEY_RES.eng + KEY_RES.mil + 'RWASD';
const FIXED_N = { A: 'Ataque-mover', P: 'Patrulhar', S: 'Parar', H: 'HQ', M: 'Modo do minimapa', N: 'Mapa inteiro', E: 'Economia', W: 'Militar e câmera', X: 'Pesquisa', F: 'Defesa', V: 'Vitória', T: 'Árvore de tecnologias', G: 'Guarnecer', U: 'Sair da guarnição', R: 'Ponto de encontro', D: 'Câmera' };
function keyClash(act, key, map) {
  const ctx = KEY_ACT.find((a) => a[0] === act)[2];
  if (!/^[A-Z]$/.test(key)) return 'Use uma letra de A a Z';
  if (KEY_RES[ctx].includes(key)) return `${key} já é ${FIXED_N[key]}`;
  for (const [a, n, c] of KEY_ACT) if (a !== act && map[a] === key && (c === ctx || c === 'any' || ctx === 'any')) return `${key} já é ${n}`;
  return null;
}
let KEYS = {}; try { KEYS = JSON.parse(localStorage.getItem('cw_keys') || '{}') || {}; } catch (e) {}
const keyMap = () => ({ ...KEY_DEF, ...KEYS });
function applyKeys() {
  const m = keyMap(); for (const b in HOTKEY) HOTKEY[b] = m[b];
  for (const k in STANCE) delete STANCE[k]; for (const v of STANCE_DEF) STANCE[m['stance_' + v[0]].toLowerCase()] = v; // mesma ordem: o painel lista Agressiva, Defensiva, Parada
  HERO_KEY.ability = m.ability; HERO_KEY.ability2 = m.ability2;
}
if (Object.keys(KEYS).some((a) => !(a in KEY_DEF)) || KEY_ACT.some(([a]) => keyClash(a, keyMap()[a], keyMap()))) KEYS = {}; // cw_keys corrompido ou com conflito: volta aos padrões
applyKeys();
const Options = (() => {
  let waiting = null; const el = document.createElement('div'); el.id = 'opts'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'opts-h'); document.body.appendChild(el);
  const pct = (v) => Math.round(v * 100) + '%';
  function render() {
    const m = keyMap(), BUS = { ui: 'Interface', world: 'Mundo', alert: 'Alertas', music: 'Música' };
    el.innerHTML = `<div class="box"><h1 id="opts-h">OPÇÕES</h1><div class="cols">
      <section><h3>Som</h3><label class="row"><span class="ln">Volume geral</span><input type="range" min="0" max="1" step="0.05" data-o="vol" value="${Audio.vol}"><b>${pct(Audio.vol)}</b></label>
        ${Object.entries(BUS).map(([k, n]) => `<label class="row"><span class="ln">${n}</span><input type="range" min="0" max="1" step="0.05" data-o="bus" data-bus="${k}" value="${Audio.busVol[k]}"><b>${pct(Audio.busVol[k])}</b></label>`).join('')}</section>
      <section><h3>Interface</h3>
        <div class="row">Texto ${seg('ui', [[0.9, '90%'], [1, '100%'], [1.2, '120%']], (v) => +v === uiScale)}</div>
        <div class="row">Modo daltônico ${seg('cb', [['0', 'Desligado'], ['1', 'Ligado']], (v) => (v === '1') === cbMode)}</div>
        <div class="row">Rolar pela borda ${seg('edge', [['1', 'Ligado'], ['0', 'Desligado']], (v) => (v === '1') === OPT.edge)}</div>
        <div class="row">Roda e dois dedos ${seg('wheel', [['pan', 'Rolam o mapa'], ['zoom', 'Dão zoom']], (v) => v === OPT.wheel)}</div>
        <p class="note">Pinça do trackpad e Ctrl+roda sempre dão zoom. Atalhos fixos: Ctrl+H HQ, Ctrl+C Clusters, Ctrl+L Labs, vírgula militares ociosos, Ctrl+Espaço centraliza.</p></section>
      <section><h3>Atalhos</h3><div class="keys">${KEY_ACT.map(([a, n]) => `<span>${n}</span><button class="key${waiting === a ? ' wait' : ''}${m[a] !== KEY_DEF[a] ? ' mod' : ''}" data-a="${a}" aria-label="Tecla de ${n}: ${m[a]}">${waiting === a ? '…' : m[a]}</button>`).join('')}</div></section></div>
      <p class="msg" id="opts-msg" role="status"></p><div class="foot"><button class="tb" data-o="reset">Restaurar atalhos</button><button class="tb" data-o="close">Voltar <kbd>Esc</kbd></button></div></div>`;
  }
  const msg = (t, bad) => { const p = $('opts-msg'); p.textContent = t; p.classList.toggle('bad', !!bad); };
  el.addEventListener('input', (e) => { const r = e.target; if (r.dataset.o === 'vol') Audio.setVol(+r.value); else if (r.dataset.o === 'bus') Audio.setBus(r.dataset.bus, +r.value); else return; r.nextElementSibling.textContent = pct(+r.value); });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; const { k, v, a, o } = b.dataset;
    if (o === 'close') return close(); if (o === 'reset') { KEYS = {}; try { localStorage.removeItem('cw_keys'); } catch (x) {} applyKeys(); waiting = null; render(); msg('Atalhos de volta ao padrão'); SFX.confirm(); return; }
    if (a) { waiting = a; render(); el.querySelector(`[data-a="${a}"]`).focus(); msg('Pressione uma letra (Esc cancela)'); SFX.click(); return; }
    if (k === 'ui') setUiScale(+v); else if (k === 'cb') setCb(v === '1'); else if (k === 'edge') { OPT.edge = v === '1'; saveOpt(); } else if (k === 'wheel') { OPT.wheel = v; saveOpt(); } else return;
    SFX.click(); render(); const f = el.querySelector(`[data-k="${k}"][data-v="${v}"]`); if (f) f.focus();
  });
  // captura na janela: a tecla do remapeamento não chega ao jogo
  addEventListener('keydown', (e) => {
    if (!el.classList.contains('open')) return;
    if (waiting) { e.preventDefault(); e.stopImmediatePropagation(); const a = waiting; if (e.key === 'Escape') { waiting = null; render(); msg(''); el.querySelector(`[data-a="${a}"]`).focus(); return; }
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key, m = keyMap(), bad = keyClash(a, key, m);
      if (bad) { msg(bad, true); SFX.deny(); return; }
      waiting = null; if (key === KEY_DEF[a]) delete KEYS[a]; else KEYS[a] = key; try { localStorage.setItem('cw_keys', JSON.stringify(KEYS)); } catch (x) {} applyKeys(); render(); el.querySelector(`[data-a="${a}"]`).focus(); msg(`${KEY_ACT.find((x) => x[0] === a)[1]}: ${key}`); SFX.confirm(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);
  function open() { waiting = null; render(); el.classList.add('open'); el.querySelector('input, button').focus(); }
  function close() { waiting = null; el.classList.remove('open'); SFX.click(); const b = $('optbtn'); if (b) b.focus(); }
  return { open, close, get isOpen() { return el.classList.contains('open'); } };
})();

// ---- 4.5.1 teclado: captura antes dos atalhos de index.html (Ctrl+C não vira a tecla C de prédio; Ctrl+Espaço não pausa) ----
function cycleBuilding(type) {
  const list = S.ents.filter((b) => b.kind === 'building' && b.owner === 0 && b.type === type);
  if (!list.length) { toast(type === 'cluster' ? MSG.noCluster : `Sem Research Lab: selecione um Engineer, X e depois ${HOTKEY.lab}`, 'info'); return; }
  const b = list[(list.findIndex((x) => x.id === sel[0]) + 1) % list.length]; select([b.id]); centerOn(b.x, b.y); SFX.click();
}
addEventListener('keydown', (e) => {
  if (!S || S.winner !== null || $('overlay').style.display !== 'none' || Options.isOpen || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (mod && k === 'h') { const h = myHQ(); if (h) { select([h.id]); centerOn(h.x, h.y); SFX.click(); } }
  else if (mod && (k === 'c' || k === 'l')) cycleBuilding(k === 'c' ? 'cluster' : 'lab');
  else if (mod && k === ' ') { spaceUsed = true; const es = selected(); if (es.length) centerOn(es.reduce((a, u) => a + u.x, 0) / es.length, es.reduce((a, u) => a + u.y, 0) / es.length); } // spaceUsed: o keyup do Espaço não pausa
  else if (k === ',' && !mod) { const ids = E.idleIds(S, 0, 'military'); if (!ids.length) toast(MSG.noIdleMil, 'info'); else { const id = ids[(ids.indexOf(sel[0]) + 1) % ids.length], u = E.byId(S, id); select([id]); centerOn(u.x, u.y); SFX.click(); } }
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);

// ---- 4.5.2 trackpad: a roda (dois dedos) rola e a pinça (wheel + ctrlKey) dá zoom em index.html; Safari manda pinça/rotação como gesture*: só a escala vale ----
let gestureZ = 1;
addEventListener('gesturestart', (e) => { e.preventDefault(); gestureZ = zoom; });
addEventListener('gesturechange', (e) => { e.preventDefault(); if (S && $('overlay').style.display === 'none') setZoom(gestureZ * e.scale); });

// ---- 4.5.3 minimapa redimensionável: arrastar a borda esquerda (180..320 px); a 300 px o painel fica com os 200 px de sempre ----
let miniW = null; try { miniW = +localStorage.getItem('cw_mini') || null; } catch (e) {}
function applyMini() {
  if (!miniW) return; const h = Math.round(miniW * 232 / 300), bh = Math.max(200, h - 32);
  mini.style.width = miniW + 'px'; mini.style.height = h + 'px'; $('miniwrap').style.width = miniW + 12 + 'px'; $('bottom').style.height = bh + 'px'; PANEL_H = bh * uiScale;
  grip.setAttribute('aria-valuenow', miniW);
}
function setMini(w) { miniW = Math.round(Math.max(180, Math.min(320, w))); applyMini(); try { localStorage.setItem('cw_mini', miniW); } catch (e) {} }
const setUiScale0 = setUiScale; setUiScale = (k) => { setUiScale0(k); applyMini(); }; // PANEL_H = 200 × escala em ui-panel.js; com minimapa maior, a altura vem daqui
const grip = document.createElement('div'); grip.id = 'minigrip'; grip.tabIndex = 0; grip.title = 'Arraste para redimensionar o minimapa';
for (const [a, v] of [['role', 'separator'], ['aria-orientation', 'vertical'], ['aria-label', 'Largura do minimapa'], ['aria-valuemin', 180], ['aria-valuemax', 320], ['aria-valuenow', 300]]) grip.setAttribute(a, v);
$('miniwrap').appendChild(grip);
let gripDrag = null;
grip.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); gripDrag = { x: e.clientX, w: mini.getBoundingClientRect().width / uiScale }; grip.classList.add('on'); });
addEventListener('mousemove', (e) => { if (gripDrag) setMini(gripDrag.w + (gripDrag.x - e.clientX) / uiScale); });
addEventListener('mouseup', () => { if (gripDrag) { gripDrag = null; grip.classList.remove('on'); } });
grip.addEventListener('keydown', (e) => { const d = { ArrowLeft: 10, ArrowRight: -10 }[e.key]; if (d) { e.preventDefault(); e.stopPropagation(); setMini((miniW || 300) + d); } });
applyMini();

// ---- estilo: mesmas peças de metal do HUD (moldura --metal, placa esmaltada, .seg, .tb, .cta) ----
document.head.insertAdjacentHTML('beforeend', `<style>
  #overlay .title header { padding-top:4vh; } #overlay .title footer { gap:14px; padding-bottom:3vh; }
  #overlay .factions .fac { width:min(420px, calc(84vw / var(--n, 2))); }
  #lobby { display:flex; gap:22px; padding:12px 18px 14px; text-align:left; background:linear-gradient(180deg,rgba(10,16,26,.9),rgba(5,9,14,.94)); border:3px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #000, 0 10px 30px rgba(0,0,0,.7); backdrop-filter:blur(6px); position:relative; }
  #lobby::after { content:''; position:absolute; inset:3px; pointer-events:none; background-image:radial-gradient(circle at 6px 6px,var(--m1) 0 1.5px,var(--m4) 2.2px,transparent 3px), radial-gradient(circle at calc(100% - 6px) 6px,var(--m1) 0 1.5px,var(--m4) 2.2px,transparent 3px), radial-gradient(circle at 6px calc(100% - 6px),var(--m1) 0 1.5px,var(--m4) 2.2px,transparent 3px), radial-gradient(circle at calc(100% - 6px) calc(100% - 6px),var(--m1) 0 1.5px,var(--m4) 2.2px,transparent 3px); }
  #lobby h3, #opts h3 { font:700 13px var(--display); letter-spacing:.25em; text-transform:uppercase; color:var(--m1); text-shadow:0 1px 0 #000; margin-bottom:6px; }
  #lobby .row { display:flex; align-items:center; gap:8px; margin-top:7px; }
  #lobby .sub { width:86px; flex:none; font:700 11px var(--label); letter-spacing:1.5px; text-transform:uppercase; color:#9aa6ba; } #lobby .sub.sm { width:auto; margin-left:6px; }
  #lobby .seg button, #opts .seg button { padding:6px 10px; font-size:11px; } .seg button:disabled { cursor:default; opacity:.5; filter:none; } .seg button small { font:500 9px var(--mono); text-transform:none; letter-spacing:0; color:var(--m1); }
  #lobby .slots { margin:2px 0 0; border-collapse:collapse; width:100%; font:500 13px var(--mono); }
  #lobby .slots td { padding:3px 8px 3px 0; border-bottom:1px solid var(--line); font:600 13px var(--body); text-align:left; color:var(--ivory); white-space:nowrap; }
  #lobby .badge { display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; margin-right:8px; border-radius:50%; background:radial-gradient(circle at 40% 35%,var(--enamel),var(--enamel2)); box-shadow:0 0 0 2px var(--c), 0 0 0 3px #000; color:var(--c); font:700 11px var(--mono); }
  #lobby .you { font:600 13px var(--display); color:var(--m1); } #lobby .ai { font:700 11px var(--label); letter-spacing:1.5px; color:#9aa6ba; }
  #lobby select, #lobby input { background:linear-gradient(180deg,var(--enamel2),var(--enamel)); color:var(--ivory); border:1px solid var(--m3); box-shadow:inset 0 0 8px rgba(0,0,0,.7); padding:4px 6px; font:500 13px var(--mono); }
  #lobby input { width:82px; } #lobby .tb { height:28px; padding:0 10px; font-size:11px; }
  #lobby .map { display:flex; flex-direction:column; }
  #lb-prev { display:block; width:288px; height:216px; border:1px solid #000; background:#000; box-shadow:0 0 0 3px var(--m2), 0 0 0 4px var(--m4), 0 6px 16px rgba(0,0,0,.7); margin:4px auto 6px; }
  #overlay p.lb-btns { display:flex; gap:12px; justify-content:center; margin:0; max-width:none; } #overlay .cta.alt { background:var(--btn); color:var(--ivory); text-shadow:0 1px 0 #000; box-shadow:inset 0 1px 0 rgba(255,255,255,.16), inset 0 -2px 0 rgba(0,0,0,.55), 0 0 0 1px var(--m2), 0 4px 10px rgba(0,0,0,.7); }
  #overlay p#lb-msg { margin:-6px 0 0; min-height:18px; font:600 13px var(--label); letter-spacing:1px; color:var(--danger); text-shadow:0 1px 2px #000; }
  @media (max-height:860px) { #overlay .fac small, #overlay .fac img.hero { display:none; } #overlay .fac { padding:8px 14px; } #overlay .fac img { width:56px; height:56px; } #overlay h1 { font-size:clamp(40px, 5vw, 64px); } #overlay h2 { margin:4px 0 0; } }
  #opts { position:fixed; inset:0; z-index:10; display:none; align-items:center; justify-content:center; background:rgba(5,8,12,.72); padding:16px; } #opts.open { display:flex; }
  #opts .box { width:min(1080px, 100%); max-height:100%; overflow:auto; background:rgba(7,11,17,.95); border:4px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #000, 0 24px 80px rgba(0,0,0,.85); padding:16px 26px 18px; }
  #opts h1 { text-align:center; font:700 30px var(--display); letter-spacing:.3em; background:linear-gradient(180deg,#fff6d2 0%,var(--m1) 28%,var(--m2) 52%,var(--m3) 72%,var(--m1) 100%); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 2px 0 #2a1b05); margin-bottom:12px; }
  #opts .cols { display:grid; grid-template-columns:1fr 1fr 1.15fr; gap:24px; } #opts section { padding:10px 12px; background:linear-gradient(180deg,var(--enamel2),var(--enamel)); border:1px solid var(--m3); box-shadow:inset 0 1px 0 rgba(255,255,255,.06), inset 0 0 14px rgba(0,0,0,.75); }
  #opts .row { display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; padding:5px 0; font:700 11px var(--label); letter-spacing:1px; text-transform:uppercase; color:#aeb7c6; } #opts .row b { width:36px; text-align:right; font:500 11px var(--mono); color:var(--ivory); }
  #opts label.row { flex-wrap:nowrap; } #opts .row .ln { width:96px; flex:none; } #opts .row input[type=range] { flex:1; min-width:0; }
  #opts .note { margin-top:8px; font-size:13px; color:#9aa6ba; }
  #opts .keys { display:grid; grid-template-columns:1fr auto; gap:3px 10px; align-items:center; font:500 14px var(--body); }
  #opts .key { min-width:40px; height:24px; font:700 12px var(--mono); color:#1a1206; background:var(--brass); border:1px solid #000; box-shadow:inset 0 1px 0 rgba(255,255,255,.35), 0 1px 2px #000; cursor:pointer; } #opts .key.mod { box-shadow:inset 0 1px 0 rgba(255,255,255,.35), 0 0 0 1px var(--own), 0 0 8px var(--glow); } #opts .key.wait { background:var(--btn); color:var(--own); animation:blink 1s infinite; }
  #opts .msg { min-height:20px; margin:10px 0 2px; text-align:center; font:600 13px var(--label); letter-spacing:1px; color:var(--own); } #opts .msg.bad { color:var(--danger); }
  #opts .foot { display:flex; justify-content:center; gap:10px; } #opts .foot kbd { font:500 10px var(--mono); color:#8f9bb0; text-transform:none; }
  #minigrip { position:absolute; left:0; top:50%; width:8px; height:64px; margin-top:-32px; cursor:ew-resize; z-index:1; background:linear-gradient(90deg,var(--m4),var(--m2) 45%,var(--m1) 55%,var(--m4)); border:1px solid #000; box-shadow:0 0 0 1px var(--m3), 0 2px 4px #000; opacity:.75; }
  #minigrip::before { content:''; position:absolute; left:1px; right:1px; top:20px; bottom:20px; background:repeating-linear-gradient(180deg,#000 0 2px,transparent 2px 5px); opacity:.6; }
  #minigrip:hover, #minigrip.on, #minigrip:focus-visible { opacity:1; box-shadow:0 0 0 1px var(--m1), 0 0 8px var(--glow); outline:none; }
</style>`);

addEventListener('DOMContentLoaded', startScreen); // depois de todos os scripts (campaign.js/replay.js podem vir depois deste); até lá vale a tela de index.html
