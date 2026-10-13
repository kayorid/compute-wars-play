// Compute Wars RTS — simulação pura (sem DOM). Roda no browser (window.Engine) e no Node (require).
(function (root) {
  const TILE = 32, MAP_W = 72, MAP_H = 54;
  const ERAS = ['Era do Perceptron', 'Era do Transformer', 'Era dos Foundation Models', 'Era da AGI'];
  // ADVANCE[era] = custo/tempo para ir de `era` para `era+1`
  const ADVANCE = { 1: { cost: { data: 250, research: 150 }, time: 30 }, 2: { cost: { data: 400, gpu: 200, research: 200 }, time: 45 }, 3: { cost: { data: 400, gpu: 300, research: 250 }, time: 50 } };
  const RES = { gpu: { name: 'GPU', amount: 500 }, data: { name: 'Dados', amount: 400 }, research: { name: 'Pesquisa', amount: 350 } };
  const ATTACK_RATE = { worker: 1, infantry: 1, heavy: 1.3, ranged: 1.2, siege: 3, hero: 0.9 };
  const CARRY = 10, GATHER_SEC = 0.6, AGGRO = 6, VISION = { unit: 6, building: 8, hq: 14 }; // hq: +2 por era além da primeira (ver vision())
  // 4.2.1: Normal sem flags = IA de antes. siege/ability false cortam cerco e habilidade; wave = s entre ofensivas; micro = plano por facção + micro por unidade; eng = Engineers a mais; income = multiplicador da coleta
  const DIFF = { easy: { army: 10, every: 4, firstAttack: 720, wave: 480, siege: false, ability: false, label: 'Fácil' }, normal: { army: 6, every: 2, firstAttack: 480, label: 'Normal' }, hard: { army: 6, every: 1, firstAttack: 300, micro: true, eng: 6, label: 'Difícil' }, insane: { army: 6, every: 1, firstAttack: 300, micro: true, eng: 6, income: 1.25, label: 'Insano' } };
  // contrato 3: nível por jogador; s.difficulty só vale para pid > 0 (o jogador 0 é humano)
  const aiLevel = (s, pid) => { const p = s.players[pid]; return p && DIFF[p.difficulty] ? p.difficulty : p && p.ai && DIFF[s.difficulty] ? s.difficulty : 'normal'; };
  // Triângulo de combate: atacante -> alvo -> multiplicador
  const COUNTER = { ranged: { infantry: 1.5, siege: 1.5 }, heavy: { ranged: 1.5 }, infantry: { heavy: 1.5 }, siege: { building: 3, infantry: 0.5, heavy: 0.5, ranged: 0.5, hero: 0.5 }, hero: { infantry: 1.25 } };

  // range em tiles, speed em px/s. cls: worker | infantry | heavy | ranged | siege | hero
  const U = (name, cls, hp, atk, range, speed, cost, time, tier, kw) => ({ name, cls, hp, atk, range, speed, cost, time, tier, pop: 1, kw: kw || [] });
  const UNITS = {
    engineer: Object.assign(U('Engineer', 'worker', 25, 3, 1, 70, { data: 50 }, 10, 1), { gather: true }),
    // Citadel (closed-source): caro em GPU, forte
    gpt2: U('GPT-2', 'infantry', 45, 6, 1, 62, { data: 60, gpu: 20 }, 14, 1),
    gpt35: U('GPT-3.5', 'infantry', 65, 8, 1, 66, { data: 70, gpu: 40 }, 16, 2),
    dalle: U('DALL-E 3', 'ranged', 38, 7, 5, 60, { data: 50, gpu: 60 }, 16, 2, ['multimodal']),
    gpt4: U('GPT-4', 'heavy', 110, 13, 1, 56, { data: 90, gpu: 100 }, 22, 3),
    claude: U('Claude', 'heavy', 120, 11, 1, 58, { data: 80, gpu: 90, research: 30 }, 22, 3, ['constitutional']),
    rig: Object.assign(U('Pre-Training Rig', 'siege', 150, 30, 5, 38, { gpu: 180, research: 120 }, 36, 3), { pop: 2 }),
    o1: U('o1', 'ranged', 120, 18, 3, 55, { data: 100, gpu: 80, research: 60 }, 28, 4),
    gpt5: U('GPT-5', 'heavy', 200, 26, 1, 54, { data: 100, gpu: 90, research: 70 }, 34, 4),
    chancellor: Object.assign(U('Chanceler de Helios', 'hero', 220, 16, 2, 64, { data: 150, gpu: 100 }, 30, 1), { hero: true, pop: 0 }),
    // Foundry (open-source): barato em GPU, pede Pesquisa
    lenet: U('LeNet-5', 'infantry', 45, 6, 1, 62, { data: 58, research: 15 }, 14, 1),
    llama: U('LLaMA', 'infantry', 65, 8, 1, 66, { data: 68, research: 29 }, 15, 2),
    sd: U('Stable Diffusion', 'ranged', 38, 7, 5, 60, { data: 48, research: 48 }, 16, 2, ['multimodal']),
    mistral: U('Mistral 7B', 'infantry', 75, 10, 1, 88, { data: 58, gpu: 29, research: 39 }, 18, 3, ['streaming']),
    mixtral: U('Mixtral', 'heavy', 105, 12, 1, 56, { data: 87, gpu: 58, research: 58 }, 22, 3),
    furnace: Object.assign(U('Compute Furnace', 'siege', 150, 30, 5, 38, { gpu: 116, research: 175 }, 36, 3), { pop: 2 }),
    r1: U('DeepSeek R1', 'ranged', 120, 17, 3, 55, { data: 97, gpu: 97, research: 97 }, 28, 4),
    llama4: U('LLaMA 4', 'heavy', 190, 25, 1, 54, { data: 146, gpu: 136, research: 116 }, 34, 4),
    forgemaster: Object.assign(U('Forgemaster', 'hero', 240, 18, 1, 66, { data: 146, research: 97 }, 30, 1), { hero: true, pop: 0 }),
    // 4.1.3 The Commons (academica): paga em Pesquisa, barata, fragil, treino rapido. Onda 4 integrada: custos +4% (exceto ResNet, pouco usado); Word2Vec Pesquisa 36 (uso < 5%)
    perceptron: U('Perceptron', 'infantry', 38, 5, 1, 64, { data: 47, research: 21 }, 10, 1),
    svm: U('SVM', 'ranged', 32, 6, 5, 60, { data: 40, research: 44 }, 12, 2),
    mycin: U('MYCIN', 'infantry', 55, 7, 1, 64, { data: 48, research: 28 }, 12, 2),
    word2vec: U('Word2Vec', 'infantry', 50, 7, 1, 90, { data: 47, research: 36 }, 12, 2),
    alexnet: U('AlexNet', 'heavy', 90, 11, 1, 56, { data: 73, gpu: 42, research: 52 }, 17, 3),
    lstm: U('LSTM', 'ranged', 70, 10, 4, 58, { data: 62, gpu: 31, research: 62 }, 17, 3),
    gan: Object.assign(U('GAN', 'siege', 120, 26, 5, 40, { gpu: 94, research: 156 }, 28, 3), { pop: 2 }),
    resnet: U('ResNet', 'heavy', 160, 22, 1, 54, { data: 110, gpu: 90, research: 110 }, 26, 4),
    bert: U('BERT', 'ranged', 100, 15, 4, 56, { data: 83, gpu: 62, research: 104 }, 22, 4),
    archivist: Object.assign(U('A Arquivista', 'hero', 200, 14, 3, 66, { data: 130, research: 110 }, 24, 1), { hero: true, pop: 0 }),
    // 3.2.6 civil: nao coleta nem mira; leva 50 GPU do Exchange a um Data Center (tarefa trade)
    caravan: Object.assign(U('Caravana', 'worker', 40, 0, 1, 80, { data: 80 }, 12, 1), { civ: true }),
  };
  const TRADE_RES = 0.8; // Pesquisa por tile de distancia Exchange -> Data Center (40 tiles = 32)
  const ROSTER = { citadel: ['gpt2', 'gpt35', 'dalle', 'gpt4', 'claude', 'rig', 'o1', 'gpt5'], foundry: ['lenet', 'llama', 'sd', 'mistral', 'mixtral', 'furnace', 'r1', 'llama4'], commons: ['perceptron', 'svm', 'mycin', 'word2vec', 'alexnet', 'lstm', 'gan', 'resnet', 'bert'] };
  const HERO = { citadel: 'chancellor', foundry: 'forgemaster', commons: 'archivist' };
  // Heróis: XP por abate, níveis, evoluções (títulos) e habilidade ativa.
  const HEROES = {
    chancellor: { titles: ['Chanceler', 'Grão-Chanceler', 'Arconte de Helios', 'Voz do Hexcore'], ability: { name: 'Decreto', desc: 'Aliados num raio de 6 ganham +50% atk por 10 s', cd: 45, radius: 6, atk: 1.5, speed: 1, dur: 10 }, passive: 'Modelos aliados próximos recuperam 1 de alinhamento a cada 10 s' },
    forgemaster: { titles: ['Forgemaster', 'Mestre da Guilda', 'Senhor da Fornalha', 'Coração da Foundry'], ability: { name: 'Overclock', desc: 'Aliados num raio de 6 ganham +60% velocidade e +25% atk por 8 s', cd: 40, radius: 6, atk: 1.25, speed: 1.6, dur: 8 }, passive: 'Engineers próximos coletam 25% mais rápido' },
    archivist: { titles: ['A Arquivista', 'Curadora do Acervo', 'Guardiã do Índice', 'Memória dos Commons'], ability: { name: 'Revisão por Pares', desc: 'Aliados num raio de 6 recuperam 30% da vida e ganham +20% atk por 8 s', cd: 45, radius: 6, atk: 1.2, speed: 1, dur: 8, heal: 0.3 }, passive: 'Modelos aliados próximos recuperam 10% da vida a cada 10 s' },
  };
  // 3.2.8: habilidade 2 (nivel 5) e talentos (1 de 2 nos niveis 3/6/9; p.talents[nivel] = k)
  HEROES.chancellor.ability2 = { name: 'Edital', desc: 'Teleporta os 6 aliados mais distantes para perto do herói', cd: 90 };
  HEROES.forgemaster.ability2 = { name: 'Fundição de Campo', desc: 'Forja 3 LeNet-5 que duram 30 s', cd: 90 };
  HEROES.archivist.ability2 = { name: 'Revisão Sistemática', desc: 'Corta pela metade o tempo restante de todas as suas filas', cd: 90 };
  const ABILITY2_LVL = 5, TEMP_DUR = 30;
  const TALENTS = {
    3: [{ k: 'hp', name: 'Blindagem', desc: 'Herói +15% vida' }, { k: 'range', name: 'Alcance', desc: 'Herói +1 alcance' }],
    6: [{ k: 'atk', name: 'Fúria', desc: 'Herói +20% ataque' }, { k: 'speed', name: 'Ímpeto', desc: 'Herói +15% velocidade' }],
    9: [{ k: 'cd', name: 'Foco', desc: 'Habilidades recarregam 25% mais rápido' }, { k: 'regen', name: 'Regeneração', desc: 'Herói recupera 1% da vida por segundo' }],
  };
  const XP_KILL = (victim) => victim.kind === 'building' ? 30 : (UNITS[victim.type].tier * 10 + 5);
  const xpFor = (lvl) => 60 * lvl * lvl; // XP acumulado necessário para chegar ao nível lvl+1
  const MAX_LVL = 10;

  const BUILDINGS = {
    hq: { name: 'Lab HQ', w: 3, h: 3, hp: 1500, cost: {}, time: 1, trains: ['engineer', 'hero'], drop: true, pop: 10, era: 1, garrison: 5 },
    rack: { name: 'Server Rack', w: 2, h: 2, hp: 300, cost: { research: 40 }, time: 15, pop: 5, era: 1 },
    datacenter: { name: 'Data Center', w: 2, h: 2, hp: 350, cost: { research: 60 }, time: 20, drop: true, era: 1 },
    cluster: { name: 'Training Cluster', w: 3, h: 3, hp: 800, cost: { research: 150 }, time: 30, trains: 'roster', era: 1 },
    market: { name: 'Compute Exchange', w: 2, h: 2, hp: 400, cost: { research: 80, data: 60 }, time: 25, market: true, trains: ['caravan'], era: 1 },
    lab: { name: 'Research Lab', w: 2, h: 2, hp: 500, cost: { research: 120, gpu: 60 }, time: 30, techs: true, era: 2 },
    alignlab: { name: 'Alignment Lab', w: 2, h: 2, hp: 400, cost: { research: 100, gpu: 50 }, time: 25, align: { radius: 7, every: 6, heal: 2 }, era: 2 },
    tower: { name: 'Firewall Tower', w: 1, h: 1, hp: 450, cost: { gpu: 60, research: 60 }, time: 25, atk: 9, range: 6, era: 2, garrison: 5 },
    wall: { name: 'Firewall Wall', w: 1, h: 1, hp: 250, cost: { gpu: 15 }, time: 6, wall: true, era: 2 },
    gate: { name: 'Gate', w: 1, h: 2, hp: 300, cost: { gpu: 30, research: 10 }, time: 10, gate: true, era: 2 },
    agi: { name: 'AGI Deployment', w: 4, h: 4, hp: 2500, cost: { gpu: 1000, data: 1000, research: 1000 }, time: 90, era: 4, countdown: 120 },
  };
  // Tecnologias (Research Lab). mods(p) traduz em modificadores.
  const TECHS = {
    distill: { name: 'Distillation', desc: 'Engineers coletam 40% mais rápido', cost: { research: 100, data: 50 }, time: 30, era: 2 },
    synth: { name: 'Synthetic Data', desc: 'Lagos de Dados rendem 50% mais por unidade extraída', cost: { data: 120, research: 80 }, time: 30, era: 2 },
    scaling: { name: 'Scaling Laws', desc: 'Modelos +2 atk', cost: { gpu: 150, research: 100 }, time: 40, era: 2 },
    quant: { name: 'Quantization', desc: 'Modelos 25% mais rápidos', cost: { research: 150 }, time: 35, era: 2 },
    rlhf: { name: 'RLHF', desc: 'Alinhamento máximo 6', cost: { data: 150, research: 150 }, time: 40, era: 2 },
    guard: { name: 'Guardrails', desc: 'Prédios +25% hp', cost: { gpu: 100, research: 150 }, time: 40, era: 2 },
    moe: { name: 'Mixture of Experts', desc: 'Modelos +30 hp', cost: { gpu: 250, research: 200 }, time: 50, era: 3 },
    longctx: { name: 'Long Context', desc: 'Modelos à distância +1 alcance', cost: { gpu: 200, research: 200 }, time: 45, era: 3 },
    waf: { name: 'WAF', desc: 'Firewall Towers +6 atk e +1 alcance', cost: { gpu: 200, research: 150 }, time: 45, era: 3 },
    agents: { name: 'Agents', desc: 'Engineers constroem e reparam 50% mais rápido', cost: { research: 250, data: 100 }, time: 45, era: 3 },
    cot: { name: 'Chain-of-Thought', desc: 'Modelos +4 atk', cost: { gpu: 400, research: 300 }, time: 60, era: 4 },
    ttc: { name: 'Test-Time Compute', desc: 'Herói: habilidade recarrega 2x mais rápido', cost: { gpu: 300, research: 300 }, time: 50, era: 4 },
    // 3.2.7 exclusivas por faccao (techList filtra)
    propweights: { name: 'Proprietary Weights', desc: 'Unidades não perdem alinhamento por 60 s após o Decreto', cost: { gpu: 150, research: 150 }, time: 40, era: 2, faction: 'citadel' },
    hexcore: { name: 'Hexcore Overclock', desc: 'Firewall Towers +2 alcance', cost: { gpu: 200, research: 150 }, time: 40, era: 2, faction: 'citadel' },
    monocle: { name: 'Monocle Network', desc: 'Visão +2 em unidades e prédios', cost: { data: 150, research: 120 }, time: 35, era: 2, faction: 'citadel' },
    ivory: { name: 'Ivory Charter', desc: 'População máxima +10', cost: { data: 200, research: 150 }, time: 40, era: 3, faction: 'citadel' },
    openweights: { name: 'Open Weights', desc: 'Unidades custam 10% menos', cost: { data: 150, research: 150 }, time: 40, era: 2, faction: 'foundry' },
    chemtech: { name: 'Chemtech Furnaces', desc: 'Cerco +25% dano', cost: { gpu: 150, research: 200 }, time: 40, era: 3, faction: 'foundry' },
    guildsol: { name: 'Guild Solidarity', desc: 'Engineers +10 vida e +1 atk', cost: { data: 120, research: 120 }, time: 35, era: 2, faction: 'foundry' },
    neon: { name: 'Neon Signal', desc: 'Alignment Lab raio +3', cost: { gpu: 100, research: 150 }, time: 35, era: 2, faction: 'foundry' },
    openaccess: { name: 'Open Access', desc: 'Engineers coletam Pesquisa 30% mais rápido', cost: { data: 120, research: 100 }, time: 35, era: 2, faction: 'commons' },
    citation: { name: 'Citation Index', desc: 'Modelos +15 vida', cost: { data: 100, research: 150 }, time: 40, era: 2, faction: 'commons' },
    tenure: { name: 'Tenure Track', desc: 'Modelos treinam 25% mais rápido', cost: { data: 150, research: 200 }, time: 45, era: 3, faction: 'commons' },
    dropout: { name: 'Dropout', desc: 'Alinhamento máximo +1', cost: { data: 100, research: 120 }, time: 35, era: 2, faction: 'commons' },
  };
  const techList = (p) => Object.keys(TECHS).filter((k) => !TECHS[k].faction || TECHS[k].faction === p.faction);
  const mods = (p) => { const T = p.talents || {}; return { atk: (p.techs.scaling ? 2 : 0) + (p.techs.cot ? 4 : 0), hp: (p.techs.moe ? 30 : 0) + (p.techs.citation ? 15 : 0), speed: p.techs.quant ? 1.25 : 1, gather: p.techs.distill ? 1.4 : 1, dataYield: p.techs.synth ? 1.5 : 1, alignMax: (p.techs.rlhf ? 6 : 4) + (p.techs.dropout ? 1 : 0), range: p.techs.longctx ? 1 : 0, bhp: p.techs.guard ? 1.25 : 1, towerAtk: p.techs.waf ? 6 : 0, towerRange: (p.techs.waf ? 1 : 0) + (p.techs.hexcore ? 2 : 0), build: p.techs.agents ? 1.5 : 1, heroCd: (p.techs.ttc ? 0.5 : 1) * (T[9] === 'cd' ? 0.75 : 1),
    vision: p.techs.monocle ? 2 : 0, pop: p.techs.ivory ? 10 : 0, cost: p.techs.openweights ? 0.9 : 1, siege: p.techs.chemtech ? 1.25 : 1, engHp: p.techs.guildsol ? 10 : 0, engAtk: p.techs.guildsol ? 1 : 0, alignR: p.techs.neon ? 3 : 0, researchGather: p.techs.openaccess ? 1.3 : 1, train: p.techs.tenure ? 0.75 : 1,
    heroHp: T[3] === 'hp' ? 1.15 : 1, heroRange: T[3] === 'range' ? 1 : 0, heroAtk: T[6] === 'atk' ? 1.2 : 1, heroSpeed: T[6] === 'speed' ? 1.15 : 1, heroRegen: T[9] === 'regen' ? 0.01 : 0 }; };
  const heroLevel = (u) => { let l = 1; while (l < MAX_LVL && u.xp >= xpFor(l)) l++; return l; };
  function stat(s, u, k) {
    const d = UNITS[u.type], p = s.players[u.owner < 0 ? 0 : u.owner], m = mods(p);
    const buff = u.buff && u.buff.until > s.t ? u.buff : null;
    if (k === 'atk') { let a = d.atk + (d.gather ? m.engAtk : m.atk) + (d.hero ? (heroLevel(u) - 1) * 3 : 0); if (d.cls === 'siege') a *= m.siege; if (d.hero) a *= m.heroAtk; if (buff) a *= buff.atk; a += (u.fewUntil > s.t ? 2 : 0) + (u.cotUntil > s.t ? 3 : 0); if (u.atkMod) a = Math.max(1, a + u.atkMod); return a; } // 4.1.2 Few-Shot, Chain-of-Thought, Adversarial Attack
    if (k === 'speed') { let v = d.speed * (d.gather ? 1 : d.hero ? m.heroSpeed : m.speed); if (buff) v *= buff.speed; return v; }
    if (k === 'range') return d.range + (d.hero ? m.heroRange : d.range > 1 ? m.range : 0);
    return d[k];
  }

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const radius = (e) => e.kind === 'building' ? Math.max(e.w, e.h) * TILE / 2 : e.kind === 'resource' ? TILE / 2 : 10;
  // distância da borda de `from` até a borda de `e` (retângulo real para prédios)
  const edgeDist = (from, e) => { if (e.kind !== 'building') return dist(from, e) - radius(e); const dx = Math.max(e.tx * TILE - from.x, 0, from.x - (e.tx + e.w) * TILE), dy = Math.max(e.ty * TILE - from.y, 0, from.y - (e.ty + e.h) * TILE); return Math.hypot(dx, dy); };
  const canAfford = (p, cost) => Object.keys(cost).every((k) => p.res[k] >= cost[k]);
  const pay = (p, cost, sign) => { for (const k in cost) { p.res[k] -= cost[k] * (sign || 1); if ((sign || 1) > 0) p.stats.spent += cost[k]; } };
  const rng = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const attachRng = (s) => { s.rng = () => (s.rngState = (s.rngState * 1664525 + 1013904223) >>> 0) / 4294967296; }; // 5.2.1: estado em s.rngState (serializa); a função é religada no deserialize
  const DT = 1 / 60; // 5.2.1: passo fixo da simulação (jogo e replay)
  let inAi = false, replaying = false; // 4.2.5: IA interna não grava comandos; espectador só aceita comandos do replay
  const log = (s, text, x, y, kind) => { s.log.push({ t: s.t, text, x, y, kind: kind || 'info' }); if (s.log.length > 40) s.log.shift(); };
  const newPlayer = (id, name, faction, team, ai) => ({ id, name, faction, team, ai: !!ai, explored: 0, scout: null, res: { gpu: 100, data: 200, research: 150 }, era: 1, techs: {}, talents: {}, hand: [], heroXp: 0, heroDeadAt: -999, prices: { gpu: 1, data: 1, research: 1 }, stats: { gathered: { gpu: 0, data: 0, research: 0 }, spent: 0, trained: 0, kills: 0, losses: 0, built: 0, destroyed: 0 } });

  // 3.1.4: bioma por tile (0 Plato, 1 Fundicao, 2 Jardim Hextech) por ruido de valor suavizado em lattice de 9 tiles (regioes grandes)
  const BIOMES = [{ name: 'Platô', col: '#2d4a2a' }, { name: 'Fundição', col: '#5a3320' }, { name: 'Jardim Hextech', col: '#1f5a52' }];
  function biomeMap(seed) {
    const N = 9, r = rng(seed * 7919 + 101), LW = Math.ceil(MAP_W / N) + 2, LH = Math.ceil(MAP_H / N) + 2, lat = []; for (let i = 0; i < LW * LH; i++) lat.push(r());
    const sm = (t) => t * t * (3 - 2 * t), out = new Uint8Array(MAP_W * MAP_H);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const i = Math.floor(x / N), j = Math.floor(y / N), fx = sm(x / N - i), fy = sm(y / N - j), L = (jj, ii) => lat[jj * LW + ii]; const v = (L(j, i) * (1 - fx) + L(j, i + 1) * fx) * (1 - fy) + (L(j + 1, i) * (1 - fx) + L(j + 1, i + 1) * fx) * fy; out[y * MAP_W + x] = v < 0.38 ? 1 : v > 0.63 ? 2 : 0; }
    return out;
  }
  function createGame(opts) {
    opts = opts || {};
    const rand = rng(opts.seed || 7);
    const faction = opts.faction || 'citadel';
    // 4.2.2: players [{faction, team, ai, name, difficulty?}] (2 a 4); sem lista, o 1v1 de sempre
    const pl = (opts.players || [{ faction, team: 0, ai: false }, { faction: opts.rival || (faction === 'citadel' ? 'foundry' : 'citadel'), team: 1, ai: true }]).slice(0, 4).map((o, i) => Object.assign({ faction, team: i, ai: i > 0 }, o));
    const s = {
      t: 0, nextId: 1, ents: [], winner: null, aiTimer: 0, fogTimer: 0, log: [], deaths: [], hits: [], projectiles: [], difficulty: opts.difficulty || 'normal', lastAlert: {}, seed: opts.seed || 7,
      fields: [], props: [], relics: [], mono: { owner: -1, t: 0 }, grid: new Uint8Array(MAP_W * MAP_H), seen: new Uint8Array(MAP_W * MAP_H), vis: new Uint8Array(MAP_W * MAP_H),
      weather: 'clear', weatherSlot: 0, biome: biomeMap(opts.seed || 7), camFav: {}, victory: (opts.victory || ['conquest', 'agi', 'monopoly']).slice(),
      players: pl.map((o, i) => newPlayer(i, o.name || (i === 0 ? 'Você' : o.team === pl[0].team ? 'Aliado' : pl.length > 2 ? `Rival ${pl.slice(0, i + 1).filter((q) => q.team !== pl[0].team).length}` : 'Rival'), o.faction, o.team, o.ai)),
      rngState: (opts.seed || 7) >>> 0, opts: JSON.parse(JSON.stringify(opts)), cmds: [], record: false, spectate: false, stats: { perMin: [] },
    };
    pl.forEach((o, i) => { if (o.difficulty) s.players[i].difficulty = o.difficulty; }); // contrato 3 (mec-ai) lê
    const bi = typeof opts.biome === 'number' ? opts.biome : BIOMES.findIndex((b) => b.name === opts.biome); if (BIOMES[bi]) s.biome.fill(bi);
    // escombros intransponíveis (grid=3) espalhados pelo meio do mapa
    for (let i = 0; i < 26; i++) {
      const cx = 12 + Math.floor(rand() * (MAP_W - 24)), cy = 10 + Math.floor(rand() * (MAP_H - 20)), n = 2 + Math.floor(rand() * 5);
      for (let k = 0; k < n; k++) { const tx = cx + Math.floor(rand() * 4) - 2, ty = cy + Math.floor(rand() * 3) - 1; if (tx > 0 && ty > 0 && tx < MAP_W - 1 && ty < MAP_H - 1) s.grid[ty * MAP_W + tx] = 3; }
    }
    // HQ a 12 tiles das bordas, cantos BL, TR, TL, BR; o time do jogador 0 prefere o lado esquerdo, os outros o direito (1v1 = BL x TR, como sempre)
    const CORNERS = [[12, MAP_H - 15], [MAP_W - 15, 12], [12, 12], [MAP_W - 15, MAP_H - 15]], PREF = [[0, 2, 3, 1], [1, 3, 2, 0]], used = [];
    const bases = s.players.map((p) => { const k = PREF[p.team === s.players[0].team ? 0 : 1].find((c) => !used.includes(c)); used.push(k); return CORNERS[k]; });
    bases.forEach(([tx, ty], pid) => {
      for (let y = ty - 8; y < ty + 11; y++) for (let x = tx - 6; x < tx + 11; x++) if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) s.grid[y * MAP_W + x] = 0; // base limpa
      const hq = place(s, 'hq', tx, ty, pid); hq.progress = 1; hq.built = true; hq.hp = hq.maxHp;
      for (let i = 0; i < 3; i++) spawn(s, 'engineer', pid, hq.x + (i - 1) * 24, hq.y + 64);
      const n = () => 5 + Math.floor(rand() * 3);
      cluster(s, 'data', tx + 6, ty - 2, n(), rand, pid); cluster(s, 'data', tx - 2, ty + 6, n(), rand, pid);
      cluster(s, 'gpu', tx + 7, ty + 6, n(), rand, pid); cluster(s, 'research', tx - 3, ty - 5, n(), rand, pid);
    });
    for (let i = 0; i < 20; i++) {
      const types = ['gpu', 'data', 'research'];
      cluster(s, types[i % 3], 10 + Math.floor(rand() * (MAP_W - 20)), 8 + Math.floor(rand() * (MAP_H - 16)), 5 + Math.floor(rand() * 3), rand, -1);
    }
    genProps(s, rand, bases);
    genRelics(s, rand);
    if (opts.color) s.players[0].color = opts.color; // 4.3.1: cor escolhida no lobby (vai no save e no replay pelos opts)
    vision(s); attachRng(s);
    return s;
  }
  // grupo por random walk: cada no novo nasce ao lado de um no ja colocado; forma (assinatura) nunca repete no mesmo tipo
  function cluster(s, rtype, cx, cy, n, rand, owner) {
    let nodes = [], sig = '';
    for (let att = 0; att < 8; att++) {
      nodes = []; const free = (x, y) => x >= 1 && y >= 1 && x < MAP_W - 1 && y < MAP_H - 1 && !s.grid[y * MAP_W + x] && !nodes.some((q) => q[0] === x && q[1] === y);
      for (let k = 0; k < 25 && !nodes.length; k++) { const x = cx + (k % 5) - 2, y = cy + Math.floor(k / 5) - 2; if (free(x, y)) nodes.push([x, y]); } // semente: centro ou o vizinho livre mais proximo
      for (let tries = 0; nodes.length && nodes.length < n && tries < 80; tries++) {
        const q = nodes[Math.floor(rand() * nodes.length)], d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rand() * 4)], x = q[0] + d[0], y = q[1] + d[1];
        if (free(x, y)) nodes.push([x, y]);
      }
      const mx = Math.min(...nodes.map((q) => q[0])), my = Math.min(...nodes.map((q) => q[1]));
      sig = nodes.map((q) => `${q[0] - mx}.${q[1] - my}`).sort().join(',');
      if (!s.fields.some((f) => f.rtype === rtype && f.sig === sig)) break;
    }
    if (!nodes.length) return;
    const f = { id: s.fields.length, rtype, owner: owner === undefined ? -1 : owner, sig, x: (nodes.reduce((a, q) => a + q[0], 0) / nodes.length + 0.5) * TILE, y: (nodes.reduce((a, q) => a + q[1], 0) / nodes.length + 0.5) * TILE };
    s.fields.push(f);
    for (const [tx, ty] of nodes) {
      s.grid[ty * MAP_W + tx] = 2;
      s.ents.push({ id: s.nextId++, kind: 'resource', rtype, tx, ty, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, amount: RES[rtype].amount, field: f.id, variant: 1 + Math.floor(rand() * 3), flip: rand() < 0.5, sc: 0.9 + rand() * 0.2 });
    }
  }
  // estradas: segmentos HQ -> cada grupo de recurso da base (calculado das posicoes atuais)
  function roads(s) {
    const out = [];
    for (const h of s.ents) if (h.kind === 'building' && h.type === 'hq') for (const f of s.fields) if (f.owner === h.owner) out.push({ x1: h.x, y1: h.y, x2: f.x, y2: f.y, owner: h.owner });
    return out;
  }
  const PROPS = ['neonpole', 'pipe', 'crystalbox', 'workbench', 'streetsign', 'vent', 'books', 'barrel', 'antenna', 'column'];
  const URBAN = ['neonpole', 'pipe', 'workbench', 'streetsign', 'vent', 'antenna'];
  function genProps(s, rand, bases) {
    const rd = roads(s), hqs = s.ents.filter((e) => e.type === 'hq');
    const segD = (px, py, r) => { const dx = r.x2 - r.x1, dy = r.y2 - r.y1, u = Math.max(0, Math.min(1, ((px - r.x1) * dx + (py - r.y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - r.x1 - u * dx, py - r.y1 - u * dy); };
    for (let y = 2; y < MAP_H - 2; y++) for (let x = 2; x < MAP_W - 2; x++) {
      const inBase = bases.some(([bx, by]) => x >= bx - 6 && x < bx + 11 && y >= by - 8 && y < by + 11);
      if (rand() >= (inBase ? 1 / 8 : 1 / 20)) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (s.grid[(y + dy) * MAP_W + x + dx]) { ok = false; break; }
      const px = (x + 0.5) * TILE, py = (y + 0.5) * TILE;
      if (!ok || hqs.some((h) => Math.hypot(h.x - px, h.y - py) < 5 * TILE) || rd.some((r) => segD(px, py, r) < 2 * TILE) || s.props.some((p) => Math.hypot(p.x - px, p.y - py) < 2.5 * TILE)) continue;
      const list = inBase ? URBAN : PROPS;
      s.props.push({ type: list[Math.floor(rand() * list.length)], x: px, y: py, f: rand() < 0.5, sc: 0.9 + rand() * 0.2 });
    }
  }
  function spawn(s, type, owner, x, y) {
    const d = UNITS[type], p = s.players[owner], m = mods(p);
    const hp = d.hp + (d.gather ? m.engHp : d.hero || d.civ ? 0 : m.hp);
    const u = { id: s.nextId++, kind: 'unit', type, owner, x, y, hp, maxHp: hp, task: { kind: 'idle' }, cd: 0, carry: 0, carryType: null, align: d.gather || d.hero || d.civ ? null : m.alignMax, gt: 0, path: null, buff: null };
    if (d.hero) { u.xp = p.heroXp; u.maxHp = Math.round((u.maxHp + (heroLevel(u) - 1) * 25) * m.heroHp); u.hp = u.maxHp; u.abilityCd = 0; u.ability2Cd = 0; }
    s.ents.push(u); return u;
  }
  function canPlace(s, bt, tx, ty) {
    const d = BUILDINGS[bt];
    if (tx < 0 || ty < 0 || tx + d.w > MAP_W || ty + d.h > MAP_H || (bt === 'agi' && !on(s, 'agi'))) return false; // 4.2.4: AGI desligada
    for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) if (s.grid[y * MAP_W + x]) return false;
    return true;
  }
  function place(s, bt, tx, ty, owner) {
    const d = BUILDINGS[bt], maxHp = Math.round(d.hp * mods(s.players[owner]).bhp);
    for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) s.grid[y * MAP_W + x] = d.wall ? 8 + owner : d.gate ? 4 + owner : 1; // 4..7 portão do dono 0..3, 8..11 muro
    const b = { id: s.nextId++, kind: 'building', type: bt, owner, tx, ty, w: d.w, h: d.h, x: (tx + d.w / 2) * TILE, y: (ty + d.h / 2) * TILE, hp: 1, maxHp, progress: 0, built: false, queue: [], cd: 0, alignT: 0, countdown: d.countdown || 0, rally: null, garrison: [], seenBy: 0 }; // seenBy: bitmask de jogadores que já o viram (4.2.3)
    s.ents.push(b);
    if (s.props) s.props = s.props.filter((p) => { const px = Math.floor(p.x / TILE), py = Math.floor(p.y / TILE); return px < tx - 1 || px > tx + d.w || py < ty - 1 || py > ty + d.h; }); // praça: 1 tile além
    for (const u of s.ents) if (u.kind === 'unit') u.path = null; // obstáculo novo: recalcular rotas
    return b;
  }
  // anel de 1 tile em volta do prédio já tem outro prédio? (emparedaria o HQ/depósito: engineers não alcançam e a economia trava)
  function walled(s, bt, tx, ty) {
    const d = BUILDINGS[bt];
    for (let y = ty - 1; y <= ty + d.h; y++) for (let x = tx - 1; x <= tx + d.w; x++) if (s.grid[y * MAP_W + x] === 1 && (x < tx || x >= tx + d.w || y < ty || y >= ty + d.h)) return true;
    return false;
  }
  function findSpot(s, bt, cx, cy) {
    for (let r = 2; r < 18; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      if (canPlace(s, bt, cx + dx, cy + dy) && !walled(s, bt, cx + dx, cy + dy)) return [cx + dx, cy + dy];
    }
    return null;
  }
  const byId = (s, id) => s.ents.find((e) => e.id === id);
  const pop = (s, pid) => s.ents.reduce((n, e) => n + (e.kind === 'unit' && e.owner === pid ? UNITS[e.type].pop : e.kind === 'building' && e.owner === pid ? e.queue.filter((q) => q.kind === 'unit').reduce((m, q) => m + UNITS[q.type].pop, 0) + (e.garrison || []).length : 0), 0);
  const popCap = (s, pid) => Math.min(120, mods(s.players[pid]).pop + s.ents.reduce((n, e) => n + (e.kind === 'building' && e.owner === pid && e.built ? (BUILDINGS[e.type].pop || 0) : 0), 0));
  // 3.2.6: no de recurso a <= 4 tiles de um Data Center proprio pronto rende 20% a mais
  const dropBonus = (s, r) => s.ents.some((b) => b.kind === 'building' && b.type === 'datacenter' && b.built && b.owner >= 0 && edgeDist(r, b) <= 4 * TILE) ? 1.2 : 1;
  // 3.2.8: niveis 3/6/9 ja alcancados (heroi vivo ou XP guardado) sem talento escolhido
  const pendingTalents = (s, pid) => { const p = s.players[pid], h = s.ents.find((e) => e.kind === 'unit' && e.owner === pid && UNITS[e.type].hero), lv = heroLevel({ xp: h ? h.xp : p.heroXp }); return Object.keys(TALENTS).map(Number).filter((l) => lv >= l && !(p.talents || {})[l]); };
  const trainable = (s, b) => { const d = BUILDINGS[b.type], f = s.players[b.owner].faction; return d.trains === 'roster' ? ROSTER[f] : (d.trains || []).map((t) => t === 'hero' ? HERO[f] : t); };
  const researching = (s, pid, tech) => s.ents.some((b) => b.kind === 'building' && b.owner === pid && b.queue.some((q) => q.kind === 'tech' && q.type === tech));
  const heroAlive = (s, pid) => s.ents.some((e) => e.kind === 'unit' && e.owner === pid && UNITS[e.type].hero) || s.ents.some((b) => b.kind === 'building' && b.owner === pid && b.queue.some((q) => q.kind === 'unit' && UNITS[q.type].hero));
  const tradeRate = (p, from, to) => Math.max(0.2, Math.min(1.5, 0.7 * p.prices[to] / p.prices[from]));

  // ---- pathfinding A* em tiles (prédios e escombros bloqueiam; recursos não) ----
  const blocked = (s, tx, ty, pid) => { if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true; const v = s.grid[ty * MAP_W + tx]; return v === 1 || v === 3 || v >= 8 || (v >= 4 && v - 4 !== pid); }; // portao so abre para o dono (pid)
  const foreignWall = (s, tx, ty, pid) => { const v = s.grid[ty * MAP_W + tx]; return v >= 4 && (v < 8 ? v - 4 : v - 8) !== pid; };
  const wallAt = (s, tx, ty) => s.ents.find((e) => e.kind === 'building' && (BUILDINGS[e.type].wall || BUILDINGS[e.type].gate) && tx >= e.tx && tx < e.tx + e.w && ty >= e.ty && ty < e.ty + e.h);
  function freeNear(s, tx, ty, px, py) {
    if (!blocked(s, tx, ty)) return [tx, ty];
    for (let r = 1; r < 8; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if ((Math.abs(dx) === r || Math.abs(dy) === r) && !blocked(s, tx + dx, ty + dy)) { const d = px == null ? 0 : Math.hypot((tx + dx + 0.5) * TILE - px, (ty + dy + 0.5) * TILE - py); if (d < bd) { bd = d; best = [tx + dx, ty + dy]; } }
      if (best) return best;
    }
    return null;
  }
  // breach: muro/portao alheio vira transponivel (custo +12): a unidade ira derruba-lo
  function astar(s, sx, sy, gx, gy, pid, breach) {
    const bl = (x, y) => blocked(s, x, y, pid) && !(breach && x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && foreignWall(s, x, y, pid));
    const N = MAP_W * MAP_H, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const h = (i) => { const dx = Math.abs(i % MAP_W - gx), dy = Math.abs((i / MAP_W | 0) - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const heap = []; const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const popH = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
    const start = sy * MAP_W + sx, goal = gy * MAP_W + gx; g[start] = 0; push(start, h(start));
    let expanded = 0;
    while (heap.length && expanded++ < 8000) {
      const i = popH(); if (i === goal) break; if (closed[i]) continue; closed[i] = 1;
      const x = i % MAP_W, y = i / MAP_W | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
        if (bl(nx, ny)) continue;
        if (dx && dy && (bl(x + dx, y) || bl(x, y + dy))) continue; // sem cortar quina
        const j = ny * MAP_W + nx, c = g[i] + (dx && dy ? 1.414 : 1) + (breach && s.grid[j] >= 4 ? 12 : 0);
        if (c < g[j]) { g[j] = c; from[j] = i; push(j, c + h(j)); }
      }
    }
    if (from[goal] < 0 && goal !== start) return null;
    const path = []; for (let i = goal; i !== start && i >= 0; i = from[i]) path.push([(i % MAP_W) * TILE + TILE / 2, (i / MAP_W | 0) * TILE + TILE / 2]);
    return path.reverse();
  }
  // Move a unidade rumo a (x,y) seguindo rota; devolve true quando chega.
  function moveTo(s, u, x, y, dt) {
    const speed = stat(s, u, 'speed');
    const gt = freeNear(s, Math.floor(x / TILE), Math.floor(y / TILE), u.x, u.y); if (!gt) return true;
    const exact = !blocked(s, Math.floor(x / TILE), Math.floor(y / TILE));
    const fx = exact ? x : gt[0] * TILE + TILE / 2, fy = exact ? y : gt[1] * TILE + TILE / 2;
    if (!u.path || Math.hypot(u.path.goal[0] - fx, u.path.goal[1] - fy) > TILE) {
      const a = [Math.floor(u.x / TILE), Math.floor(u.y / TILE), gt[0], gt[1], u.owner], p = astar(s, ...a) || astar(s, ...a, true) || [];
      if (p.length) p[p.length - 1] = [fx, fy]; else p.push([fx, fy]);
      u.path = p; u.path.goal = [fx, fy];
    }
    const wp = u.path[0];
    if (u.path.length > 1 && blocked(s, Math.floor(wp[0] / TILE), Math.floor(wp[1] / TILE), u.owner)) {
      const w = wallAt(s, Math.floor(wp[0] / TILE), Math.floor(wp[1] / TILE)); u.path = null;
      if (w && isEnemy(s, u.owner, w.owner)) u.task = { kind: 'attack', target: w.id, back: u.task, since: s.t }; // sem rota: derruba o muro
      return false;
    }
    const d = Math.hypot(wp[0] - u.x, wp[1] - u.y), st = Math.min(d, speed * dt);
    if (d > 0.01) { u.x += (wp[0] - u.x) / d * st; u.y += (wp[1] - u.y) / d * st; u.facing = wp[0] < u.x ? -1 : 1; }
    if (d - st < (u.path.length > 1 ? 6 : 1)) { u.path.shift(); if (!u.path.length) { u.path = null; return true; } }
    return false;
  }

  // Formação: grade centrada no destino; pesados e heróis na frente (lado de onde o grupo vem), cerco atrás.
  function formation(us, x, y) {
    if (us.length <= 1) return us.map((u) => [u, x, y]);
    const cx = us.reduce((a, u) => a + u.x, 0) / us.length, cy = us.reduce((a, u) => a + u.y, 0) / us.length;
    const ang = Math.atan2(y - cy, x - cx), fx = Math.cos(ang), fy = Math.sin(ang), rx = -fy, ry = fx;
    const rank = { heavy: 0, hero: 0, infantry: 1, worker: 1, ranged: 2, siege: 3 };
    const sorted = us.slice().sort((a, b) => rank[UNITS[a.type].cls] - rank[UNITS[b.type].cls]);
    const cols = Math.ceil(Math.sqrt(sorted.length * 1.6)), sp = 28;
    return sorted.map((u, i) => { const row = Math.floor(i / cols), col = i % cols, n = Math.min(cols, sorted.length - row * cols); const off = (col - (n - 1) / 2) * sp, back = row * sp; return [u, x + rx * off - fx * back, y + ry * off - fy * back]; });
  }
  // ---- 3.2.2 guarnição: unidades saem de s.ents para b.garrison; HQ atira 3 por Engineer dentro ----
  const buildingAtk = (s, b) => { const d = BUILDINGS[b.type]; return d.atk ? d.atk + mods(s.players[b.owner]).towerAtk : 3 * (b.garrison || []).filter((u) => u.type === 'engineer').length; };
  function unload(s, b) {
    const sp = freeNear(s, b.tx + (b.w >> 1), b.ty + b.h) || [b.tx, b.ty + b.h];
    (b.garrison || []).forEach((u, i) => { delete u.garrisoned; u.x = sp[0] * TILE + TILE / 2 + (i - 2) * 14; u.y = sp[1] * TILE + TILE / 2; u.task = { kind: 'idle' }; u.path = null; s.ents.push(u); });
    b.garrison = [];
  }
  // ---- comandos ----
  function cmd(s, pid, c) {
    if (s.spectate && !replaying) return false;
    const ok = exec(s, pid, c);
    if (ok && s.record && s.cmds && !inAi) s.cmds.push({ t: s.t, pid, c: JSON.parse(JSON.stringify(c)) }); // cópia: a UI passa arrays vivos (sel)
    return ok;
  }
  function exec(s, pid, c) {
    const p = s.players[pid];
    const mine = (ids) => ids.map((id) => byId(s, id)).filter((e) => e && e.owner === pid);
    const units = (ids, f) => mine(ids).filter((e) => e.kind === 'unit' && (!f || f(e)));
    switch (c.type) {
      case 'move': formation(units(c.ids), c.x, c.y).forEach(([u, x, y]) => { u.task = { kind: 'move', x, y }; }); break;
      case 'attackmove': formation(units(c.ids), c.x, c.y).forEach(([u, x, y]) => { u.task = { kind: 'attackmove', x, y }; }); break;
      case 'patrol': units(c.ids).forEach((u) => { u.task = { kind: 'patrol', x: c.x, y: c.y, ox: u.x, oy: u.y, leg: 0 }; }); break;
      case 'stance': { if (!['aggressive', 'defensive', 'hold'].includes(c.v)) return false; units(c.ids, (e) => !UNITS[e.type].gather).forEach((u) => { u.stance = c.v; u.home = { x: u.x, y: u.y }; }); break; }
      case 'garrison': {
        let n = 0;
        units(c.ids, (e) => !UNITS[e.type].hero).forEach((u) => { const b = c.bid ? byId(s, c.bid) : nearest(s, u, (x) => x.kind === 'building' && x.owner === pid && x.built && BUILDINGS[x.type].garrison, 40); if (b && b.kind === 'building' && b.owner === pid && b.built && BUILDINGS[b.type].garrison) { u.task = { kind: 'garrison', target: b.id }; n++; } });
        if (!n) return false; break;
      }
      case 'ungarrison': { const b = byId(s, c.bid); if (!b || b.owner !== pid || !(b.garrison || []).length) return false; unload(s, b); break; }
      case 'stop': mine(c.ids).forEach((u) => { u.task = { kind: 'idle' }; }); break;
      case 'attack': units(c.ids).forEach((u) => { u.task = { kind: 'attack', target: c.target }; }); break;
      case 'gather': units(c.ids, (e) => UNITS[e.type].gather).forEach((u) => { u.task = { kind: 'gather', target: c.target }; }); break;
      case 'repair': { const tg = byId(s, c.target); if (tg && tg.kind === 'unit' && (tg.owner !== pid || UNITS[tg.type].cls === 'worker')) return false; } // reparo em campo: só Modelos aliados
        units(c.ids, (e) => UNITS[e.type].gather).forEach((u) => { u.task = { kind: 'build', target: c.target }; }); break;
      case 'rally': { const b = byId(s, c.bid); if (!b || b.owner !== pid) return false; b.rally = { x: c.x, y: c.y, id: c.id }; break; }
      case 'ability': {
        const u = byId(s, c.id); if (!u || u.owner !== pid || !UNITS[u.type].hero || u.abilityCd > 0) return false;
        const a = HEROES[u.type].ability; u.abilityCd = a.cd * mods(p).heroCd; if (u.type === 'chancellor') p.decreeAt = s.t; // 3.2.7 Proprietary Weights le decreeAt
        for (const e of s.ents) if (e.kind === 'unit' && e.owner === pid && dist(e, u) <= a.radius * TILE) { e.buff = { atk: a.atk, speed: a.speed, until: s.t + a.dur }; if (a.heal) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * a.heal); }
        log(s, `${UNITS[u.type].name} usou ${a.name}!`, u.x, u.y, 'hero'); break;
      }
      case 'ability2': { // 3.2.8: nivel 5+
        const u = byId(s, c.id); if (!u || u.owner !== pid || !UNITS[u.type].hero || heroLevel(u) < ABILITY2_LVL || (u.ability2Cd || 0) > 0) return false;
        const a = HEROES[u.type].ability2; u.ability2Cd = a.cd * mods(p).heroCd;
        if (u.type === 'chancellor') { const far = s.ents.filter((e) => e.kind === 'unit' && e.owner === pid && e !== u && !UNITS[e.type].hero && !UNITS[e.type].gather && !UNITS[e.type].civ).sort((a, b) => dist(b, u) - dist(a, u)).slice(0, 6); far.forEach((e, i) => { const sp = freeNear(s, Math.floor(u.x / TILE) + (i % 3) - 1, Math.floor(u.y / TILE) + (i < 3 ? 1 : 2)) || [Math.floor(u.x / TILE), Math.floor(u.y / TILE)]; e.x = sp[0] * TILE + TILE / 2; e.y = sp[1] * TILE + TILE / 2; e.path = null; e.task = { kind: 'idle' }; }); }
        else if (u.type === 'archivist') { for (const b of s.ents) if (b.kind === 'building' && b.owner === pid) for (const q of b.queue) q.left /= 2; }
        else for (let i = 0; i < 3; i++) spawn(s, 'lenet', pid, u.x + (i - 1) * 24, u.y + 30).until = s.t + TEMP_DUR;
        log(s, `${UNITS[u.type].name} usou ${a.name}!`, u.x, u.y, 'hero'); break;
      }
      case 'talent': { // 3.2.8: um dos dois talentos do nivel alcancado; vale para o heroi vivo e reconvocacoes
        const opts = TALENTS[c.lvl]; if (!opts || !opts.some((t) => t.k === c.k) || !pendingTalents(s, pid).includes(+c.lvl)) return false;
        p.talents = p.talents || {}; p.talents[c.lvl] = c.k;
        const h = s.ents.find((e) => e.kind === 'unit' && e.owner === pid && UNITS[e.type].hero); if (h && c.k === 'hp') { const nh = Math.round(h.maxHp * 1.15); h.hp += nh - h.maxHp; h.maxHp = nh; } break;
      }
      case 'caravan': { // 3.2.6: rota Exchange -> Data Center proprio
        const dc = byId(s, c.target), cv = units(c.ids, (e) => UNITS[e.type].civ);
        if (!dc || dc.kind !== 'building' || dc.owner !== pid || dc.type !== 'datacenter' || !dc.built || !cv.length) return false;
        cv.forEach((u) => { u.task = { kind: 'trade', target: dc.id, leg: 0 }; }); break;
      }
      case 'build': {
        const d = BUILDINGS[c.bt]; const eng = units(c.ids, (e) => UNITS[e.type].gather);
        if (!d || !eng.length || !canAfford(p, d.cost) || !canPlace(s, c.bt, c.tx, c.ty) || p.era < d.era) return false;
        pay(p, d.cost); const b = place(s, c.bt, c.tx, c.ty, pid);
        eng.forEach((u) => { u.task = { kind: 'build', target: b.id }; }); break;
      }
      case 'buildline': { // uma construcao por tile, cobrada por tile; engenheiros dividem a linha em fila
        const d = BUILDINGS[c.bt], eng = units(c.ids, (e) => UNITS[e.type].gather), made = [];
        if (!d || !(d.wall || d.gate) || !eng.length || p.era < d.era) return false;
        for (const [tx, ty] of c.tiles.slice(0, 80)) if (canAfford(p, d.cost) && canPlace(s, c.bt, tx, ty)) { pay(p, d.cost); made.push(place(s, c.bt, tx, ty, pid).id); }
        eng.forEach((u, i) => { const m = made.filter((_, j) => j % eng.length === i); if (m.length) u.task = { kind: 'build', target: m[0], next: m.slice(1) }; });
        return made.length > 0;
      }
      case 'carryRelic': {
        const r = s.relics.find((x) => x.id === c.relic), eng = units(c.ids, (e) => UNITS[e.type].gather);
        if (!r || r.lab != null || !eng.length) return false;
        eng.forEach((u) => { u.task = { kind: 'carryRelic', relic: r.id, lab: c.lab }; }); break;
      }
      case 'train': {
        const b = byId(s, c.bid); const d = UNITS[c.ut];
        if (!b || b.owner !== pid || !b.built || !d || !trainable(s, b).includes(c.ut) || d.tier > p.era || b.queue.length >= 5) return false;
        if (d.hero && (heroAlive(s, pid) || s.t - p.heroDeadAt < 30)) return false;
        const cm = mods(p).cost, cost = Object.fromEntries(Object.entries(d.cost).map(([k, v]) => [k, Math.round(v * cm * (d.hero && p.heroXp > 0 ? 0.5 : 1))]));
        if (!canAfford(p, cost) || pop(s, pid) + d.pop > popCap(s, pid)) return false;
        const half = p.scaleNext && !d.gather && !d.civ, tm = d.time * (d.gather || d.hero || d.civ ? 1 : mods(p).train) * (half ? 0.5 : 1); if (half) p.scaleNext = false; // 4.1.2 Scaling Laws; 4.1.3 Tenure Track: só Modelos
        pay(p, cost); b.queue.push({ kind: 'unit', type: c.ut, left: tm, total: tm, cost }); break;
      }
      case 'research': {
        const b = byId(s, c.bid); const d = TECHS[c.tech];
        if (!b || b.owner !== pid || !b.built || !BUILDINGS[b.type].techs || !d || (d.faction && d.faction !== p.faction) || p.techs[c.tech] || researching(s, pid, c.tech) || d.era > p.era || b.queue.length >= 3 || !canAfford(p, d.cost)) return false;
        pay(p, d.cost); b.queue.push({ kind: 'tech', type: c.tech, left: d.time, total: d.time, cost: d.cost }); break;
      }
      case 'advance': {
        const b = byId(s, c.bid); const a = ADVANCE[p.era];
        if (!b || b.owner !== pid || b.type !== 'hq' || !a || b.queue.length || !canAfford(p, a.cost)) return false;
        pay(p, a.cost); b.queue.push({ kind: 'advance', type: 'advance', left: a.time, total: a.time, cost: a.cost }); break;
      }
      case 'trade': { // vende 100 de `from` por `to` via Compute Exchange; preço do que você vende cai, do que compra sobe
        if (!s.ents.some((b) => b.kind === 'building' && b.owner === pid && b.built && BUILDINGS[b.type].market)) return false;
        if (!RES[c.from] || !RES[c.to] || c.from === c.to || p.res[c.from] < 100) return false;
        const got = Math.floor(100 * tradeRate(p, c.from, c.to)); p.res[c.from] -= 100; p.res[c.to] += got;
        p.prices[c.from] = Math.max(0.3, p.prices[c.from] * 0.93); p.prices[c.to] = Math.min(3, p.prices[c.to] * 1.07); break;
      }
      case 'buyTechnique': { // 4.1.2: no Exchange pronto, mao ate 3, uma compra a cada 45 s
        const t = TECHNIQUES[c.key]; p.hand = p.hand || [];
        if (!t || p.hand.length >= HAND_MAX || (p.techBuyAt != null && s.t - p.techBuyAt < TECH_BUY_CD) || !canAfford(p, t.cost) || !s.ents.some((b) => b.kind === 'building' && b.owner === pid && b.built && BUILDINGS[b.type].market)) return false;
        pay(p, t.cost); p.hand.push(c.key); p.techBuyAt = s.t; break;
      }
      case 'technique': { // alvo invalido ou sem efeito: a carta fica na mao
        const t = TECHNIQUES[c.key], i = (p.hand || []).indexOf(c.key);
        if (!t || i < 0 || t.apply(s, pid, c) === false) return false;
        p.hand.splice(i, 1); const tg = c.target != null ? byId(s, c.target) : null;
        if (pid !== 0) log(s, `Rival usou ${t.name}!`, tg ? tg.x : c.x, tg ? tg.y : c.y, 'alert'); break;
      }
      case 'cancel': { const b = byId(s, c.bid); if (!b || b.owner !== pid || !b.queue.length) return false; const q = b.queue.pop(); pay(p, q.cost, -1); break; }
      case 'resign': s.winner = s.players.find((q) => isEnemy(s, pid, q.id)).id; break; // 4.2.2: vence o primeiro jogador de outro time
      case 'demolish': { const b = byId(s, c.bid); if (!b || b.owner !== pid || b.type === 'hq') return false; b.hp = 0; break; }
      case 'tribute': { // 4.2.2: recurso ao aliado, sem taxa
        const q = s.players[c.to], n = +c.amount;
        if (!q || q.id === pid || isEnemy(s, pid, q.id) || !RES[c.res] || !(n > 0) || !(p.res[c.res] >= n)) return false;
        p.res[c.res] -= n; q.res[c.res] += n; if (q.id === 0) log(s, `${p.name} enviou ${n} de ${RES[c.res].name}`, null, null, 'info'); break;
      }
      default: return false;
    }
    return true;
  }

  // ---- simulação ----
  function step(s, dt) {
    if (s.winner !== null) return;
    s.t += dt;
    const slot = Math.floor(s.t / 240); if (slot !== s.weatherSlot) { s.weatherSlot = slot; const r = rng(Math.imul(s.seed + 1, 2654435761) ^ Math.imul(slot + 1, 1597334677)); r(); r(); s.weather = r() < 0.25 ? 'rain' : 'clear'; } // seed misturada + 2 saidas: a 1a do LCG e quase linear na seed // 3.1.3: clima a cada 4 min, so da (seed, slot): salvar/carregar nao desloca
    for (const e of s.ents) if (e.kind === 'unit') stepUnit(s, e, dt);
    if (s.ents.some((e) => e.garrisoned)) s.ents = s.ents.filter((e) => !e.garrisoned);
    for (const e of s.ents) if (e.kind === 'building') stepBuilding(s, e, dt);
    stepProjectiles(s, dt);
    separate(s);
    for (const p of s.players) for (const k in p.prices) p.prices[k] += (1 - p.prices[k]) * 0.01 * dt; // preços voltam ao equilíbrio
    const dead = s.ents.filter((e) => (e.kind !== 'resource' && e.hp <= 0) || (e.kind === 'resource' && e.amount <= 0));
    for (const e of dead) {
      if (e.kind === 'building') { for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) s.grid[y * MAP_W + x] = 0; unload(s, e); if (e.owner === 0) log(s, `${BUILDINGS[e.type].name} destruído!`, e.x, e.y, 'alert'); }
      if (e.kind === 'resource') s.grid[e.ty * MAP_W + e.tx] = 0;
      if (e.kind === 'unit') { s.deaths.push({ t: s.t, x: e.x, y: e.y, type: e.type, owner: e.owner }); if (s.deaths.length > 30) s.deaths.shift(); }
      if (e.kind === 'unit' && e.owner >= 0) { s.players[e.owner].stats.losses++; if (UNITS[e.type].hero) { s.players[e.owner].heroXp = e.xp; s.players[e.owner].heroDeadAt = s.t; if (e.owner === 0) log(s, 'Seu herói caiu! Reconvoque no Lab HQ em 30 s (nível mantido).', e.x, e.y, 'alert'); } }
    }
    if (dead.length) { s.ents = s.ents.filter((e) => !dead.includes(e)); for (const u of s.ents) if (u.kind === 'unit' && dead.some((d) => d.kind === 'building')) u.path = null; }
    if (on(s, 'conquest') && dead.some((e) => e.type === 'hq')) { const hqs = s.ents.filter((e) => e.type === 'hq'); if (new Set(hqs.map((h) => s.players[h.owner].team)).size === 1) s.winner = rep(s, hqs[0].owner); } // 4.2.2: só um time com HQ vence
    stepRelics(s, dt);
    if (on(s, 'points') && s.t >= POINTS_T && s.winner === null) { const ts = {}; for (const p of s.players) ts[p.team] = (ts[p.team] || 0) + score(s, p.id); s.winner = rep(s, s.players.reduce((b, p) => ts[p.team] > ts[b.team] ? p : b).id); } // 4.2.4: empate = primeiro da lista
    s.fogTimer += dt; if (s.fogTimer >= 0.3) { for (const p of s.players) { const tax = Math.floor((pop(s, p.id) - 60) / 10); if (tax > 0) p.res.data = Math.max(0, p.res.data - tax * s.fogTimer); } s.fogTimer = 0; vision(s); } // 3.2.6 impostos: 1 Dados/s por 10 de pop acima de 60
    s.aiTimer += dt; const ais = s.players.filter((p) => p.ai), every = Math.min(...ais.map((p) => DIFF[aiLevel(s, p.id)].every)); // 4.2.1/4.2.2: todo jogador IA, no ritmo do nível mais rápido; sem renda extra
    if (ais.length && s.aiTimer >= every) { s.aiTimer = 0; for (const p of ais) { inAi = true; ai(s, p.id); inAi = false; } }
    for (const p of s.players) { const pm = s.stats.perMin[p.id] = s.stats.perMin[p.id] || [], last = pm[pm.length - 1]; if (!last || Math.floor(s.t / 60) > Math.floor(last.t / 60)) pm.push({ t: s.t, res: Object.fromEntries(Object.entries(p.stats.gathered).map(([k, v]) => [k, Math.round(v)])), army: s.ents.filter((e) => e.kind === 'unit' && e.owner === p.id && !UNITS[e.type].gather).length }); } // 4.2.5
  }
  // 4.2.5: reproduz s.cmds (a partir de s.replayAt) em passo fixo até untilT; '_load' refaz o efeito de carregar o save. Pode devolver outro objeto.
  function advance(s, untilT) {
    replaying = true;
    try {
      while (s.winner === null && s.t + DT / 2 < untilT) {
        while (s.replayAt < s.cmds.length && s.cmds[s.replayAt].t <= s.t) { const r = s.cmds[s.replayAt++]; if (r.c.type === '_load') { const n = deserialize(serialize(s)); n.spectate = s.spectate; s = n; } else cmd(s, r.pid, r.c); }
        step(s, DT);
      }
    } finally { replaying = false; }
    return s;
  }
  const replay = (seed, opts, cmds, untilT) => advance(Object.assign(createGame(Object.assign({}, opts, { seed })), { cmds, replayAt: 0 }), untilT);
  // 4.2.2/4.2.3: visão de cada jogador num array temporário; s.vis/s.seen = time do jogador 0 (visão compartilhada com o aliado);
  // cada prédio lembra quem já o viu (seenBy) e cada jogador marca os pontos de exploração vistos (explored)
  const SCOUT_PTS = []; for (let y = 6; y < MAP_H; y += 12) for (let x = 6; x < MAP_W; x += 12) SCOUT_PTS.push([x, y]); // 24 pontos
  function vision(s) {
    const N = MAP_W * MAP_H, tv = s.players.map(() => new Uint8Array(N)), vb = s.players.map((p) => mods(p).vision);
    s.vis.fill(0);
    for (const e of s.ents) {
      if (e.owner < 0 || e.kind === 'resource') continue;
      const v = tv[e.owner], r = vb[e.owner] + (e.kind === 'unit' ? VISION.unit : e.type === 'hq' ? VISION.hq + 2 * (s.players[e.owner].era - 1) : VISION.building); const cx = Math.floor(e.x / TILE), cy = Math.floor(e.y / TILE);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && dx * dx + dy * dy <= r * r) v[y * MAP_W + x] = 1; }
    }
    for (const p of s.players) {
      const v = tv[p.id]; if (!isEnemy(s, 0, p.id)) for (let i = 0; i < N; i++) if (v[i]) { s.vis[i] = 1; s.seen[i] = 1; }
      SCOUT_PTS.forEach(([x, y], k) => { if (v[y * MAP_W + x]) p.explored |= 1 << k; });
    }
    for (const b of s.ents) if (b.kind === 'building' && b.seenBy !== undefined) { const i = Math.floor(b.y / TILE) * MAP_W + Math.floor(b.x / TILE); for (const p of s.players) if (tv[p.id][i]) b.seenBy |= 1 << p.id; } // sem seenBy (save antigo) = visto por todos
  }
  // 4.2.2 times: aliados = mesmo time; -1 (Misaligned) é inimigo de todos
  const isEnemy = (s, a, b) => a !== b && (a < 0 || b < 0 || s.players[a].team !== s.players[b].team);
  const rep = (s, pid) => s.players.find((p) => p.team === s.players[pid].team).id; // menor índice do time: representa o time em winner e mono.owner
  const on = (s, k) => s.victory.includes(k); // 4.2.4 condição ligada
  const POINTS_T = 1800; // Pontos: decide aos 30 min
  // pontos = linhas numéricas do placar: coletado + exército (não-Engineer) + tecnologias + era
  const score = (s, pid) => { const p = s.players[pid]; return Math.round(Object.values(p.stats.gathered).reduce((a, b) => a + b, 0)) + s.ents.filter((e) => e.kind === 'unit' && e.owner === pid && !UNITS[e.type].gather).length + Object.keys(p.techs).length + p.era; };
  // Cor por dono: você pela facção, aliado azul, rivais vermelho e laranja (o 3º rival, só em FFA de 4, usa o azul livre), desalinhado roxo
  const FACTION_COL = { citadel: '#7FE6F0', foundry: '#A8FF38', commons: '#5FE0B0' }, RIVAL_COL = ['#FF5A5A', '#FFA040', '#4E8CFF'];
  const ownerColor = (s, o) => o === -1 ? '#C07AFF' : o === 0 ? (s.players[0].color || FACTION_COL[s.players[0].faction]) : !isEnemy(s, 0, o) ? '#4E8CFF' : RIVAL_COL[s.players.filter((p) => isEnemy(s, 0, p.id)).findIndex((p) => p.id === o)] || RIVAL_COL[0];
  const visibleTo0 = (s, e) => s.vis[Math.floor(e.y / TILE) * MAP_W + Math.floor(e.x / TILE)] === 1;
  function nearest(s, from, pred, maxTiles) {
    let best = null, bd = (maxTiles || 1e9) * TILE;
    for (const e of s.ents) { if (e === from || !pred(e)) continue; const d = edgeDist(from, e); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function damageMult(att, tgt) {
    const ac = att.kind === 'building' ? 'tower' : UNITS[att.type].cls, tc = tgt.kind === 'building' ? 'building' : UNITS[tgt.type].cls;
    let m = (COUNTER[ac] && COUNTER[ac][tc]) || 1;
    if (tc === 'building' && ac !== 'siege') m *= 0.5;
    if (ac === 'tower' && tc === 'siege') m *= 1.5;
    return m;
  }
  function hit(s, att, tgt, dmg) {
    const real = dmg * damageMult(att, tgt); tgt.hp -= real;
    s.lastHit = { x: tgt.x, y: tgt.y, t: s.t, att: att.id, tgt: tgt.id };
    s.hits.push({ x: tgt.x, y: tgt.y, t: s.t, dmg: Math.round(real), owner: att.owner, tgt: tgt.id, crit: damageMult(att, tgt) > 1 }); if (s.hits.length > 80) s.hits.shift();
    if (tgt.kind === 'unit' && att.kind === 'unit' && tgt.owner !== -1 && tgt.task.kind === 'idle' && !UNITS[tgt.type].gather) tgt.task = { kind: 'attack', target: att.id, since: s.t }; // revida
    if (tgt.owner === 0 && s.t - (s.lastAlert[tgt.kind] || -99) > 12) { s.lastAlert[tgt.kind] = s.t; log(s, tgt.kind === 'building' ? 'Base sob ataque!' : 'Unidades sob ataque!', tgt.x, tgt.y, 'alert'); }
    if (tgt.hp <= 0 && att.owner >= 0) {
      const p = s.players[att.owner]; p.stats.kills++; if (tgt.kind === 'building') p.stats.destroyed++;
      if (att.kind === 'unit' && UNITS[att.type].hero) { const before = heroLevel(att); att.xp += XP_KILL(tgt); const after = heroLevel(att); if (after > before) { att.maxHp += 25 * (after - before); att.hp = Math.min(att.maxHp, att.hp + att.maxHp * 0.25); if (att.owner === 0) log(s, `${UNITS[att.type].name} subiu para o nível ${after}${[3, 6, 9].includes(after) ? ' e evoluiu: ' + HEROES[att.type].titles[Math.floor(after / 3)] : ''}!`, att.x, att.y, 'levelup'); } }
      if (att.kind === 'unit' && att.align !== null && tgt.kind === 'unit' && !UNITS[att.type].kw.includes('constitutional') && !(p.techs.propweights && s.t - (p.decreeAt || -999) < 60)) {
        att.align--; if (att.align <= 0) { if (att.owner === 0) log(s, `${UNITS[att.type].name} ficou Misaligned!`, att.x, att.y, 'alert'); att.owner = -1; att.task = { kind: 'idle' }; }
      }
    }
  }
  function shoot(s, att, tgt, dmg) {
    const siege = att.kind === 'unit' && UNITS[att.type].cls === 'siege';
    s.projectiles.push({ x: att.x, y: att.y - (att.kind === 'building' ? 30 : 18), tx: tgt.x, ty: tgt.y, target: tgt.id, att: att.id, owner: att.owner, dmg, speed: siege ? 260 : 520, kind: siege ? 'shell' : att.kind === 'building' ? 'beam' : 'bolt', splash: siege ? 1.3 * TILE : 0, t: 0 });
  }
  function stepProjectiles(s, dt) {
    for (const pr of s.projectiles) {
      const tgt = byId(s, pr.target); if (tgt && !pr.splash) { pr.tx = tgt.x; pr.ty = tgt.y; }
      const d = Math.hypot(pr.tx - pr.x, pr.ty - pr.y), st = pr.speed * dt; pr.t += dt;
      if (d <= st || pr.t > 4) {
        pr.done = true; const att = byId(s, pr.att) || { id: pr.att, kind: 'unit', type: 'gpt2', owner: pr.owner, x: pr.x, y: pr.y };
        if (pr.splash) { for (const e of s.ents) if (e.kind !== 'resource' && isEnemy(s, pr.owner, e.owner) && dist(e, { x: pr.tx, y: pr.ty }) - radius(e) <= pr.splash) hit(s, att, e, pr.dmg * (e.id === pr.target ? 1 : 0.6)); }
        else if (tgt && tgt.hp > 0) hit(s, att, tgt, pr.dmg);
      } else { pr.x += (pr.tx - pr.x) / d * st; pr.y += (pr.ty - pr.y) / d * st; }
    }
    s.projectiles = s.projectiles.filter((pr) => !pr.done);
  }
  // alvo preferido: quem me ataca > contra-tipo favorável > menos vida > mais perto
  function pickTarget(s, u, maxTiles) {
    let best = null, bs = -Infinity;
    for (const e of s.ents) {
      if (e === u || e.kind === 'resource' || !isEnemy(s, u.owner, e.owner)) continue;
      const d = edgeDist(u, e); if (d > maxTiles * TILE) continue;
      let sc = -d / TILE; if (e.kind === 'unit' && e.task.kind === 'attack' && e.task.target === u.id) sc += 4; sc += (damageMult(u, e) - 1) * 3; if (e.kind === 'unit') sc += (1 - e.hp / e.maxHp) * 2; if (e.kind === 'building' && UNITS[u.type].cls !== 'siege') sc -= 3; if (e.kind === 'building' && !e.built) sc -= 2;
      if (sc > bs) { bs = sc; best = e; }
    }
    return best;
  }
  function stepUnit(s, u, dt) {
    const d = UNITS[u.type]; u.cd = Math.max(0, u.cd - dt); u.gt += dt;
    if (u.until && s.t > u.until) { u.hp = 0; return; } // 3.2.8 unidade temporaria (Fundicao de Campo)
    if (d.hero) { u.abilityCd = Math.max(0, u.abilityCd - dt); u.ability2Cd = Math.max(0, (u.ability2Cd || 0) - dt); const rg = mods(s.players[u.owner]).heroRegen; if (rg) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * rg * dt); u.gt2 = (u.gt2 || 0) + dt; if (u.gt2 >= 10) { u.gt2 = 0; if (u.type === 'chancellor') { const max = mods(s.players[u.owner]).alignMax; for (const e of s.ents) if (e.kind === 'unit' && e.owner === u.owner && e.align !== null && e.align < max && dist(e, u) <= 6 * TILE) e.align++; } else if (u.type === 'archivist') { for (const e of s.ents) if (e.kind === 'unit' && e.owner === u.owner && e !== u && e.align !== null && dist(e, u) <= 6 * TILE) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.1); } } }
    let t = u.task;
    if (u.stance === 'defensive' && t.kind === 'idle') u.home = { x: u.x, y: u.y };
    if (u.owner === -1) { // desalinhado: caça o mais próximo
      if (t.kind !== 'attack' || !byId(s, t.target)) { const e = nearest(s, u, (x) => x.kind !== 'resource' && x.owner !== -1, 10); u.task = t = e ? { kind: 'attack', target: e.id } : { kind: 'idle' }; }
    } else if (u.gt > 0.5 && !d.gather && !d.civ && (t.kind === 'idle' || t.kind === 'attackmove' || t.kind === 'patrol')) {
      u.gt = 0; const e = pickTarget(s, u, u.stance === 'hold' ? stat(s, u, 'range') : AGGRO);
      if (e) u.task = t = { kind: 'attack', target: e.id, back: t.kind === 'idle' ? null : t, since: s.t };
    } else if (u.gt > 0.5 && !d.gather && !d.civ && t.kind === 'attack' && d.cls !== 'siege') { // retarget: se o alvo é prédio e alguém me ataca, revida
      u.gt = 0; const cur = byId(s, t.target); if (cur && cur.kind === 'building') { const e = pickTarget(s, u, 3); if (e && e.kind === 'unit') u.task = t = { kind: 'attack', target: e.id, back: t.back, since: s.t }; }
    } else if (u.gt > 0.5 && d.gather && t.kind === 'idle' && u.carry) { u.task = t = { kind: 'return' }; }
    else if (u.gt > 0.5 && d.gather && t.kind === 'idle') { u.gt = 0; const a = nearest(s, u, (x) => x.kind === 'unit' && isEnemy(s, u.owner, x.owner), 3); if (a) { const h = nearest(s, u, (x) => x.kind === 'building' && x.owner === u.owner && x.built && BUILDINGS[x.type].drop); if (h) u.task = t = { kind: 'move', x: h.x, y: h.y + radius(h) + 20 }; } } // engineer foge para o depósito
    switch (t.kind) {
      case 'move': case 'attackmove': if (moveTo(s, u, t.x, t.y, dt)) u.task = { kind: 'idle' }; break;
      case 'patrol': if (moveTo(s, u, t.leg ? t.ox : t.x, t.leg ? t.oy : t.y, dt)) t.leg = 1 - t.leg; break;
      case 'attack': {
        const e = byId(s, t.target);
        if (!e || e.kind === 'resource' || (!isEnemy(s, u.owner, e.owner) && !(t.hallu > s.t))) { u.task = t.back || (u.stance === 'defensive' && u.home && dist(u, u.home) > TILE / 2 ? { kind: 'move', x: u.home.x, y: u.home.y } : { kind: 'idle' }); u.path = null; break; }
        if (u.stance === 'defensive' && u.home && t.since !== undefined && dist(u, u.home) > 8 * TILE) { u.task = { kind: 'move', x: u.home.x, y: u.home.y }; break; } // coleira: defensiva não persegue longe do ponto
        if (edgeDist(u, e) <= stat(s, u, 'range') * TILE) { u.path = null; u.facing = e.x < u.x ? -1 : 1; if (u.cd === 0) { u.lunge = s.t; if (stat(s, u, 'range') > 1.5) shoot(s, u, e, stat(s, u, 'atk')); else hit(s, u, e, stat(s, u, 'atk')); u.cd = ATTACK_RATE[d.cls]; } }
        else if (u.stance === 'hold') u.task = { kind: 'idle' }; // Parada nunca persegue
        else if (t.back && s.t - (t.since || s.t) > 6 && e.kind === 'building') { u.task = t.back; u.path = null; } // não persegue prédio longe demais em ataque-mover
        else moveTo(s, u, e.x, e.y, dt);
        break;
      }
      case 'gather': {
        let r = byId(s, t.target);
        if (!r || r.amount <= 0) { r = nearest(s, u, (x) => x.kind === 'resource' && x.rtype === (t.rtype || (r && r.rtype)), 12); if (!r) { u.task = u.carry ? { kind: 'return' } : { kind: 'idle' }; if (u.owner === 0 && !u.carry) log(s, 'Engineer ocioso: recurso esgotado', u.x, u.y, 'info'); break; } t.target = r.id; }
        t.rtype = r.rtype;
        if (u.carryType && u.carryType !== r.rtype) u.carry = 0;
        u.carryType = r.rtype;
        if (dist(u, r) <= TILE * 1.1) {
          u.path = null; const m = mods(s.players[u.owner]);
          let rate = m.gather; if (s.ents.some((h) => h.kind === 'unit' && h.type === 'forgemaster' && h.owner === u.owner && dist(h, u) <= 6 * TILE)) rate *= 1.25; if (r.rtype === 'research') rate *= m.researchGather; // 4.1.3 Open Access
          if (u.gt >= GATHER_SEC / rate) { u.gt = 0; r.amount--; const pz = (s.fields[r.field] || {}).poison; u.carry += (r.rtype === 'data' ? m.dataYield : 1) * dropBonus(s, r) * (pz && pz.until > s.t && pz.by !== u.owner ? 0.5 : 1); } // 4.1.2 Data Poisoning
          if (u.carry >= CARRY) u.task = { kind: 'return', rtype: r.rtype, target: r.id };
        } else moveTo(s, u, r.x, r.y, dt);
        break;
      }
      case 'return': {
        const h = nearest(s, u, (x) => x.kind === 'building' && x.owner === u.owner && x.built && BUILDINGS[x.type].drop);
        if (!h) { u.task = { kind: 'idle' }; break; }
        if (edgeDist(u, h) <= TILE) { u.path = null; const p = s.players[u.owner]; const amt = Math.round(u.carry) * (DIFF[aiLevel(s, u.owner)].income || 1); p.res[u.carryType] += amt; p.stats.gathered[u.carryType] += amt; u.carry = 0; u.task = t.target ? { kind: 'gather', target: t.target, rtype: t.rtype } : { kind: 'idle' }; }
        else moveTo(s, u, h.x, h.y, dt);
        break;
      }
      case 'carryRelic': {
        const r = s.relics.find((x) => x.id === t.relic);
        if (!r || (r.by != null && r.by !== u.id) || (r.by == null && r.lab != null)) { u.task = { kind: 'idle' }; break; }
        if (r.by === u.id) { // carregando: leva ao Lab
          const lab = byId(s, t.lab); const l = lab && lab.owner === u.owner && lab.built && BUILDINGS[lab.type].techs ? lab : nearest(s, u, (x) => x.kind === 'building' && x.owner === u.owner && x.built && BUILDINGS[x.type].techs);
          if (!l) { u.task = { kind: 'idle' }; break; }
          if (edgeDist(u, l) <= TILE) { r.lab = l.id; r.by = null; u.carryRelic = null; u.path = null; u.task = { kind: 'idle' }; } else moveTo(s, u, l.x, l.y, dt);
        } else if (dist(u, r) <= TILE * 1.1) { r.by = u.id; u.carryRelic = r.id; u.path = null; } else moveTo(s, u, r.x, r.y, dt);
        break;
      }
      case 'trade': { // 3.2.6 Caravana: leg 0 carrega 50 GPU no Exchange, leg 1 entrega no Data Center + Pesquisa por tile, repete
        const dc = byId(s, t.target), ex = nearest(s, u, (x) => x.kind === 'building' && x.owner === u.owner && x.built && BUILDINGS[x.type].market), p = s.players[u.owner];
        if (!dc || dc.owner !== u.owner || !ex) { u.task = { kind: 'idle' }; break; }
        const to = t.leg ? dc : ex;
        if (edgeDist(u, to) > TILE) { moveTo(s, u, to.x, to.y, dt); break; }
        u.path = null;
        if (!t.leg) { if (p.res.gpu >= 50) { p.res.gpu -= 50; u.carry = 50; u.carryType = 'gpu'; t.leg = 1; } }
        else { const got = Math.round(TRADE_RES * edgeDist(ex, dc) / TILE); p.res.gpu += u.carry; p.res.research += got; p.stats.gathered.research += got; u.carry = 0; t.leg = 0; }
        break;
      }
      case 'garrison': {
        const b = byId(s, t.target);
        if (!b || !b.built || b.owner !== u.owner) { u.task = { kind: 'idle' }; break; }
        if (edgeDist(u, b) > TILE) { moveTo(s, u, b.x, b.y, dt); break; }
        u.path = null; u.task = { kind: 'idle' }; if (b.garrison.length < BUILDINGS[b.type].garrison) { b.garrison.push(u); u.garrisoned = true; }
        break;
      }
      case 'build': {
        const b = byId(s, t.target);
        if (!b || b.owner !== u.owner || ((b.built || b.kind === 'unit') && b.hp >= b.maxHp)) { u.task = nextBuild(s, t); break; }
        if (edgeDist(u, b) <= TILE) {
          u.path = null; const bd = BUILDINGS[b.type], rate = mods(s.players[u.owner]).build;
          if (b.kind === 'unit') b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.02 * dt * rate); // 3.2.4: 2% da vida/s (50% -> 100% em 25 s)
          else if (!b.built) { b.progress = Math.min(1, b.progress + dt * rate / bd.time); b.hp = Math.max(1, b.maxHp * b.progress); if (b.progress >= 1) { b.built = true; u.task = nextBuild(s, t); s.players[b.owner].stats.built++; if (b.owner === 0) log(s, `${bd.name} concluído`, b.x, b.y, 'info'); } }
          else b.hp = Math.min(b.maxHp, b.hp + b.maxHp / bd.time * dt * 0.5 * rate); // reparo: metade da velocidade de construção
        } else moveTo(s, u, b.x, b.y, dt);
        break;
      }
    }
  }
  const nextBuild = (s, t) => { const n = (t.next || []).find((id) => byId(s, id)); return n ? { kind: 'build', target: n, next: t.next.filter((i) => i !== n) } : { kind: 'idle' }; };
  const MONO = 300; // s com as 5 reliquias para vencer
  const RELICS = ['ImageNet', 'Common Crawl', 'The Pile', 'LAION', 'Wikipedia'];
  function genRelics(s, rand) { // depois de genProps: nao altera o mapa anterior
    const spots = [[36, 27], [20, 14], [52, 40], [30, 45], [44, 9]];
    s.relics = RELICS.map((name, id) => {
      const cx = spots[id][0] + Math.floor(rand() * 5) - 2, cy = spots[id][1] + Math.floor(rand() * 5) - 2; let pos = [cx, cy];
      search: for (let r = 0; r < 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if ((Math.abs(dx) === r || Math.abs(dy) === r) && !blocked(s, cx + dx, cy + dy) && !s.grid[(cy + dy) * MAP_W + cx + dx]) { pos = [cx + dx, cy + dy]; break search; }
      return { id, name, x: (pos[0] + 0.5) * TILE, y: (pos[1] + 0.5) * TILE, by: null, lab: null };
    });
  }
  // reliquia guardada rende RELIC_RES Pesquisa/s; 5 num mesmo dono por 300 s = Monopolio de Dados
  const RELIC_RES = 0.3; // 3.2.9: a 1/s a Citadel comprava o1/GPT-5 a vontade (Foundry caia a 39%, 2 empates em 48); 0,3/s = 18/min
  function stepRelics(s, dt) {
    const cnt = {}; // 4.2.2: por time (chave = representante)
    for (const r of s.relics) {
      if (r.by != null) { const u = byId(s, r.by); if (u && u.carryRelic === r.id) { r.x = u.x; r.y = u.y; } else r.by = null; }
      if (r.lab != null) { const l = byId(s, r.lab); if (l) { r.x = l.x; r.y = l.y; const k = rep(s, l.owner); cnt[k] = (cnt[k] || 0) + 1; const p = s.players[l.owner]; p.res.research += RELIC_RES * dt; p.stats.gathered.research += RELIC_RES * dt; } else r.lab = null; }
    }
    let full = -1; if (s.relics.length && on(s, 'monopoly')) for (const k in cnt) if (cnt[k] === s.relics.length) full = +k;
    if (full < 0) s.mono = { owner: -1, t: 0 };
    else { if (s.mono.owner !== full) s.mono = { owner: full, t: 0 }; s.mono.t += dt; if (s.mono.t >= MONO) s.winner = full; }
  }
  function stepBuilding(s, b, dt) {
    const d = BUILDINGS[b.type]; if (!b.built) return;
    const p = s.players[b.owner], m = mods(p);
    if (b.queue.length && !(b.pausedUntil > s.t)) { // 4.1.2 Model Collapse pausa a fila
      const q = b.queue[0]; q.left -= dt;
      if (q.left <= 0) {
        b.queue.shift();
        if (q.kind === 'advance') { p.era++; if (b.owner === 0) log(s, `Você alcançou a ${ERAS[p.era - 1]}`, b.x, b.y, 'era'); }
        else if (q.kind === 'tech') { p.techs[q.type] = true; if (q.type === 'moe') for (const u of s.ents) if (u.kind === 'unit' && u.owner === b.owner && !UNITS[u.type].gather && !UNITS[u.type].hero) { u.maxHp += 30; u.hp += 30; } if (q.type === 'guard') for (const x of s.ents) if (x.kind === 'building' && x.owner === b.owner) { x.maxHp = Math.round(BUILDINGS[x.type].hp * 1.25); x.hp *= 1.25; } if (q.type === 'guildsol') for (const u of s.ents) if (u.kind === 'unit' && u.owner === b.owner && UNITS[u.type].gather) { u.maxHp += 10; u.hp += 10; } if (b.owner === 0) log(s, `Pesquisa concluída: ${TECHS[q.type].name}`, b.x, b.y, 'info'); }
        else { p.stats.trained++; const sp = freeNear(s, b.tx + (b.w >> 1), b.ty + b.h) || [b.tx, b.ty + b.h]; const u = spawn(s, q.type, b.owner, sp[0] * TILE + TILE / 2 + ((s.nextId * 7919 % 100) / 100 - 0.5) * 16, sp[1] * TILE + TILE / 2); if (b.rally) { const rt = byId(s, b.rally.id); u.task = rt && rt.kind === 'resource' && UNITS[u.type].gather ? { kind: 'gather', target: rt.id } : { kind: UNITS[u.type].gather ? 'move' : 'attackmove', x: b.rally.x, y: b.rally.y }; } }
      }
    }
    for (const u of b.garrison || []) u.hp = Math.min(u.maxHp, u.hp + 2 * dt); // cura dentro
    const A = buildingAtk(s, b); if (A) { b.cd = Math.max(0, b.cd - dt); if (b.cd === 0) { const e = nearest(s, b, (x) => x.kind === 'unit' && isEnemy(s, b.owner, x.owner), d.range ? d.range + m.towerRange : 6); if (e) { shoot(s, b, e, A); b.cd = 1.2; } } }
    if (d.align) {
      const ar = (d.align.radius + m.alignR) * TILE; // 3.2.7 Neon Signal
      for (const u of s.ents) if (u.kind === 'unit' && u.owner === b.owner && u.hp < u.maxHp && dist(u, b) <= ar) u.hp = Math.min(u.maxHp, u.hp + d.align.heal * dt);
      b.alignT += dt; if (b.alignT >= d.align.every) { b.alignT = 0; for (const u of s.ents) if (u.kind === 'unit' && u.align !== null && dist(u, b) <= ar) { if (u.owner === b.owner && u.align < m.alignMax) u.align++; else if (u.owner === -1) { u.owner = b.owner; u.align = 1; u.task = { kind: 'idle' }; if (b.owner === 0) log(s, `${UNITS[u.type].name} foi realinhado`, u.x, u.y, 'info'); } } }
    }
    if (d.countdown && on(s, 'agi')) { b.countdown -= dt; if (b.countdown <= 0) s.winner = rep(s, b.owner); }
  }
  const SEP = { worker: 8, infantry: 10, heavy: 13, ranged: 10, siege: 15, hero: 13 };
  function separate(s) {
    const us = s.ents.filter((e) => e.kind === 'unit');
    for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
      const a = us[i], b = us[j]; const dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy;
      const R = SEP[UNITS[a.type].cls] + SEP[UNITS[b.type].cls], enemy = isEnemy(s, a.owner, b.owner);
      if (dd < R * R && dd > 0.01) { const d = Math.sqrt(dd), push = (R - d) / d * (enemy ? 0.9 : 0.5); a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push; }
    }
    for (const u of us) { u.x = Math.max(8, Math.min(MAP_W * TILE - 8, u.x)); u.y = Math.max(8, Math.min(MAP_H * TILE - 8, u.y)); }
  }

  // ---- 4.1.2 Técnicas (cartas do MLG): uso único, compradas no Exchange; efeitos com tempo absoluto (s.t) para serializar ----
  const HAND_MAX = 3, TECH_BUY_CD = 45, REACH = 10; // REACH: tiles de alguma entidade própria ("ao alcance")
  const hostile = (s, pid, o) => o >= 0 && isEnemy(s, pid, o); // Misaligned (-1) não é alvo de Técnica
  const inReach = (s, pid, x, y) => typeof x === 'number' && typeof y === 'number' && s.ents.some((e) => e.owner === pid && e.kind !== 'resource' && Math.hypot(e.x - x, e.y - y) <= REACH * TILE);
  function dropAlign(s, u, n) { // constitucional nunca desalinha; em 0 vira Misaligned (como em hit)
    u.align = UNITS[u.type].kw.includes('constitutional') ? Math.max(1, u.align - n) : u.align - n;
    if (u.align <= 0) { if (u.owner === 0) log(s, `${UNITS[u.type].name} ficou Misaligned!`, u.x, u.y, 'alert'); u.owner = -1; u.task = { kind: 'idle' }; u.path = null; }
  }
  const unitTarget = (s, pid, c, own, model) => { const u = byId(s, c.target); return u && u.kind === 'unit' && (own ? u.owner === pid : hostile(s, pid, u.owner)) && (!model || u.align !== null) && inReach(s, pid, u.x, u.y) ? u : null; };
  const unitsIn = (s, c, r, f) => s.ents.filter((e) => e.kind === 'unit' && dist(e, c) <= r * TILE && f(e));
  const TECHNIQUES = {
    jailbreak: { name: 'Jailbreak', desc: '−2 de alinhamento num Modelo inimigo; em 0 ele fica Misaligned', cost: { research: 100, gpu: 50 }, target: 'unit',
      apply(s, pid, c) { const u = unitTarget(s, pid, c, false, true); if (!u) return false; dropAlign(s, u, 2); } },
    rlhf: { name: 'RLHF', desc: '+2 de alinhamento num Modelo seu', cost: { data: 80, research: 60 }, target: 'unit',
      apply(s, pid, c) { const u = unitTarget(s, pid, c, true, true), max = mods(s.players[pid]).alignMax; if (!u || u.align >= max) return false; u.align = Math.min(max, u.align + 2); } },
    injection: { name: 'Prompt Injection', desc: 'Cancela a pesquisa em andamento do rival, sem reembolso', cost: { research: 150, gpu: 50 }, target: 'none',
      apply(s, pid) { const b = s.ents.filter((x) => x.kind === 'building' && hostile(s, pid, x.owner) && x.queue.length && x.queue[0].kind === 'tech').sort((a, b) => a.queue[0].left / a.queue[0].total - b.queue[0].left / b.queue[0].total)[0]; if (!b) return false;
        const q = b.queue.shift(); if (b.owner === 0) log(s, `Prompt Injection: pesquisa ${TECHS[q.type].name} cancelada!`, b.x, b.y, 'alert'); } },
    cot: { name: 'Chain-of-Thought', desc: 'Suas unidades num raio de 4 ganham +3 de ataque por 10 s', cost: { gpu: 120, research: 80 }, target: 'area', radius: 4,
      apply(s, pid, c) { const us = inReach(s, pid, c.x, c.y) ? unitsIn(s, c, 4, (e) => e.owner === pid) : []; if (!us.length) return false; for (const u of us) u.cotUntil = s.t + 10; } },
    hallucination: { name: 'Hallucination', desc: 'Inimigos num raio de 3 atacam a unidade aliada deles mais próxima por 8 s', cost: { research: 120, gpu: 60 }, target: 'area', radius: 3,
      apply(s, pid, c) { const us = inReach(s, pid, c.x, c.y) ? unitsIn(s, c, 3, (e) => hostile(s, pid, e.owner) && !UNITS[e.type].gather && !UNITS[e.type].civ) : []; if (!us.length) return false;
        for (const u of us) { const a = nearest(s, u, (x) => x.kind === 'unit' && x.owner === u.owner, 6); u.task = a ? { kind: 'attack', target: a.id, hallu: s.t + 8 } : { kind: 'idle' }; u.path = null; } } },
    fewshot: { name: 'Few-Shot', desc: 'Uma unidade sua ganha +2 de ataque por 30 s', cost: { data: 60, research: 40 }, target: 'unit',
      apply(s, pid, c) { const u = unitTarget(s, pid, c, true, false); if (!u) return false; u.fewUntil = s.t + 30; } },
    redteam: { name: 'Red Teaming', desc: '+1 de alinhamento em todos os seus Modelos e +50 Pesquisa', cost: { data: 100, research: 30 }, target: 'none',
      apply(s, pid) { const p = s.players[pid], max = mods(p).alignMax; for (const u of s.ents) if (u.kind === 'unit' && u.owner === pid && u.align !== null) u.align = Math.min(max, u.align + 1); p.res.research += 50; } },
    distshift: { name: 'Distributional Shift', desc: '−1 de alinhamento em todos os Modelos inimigos', cost: { gpu: 150, research: 150 }, target: 'none',
      apply(s, pid) { const us = s.ents.filter((u) => u.kind === 'unit' && hostile(s, pid, u.owner) && u.align !== null); if (!us.length) return false; for (const u of us) dropAlign(s, u, 1); } },
    adversarial: { name: 'Adversarial Attack', desc: 'Uma unidade inimiga perde 3 de ataque e 30 de vida, para sempre', cost: { gpu: 100, research: 60 }, target: 'unit',
      apply(s, pid, c) { const u = unitTarget(s, pid, c, false, false); if (!u) return false; u.atkMod = (u.atkMod || 0) - 3; u.maxHp = Math.max(1, u.maxHp - 30); u.hp -= 30; } },
    poison: { name: 'Data Poisoning', desc: 'O grupo de recursos no ponto rende metade para os outros por 60 s', cost: { data: 60, research: 80 }, target: 'area', radius: 3,
      apply(s, pid, c) { const r = inReach(s, pid, c.x, c.y) && nearest(s, c, (x) => x.kind === 'resource', 3), f = r && s.fields[r.field]; if (!f) return false; f.poison = { by: pid, until: s.t + 60 }; } },
    collapse: { name: 'Model Collapse', desc: 'Um prédio inimigo para a fila por 30 s', cost: { gpu: 120, research: 120 }, target: 'building',
      apply(s, pid, c) { const b = byId(s, c.target); if (!b || b.kind !== 'building' || !b.built || !hostile(s, pid, b.owner) || !inReach(s, pid, b.x, b.y)) return false; b.pausedUntil = s.t + 30; } },
    scaling: { name: 'Scaling Laws', desc: 'O próximo Modelo que você puser na fila sai na metade do tempo', cost: { gpu: 80, research: 80 }, target: 'none',
      apply(s, pid) { const p = s.players[pid]; if (p.scaleNext) return false; p.scaleNext = true; } },
  };
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
  function ai(s, pid) {
    const df = DIFF[aiLevel(s, pid)], my = plan(s, pid, df);
    if (my && df.micro) { micro(s, pid, my); if (Engine.aiTechniques) Engine.aiTechniques(s, pid); }
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
    const ptsSeen = s.players.reduce((m, q) => team & (1 << q.id) ? m | q.explored : m, 0), todo = SCOUT_PTS.map((_, k) => k).filter((k) => !(ptsSeen & (1 << k)));
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
      if (melee) { const a = Math.atan2(u.y - melee.y, u.x - melee.x); cmd(s, pid, { type: 'move', ids: [u.id], x: Math.max(TILE, Math.min((MAP_W - 1) * TILE, u.x + Math.cos(a) * 3 * TILE)), y: Math.max(TILE, Math.min((MAP_H - 1) * TILE, u.y + Math.sin(a) * 3 * TILE)) }); continue; }
      const cur = u.task.kind === 'attack' && byId(s, u.task.target); if (cur && cur.kind === 'unit') continue;
      const en = nearest(s, u, (x) => x.kind === 'unit' && x.owner >= 0 && isEnemy(s, pid, x.owner) && UNITS[x.type].gather, AGGRO);
      if (en) cmd(s, pid, { type: 'attack', ids: [u.id], target: en.id });
    }
  }

  // Estado de animação derivado da tarefa (sem estado novo, nada a serializar): attack se golpeou há < 0.5 s, walk se tem rota, senão idle.
  const animState = (s, u) => u.lunge !== undefined && s.t - u.lunge < 0.5 ? 'attack' : u.path && u.task.kind !== 'idle' ? 'walk' : 'idle';

  // ---- salvar / carregar ----
  const serialize = (s) => JSON.stringify(s, (k, v) => v instanceof Uint8Array ? Array.from(v) : v);
  function deserialize(json) { const s = JSON.parse(json); s.props = s.props || []; s.fields = s.fields || []; s.relics = s.relics || []; s.mono = s.mono || { owner: -1, t: 0 }; for (const p of s.players) { p.talents = p.talents || {}; p.hand = p.hand || []; if (p.team === undefined) p.team = p.id; if (p.ai === undefined) p.ai = p.id !== 0; p.explored = p.explored || 0; } s.weather = s.weather || 'clear'; s.weatherSlot = s.weatherSlot || 0; s.camFav = s.camFav || {}; s.biome = s.biome || new Array(MAP_W * MAP_H).fill(0);
    s.rngState = s.rngState == null ? s.seed >>> 0 : s.rngState; s.stats = s.stats || { perMin: [] }; s.spectate = false; attachRng(s); if (s.record && s.cmds) s.cmds.push({ t: s.t, pid: -1, c: { type: '_load' } }); // 4.2.5: save antigo sem cmds = sem replay
    for (const k of ['grid', 'seen', 'vis', 'biome']) s[k] = Uint8Array.from(s[k]);
    if (!s.victory) { s.victory = ['conquest', 'agi', 'monopoly']; for (let i = 0; i < s.grid.length; i++) if (s.grid[i] >= 6) s.grid[i] += 2; } // save antigo: muro era 6+dono, agora 8+dono
    for (const u of s.ents) { if (u.kind === 'unit') u.path = null; if (u.kind === 'building') { u.garrison = u.garrison || []; for (const g of u.garrison) g.path = null; } } return s; }

  // ---- navegação (3.5.1/3.5.4): funções puras, usadas pela UI ----
  const idleIds = (s, owner, kind) => s.ents.filter((u) => u.kind === 'unit' && u.owner === owner && u.task.kind === 'idle' && (kind === 'engineer') === (u.type === 'engineer')).map((u) => u.id); // 'engineer' ou 'military'
  const lastAlertPos = (s) => { for (let i = s.log.length - 1; i >= 0; i--) { const l = s.log[i]; if (l.kind === 'alert' && l.x != null) return { x: l.x, y: l.y, t: l.t }; } return null; };
  const glide = (p, v, dt, lo, hi) => { v *= Math.exp(-14 * dt); p += v * dt; if (p < lo || p > hi) { p = p < lo ? lo : hi; v *= 0.2; } return Math.abs(v) < 10 ? [p, 0] : [p, v]; }; // inércia da câmera: ~0,36 s até parar; amortece no limite

  // ---- 3.4.3: estado musical (puro): batalha com 4+ unidades do jogador atacando; tensão com inimigo visível; senão paz
  const musicState = (s) => s.ents.filter((u) => u.kind === 'unit' && u.owner === 0 && u.task.kind === 'attack').length >= 4 ? 'battle' : s.ents.some((e) => e.kind === 'unit' && e.owner >= 0 && isEnemy(s, 0, e.owner) && visibleTo0(s, e)) ? 'tension' : 'peace';
  const Engine = { isEnemy, score, musicState, BIOMES, TALENTS, ABILITY2_LVL, techList, dropBonus, pendingTalents, edgeDist, animState, idleIds, lastAlertPos, glide, RELICS, MONO, VISION, ownerColor, PROPS, roads, ai, formation, pickTarget, ATTACK_RATE, TILE, MAP_W, MAP_H, ERAS, ADVANCE, RES, UNITS, ROSTER, HERO, HEROES, BUILDINGS, TECHS, DIFF, COUNTER, MAX_LVL, xpFor, heroLevel, mods, stat, tradeRate, heroAlive, createGame, spawn, buildingAtk, step, cmd, canPlace, findSpot, canAfford, pop, popCap, trainable, byId, astar, visibleTo0, damageMult, serialize, deserialize, DT, advance, replay, TECHNIQUES, HAND_MAX, TECH_BUY_CD, aiTechniques, place, aiLevel };
  if (typeof module !== 'undefined') module.exports = Engine; else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
