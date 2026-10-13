// 4.2.5: replays (localStorage.cw_replays, 5 mais recentes), modo espectador e gráfico por minuto da tela final
const Replay = (() => {
  const KEY = 'cw_replays', FNAME = { citadel: 'The Citadel', foundry: 'The Foundry', commons: 'The Commons' }, SPEEDS = [1, 2, 4, 8];
  let cur = null; // replay em exibição (ou o da partida que acabou de terminar)
  const st = document.createElement('style');
  st.textContent = `body.spectate #bottom, body.spectate #talent, body.spectate #tut { display:none !important; }
  #rpbar { position:fixed; left:50%; bottom:18px; transform:translateX(-50%); display:none; align-items:center; gap:12px; padding:8px 14px; background:var(--chrome); border:3px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, 0 12px 30px rgba(0,0,0,.85); z-index:6; color:var(--ivory); }
  body.spectate #rpbar { display:flex; }
  #rpbar b { font:700 15px var(--display); letter-spacing:.3em; background:var(--brass); -webkit-background-clip:text; background-clip:text; color:transparent; }
  #rpbar .t { font:500 14px var(--mono); min-width:110px; text-align:center; }
  #rpchart { display:block; margin:6px auto 14px; border:1px solid #000; box-shadow:0 0 0 1px var(--m3), inset 0 0 0 1px #000; background:#070b11; }
  #overlay .box.rp td .tb { height:26px; }
  @media (max-height:800px) { #overlay .box:has(#rpchart) { padding:16px 40px; } #overlay .box:has(#rpchart) h1 { font-size:40px; margin:0; } #overlay .box:has(#rpchart) h2 { margin:4px 0 6px; } #overlay .box:has(#rpchart) table { margin:6px auto; } #overlay .box:has(#rpchart) td { padding:2px 16px; } }`;
  document.head.appendChild(st);
  const list = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  // guarda a partida que terminou; se a cota estourar, descarta os mais antigos
  function store() {
    if (!S || !S.cmds || S.spectate) return null;
    const rec = { date: Date.now(), seed: S.seed, opts: S.opts, cmds: S.cmds, t: S.t, winner: S.winner, factions: S.players.map((p) => p.faction), teams: S.players.map((p) => p.team) };
    for (let all = [rec, ...list()].slice(0, 5); all.length; all.pop()) { try { localStorage.setItem(KEY, JSON.stringify(all)); break; } catch (e) {} }
    return rec;
  }
  function open() {
    const o = $('overlay'), rs = list(); o.style.display = 'flex';
    const sides = (r) => { const T = r.teams || r.factions.map((_, i) => i), nm = (k) => FNAME[k] || k, side = (same) => r.factions.filter((_, i) => (T[i] === T[0]) === same).map(nm).join(' + '); return side(true) + ' × ' + side(false); }; // 4.2.2: seu time × rivais (replays antigos: 1 por time)
    const rows = rs.map((r, i) => `<tr><td>${new Date(r.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${sides(r)}</td><td>${r.winner === 0 ? 'Vitória' : 'Derrota'}</td><td>${fmtT(r.t)}</td><td><button class="tb" data-i="${i}">Assistir</button></td></tr>`).join('');
    o.innerHTML = `<div class="box rp"><h1 class="metal-text">REPLAYS</h1><h2>${rs.length > 1 ? `Últimas ${rs.length} partidas` : rs.length ? 'Última partida' : 'Nenhum replay gravado'}</h2>${rs.length ? `<table><tr><td></td><td><b>Facções</b></td><td><b>Resultado</b></td><td><b>Duração</b></td><td></td></tr>${rows}</table>` : '<p>Termine uma partida para gravar o primeiro replay.</p>'}<button class="cta" id="rpback">Voltar</button></div>`;
    o.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => play(rs[+b.dataset.i]); });
    $('rpback').onclick = () => { SFX.click(); startScreen(); };
  }
  function play(rec) {
    cur = rec; const s = E.createGame(Object.assign({}, rec.opts, { seed: rec.seed })); s.spectate = true; s.cmds = rec.cmds; s.replayAt = 0;
    Audio.unlock(); begin(s); bar(); setSpeed(1);
  }
  const setSpeed = (v) => { speed = v; paused = false; };
  function bar() {
    if ($('rpbar')) return;
    const b = document.createElement('div'); b.id = 'rpbar';
    b.innerHTML = `<b>REPLAY</b><span class="t"></span><button class="tb" id="rppause" title="Pausar (Espaço)">Pausar</button><span class="seg" role="group" aria-label="Velocidade do replay">${SPEEDS.map((v) => `<button data-v="${v}">${v}x</button>`).join('')}</span><button class="tb" id="rpquit">Sair</button>`;
    document.body.appendChild(b);
    $('rppause').onclick = () => { paused = !paused; SFX.pause(); };
    b.querySelectorAll('[data-v]').forEach((x) => { x.onclick = () => { setSpeed(+x.dataset.v); SFX.click(); }; });
    $('rpquit').onclick = () => { S = null; document.body.classList.remove('spectate'); SFX.click(); startScreen(); };
    setInterval(() => { if (!S || !S.spectate) return; b.querySelector('.t').textContent = `${fmtT(S.t)} / ${fmtT(cur.t)}`; $('rppause').textContent = paused ? 'Continuar' : 'Pausar'; b.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', !paused && +x.dataset.v === speed)); }, 200);
  }
  // gráfico de recursos coletados e exército por minuto (s.stats.perMin + ponto final com o estado atual)
  function chart(container) {
    const per = (S.stats && S.stats.perMin) || [];
    const series = S.players.map((p) => { const pts = (per[p.id] || []).map((x) => ({ t: x.t, res: Object.values(x.res).reduce((a, b) => a + b, 0), army: x.army }));
      pts.push({ t: S.t, res: Math.round(Object.values(p.stats.gathered).reduce((a, b) => a + b, 0)), army: S.ents.filter((e) => e.kind === 'unit' && e.owner === p.id && !E.UNITS[e.type].gather).length });
      return { name: p.id === 0 ? 'Você' : p.name, col: E.ownerColor(S, p.id), pts }; });
    const W = 760, H = 204, dpr = window.devicePixelRatio || 1, cv = document.createElement('canvas'); cv.id = 'rpchart';
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Recursos coletados e exército por minuto: ' + series.map((s) => `${s.name} ${s.pts[s.pts.length - 1].res} recursos, ${s.pts[s.pts.length - 1].army} unidades no fim`).join('; '));
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const mins = Math.max(1, Math.ceil(S.t / 60 - 1e-6)), font = getComputedStyle(document.body).getPropertyValue('--mono') || 'monospace';
    const panel = (x0, title, key) => {
      const L = x0 + 44, R = x0 + 360, T = 52, B = H - 28, max = Math.max(1, ...series.flatMap((s) => s.pts.map((p) => p[key]))), unit = key === 'army' ? 4 : 2000, top = Math.ceil(max / unit) * unit; // quartos inteiros no eixo
      g.fillStyle = '#d9d1c0'; g.font = `600 13px ${font}`; g.textAlign = 'left'; g.fillText(title, L, 40);
      g.font = `11px ${font}`; g.strokeStyle = 'rgba(201,160,78,.18)'; g.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { const y = B - (B - T) * i / 4; g.beginPath(); g.moveTo(L, y + 0.5); g.lineTo(R, y + 0.5); g.stroke(); g.fillStyle = '#8f8a7e'; g.textAlign = 'right'; g.fillText(Math.round(top * i / 4), L - 6, y + 4); }
      const step = Math.max(1, Math.ceil(mins / 8)); g.textAlign = 'center';
      for (let m = 0; m <= mins; m += step) { const x = L + (R - L) * m / mins; g.fillText(m, x, B + 15); }
      g.strokeStyle = '#7a5c22'; g.beginPath(); g.moveTo(L, T); g.lineTo(L, B); g.lineTo(R, B); g.stroke();
      for (const s of series) { g.strokeStyle = s.col; g.lineWidth = 2.5; g.lineJoin = 'round'; g.beginPath(); s.pts.forEach((p, i) => { const x = L + (R - L) * Math.min(1, p.t / 60 / mins), y = B - (B - T) * p[key] / top; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
    };
    panel(0, 'Recursos coletados', 'res'); panel(380, 'Exército', 'army');
    g.textAlign = 'right'; g.font = `11px ${font}`; g.fillStyle = '#8f8a7e'; g.fillText('minutos', W - 20, H - 2);
    series.forEach((s, i) => { const x = (W - series.length * 110) / 2 + i * 110; g.fillStyle = s.col; g.fillRect(x, 9, 18, 4); g.fillStyle = '#d9d1c0'; g.textAlign = 'left'; g.fillText(s.name, x + 24, 14); }); // legenda numa faixa própria no topo (4 jogadores não cobrem os títulos)
    container.insertBefore(cv, container.querySelector('.cta'));
  }
  // tela final: guarda o replay (partida real), mostra o gráfico e o botão "Ver replay"
  function end(box) {
    if (S.spectate) { box.querySelector('h1').textContent = 'FIM DO REPLAY'; document.body.classList.remove('spectate'); } else cur = store();
    chart(box);
    if (!cur) return; // save antigo sem gravação: sem replay
    const btn = document.createElement('button'); btn.className = 'cta'; btn.textContent = S.spectate ? 'Ver de novo' : 'Ver replay'; const rec = cur;
    btn.onclick = () => { SFX.click(); play(rec); }; box.insertBefore(btn, box.querySelector('.cta')); box.insertBefore(document.createTextNode(' '), box.querySelector('.cta'));
  }
  return { open, play, chart, end, list };
})();
