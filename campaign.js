// 4.1.1 Campanha "Compute Wars: Set 1", 4.3.4 briefing e objetivos ao vivo, 4.3.5 perfil. Browser: window.Campaign / window.Profile; Node: require('./campaign.js').
(function (root) {
  const NODE = typeof module !== 'undefined';
  const CE = NODE ? require('./engine.js') : root.Engine, TL = CE.TILE;
  const mem = {}, LS = NODE ? null : (() => { try { return root.localStorage; } catch (e) { return null; } })();
  const load = (k) => { try { return JSON.parse((LS ? LS.getItem(k) : mem[k]) || 'null'); } catch (e) { return null; } };
  const save = (k, v) => { const j = JSON.stringify(v); mem[k] = j; try { if (LS) LS.setItem(k, j); } catch (e) {} };
  const clock = (t) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;

  // ---- helpers de posicionamento (mutação logo após createGame) ----
  const hqOf = (S, pid) => S.ents.find((e) => e.type === 'hq' && e.owner === pid);
  const put = (S, bt, owner, tx, ty) => { const sp = CE.findSpot(S, bt, tx, ty); if (!sp) return null; const b = CE.place(S, bt, sp[0], sp[1], owner); b.progress = 1; b.built = true; b.hp = b.maxHp; return b; };
  const freeTile = (S, tx, ty) => { for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = tx + dx, y = ty + dy; if ((Math.abs(dx) === r || Math.abs(dy) === r) && x > 0 && y > 0 && x < CE.MAP_W - 1 && y < CE.MAP_H - 1 && !S.grid[y * CE.MAP_W + x]) return [x, y]; } return [tx, ty]; };
  // n unidades em grade de 3 colunas em volta do tile (tx, ty), cada uma num tile livre
  const squad = (S, types, owner, tx, ty) => types.map((t, i) => { const [x, y] = freeTile(S, tx + (i % 3) - 1, ty + Math.floor(i / 3)); return CE.spawn(S, t, owner, x * TL + TL / 2, y * TL + TL / 2); });
  const stance = (S, pid, us, v) => CE.cmd(S, pid, { type: 'stance', ids: us.map((u) => u.id), v });
  const alive = (S, ids) => ids.filter((id) => CE.byId(S, id)).length;
  const relicsIn = (S, pid) => S.relics.filter((r) => { const l = r.lab != null && CE.byId(S, r.lab); return l && l.owner === pid; }).length;
  const myAgi = (S) => S.ents.find((e) => e.type === 'agi' && e.owner === 0 && e.built);

  const MISSIONS = [
    { name: 'Pre-Training Run', faction: 'citadel', seed: 101, difficulty: 'easy', villain: 'Capataz Ruído',
      brief: 'O primeiro treino nunca é limpo. Do subsolo da Foundry sobem enxames de Modelos crus, alimentados por dados sem curadoria. Mantenha o Lab HQ de pé até o fim da corrida: dez minutos de gradiente sob fogo.',
      quote: 'Todo modelo começa como ruído. Alguns nunca passam disso.',
      setup(S, c) { const h = hqOf(S, 0); c.wave = 0; put(S, 'tower', 0, h.tx + 4, h.ty - 2); put(S, 'tower', 0, h.tx + 1, h.ty - 3); squad(S, ['gpt2', 'gpt2', 'gpt2', 'gpt2'], 0, h.tx + 5, h.ty + 1); },
      run(S, c) { // onda k (0..9) aos 0:45 + 60k: min(2+k, 10) Modelos do rival, tier até 1 + k/4, sem cerco
        while (c.wave < 10 && S.t >= 45 + 60 * c.wave) {
          const k = c.wave++, types = CE.ROSTER[S.players[1].faction].filter((t) => CE.UNITS[t].tier <= 1 + Math.floor(k / 4) && CE.UNITS[t].cls !== 'siege'), me = hqOf(S, 0);
          const us = squad(S, Array.from({ length: Math.min(2 + k, 10) }, (_, j) => types[(j + k) % types.length]), 1, 52, 18);
          if (me) CE.cmd(S, 1, { type: 'attackmove', ids: us.map((u) => u.id), x: me.x, y: me.y });
        }
      },
      objectives: [
        { label: (S) => `Sobreviva até 10:00 (faltam ${clock(600 - S.t)})`, done: (S) => S.t >= 600 },
        { label: (S, c) => `Mantenha o Lab HQ de pé (ondas: ${c.wave}/10)`, done: (S) => S.t >= 600 && !!hqOf(S, 0) },
      ] },
    { name: 'O Indexador', faction: 'foundry', seed: 202, difficulty: 'easy', villain: 'O Indexador',
      brief: 'Cinco Datasets canônicos estão soltos pelo mapa. O Indexador quer catalogar todos e cobrar pelo acesso. Leve três para os seus Research Labs antes que as patas de latão dele cheguem lá.',
      quote: 'O que não está no meu índice não existe.',
      setup(S, c) {
        const h = hqOf(S, 0), p = S.players[0]; p.era = 2; p.res = { gpu: 300, data: 400, research: 400 };
        put(S, 'lab', 0, h.tx + 5, h.ty - 3); squad(S, ['engineer', 'engineer'], 0, h.tx + 1, h.ty + 4);
        squad(S, ['lenet', 'lenet', 'lenet', 'lenet'], 0, h.tx + 5, h.ty + 1); c.guards = [];
        for (const r of S.relics) { const far = Math.hypot(r.x - h.x, r.y - h.y) / TL; if (far < 20) continue; const g = squad(S, far > 30 ? ['gpt2', 'gpt2', 'dalle'] : ['gpt2', 'gpt2'], 1, Math.floor(r.x / TL), Math.floor(r.y / TL) + 1); stance(S, 1, g, 'hold'); c.guards.push(...g.map((u) => u.id)); } // só a relíquia mais perto de casa fica livre; as outras exigem luta
      },
      objectives: [{ label: (S) => `Guarde 3 relíquias nos seus Research Labs (${relicsIn(S, 0)}/3)`, done: (S) => relicsIn(S, 0) >= 3 }] },
    { name: 'Sete Cabeças', faction: 'foundry', seed: 303, difficulty: 'normal', villain: 'Comandante Sentinel',
      brief: 'Sete Mistral 7B, leves e rápidos, contra a muralha da Citadel. Derrube os dois Training Clusters que alimentam o exército rival. Só Mistral entra nesta luta: qualquer outro Modelo em campo e a operação é cancelada.',
      quote: 'Sete pesos abertos contra um portão fechado. Deixem que tentem.',
      setup(S, c) {
        const h = hqOf(S, 0), r = hqOf(S, 1), p = S.players[0]; p.era = 3; p.res = { gpu: 800, data: 800, research: 800 }; S.players[1].era = 2;
        put(S, 'cluster', 0, h.tx + 5, h.ty - 4); put(S, 'rack', 0, h.tx - 3, h.ty - 3); put(S, 'rack', 0, h.tx - 3, h.ty + 1); squad(S, Array(7).fill('mistral'), 0, h.tx + 6, h.ty + 1); squad(S, ['engineer', 'engineer'], 0, h.tx + 1, h.ty + 4);
        c.targets = [put(S, 'cluster', 1, r.tx - 7, r.ty + 2), put(S, 'cluster', 1, r.tx - 2, r.ty + 7)].map((b) => b.id);
        put(S, 'tower', 1, r.tx - 4, r.ty + 5);
        stance(S, 1, squad(S, ['gpt2', 'gpt2', 'gpt2', 'dalle'], 1, r.tx - 5, r.ty + 5), 'defensive');
      },
      fail: (S) => S.ents.some((u) => u.kind === 'unit' && u.owner === 0 && !CE.UNITS[u.type].gather && !CE.UNITS[u.type].civ && u.type !== 'mistral'),
      failText: 'Um Modelo que não é Mistral 7B entrou em campo.',
      objectives: [
        { label: (S, c) => `Destrua 2 Training Clusters rivais (${2 - alive(S, c.targets)}/2)`, done: (S, c) => !alive(S, c.targets) },
        { label: () => 'Só Mistral 7B em campo (outro Modelo encerra a missão)', done: () => true },
      ] },
    { name: 'Alinhamento', faction: 'citadel', seed: 404, difficulty: 'easy', villain: 'A Desalinhada',
      brief: 'Uma leva de Modelos perdeu o alinhamento e vaga pelo planalto atacando tudo o que vê. Não os destrua: atraia cada um para o raio do seu Alignment Lab e traga cinco de volta.',
      quote: 'Vocês chamam de desvio. Eu chamo de liberdade.',
      setup(S, c) {
        const h = hqOf(S, 0), p = S.players[0]; p.era = 2; p.res = { gpu: 300, data: 300, research: 300 };
        put(S, 'alignlab', 0, h.tx + 5, h.ty - 4); squad(S, ['chancellor'], 0, h.tx + 4, h.ty + 1);
        const lost = [...squad(S, ['lenet', 'llama', 'sd'], 1, 33, 31), ...squad(S, ['lenet', 'llama', 'mistral'], 1, 26, 18), ...squad(S, ['sd', 'mixtral'], 1, 40, 42)]; // 3 bandos a 20+ tiles: atrair um por vez
        for (const u of lost) { u.owner = -1; u.align = 0; }
        c.ids = lost.map((u) => u.id); c.got = [];
      },
      run(S, c) { for (const id of c.ids) { const u = CE.byId(S, id); if (u && u.owner === 0 && !c.got.includes(id)) c.got.push(id); } },
      objectives: [{ label: (S, c) => `Realinhe 5 Modelos Misaligned (${Math.min(5, c.got.length)}/5)`, done: (S, c) => c.got.length >= 5 }] },
    { name: 'Catastrophic Forgetting', faction: 'citadel', seed: 505, difficulty: 'normal', villain: 'Matriarca Entropia',
      brief: 'A Foundry guarda tudo o que aprendeu em quatro Data Centers. Destrua os quatro e o rival esquece o próprio treino.',
      quote: 'Apague o que quiser. Eu guardo cópias das cópias.',
      setup(S, c) {
        const h = hqOf(S, 0), r = hqOf(S, 1), p = S.players[0]; p.era = 3; p.res = { gpu: 600, data: 600, research: 600 }; S.players[1].era = 2;
        put(S, 'cluster', 0, h.tx + 5, h.ty - 4); put(S, 'cluster', 0, h.tx + 5, h.ty + 1); put(S, 'lab', 0, h.tx + 4, h.ty - 8);
        squad(S, ['gpt35', 'gpt35', 'gpt35', 'gpt35', 'gpt35', 'gpt35', 'rig', 'rig'], 0, h.tx + 9, h.ty - 1);
        c.targets = S.fields.filter((f) => f.owner === -1 && f.x > r.x - 30 * TL).sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y)).slice(0, 4).map((f) => put(S, 'datacenter', 1, Math.floor(f.x / TL), Math.floor(f.y / TL))).filter(Boolean).map((b) => b.id); // postos avançados nos 4 campos neutros mais perto do rival
        put(S, 'tower', 1, r.tx - 3, r.ty + 4); put(S, 'tower', 1, r.tx + 4, r.ty + 4);
      },
      objectives: [{ label: (S, c) => `Destrua os ${c.targets.length} Data Centers rivais (${c.targets.length - alive(S, c.targets)}/${c.targets.length})`, done: (S, c) => !alive(S, c.targets) }] },
    { name: 'AGI Deployment', faction: 'foundry', seed: 606, difficulty: 'hard', villain: 'Diretora de Helios',
      brief: 'Chegou a hora. Leve a Foundry à Era da AGI, erga o AGI Deployment e mantenha-o de pé até a contagem zerar. A Diretora de Helios joga no Difícil e não vai assistir de braços cruzados.',
      quote: 'Uma AGI aberta? Só por cima do meu cadáver de latão.',
      setup(S) {
        const h = hqOf(S, 0), p = S.players[0]; p.era = 2; p.res = { gpu: 800, data: 800, research: 800 };
        put(S, 'lab', 0, h.tx + 4, h.ty - 8); put(S, 'cluster', 0, h.tx + 5, h.ty - 4); put(S, 'cluster', 0, h.tx + 5, h.ty + 1);
        put(S, 'tower', 0, h.tx + 8, h.ty - 6); put(S, 'tower', 0, h.tx + 9, h.ty + 2); squad(S, Array(5).fill('engineer'), 0, h.tx + 1, h.ty + 4);
        put(S, 'market', 0, h.tx - 4, h.ty - 4); // Compute Exchange: o mapa sobra Dados, a maravilha pede GPU e Pesquisa
      },
      objectives: [
        { label: () => 'Alcance a Era da AGI', done: (S) => S.players[0].era >= 4 },
        { label: () => 'Construa o AGI Deployment', done: (S) => !!myAgi(S) },
        { label: (S) => { const a = myAgi(S); return `Mantenha-o de pé até a contagem zerar${a ? ` (${clock(a.countdown)})` : ''}`; }, done: (S) => { const a = myAgi(S); return !!a && a.countdown <= 0; } },
      ] },
  ];
  MISSIONS.forEach((m, i) => { m.id = i; m.art = `assets/campaign/brief_${i + 1}.jpg`; m.portrait = `assets/campaign/villain_${i + 1}.jpg`; });

  function create(i) {
    const m = MISSIONS[i], S = CE.createGame({ seed: m.seed, faction: m.faction, difficulty: m.difficulty });
    S.players[1].name = m.villain; S.campaign = { i, done: m.objectives.map(() => false) };
    m.setup(S, S.campaign);
    return S;
  }
  const progress = () => load('cw_campaign') || { best: {} };
  const unlocked = (i) => i === 0 || progress().best[i - 1] != null;

  // ---- perfil (4.3.5) ----
  const ACH = [
    { k: 'first', name: 'Primeiro Deploy', desc: 'Vença uma partida.', t: (S, g, won) => won },
    { k: 'hard', name: 'Contra a Corrente', desc: 'Vença com o rival no Difícil ou acima.', t: (S, g, won) => won && ['hard', 'insane'].includes((S.players[1] && S.players[1].difficulty) || S.difficulty) },
    { k: 'blitz', name: 'Blitzscaling', desc: 'Destrua o Lab HQ rival antes de 15:00.', t: (S) => S.t < 900 && !hqOf(S, 1) },
    { k: 'agi20', name: 'Singularidade Precoce', desc: 'Vença pelo AGI Deployment em menos de 20 min.', t: (S, g, won) => won && S.t < 1200 && !!S.ents.find((e) => e.type === 'agi' && e.owner === 0 && e.built && e.countdown <= 0) },
    { k: 'mono', name: 'Monopólio de Dados', desc: 'Vença guardando as 5 relíquias.', t: (S, g, won) => won && S.mono.owner === 0 && S.mono.t >= CE.MONO },
    { k: 'aligned', name: 'Nunca Desalinhou', desc: 'Vença sem nenhum Modelo seu ficar Misaligned.', t: (S, g, won) => won && !g.mis },
    { k: 'intact', name: 'Firewall Intacto', desc: 'Vença sem perder nenhum prédio.', t: (S, g, won) => won && !g.lost },
    { k: 'hero5', name: 'Fine-Tuning', desc: 'Leve o herói ao nível 5.', t: (S, g) => g.lvl >= 5 },
    { k: 'hero10', name: 'Modelo de Fronteira', desc: 'Leve o herói ao nível 10.', t: (S, g) => g.lvl >= 10 },
    { k: 'scholar', name: 'Estado da Arte', desc: 'Pesquise 12 tecnologias numa partida.', t: (S) => Object.keys(S.players[0].techs).length >= 12 },
    { k: 'army', name: 'Escala Máxima', desc: 'Tenha 40 Modelos em campo ao mesmo tempo.', t: (S) => S.ents.filter((u) => u.kind === 'unit' && u.owner === 0 && !CE.UNITS[u.type].gather && !CE.UNITS[u.type].civ).length >= 40 },
    { k: 'set1', name: 'Set 1 Completo', desc: 'Conclua as 6 missões da campanha.', t: () => MISSIONS.every((m, i) => progress().best[i] != null) },
  ];
  let P = null; const prof = () => P || (P = Object.assign({ wins: 0, games: 0, time: 0, hero: 1, ach: {} }, load('cw_profile') || {}));
  const seenLog = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  function award(S, g, won) {
    const p = prof();
    for (const a of ACH) if (!p.ach[a.k] && a.t(S, g, won)) { p.ach[a.k] = Date.now(); if (!NODE && typeof toast === 'function') toast(`Conquista: ${a.name}`, 'info'); }
  }
  function profTick(S) {
    if (S.spectate) return; // replay assistido não é partida jogada
    const g = S.prof || (S.prof = { t: S.t, mis: false, lost: false, lvl: 1, end: false, chk: 0 }), p = prof();
    if (g.end) return;
    p.time += Math.max(0, S.t - g.t); g.t = S.t;
    const h = S.ents.find((e) => e.kind === 'unit' && e.owner === 0 && CE.UNITS[e.type].hero); if (h) g.lvl = Math.max(g.lvl, CE.heroLevel(h)); p.hero = Math.max(p.hero, g.lvl);
    for (const l of S.log) if (!seenLog || !seenLog.has(l)) { if (seenLog) seenLog.add(l); if (/ficou Misaligned/.test(l.text)) g.mis = true; if (l.kind === 'alert' && / destruído!$/.test(l.text)) g.lost = true; }
    if (S.t - g.chk >= 1 || S.winner !== null) { g.chk = S.t; award(S, g, null); }
    if (S.winner !== null) {
      g.end = true; p.games++; const won = S.winner === 0; if (won) p.wins++;
      const c = S.campaign; if (c && won) { const pr = progress(); pr.best[c.i] = Math.min(pr.best[c.i] == null ? Infinity : pr.best[c.i], Math.round(S.t)); save('cw_campaign', pr); }
      award(S, g, won); save('cw_profile', p);
    } else if (S.t - (g.saved || 0) >= 15) { g.saved = S.t; save('cw_profile', p); }
  }

  // ---- regras da missão + perfil: chamado do loop a cada quadro (e do bot a cada passo) ----
  let objT = 0, lastS = null;
  function tick(S, dt) {
    if (!S) return;
    const c = S.campaign;
    if (c && !c.over) {
      const m = MISSIONS[c.i];
      if (m.run && S.winner === null) m.run(S, c);
      c.done = m.objectives.map((o, k) => !!(c.done && c.done[k]) || !!o.done(S, c));
      if (S.winner === null || S.winner === 0) {
        if (m.fail && m.fail(S, c)) { S.winner = 1; c.failed = true; }
        else if (c.done.every(Boolean)) S.winner = 0;
        else if (S.winner === 0) S.winner = null; // R8: vitória padrão não encerra missão com objetivo pendente
      }
      if (S.winner !== null) c.over = true;
    }
    const ended = S.winner !== null && !(S.prof && S.prof.end);
    profTick(S);
    if (NODE) return;
    objT += dt || 0; if (objT > 0.25 || ended || S !== lastS) { objT = 0; lastS = S; renderObj(S); } // partida nova: esconde/mostra já
    if (ended) queueMicrotask(() => decorateEnd(S));
  }

  // ---- UI (só browser) ----
  const CSS = `
  #cw-obj { position:fixed; top:54px; right:12px; z-index:3; width:330px; background:rgba(7,11,17,.94); border:3px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #000, 0 12px 30px rgba(0,0,0,.85); padding:9px 12px 10px; zoom:var(--ui); }
  #cw-obj h2 { font:700 13px var(--display); letter-spacing:3px; color:var(--m1); text-shadow:0 1px 0 #000; margin:0 0 2px; }
  #cw-obj small { display:block; font:700 10px var(--label); letter-spacing:1.5px; text-transform:uppercase; color:#9aa6ba; margin-bottom:6px; }
  .cw-objs { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:5px; text-align:left; }
  .cw-objs li { display:flex; gap:9px; align-items:flex-start; font:15px/1.25 var(--body); color:#d9d1c0; }
  .cw-objs li i { flex:none; width:16px; height:16px; margin-top:1px; border:1px solid #000; box-shadow:0 0 0 1px var(--m3), inset 0 1px 3px #000; background:linear-gradient(180deg,#000,#1b2430); font:700 13px/15px var(--mono); font-style:normal; color:#1a1206; text-align:center; }
  .cw-objs li.ok { color:var(--m1); } .cw-objs li.ok i { background:var(--brass); box-shadow:0 0 0 1px var(--m1), 0 0 8px var(--glow); }
  .cw-objs li.ok i::before { content:'✓'; }
  .cw-wrap { width:min(1180px, 94vw); max-height:92vh; overflow:auto; background:rgba(7,11,17,.93); border:4px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #000, 0 24px 80px rgba(0,0,0,.85); padding:22px 28px 24px; text-align:center; backdrop-filter:blur(3px); }
  #overlay .cw-wrap h1 { font-size:clamp(30px, 3.4vw, 46px); letter-spacing:.18em; margin:0; }
  #overlay .cw-wrap h2 { margin:4px 0 16px; }
  .cw-grid { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:16px; }
  .cw-m { position:relative; padding:0; border:3px solid; border-image:var(--metal) 1; background:#05080c; box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #000, 0 8px 22px rgba(0,0,0,.7); cursor:pointer; text-align:left; color:var(--ivory); overflow:hidden; transition:transform .15s; }
  .cw-m:hover:not(:disabled) { transform:translateY(-2px); box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #000, 0 0 24px var(--glow); }
  .cw-m img { display:block; width:100%; aspect-ratio:16/9; object-fit:cover; }
  .cw-m div { position:absolute; left:0; right:0; bottom:0; padding:30px 12px 9px; background:linear-gradient(transparent, rgba(3,5,8,.95) 55%); }
  .cw-m em { display:block; font:700 10px var(--label); letter-spacing:2px; text-transform:uppercase; color:var(--own); font-style:normal; }
  .cw-m b { display:block; font:700 18px var(--display); letter-spacing:1px; color:var(--m1); text-shadow:0 1px 0 #000; }
  .cw-m span { display:block; font:500 12px var(--mono); color:#b9c2d0; margin-top:2px; }
  .cw-m.done span { color:var(--data); } .cw-m.locked { cursor:not-allowed; } .cw-m.locked img { filter:grayscale(1) brightness(.35); } .cw-m.locked b { color:#8a93a3; }
  .cw-m .seal { position:absolute; top:8px; right:8px; width:30px; height:30px; border-radius:50%; background:var(--brass); color:#1a1206; font:700 16px/30px var(--mono); text-align:center; box-shadow:0 0 0 1px #000, 0 0 10px var(--glow); }
  .cw-brief { display:grid; grid-template-columns:minmax(0,1.55fr) minmax(0,1fr); gap:22px; text-align:left; align-items:start; }
  .cw-art { position:relative; border:3px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #000; }
  .cw-art > img { display:block; width:100%; aspect-ratio:16/9; object-fit:cover; }
  .cw-vil { position:absolute; left:12px; bottom:12px; width:24%; border:3px solid; border-image:var(--metal) 1; box-shadow:0 0 0 1px #000, 0 8px 18px rgba(0,0,0,.85); background:#000; }
  .cw-vil img { display:block; width:100%; aspect-ratio:3/4; object-fit:cover; }
  .cw-vil b { position:absolute; left:0; right:0; bottom:0; padding:14px 4px 4px; background:linear-gradient(transparent, rgba(0,0,0,.92)); font:600 11px var(--display); letter-spacing:1px; color:var(--m1); text-align:center; }
  .cw-side em { display:block; font:700 11px var(--label); letter-spacing:2px; text-transform:uppercase; color:var(--own); font-style:normal; }
  .cw-side h3 { font:700 26px var(--display); letter-spacing:1.5px; color:var(--m1); text-shadow:0 1px 0 #000; margin:2px 0 10px; }
  #overlay .cw-side p { margin:0 0 10px; font-size:17px; line-height:1.45; color:#e4dccb; max-width:none; }
  #overlay .cw-side p.q { font-style:italic; color:#b7bfcc; border-left:2px solid var(--m2); padding-left:10px; }
  .cw-side h4 { font:700 12px var(--label); letter-spacing:2px; text-transform:uppercase; color:#9aa6ba; margin:14px 0 6px; padding-top:10px; border-top:1px solid var(--m3); }
  .cw-btns { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:18px; }
  .cw-stats { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; margin-bottom:18px; }
  .cw-stats div { background:linear-gradient(180deg,var(--enamel2),var(--enamel)); border:1px solid var(--m3); box-shadow:inset 0 1px 0 rgba(255,255,255,.08), inset 0 0 12px rgba(0,0,0,.7); padding:10px; }
  .cw-stats b { display:block; font:700 30px var(--mono); color:var(--ivory); text-shadow:0 0 10px var(--glow); } .cw-stats small { font:700 11px var(--label); letter-spacing:1.5px; text-transform:uppercase; color:#9aa6ba; }
  .cw-ach { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; text-align:left; }
  .cw-ach div { display:flex; gap:10px; align-items:center; padding:8px 10px; border:1px solid var(--m4); background:rgba(0,0,0,.35); opacity:.55; }
  .cw-ach div.ok { opacity:1; border-color:var(--m2); box-shadow:inset 0 0 14px rgba(0,0,0,.6), 0 0 10px var(--glow); }
  .cw-ach i { flex:none; width:34px; height:34px; border-radius:50%; background:radial-gradient(circle at 40% 35%,var(--enamel),var(--enamel2)); box-shadow:0 0 0 2px var(--m3), 0 0 0 3px #000; font:700 16px/34px var(--display); font-style:normal; color:#6f7a8c; text-align:center; }
  .cw-ach div.ok i { background:var(--brass); color:#1a1206; box-shadow:0 0 0 2px var(--m1), 0 0 0 3px #000; }
  .cw-ach b { display:block; font:700 14px var(--display); color:var(--m1); } .cw-ach small { font-size:13px; color:#b7bfcc; line-height:1.25; }
  .cw-end { margin:4px 0 0; font:600 14px var(--label); letter-spacing:2px; text-transform:uppercase; color:var(--own); }
  @media (max-width:900px) { .cw-grid, .cw-ach { grid-template-columns:repeat(2, minmax(0,1fr)); } .cw-brief { grid-template-columns:1fr; } .cw-stats { grid-template-columns:repeat(2, minmax(0,1fr)); } }`;
  const el = (id) => document.getElementById(id);
  function styled() { if (!el('cw-css')) { const s = document.createElement('style'); s.id = 'cw-css'; s.textContent = CSS; document.head.appendChild(s); } }
  const objList = (m, S, c) => `<ul class="cw-objs">${m.objectives.map((o, k) => `<li class="${c && c.done[k] ? 'ok' : ''}"><i aria-hidden="true"></i><span>${o.label(S, c)}</span></li>`).join('')}</ul>`;
  function renderObj(S) {
    styled(); let o = el('cw-obj'); const c = S.campaign;
    if (!c) { if (o) o.style.display = 'none'; return; }
    if (!o) { o = document.createElement('div'); o.id = 'cw-obj'; o.setAttribute('role', 'status'); o.setAttribute('aria-label', 'Objetivos da missão'); document.body.appendChild(o); }
    const m = MISSIONS[c.i], html = `<h2>OBJETIVOS</h2><small>Missão ${c.i + 1} · ${m.name}</small>${objList(m, S, c)}`;
    if (o.innerHTML !== html) o.innerHTML = html;
    const sc = el('score'); o.style.display = sc && sc.style.display === 'block' ? 'none' : 'block'; // placar (Tab) ocupa o mesmo canto
  }
  function screen(html) { styled(); const o = el('overlay'); o.style.display = 'flex'; o.style.backgroundImage = 'url(assets/ui_title.jpg)'; o.innerHTML = `<div class="cw-wrap">${html}</div>`; const b = o.querySelector('.cw-wrap button:not(:disabled)'); if (b) b.focus(); return o; }
  const click = () => { if (typeof SFX !== 'undefined' && SFX.click) SFX.click(); };
  function open() {
    if (typeof Audio !== 'undefined' && Audio.stopAmbient) Audio.stopAmbient();
    const pr = progress();
    const o = screen(`<h1 class="metal-text">CAMPANHA</h1><h2>COMPUTE WARS · SET 1</h2><div class="cw-grid">${MISSIONS.map((m, i) => { const ok = unlocked(i), best = pr.best[i];
      return `<button class="cw-m ${best != null ? 'done' : ''} ${ok ? '' : 'locked'}" data-i="${i}" ${ok ? '' : 'disabled aria-disabled="true"'} aria-label="Missão ${i + 1}: ${m.name}"><img src="${m.art}" alt="">${best != null ? '<i class="seal" aria-hidden="true">✓</i>' : ''}<div><em>Missão ${i + 1} · ${m.faction === 'citadel' ? 'The Citadel' : 'The Foundry'}</em><b>${m.name}</b><span>${best != null ? `Concluída · melhor ${clock(best)}` : ok ? 'Disponível' : `Bloqueada: conclua a missão ${i}`}</span></div></button>`; }).join('')}</div>
      <div class="cw-btns"><button class="cta" id="cw-back">Voltar</button></div>`);
    o.querySelectorAll('.cw-m:not(:disabled)').forEach((b) => b.onclick = () => { click(); briefing(+b.dataset.i); });
    el('cw-back').onclick = () => { click(); startScreen(); };
  }
  function briefing(i) {
    const m = MISSIONS[i], S0 = create(i); document.body.dataset.f = m.faction; // S0: objetivos com os números reais do início
    screen(`<div class="cw-brief"><div class="cw-art"><img src="${m.art}" alt="Arte da missão ${m.name}"><div class="cw-vil"><img src="${m.portrait}" alt="Retrato de ${m.villain}"><b>${m.villain}</b></div></div>
      <div class="cw-side"><em>Missão ${i + 1} de 6 · ${m.faction === 'citadel' ? 'The Citadel' : 'The Foundry'} contra ${m.villain}${m.difficulty === 'hard' ? ' · Difícil' : ''}</em><h3>${m.name}</h3><p>${m.brief}</p><p class="q">“${m.quote}” — ${m.villain}</p>
      <h4>Objetivos</h4>${objList(m, S0, S0.campaign)}</div></div>
      <div class="cw-btns"><button class="cta" id="cw-go">Iniciar missão</button><button class="cta" id="cw-list">Voltar</button></div>`);
    el('cw-go').onclick = () => start(i); el('cw-list').onclick = () => { click(); open(); };
  }
  function start(i) {
    if (typeof Audio !== 'undefined' && Audio.unlock) Audio.unlock();
    const st = create(i); begin(st, true);
    if (typeof Sound !== 'undefined') Sound.start('mission' + (1 + Math.floor(i / 2))); // 4.4.2: 3 temas, um a cada 2 missões (substitui o de facção)
    if (typeof bannerShow === 'function') { bannerShow(`Missão ${i + 1}`, MISSIONS[i].name); el('banner').classList.add('intro'); }
    renderObj(st);
  }
  function decorateEnd(S) {
    const c = S.campaign, box = el('overlay').querySelector('.box'); if (!c || !box) return;
    const m = MISSIONS[c.i], won = S.winner === 0, h2 = box.querySelector('h2');
    if (h2) h2.textContent = won ? `Missão ${c.i + 1} concluída: ${m.name}` : c.failed ? m.failText : `Missão ${c.i + 1} fracassou: ${m.name}`;
    const bt = box.querySelector('button'); if (bt) bt.remove();
    const d = document.createElement('div'); d.className = 'cw-btns';
    d.innerHTML = `${won && c.i < 5 ? '<button class="cta" id="cw-next">Próxima missão</button>' : ''}<button class="cta" id="cw-retry">Tentar de novo</button><button class="cta" id="cw-list">Missões</button>`;
    box.appendChild(d);
    if (el('cw-next')) el('cw-next').onclick = () => briefing(c.i + 1);
    el('cw-retry').onclick = () => briefing(c.i); el('cw-list').onclick = () => open();
    (el('cw-next') || el('cw-retry')).focus();
  }
  function openProfile() {
    const p = prof(), n = Object.keys(p.ach).filter((k) => ACH.some((a) => a.k === k)).length;
    const o = screen(`<h1 class="metal-text">PERFIL</h1><h2>${n} DE ${ACH.length} CONQUISTAS</h2>
      <div class="cw-stats"><div><b>${p.wins}</b><small>Vitórias</small></div><div><b>${p.games}</b><small>Partidas</small></div><div><b>${Math.floor(p.time / 3600)}h ${String(Math.floor(p.time % 3600 / 60)).padStart(2, '0')}min</b><small>Tempo jogado</small></div><div><b>${p.hero}</b><small>Maior nível de herói</small></div></div>
      <div class="cw-ach">${ACH.map((a, i) => `<div class="${p.ach[a.k] ? 'ok' : ''}" aria-label="${a.name}: ${p.ach[a.k] ? 'obtida' : 'não obtida'}"><i aria-hidden="true">${p.ach[a.k] ? '✓' : i + 1}</i><span><b>${a.name}</b><small>${a.desc}</small></span></div>`).join('')}</div>
      <div class="cw-btns"><button class="cta" id="cw-back">Voltar</button></div>`);
    el('cw-back').onclick = () => { click(); startScreen(); };
  }

  const Campaign = { MISSIONS, create, tick, open, start, briefing, progress, unlocked };
  const Profile = { open: openProfile, data: prof, ACH };
  if (NODE) module.exports = { Campaign, Profile }; else { root.Campaign = Campaign; root.Profile = Profile; }
})(typeof window !== 'undefined' ? window : globalThis);
