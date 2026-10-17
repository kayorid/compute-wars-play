// Compute Wars — IA dos jogadores controlados pelo computador (plan, micro, Técnicas). Extraída de engine.js na Onda 5 sem mudar comportamento.
// Pura como a engine: só lê o estado e age por E.cmd. Carregada depois de engine.js (browser) ou pela própria engine (Node).
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.Engine;
  const { DIFF, aiLevel, UNITS, BUILDINGS, HERO, ROSTER, COUNTER, ADVANCE, TECHS, TALENTS, TECHNIQUES, ATTACK_RATE, TILE, AGGRO, scoutPts, cmd, nearest, isEnemy, heroAlive, canAfford, findSpot, pop, popCap, techList, pendingTalents, byId, stat, dist, radius, hostile, inReach } = E;
  // IA: compra Jailbreak/RLHF com folga (2x o custo), priorizando a que já tem alvo; usa em Modelo de alinhamento 1. Chamada pela ai() da frente mec-ai.
  function aiTechniques(s, pid) {
    const p = s.players[pid]; p.hand = p.hand || [];
    const jb = () => s.ents.find((u) => u.kind === 'unit' && hostile(s, pid, u.owner) && u.align === 1 && inReach(s, pid, u.x, u.y)), rl = () => s.ents.find((u) => u.kind === 'unit' && u.owner === pid && u.align === 1);
    const missing = ['jailbreak', 'rlhf'].filter((k) => !p.hand.includes(k)), want = missing.find((k) => (k === 'jailbreak' ? jb : rl)()) || missing[0];
    if (want && Object.keys(TECHNIQUES[want].cost).every((k) => p.res[k] >= 2 * TECHNIQUES[want].cost[k])) cmd(s, pid, { type: 'buyTechnique', key: want });
    let u; if (p.hand.includes('jailbreak') && (u = jb())) cmd(s, pid, { type: 'technique', key: 'jailbreak', target: u.id });
    if (p.hand.includes('rlhf') && (u = rl())) cmd(s, pid, { type: 'technique', key: 'rlhf', target: u.id });
  }

  // ---- IA do rival ----
  // 4.2.1 ordem de construção do Difícil por facção e era (acumula as eras alcançadas; o tipo repetido pede mais um)
  const ORDER = { citadel: { 1: 'cluster', 2: 'cluster lab alignlab wall market datacenter tower', 3: 'cluster tower', 4: 'agi' }, foundry: { 1: 'cluster', 2: 'cluster lab alignlab wall market datacenter', 3: 'cluster cluster', 4: 'agi' } };
  ORDER.commons = ORDER.foundry; // onda5/mapa R22: sem entrada, o Difícil/Insano da Commons lançava TypeError; mesma escada da Foundry (economia de Pesquisa, sem torre na era 2)
  function ai(s, pid) {
    const df = DIFF[aiLevel(s, pid)], my = plan(s, pid, df);
    if (my && df.micro) { micro(s, pid, my); if (E.aiTechniques) E.aiTechniques(s, pid); }
  }
  // macro: economia, prédios, produção, pesquisa, eras e ofensivas
  function plan(s, pid, df) {
    const p = s.players[pid]; const my = s.ents.filter((e) => e.owner === pid);
    const hq = my.find((e) => e.type === 'hq'); if (!hq) return;
    const eng = my.filter((e) => e.type === 'engineer'), mil = my.filter((e) => e.kind === 'unit' && e.type !== 'engineer' && !UNITS[e.type].civ);
    const bld = (t) => my.filter((e) => e.kind === 'building' && e.type === t);
    const ctx = hq.tx + 1, cty = hq.ty + 1;
    const team = s.players.reduce((m, q) => isEnemy(s, pid, q.id) ? m : m | (1 << q.id), 0), known = (e) => e.seenBy === undefined || (e.seenBy & team); // 4.2.3: só o que o time já viu
    const enemyHq = nearest(s, hq, (x) => x.type === 'hq' && isEnemy(s, pid, x.owner)); // só orienta o muro; o ataque usa o que o time já viu (4.2.3)
    if (!hq.queue.length) {
      if (eng.length < 8 + p.era * 2 + (df.eng || 0)) cmd(s, pid, { type: 'train', bid: hq.id, ut: 'engineer' });
      else if (!heroAlive(s, pid)) cmd(s, pid, { type: 'train', bid: hq.id, ut: HERO[p.faction] });
    }
    const fetch = eng.filter((e) => e.task.kind === 'carryRelic'), loose = s.relics.filter((r) => r.lab == null && r.by == null && dist(hq, r) < 30 * TILE && !fetch.some((e) => e.task.relic === r.id)).sort((a, b) => dist(hq, a) - dist(hq, b));
    if (p.era >= 2 && bld('lab').some((b) => b.built)) for (const e of eng.filter((x) => x.task.kind === 'idle' || x.task.kind === 'gather').slice(0, Math.max(0, 2 - fetch.length))) if (loose.length) cmd(s, pid, { type: 'carryRelic', ids: [e.id], relic: loose.shift().id }); // 2 Engineers buscam reliquias
    const idle = eng.filter((e) => e.task.kind === 'idle');
    if (idle.length) {
      const want = { data: p.res.data / 1.5, gpu: p.res.gpu / (p.era >= 2 ? 1 : 0.4), research: p.res.research };
      const rt = Object.keys(want).sort((a, b) => want[a] - want[b])[0];
      const drops = my.filter((b) => b.kind === 'building' && b.built && BUILDINGS[b.type].drop);
      const r = nearest(s, hq, (x) => x.kind === 'resource' && x.rtype === rt && drops.some((b) => dist(b, x) < 14 * TILE)) || nearest(s, hq, (x) => x.kind === 'resource', 45);
      if (r) cmd(s, pid, { type: 'gather', ids: idle.map((e) => e.id), target: r.id });
    }
    // mercado: vende excesso do recurso mais abundante quando falta outro
    if (bld('market').some((b) => b.built)) { const ks = Object.keys(p.res).sort((a, b) => p.res[b] - p.res[a]); if (p.res[ks[0]] > 600 && p.res[ks[2]] < 150) cmd(s, pid, { type: 'trade', from: ks[0], to: ks[2] }); }
    const building = my.find((e) => e.kind === 'building' && !e.built);
    const farRes = () => { const drops = my.filter((b) => b.kind === 'building' && b.built && BUILDINGS[b.type].drop); return nearest(s, hq, (x) => x.kind === 'resource' && !drops.some((b) => dist(b, x) < 10 * TILE), 32); };
    const orderNext = () => { if (!df.micro) return null; const n = {}; for (let e = 1; e <= p.era; e++) for (const bt of ORDER[p.faction][e].split(' ')) { n[bt] = (n[bt] || 0) + 1; if (bld(bt).length < n[bt]) return bt; } return null; };
    const orderBuild = (bt) => { // sem recurso: espera (bloqueia a escada comum); sem lugar: deixa a escada comum seguir
      if (!canAfford(p, BUILDINGS[bt].cost)) return true;
      if (bt === 'wall') { // trecho de 3 muros a 5 tiles do HQ, de frente para o inimigo
        const a = enemyHq ? Math.atan2(enemyHq.y - hq.y, enemyHq.x - hq.x) : 0, cx = ctx + Math.round(Math.cos(a) * 5), cy = cty + Math.round(Math.sin(a) * 5), px = Math.round(-Math.sin(a)), py = Math.round(Math.cos(a));
        const e = eng[eng.length - 1]; return e && cmd(s, pid, { type: 'buildline', ids: [e.id], bt, tiles: [-1, 0, 1].map((k) => [cx + px * k, cy + py * k]) });
      }
      const far = bt === 'datacenter' && farRes(); return build(bt, far ? [far.tx, far.ty] : null);
    };
    const build = (bt, near) => { const sp = findSpot(s, bt, near ? near[0] : ctx, near ? near[1] : cty); const e = eng[eng.length - 1]; return sp && e && cmd(s, pid, { type: 'build', ids: [e.id], bt, tx: sp[0], ty: sp[1] }); };
    if (building && eng.length) { if (!eng.some((e) => e.task.kind === 'build')) cmd(s, pid, { type: 'repair', ids: [eng[eng.length - 1].id], target: building.id }); }
    else if (!bld('cluster').length) build('cluster');
    else if (pop(s, pid) >= popCap(s, pid) - 3) build('rack');
    else if (df.micro && orderNext() && orderBuild(orderNext())) { /* Difícil: ordem por facção e era */ }
    else if (p.era >= 2 && !bld('lab').length) build('lab');
    else if (p.era >= 2 && !bld('market').length) build('market');
    else if (p.era >= 2 && !bld('alignlab').length) build('alignlab');
    else if (p.era >= 2 && bld('tower').length < 2) build('tower');
    else if (p.era >= 3 && bld('cluster').length < 2) build('cluster');
    else if (p.era >= 3 && bld('tower').length < 4) build('tower');
    else if (p.era >= 4 && !bld('agi').length) build('agi');
    else { // recurso longe de qualquer depósito: expande com Data Center
      const far = farRes();
      if (far && bld('datacenter').length < 3) build('datacenter', [far.tx, far.ty]);
    }
    const intruder = nearest(s, hq, (x) => x.kind === 'unit' && isEnemy(s, pid, x.owner), 16);
    const foes = s.ents.filter((e) => e.kind === 'unit' && e.owner >= 0 && isEnemy(s, pid, e.owner) && !UNITS[e.type].gather && !UNITS[e.type].civ), fc = {}; for (const e of foes) if (!UNITS[e.type].hero) fc[UNITS[e.type].cls] = (fc[UNITS[e.type].cls] || 0) + 1;
    const foeMost = Object.keys(fc).sort((a, b) => fc[b] - fc[a])[0], beats = (ut) => (COUNTER[UNITS[ut].cls] || {})[foeMost] || 1;
    const counts = {}; for (const u of mil) counts[UNITS[u.type].cls] = (counts[UNITS[u.type].cls] || 0) + 1;
    // poupa para avançar de era quando já tem exército razoável
    const saving = ADVANCE[p.era] && mil.length >= 8 + p.era * 2 && !intruder && !canAfford(p, ADVANCE[p.era].cost);
    for (const c of saving ? [] : bld('cluster').filter((b) => b.built && !b.queue.length)) {
      // composição: evita repetir a classe mais numerosa; cerco só na era 3+ e com exército
      let opts = ROSTER[p.faction].filter((ut) => UNITS[ut].tier <= p.era && canAfford(p, UNITS[ut].cost) && (UNITS[ut].cls !== 'siege' || (df.siege !== false && mil.length >= 8 && (counts.siege || 0) < 3)));
      const most = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      if (opts.length > 1 && most) opts = opts.filter((ut) => UNITS[ut].cls !== most || UNITS[ut].cls === 'siege').concat(opts.filter((ut) => UNITS[ut].cls === most));
      opts.sort((a, b) => UNITS[b].tier - UNITS[a].tier || (UNITS[a].cls === most ? 1 : -1));
      if (df.micro && foeMost) opts.sort((a, b) => beats(b) - beats(a)); // Difícil: contra a classe rival mais numerosa (sort estável mantém a ordem acima no empate)
      if (opts.length) cmd(s, pid, { type: 'train', bid: c.id, ut: opts[0] });
    }
    for (const l of bld('lab').filter((b) => b.built && !b.queue.length)) {
      const t = techList(p).find((k) => !p.techs[k] && TECHS[k].era <= p.era && canAfford(p, TECHS[k].cost));
      if (t) cmd(s, pid, { type: 'research', bid: l.id, tech: t });
    }
    if (ADVANCE[p.era] && !hq.queue.length && mil.length >= 3) cmd(s, pid, { type: 'advance', bid: hq.id });
    for (const l of pendingTalents(s, pid)) cmd(s, pid, { type: 'talent', lvl: l, k: TALENTS[l][0].k }); // 3.2.8: IA pega o primeiro talento
    const hero = mil.find((u) => UNITS[u.type].hero);
    if (df.ability !== false && hero && s.ents.some((x) => x.kind === 'unit' && x.owner >= 0 && isEnemy(s, pid, x.owner) && dist(x, hero) < 6 * TILE)) { if (hero.abilityCd === 0) cmd(s, pid, { type: 'ability', id: hero.id }); cmd(s, pid, { type: 'ability2', id: hero.id }); }
    // 4.2.3: da era 2 em diante, 1 militar (não herói) visita o ponto de exploração não visto mais perto; fica fora das levas
    const ptsSeen = s.players.reduce((m, q) => team & (1 << q.id) ? m | q.explored : m, 0), SCOUT_PTS = scoutPts(s), todo = SCOUT_PTS.map((_, k) => k).filter((k) => !(ptsSeen & (1 << k)));
    let sc = byId(s, p.scout); if (sc && sc.owner !== pid) sc = null;
    if (p.era >= 2 && todo.length) {
      if (!sc) { sc = mil.find((u) => u.task.kind === 'idle' && !UNITS[u.type].hero && !UNITS[u.type].civ); p.scout = sc ? sc.id : null; p.scoutWp = null; }
      if (sc && sc.task.kind === 'idle') {
        if (p.scoutWp != null) p.explored |= 1 << p.scoutWp; // chegou (ou não alcança): conta como explorado, não trava
        const d = (k) => Math.hypot((SCOUT_PTS[k][0] + 0.5) * TILE - sc.x, (SCOUT_PTS[k][1] + 0.5) * TILE - sc.y), k = todo.filter((k) => k !== p.scoutWp).sort((a, b) => d(a) - d(b))[0];
        p.scoutWp = k === undefined ? null : k; if (k !== undefined) cmd(s, pid, { type: 'move', ids: [sc.id], x: (SCOUT_PTS[k][0] + 0.5) * TILE, y: (SCOUT_PTS[k][1] + 0.5) * TILE });
      }
    } else p.scout = null;
    const haven = bld('alignlab').find((b) => b.built), idleMil = mil.filter((u) => u.task.kind === 'idle' && u.id !== p.scout && !(df.micro && haven && u.hp < u.maxHp * 0.6 && dist(u, haven) < 7 * TILE)); // Difícil: quem se cura no Lab fica fora; o batedor também
    if (df.micro) { // Caravanas: até 2, do Exchange ao Data Center mais longe
      const mk = bld('market').find((b) => b.built), dc = bld('datacenter').filter((b) => b.built).sort((a, b) => dist(b, mk || hq) - dist(a, mk || hq))[0], cv = my.filter((e) => e.type === 'caravan');
      if (mk && dc) { if (cv.length < 2 && !mk.queue.length) cmd(s, pid, { type: 'train', bid: mk.id, ut: 'caravan' }); const ic = cv.filter((e) => e.task.kind === 'idle'); if (ic.length) cmd(s, pid, { type: 'caravan', ids: ic.map((e) => e.id), target: dc.id }); }
    }
    const tgt = s.t >= df.firstAttack && nearest(s, hq, (x) => x.kind === 'building' && isEnemy(s, pid, x.owner) && known(x));
    const setStance = (v) => { const ids = idleMil.filter((u) => (u.stance || 'aggressive') !== v).map((u) => u.id); if (ids.length) cmd(s, pid, { type: 'stance', ids, v }); }; // 3.2.1: defensiva em casa, agressiva nos ataques
    if (intruder && idleMil.length) { setStance('defensive'); cmd(s, pid, { type: 'attack', ids: idleMil.map((u) => u.id), target: intruder.id }); }
    else if (tgt && (!df.wave || s.t - (p.aiWave || 0) >= df.wave) && (df.micro ? idleMil.length >= 4 && (power(idleMil) >= power(foes) || idleMil.length >= 30) : idleMil.length >= Math.max(4, df.army + p.era * 2 - Math.floor(s.t / 600)))) { p.aiWave = s.t; setStance('aggressive'); cmd(s, pid, { type: 'attackmove', ids: idleMil.map((u) => u.id), x: tgt.x, y: tgt.y }); }
    else setStance('defensive');
    return my;
  }
  // força de combate (vida x dano/s): o Difícil só sai quando o exército ocioso supera o militar rival inteiro
  const power = (us) => us.reduce((a, u) => a + u.hp * UNITS[u.type].atk / ATTACK_RATE[UNITS[u.type].cls], 0);
  // micro do Difícil, por unidade militar: recua a 25% de vida, kiting de quem atira contra melee a < 2 tiles, foca Engineers
  function micro(s, pid, my) {
    const hq = my.find((e) => e.type === 'hq'), haven = my.find((e) => e.type === 'alignlab' && e.built) || hq;
    for (const u of my) {
      if (u.kind !== 'unit' || u.type === 'engineer' || UNITS[u.type].civ) continue;
      if (u.hp <= u.maxHp * 0.25) { const hx = haven.x, hy = haven.y + radius(haven) + 20; if (dist(u, haven) > 4 * TILE && !(u.task.kind === 'move' && Math.hypot(u.task.x - hx, u.task.y - hy) < TILE)) cmd(s, pid, { type: 'move', ids: [u.id], x: hx, y: hy }); continue; }
      const melee = stat(s, u, 'range') > 1.5 && nearest(s, u, (x) => x.kind === 'unit' && isEnemy(s, pid, x.owner) && UNITS[x.type].range <= 1.5 && !UNITS[x.type].gather && !UNITS[x.type].civ, 2);
      if (melee) { const a = Math.atan2(u.y - melee.y, u.x - melee.x); cmd(s, pid, { type: 'move', ids: [u.id], x: Math.max(TILE, Math.min((s.W - 1) * TILE, u.x + Math.cos(a) * 3 * TILE)), y: Math.max(TILE, Math.min((s.H - 1) * TILE, u.y + Math.sin(a) * 3 * TILE)) }); continue; }
      const cur = u.task.kind === 'attack' && byId(s, u.task.target); if (cur && cur.kind === 'unit') continue;
      const en = nearest(s, u, (x) => x.kind === 'unit' && x.owner >= 0 && isEnemy(s, pid, x.owner) && UNITS[x.type].gather, AGGRO);
      if (en) cmd(s, pid, { type: 'attack', ids: [u.id], target: en.id });
    }
  }

  E.ai = ai; E.aiTechniques = aiTechniques;
})(typeof window !== 'undefined' ? window : globalThis);
