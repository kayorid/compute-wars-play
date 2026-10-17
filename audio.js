// Compute Wars — som: sintetizador (Audio), amostras/ambiente/música/vozes (Sound) e Voice. Carregado por index.html depois dos globais (cam, cv, S).
// ---- som procedural ----
const Audio = (() => {
  let ac = null, master = null, muted = false, vol = 0.7, busNow = 'ui', hoverT = -1e9;
  const post = {}, bus = {}, busVol = { ui: 1, world: 0.6, alert: 0.85, music: 0.5 }; // 3.4.2: barramentos -> EQ -> master -> compressor -> limitador. 5.4.1: Mundo -4,4 dB, alertas -1,4 dB, música -4 dB (medido: Mundo 4-6 LU e música 8-12 LU abaixo das falas)
  try { muted = localStorage.getItem('cw_mute') === '1'; vol = +(localStorage.getItem('cw_vol') || 0.7); Object.assign(busVol, JSON.parse(localStorage.getItem('cw_bus') || '{}')); } catch (e) {}
  // 5.4.1 EQ por barramento [tipo, Hz, dB, Q] (motivos em docs/specs/_completed/onda-5/2026-10-17-audio/design.md); limitador no fim do master
  const EQ = { ui: [['highpass', 180, 0, 0.7], ['highshelf', 8000, -2]], world: [['highpass', 45, 0, 0.7], ['peaking', 350, -3, 1]], alert: [['highpass', 120, 0, 0.7], ['peaking', 2500, 3, 1]], music: [['highpass', 40, 0, 0.7], ['peaking', 2500, -4, 0.8], ['highshelf', 7000, -3]] };
  const LIM_TRIM = 0.82; /* -1,7 dB depois do limitador: anula a compensação automática do compressor do Chromium ((1 - 1/20) * 3 dB * 0,6), abaixo do limiar o limitador fica transparente */
  let dest = null, endT = 0, limiter = null, trim = null;
  const ctxOk = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)();
        limiter = ac.createDynamicsCompressor(); limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.1; trim = ac.createGain(); trim.gain.value = LIM_TRIM; limiter.connect(trim).connect(ac.destination);
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(limiter); master = ac.createGain(); master.gain.value = muted ? 0 : vol; master.connect(comp);
        for (const k in busVol) { bus[k] = ac.createGain(); bus[k].gain.value = busVol[k]; let n = bus[k]; for (const [type, f, db, q] of EQ[k]) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.gain.value = db; if (q) b.Q.value = q; n = n.connect(b); } post[k] = n; n.connect(master); } } catch (e) { return false; } } if (ac.state === 'suspended') ac.resume(); return true; };
  const out = (o) => dest || bus[o.bus || busNow]; /* 5.4.3: dest = nó da voz em curso */
  const panOf = (x) => x == null ? 0 : Math.max(-0.8, Math.min(0.8, (x - cam.x - cv.width / 2) / (cv.width / 2)));
  const gainOf = (x, y) => { if (x == null) return 1; const dx = x - cam.x - cv.width / 2, dy = y - cam.y - cv.height / 2; const d = Math.hypot(dx, dy) / Math.max(cv.width, 900); return Math.max(0.12, 1 - d * 0.9); };
  function tone(o) { if (!ctxOk()) return; const t = ac.currentTime + (o.delay || 0); const osc = ac.createOscillator(), g = ac.createGain(), p = ac.createStereoPanner(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur); const v = (o.vol || 0.1) * gainOf(o.x, o.y); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.a || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur); p.pan.value = panOf(o.x); let node = osc; if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; } node.connect(g).connect(p).connect(out(o)); osc.start(t); osc.stop(t + o.dur + 0.05); endT = Math.max(endT, t + o.dur); }
  function noise(o) { if (!ctxOk()) return; const t = ac.currentTime + (o.delay || 0); const len = Math.floor(ac.sampleRate * o.dur); const buf = ac.createBuffer(1, len, ac.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); const src = ac.createBufferSource(); src.buffer = buf; const f = ac.createBiquadFilter(); f.type = o.hp ? 'highpass' : o.bp ? 'bandpass' : 'lowpass'; if (o.q) f.Q.value = o.q; f.frequency.setValueAtTime(o.f || 1200, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur); const g = ac.createGain(); g.gain.value = (o.vol || 0.1) * gainOf(o.x, o.y); const p = ac.createStereoPanner(); p.pan.value = panOf(o.x); src.connect(f).connect(g).connect(p).connect(out(o)); src.start(t); endT = Math.max(endT, t + o.dur); }
  const arp = (fs, step, dur, type, vol) => fs.forEach((f, i) => tone({ f, dur, type: type || 'triangle', vol: vol || 0.08, delay: i * step, a: 0.02 }));
  const sfx = {
    click: () => tone({ f: 1400, to: 900, dur: 0.05, type: 'square', vol: 0.03 }),
    confirm: () => { tone({ f: 740, dur: 0.08, type: 'triangle', vol: 0.06 }); tone({ f: 1108, dur: 0.14, type: 'sine', vol: 0.05, delay: 0.06 }); },
    deny: () => { tone({ f: 220, to: 160, dur: 0.18, type: 'sawtooth', vol: 0.05, lp: 900 }); },
    move: (x, y) => { noise({ dur: 0.08, f: 2500, vol: 0.05, x, y }); tone({ f: 520, to: 420, dur: 0.07, type: 'triangle', vol: 0.04, x, y }); },
    attack: (x, y) => { noise({ dur: 0.12, f: 6000, hp: true, vol: 0.07, x, y }); tone({ f: 980, to: 1600, dur: 0.1, type: 'sawtooth', vol: 0.035, lp: 3000, x, y }); },
    gather: (x, y) => { tone({ f: 1800, dur: 0.05, type: 'sine', vol: 0.05, x, y }); tone({ f: 2400, dur: 0.07, type: 'sine', vol: 0.04, delay: 0.05, x, y }); },
    build: (x, y) => { noise({ dur: 0.1, f: 900, vol: 0.12, x, y }); tone({ f: 180, to: 90, dur: 0.14, type: 'square', vol: 0.06, lp: 600, x, y }); },
    deposit: (x, y) => { tone({ f: 2093, dur: 0.06, type: 'sine', vol: 0.035, x, y }); tone({ f: 2637, dur: 0.08, type: 'sine', vol: 0.03, delay: 0.04, x, y }); },
    hitMelee: (x, y) => { noise({ dur: 0.07, f: 1800, to: 300, vol: 0.14, x, y }); tone({ f: 260, to: 120, dur: 0.08, type: 'square', vol: 0.05, lp: 700, x, y }); },
    hitRanged: (x, y) => { tone({ f: 1900, to: 300, dur: 0.14, type: 'sawtooth', vol: 0.05, lp: 2500, x, y }); noise({ dur: 0.05, f: 5000, hp: true, vol: 0.04, x, y }); },
    hitSiege: (x, y) => { noise({ dur: 0.5, f: 700, to: 80, vol: 0.35, x, y }); tone({ f: 70, to: 35, dur: 0.5, type: 'sine', vol: 0.3, x, y }); },
    trained: () => { arp([659, 988], 0.09, 0.16, 'triangle', 0.06); },
    research: () => { arp([523, 659, 784, 1046], 0.07, 0.3, 'sine', 0.06); },
    built: () => { noise({ dur: 0.12, f: 1200, vol: 0.08 }); arp([392, 523], 0.1, 0.25, 'triangle', 0.06); },
    alert: () => { for (let i = 0; i < 2; i++) { tone({ f: 196, dur: 0.35, type: 'sawtooth', vol: 0.09, lp: 1200, delay: i * 0.45 }); tone({ f: 247, dur: 0.35, type: 'sawtooth', vol: 0.06, lp: 1200, delay: i * 0.45 }); } },
    era: () => { arp([262, 330, 392, 523, 659, 784], 0.11, 0.9, 'triangle', 0.08); tone({ f: 131, dur: 1.6, type: 'sine', vol: 0.12, delay: 0.3 }); noise({ dur: 1.2, f: 3000, to: 200, vol: 0.05, delay: 0.5 }); },
    ability: (x, y) => { tone({ f: 200, to: 1600, dur: 0.5, type: 'sawtooth', vol: 0.08, lp: 2800, x, y }); noise({ dur: 0.6, f: 400, to: 4000, vol: 0.1, x, y }); arp([880, 1108, 1318], 0.08, 0.4, 'sine', 0.06); },
    levelup: () => { arp([523, 659, 784, 1046, 1318], 0.06, 0.5, 'sine', 0.07); tone({ f: 2093, dur: 0.8, type: 'sine', vol: 0.04, delay: 0.3 }); },
    death: (x, y, big) => { noise({ dur: big ? 0.7 : 0.35, f: 2000, to: 150, vol: big ? 0.2 : 0.1, x, y }); tone({ f: big ? 160 : 300, to: 50, dur: big ? 0.6 : 0.3, type: 'sawtooth', vol: 0.05, lp: 500, x, y }); },
    misaligned: (x, y) => { for (let i = 0; i < 4; i++) tone({ f: 600 + i * 90, to: 300, dur: 0.1, type: 'square', vol: 0.05, delay: i * 0.07, x, y }); },
    victory: () => { arp([392, 523, 659, 784, 1046], 0.14, 1.2, 'triangle', 0.1); tone({ f: 196, dur: 2.5, type: 'sine', vol: 0.12, delay: 0.5 }); },
    defeat: () => { arp([392, 349, 311, 262], 0.35, 1.4, 'sawtooth', 0.06); tone({ f: 65, dur: 3, type: 'sine', vol: 0.12 }); },
    pause: () => tone({ f: 440, to: 330, dur: 0.12, type: 'triangle', vol: 0.05 }),
    open: () => { tone({ f: 98, to: 196, dur: 1.6, type: 'sine', vol: 0.12 }); noise({ dur: 1.4, f: 300, to: 3500, vol: 0.05 }); arp([392, 523, 659, 784], 0.2, 0.9, 'triangle', 0.06); },
    // 4.4.3 foley de interface: pico somado <= 0,0316 (-30 dBFS) no bus ui
    openCat: () => { tone({ f: 660, to: 880, dur: 0.06, type: 'triangle', vol: 0.38 }); tone({ f: 1320, dur: 0.07, type: 'sine', vol: 0.29, delay: 0.035 }); },
    back: () => tone({ f: 880, to: 520, dur: 0.08, type: 'triangle', vol: 0.53 }),
    buy: () => { tone({ f: 2093, dur: 0.05, type: 'sine', vol: 0.34 }); tone({ f: 2637, dur: 0.14, type: 'sine', vol: 0.34, delay: 0.05 }); noise({ dur: 0.04, f: 7000, hp: true, vol: 0.19 }); },
    error: () => { tone({ f: 185, dur: 0.09, type: 'square', vol: 0.48, lp: 900 }); tone({ f: 175, dur: 0.12, type: 'square', vol: 0.48, lp: 900, delay: 0.11 }); },
    openTree: () => { noise({ dur: 0.3, f: 300, to: 2400, vol: 0.49 }); tone({ f: 392, to: 784, dur: 0.25, type: 'sine', vol: 0.38 }); },
    hover: () => { const t = performance.now(); if (t - hoverT < 60) return; hoverT = t; tone({ f: 2400, dur: 0.025, type: 'sine', vol: 0.04 }); },
  };
  function setBus(k, v) { busVol[k] = v; if (bus[k]) bus[k].gain.value = v; try { localStorage.setItem('cw_bus', JSON.stringify(busVol)); } catch (e) {} }
  function duck() { if (!bus.music) return; const g = bus.music.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(busVol.music * 0.5, t, 0.03); g.setTargetAtTime(busVol.music, t + 1.5, 0.3); } // -6 dB na música enquanto o alerta soa
  function setMute(m) { muted = m; if (master) master.gain.value = muted ? 0 : vol; try { localStorage.setItem('cw_mute', m ? '1' : '0'); } catch (e) {} }
  function setVol(v) { vol = v; if (master && !muted) master.gain.value = v; try { localStorage.setItem('cw_vol', v); } catch (e) {} }
  return { sfx, tone, noise, ambient: (f) => Sound.start(f), stopAmbient: () => Sound.stop(), setMute, setVol, setBus, duck, gainOf, panOf, bus, busVol, get muted() { return muted; }, get vol() { return vol; }, get ctx() { return ac; }, set busNow(b) { busNow = b; }, get dest() { return dest; }, set dest(d) { dest = d; endT = 0; }, get endT() { return endT; }, get limiter() { return limiter; }, get out() { return trim; }, get master() { return master; }, post, unlock: ctxOk };
})();
const SFX = Audio.sfx;

// ---- 3.4: amostras reais, ambiente espacial, música adaptativa e vozes (sintetizador acima é o fallback) ----
const Sound = (() => {
  const N = { click: 3, confirm: 3, deny: 3, move: 3, attack: 3, gather: 3, build: 3, deposit: 3, hitMelee: 3, hitRanged: 3, hitSiege: 3, trained: 3, research: 3, built: 3, alert: 3, era: 3, ability: 3, levelup: 3, death: 3, misaligned: 3, victory: 2, defeat: 3, pause: 2, open: 3 };
  const GAIN = { ability: 0.38, alert: 0.41, attack: 0.39, build: 2.54, built: 1.58, click: 1.1, confirm: 0.48, death: 0.77, defeat: 0.43, deny: 1.07, deposit: 2.66, era: 0.35, gather: 1.12, hitMelee: 0.67, hitRanged: 0.36, hitSiege: 0.65, levelup: 0.53, misaligned: 1.95, move: 7.83, open: 0.45, pause: 0.71, research: 0.49, trained: 0.51, victory: 0.46 }; // 4.4: -20 LUFS efetivos (tools/audio-loudness.py); pico x ganho <= 1
  const BUS = (k) => /^(alert|victory|defeat|misaligned)$/.test(k) ? 'alert' : /^(move|attack|gather|build|deposit|hit|death|ability)/.test(k) ? 'world' : 'ui';
  const bufs = {}, last = {}; let loading = false;
  const decode = async (url) => { try { const r = await fetch(url); if (!r.ok) return null; return await Audio.ctx.decodeAudioData(await r.arrayBuffer()); } catch (e) { return null; } };
  function load() { if (loading || !Audio.ctx) return; loading = true; for (const ev in N) Promise.all(Array.from({ length: N[ev] }, (_, i) => decode(`assets/sfx/${ev}_${i + 1}.ogg`))).then((bs) => { bs = bs.filter(Boolean); if (bs.length) bufs[ev] = bs; }); }
  const pick = (prev, n, r) => { if (n < 2) return 0; let i = Math.floor(r * (n - 1)); if (i >= prev) i++; return i; }; // nunca repete a anterior
  function play(ev, x, y, rate) { const b = bufs[ev]; if (!b) return false; const ac = Audio.ctx, i = pick(last[ev], b.length, Math.random()); last[ev] = i; const src = ac.createBufferSource(); src.buffer = b[i]; src.playbackRate.value = (rate || 1) * (0.94 + Math.random() * 0.12); const g = ac.createGain(); g.gain.value = GAIN[ev] * Audio.gainOf(x, y); const p = ac.createStereoPanner(); p.pan.value = Audio.panOf(x); src.connect(g).connect(p).connect(Audio.dest || Audio.bus[BUS(ev)]); src.start(); sampEnd = ac.currentTime + b[i].duration / src.playbackRate.value; return true; }

  // 5.4.3 silêncio inteligente: no máx. 12 vozes no Mundo; alerta 3 > herói 2 > combate 1 > coleta 0; quem chega rouba a menor (a mais antiga entre iguais)
  const PRIO = { alert: 3, misaligned: 3, ability: 2, attack: 1, hitMelee: 1, hitRanged: 1, hitSiege: 1, death: 1, gather: 0, deposit: 0, build: 0, move: 0 }, CAP = 12;
  const steal = (vs, p, cap) => { if (vs.length < cap) return -1; let w = 0; for (let i = 1; i < vs.length; i++) if (vs[i].p < vs[w].p || (vs[i].p === vs[w].p && vs[i].t < vs[w].t)) w = i; return vs[w].p > p ? null : w; };
  const voices = []; let stolen = 0, dropped = 0, sampEnd = 0;
  function voice(k) { const ac = Audio.ctx, now = ac.currentTime; for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= now) { voices[i].g.disconnect(); voices.splice(i, 1); }
    const w = steal(voices, PRIO[k], CAP); if (w === null) { dropped++; return null; }
    if (w >= 0) { const v = voices.splice(w, 1)[0]; v.g.gain.setTargetAtTime(0, now, 0.008); setTimeout(() => v.g.disconnect(), 200); stolen++; } /* rampa de ~40 ms: sem estalo */
    const g = ac.createGain(); g.connect(Audio.bus[BUS(k)]); const v = { p: PRIO[k], t: now, end: now + 0.5, g, k }; voices.push(v); return v; }

  // 5.4.2 material do prédio atingido (facção do dono): Citadel vidro/latão, Foundry ferro/vapor, Commons madeira/papel; altura e duração variam por golpe
  const MAT = {
    citadel: (x, y, r, d) => { [2610, 4330, 6120].forEach((f, i) => Audio.tone({ f: f * r, dur: 0.25 * d / (i + 1), type: 'sine', vol: 0.14 / (i + 1), a: 0.002, x, y })); Audio.tone({ f: 620 * r, to: 600 * r, dur: 0.4 * d, type: 'triangle', vol: 0.16, a: 0.004, lp: 2500, x, y }); },
    foundry: (x, y, r, d) => { [190, 524, 1026].forEach((f, i) => Audio.tone({ f: f * r, dur: 0.35 * d / (i + 1), type: 'square', vol: 0.22 / (i + 1), a: 0.002, lp: 1800, x, y })); Audio.noise({ dur: 0.45 * d, f: 3500 * r, hp: true, vol: 0.03, delay: 0.04, x, y }); },
    commons: (x, y, r, d) => { Audio.tone({ f: 210 * r, to: 140 * r, dur: 0.09 * d, type: 'sine', vol: 0.33, a: 0.002, x, y }); Audio.noise({ dur: 0.06 * d, f: 900 * r, bp: true, q: 2, vol: 0.53, x, y }); Audio.noise({ dur: 0.14 * d, f: 3200 * r, bp: true, q: 1.5, vol: 0.36, delay: 0.02, x, y }); },
  };
  const matAt = (x, y) => { if (!S || x == null) return null; const T = E.TILE; const b = S.ents.find((e) => e.kind === 'building' && x >= e.tx * T && x < (e.tx + e.w) * T && y >= e.ty * T && y < (e.ty + e.h) * T); const p = b && S.players[b.owner]; return p && MAT[p.faction] ? p.faction : null; };
  function material(k, x, y, f, r = 0.9 + Math.random() * 0.2, d = 0.9 + Math.random() * 0.2) { if (!/^hit/.test(k) || !(f = f || matAt(x, y))) return null; MAT[f](x, y, r, d); return f; } /* r, d: altura e duração; o roteiro de medição fixa os extremos */

  for (const k in SFX) { const synth = SFX[k]; SFX[k] = (...a) => { if (!Audio.unlock()) return; if (BUS(k) === 'alert') Audio.duck(); if (k === 'victory' || k === 'defeat') { const n = stops; setTimeout(() => { if (n === stops && !music && S && S.winner !== null) start(k); }, 2500); } /* tema depois do efeito, só se ninguém parou a música no meio (ex.: voltou ao título) */ if (k === 'levelup') Voice.say(myHero(), 'level');
      const v = PRIO[k] != null ? voice(k) : null; if (PRIO[k] != null && !v) return; Audio.dest = v && v.g; sampEnd = 0;
      if (!play(k, a[0], a[1], k === 'death' && a[2] ? 0.7 : 1)) { Audio.busNow = BUS(k); synth(...a); Audio.busNow = 'ui'; }
      if (v) { v.mat = material(k, a[0], a[1]); v.end = Math.max(Audio.endT, sampEnd, v.t + 0.05); } Audio.dest = null; }; }
  const unlock0 = Audio.unlock; Audio.unlock = () => { const ok = unlock0(); if (ok) load(); return ok; };
  const myHero = () => S && S.ents.find((e) => e.kind === 'unit' && e.owner === 0 && E.UNITS[e.type].hero);
  const noiseBuf = (sec) => { const ac = Audio.ctx, len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return b; };

  // 3.4.5 ambiente espacial: um loop por tipo de fonte; volume pela fonte mais próxima do centro da câmera, pan pelo x
  const SRC = { lake: (e) => e.kind === 'resource' && e.rtype === 'data', rack: (e) => e.kind === 'building' && e.type === 'rack' && e.built, furnace: (e) => e.kind === 'unit' && e.type === 'furnace' };
  const LVL = { lake: 0.35, rack: 0.25, furnace: 0.4 }, RANGE = 520;
  let amb = null;
  function mkLoop(k, g) { const ac = Audio.ctx, n = ac.createBufferSource(); n.buffer = noiseBuf(3); n.loop = true; const f = ac.createBiquadFilter(), l = ac.createOscillator(), lg = ac.createGain();
    if (k === 'lake') { f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 3; l.frequency.value = 2.7; lg.gain.value = 350; l.connect(lg).connect(f.frequency); n.connect(f).connect(g); n.start(); l.start(); return [n, l]; }
    if (k === 'rack') { const o = ac.createOscillator(), o2 = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60; o2.type = 'sine'; o2.frequency.value = 120; f.type = 'lowpass'; f.frequency.value = 420; o.connect(f); o2.connect(f); f.connect(g); const nf = ac.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 5000; const ng = ac.createGain(); ng.gain.value = 0.08; n.connect(nf).connect(ng).connect(g); o.start(); o2.start(); n.start(); return [o, o2, n]; }
    f.type = 'lowpass'; f.frequency.value = 180; l.frequency.value = 0.5; lg.gain.value = 60; l.connect(lg).connect(f.frequency); n.connect(f).connect(g); n.start(); l.start(); return [n, l]; }
  function startAmb() { const ac = Audio.ctx; amb = {}; for (const k in SRC) { const g = ac.createGain(); g.gain.value = 0; const p = ac.createStereoPanner(); g.connect(p).connect(Audio.bus.world); amb[k] = { g, p, nodes: mkLoop(k, g), vol: 0, pan: 0 }; } }
  function spatial(s) { if (!amb) return; const cx = cam.x + vw() / 2, cy = cam.y + (44 + viewH() / 2) / zoom, t = Audio.ctx.currentTime; for (const k in SRC) { let bd = RANGE, bx = cx; for (const e of s.ents) if (SRC[k](e)) { const d = Math.hypot(e.x - cx, e.y - cy); if (d < bd) { bd = d; bx = e.x; } } const a = amb[k]; a.vol = (1 - bd / RANGE) * LVL[k]; a.pan = Math.max(-0.9, Math.min(0.9, (bx - cx) / (vw() / 2))); a.g.gain.setTargetAtTime(a.vol, t, 0.15); a.p.pan.setTargetAtTime(a.pan, t, 0.15); } }

  // 3.4.3 música procedural: 3 camadas (base, tensão, batalha) na mesma tonalidade/BPM, crossfade por estado com histerese de 5 s na descida
  const KEY = { citadel: { root: 57, bpm: 84, prog: [[0, 3, 7], [-4, 0, 3], [5, 8, 12], [-2, 2, 5], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]] }, foundry: { root: 50, bpm: 100, prog: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7], [-5, -1, 2], [-4, 0, 3], [-2, 2, 5]] }, commons: { root: 55, bpm: 92, prog: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [2, 5, 9], [0, 4, 7], [-5, -1, 2], [5, 9, 12], [-3, 0, 4]] }, // 4.1.3: Commons em modo maior, andamento de biblioteca
    // 4.4.2 temas: mix fixo = fora da partida (sem estados nem ambiente); missões são adaptativas como as facções
    menu: { root: 52, bpm: 72, mix: [1, 0.7, 0], prog: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5], [0, 3, 7], [-4, 0, 3], [-5, -2, 2], [-5, -1, 2]] },
    victory: { root: 60, bpm: 96, mix: [1, 1, 0.5], prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
    defeat: { root: 45, bpm: 58, mix: [1, 0.35, 0], prog: [[0, 3, 7], [-2, 1, 5], [-4, 0, 3], [-5, -1, 2], [0, 3, 7], [-4, -1, 3], [-7, -3, 0], [-5, -1, 2]] },
    mission1: { root: 55, bpm: 90, prog: [[0, 3, 7], [3, 7, 10], [-2, 2, 5], [-4, 0, 3], [0, 3, 7], [3, 7, 10], [5, 8, 12], [-5, -1, 2]] },
    mission2: { root: 53, bpm: 108, prog: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 1, 5], [0, 3, 7], [1, 5, 8], [-4, 0, 3], [-5, -2, 2]] },
    mission3: { root: 48, bpm: 120, prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2], [0, 3, 7], [3, 7, 10], [1, 5, 8], [-1, 2, 7]] } };
  const RANK = { peace: 0, tension: 1, battle: 2 }, MIX = { peace: [1, 0, 0], tension: [1, 1, 0], battle: [0.7, 1, 1] };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let music = null, state = 'peace', pend = null, pendT = 0, tickT = 0, stops = 0;
  function note(dst, f, t, dur, type, vol, a, lp) { const ac = Audio.ctx, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); let n = o; if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); n = fl; } n.connect(g).connect(dst); o.start(t); o.stop(t + dur + 0.05); }
  function hit(dst, t, f, dur, vol) { const ac = Audio.ctx, n = ac.createBufferSource(); n.buffer = music.noise; const fl = ac.createBiquadFilter(); fl.type = f > 1000 ? 'highpass' : 'lowpass'; fl.frequency.value = f; const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); n.connect(fl).connect(g).connect(dst); n.start(t); n.stop(t + dur); }
  function schedule() { if (!music) return; const ac = Audio.ctx, k = music.key, beat = 60 / k.bpm; while (music.t < ac.currentTime + 0.5) { const b = music.beat, ch = k.prog[Math.floor(b / 4) % 8], bb = b % 4, t = music.t, [base, tens, batt] = music.layers;
      if (bb === 0) ch.forEach((o, i) => { note(base, hz(k.root + o), t, beat * 4, 'triangle', 0.09 / (i + 1), 0.6, 1200); note(base, hz(k.root + o - 12), t, beat * 4, 'sine', 0.05, 0.8); });
      for (let e = 0; e < 2; e++) note(tens, hz(k.root + 12 + ch[(b * 2 + e) % 3]), t + e * beat / 2, beat / 2, 'sine', 0.06, 0.01);
      note(batt, hz(k.root + ch[0] - 24), t, beat * 0.5, 'sawtooth', 0.12, 0.01, 500); if (bb % 2 === 0) hit(batt, t, 150, 0.25, 0.5); hit(batt, t + beat / 2, 6000, 0.06, 0.12);
      music.beat++; music.t += beat; } }
  function start(theme) { stop(); if (!Audio.unlock()) return; const ac = Audio.ctx, key = KEY[theme] || KEY.citadel; const layers = [0, 1, 2].map((i) => { const g = ac.createGain(); g.gain.value = (key.mix || MIX.peace)[i]; g.connect(Audio.bus.music); return g; }); music = { name: KEY[theme] ? theme : 'citadel', key, layers, beat: 0, t: ac.currentTime + 0.1, noise: noiseBuf(1), timer: setInterval(schedule, 200) }; state = 'peace'; pend = null; schedule(); if (!key.mix) startAmb(); }
  function stop() { stops++; if (music) { clearInterval(music.timer); const t = Audio.ctx.currentTime; music.layers.forEach((g) => { g.gain.setTargetAtTime(0, t, 0.3); setTimeout(() => g.disconnect(), 2000); }); music = null; } if (amb) { for (const k in amb) { amb[k].g.gain.setTargetAtTime(0, Audio.ctx.currentTime, 0.3); const a = amb[k]; setTimeout(() => a.nodes.forEach((n) => n.stop()), 2000); } amb = null; } }
  function setState(st) { if (!music || music.key.mix || st === state) { pend = null; return; } if (RANK[st] < RANK[state]) { if (pend !== st) { pend = st; pendT = performance.now(); return; } if (performance.now() - pendT < 5000) return; } state = st; pend = null; const t = Audio.ctx.currentTime; music.layers.forEach((g, i) => g.gain.setTargetAtTime(MIX[st][i], t, 0.7)); }
  function tick(s, dt) { watch(s); spatial(s); tickT += dt; if (tickT >= 0.25) { tickT = 0; setState(E.musicState(s)); } }

  // 3.4.4 vozes: uma de cada vez; clique repetido na mesma unidade cicla as falas; reverb curto por convolução
  const Voice = (() => { const vb = {}; let cur = null, lastId = -1, cyc = 0, verb = null; const KINDS = ['select', 'order', 'attack'];
    const get = (name) => vb[name] || (vb[name] = decode(`assets/voice/${name}.wav`));
    async function say(u, kind) { if (!u || u.kind !== 'unit' || u.owner !== 0 || !Audio.ctx) return; if (kind === 'select') { cyc = u.id === lastId ? (cyc + 1) % 3 : 0; lastId = u.id; kind = KINDS[cyc]; } const b = await get(`${S.players[0].faction}_${u.type}_${kind}`); if (!b) return; const ac = Audio.ctx; if (cur) try { cur.stop(); } catch (e) {} if (!verb) { verb = ac.createConvolver(); const ir = noiseBuf(0.3), d = ir.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] *= Math.pow(1 - i / d.length, 3); verb.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.25; verb.connect(wet).connect(Audio.bus.ui); } const src = ac.createBufferSource(); src.buffer = b; const g = ac.createGain(); g.gain.value = 0.9; src.connect(g); g.connect(Audio.bus.ui); g.connect(verb); src.start(); cur = src; }
    return { say, get playing() { return cur; }, loaded: () => Object.keys(vb).length }; })();
  // 4.4.1 narrador: uma fala por vez no bus de alertas, fila sem duplicata, mesma fala no máx. a cada 20 s (relógio real)
  const Narrator = (() => { const LINES = { start: 'Partida iniciada', attack: 'Base sob ataque', era: 'Era alcançada', research: 'Pesquisa concluída', heroDown: 'Herói caiu', relic: 'Relíquia capturada', victory: 'Vitória', defeat: 'Derrota', misaligned: 'Unidade desalinhada', heroLevel: 'Herói subiu de nível', wonderRival: 'Maravilha iniciada pelo rival', wonder: 'Maravilha iniciada', popCap: 'População no limite', depleted: 'Recursos esgotados', allyAttack: 'Aliado sob ataque' };
    const nb = {}, said = {}, q = [], GAP = 20000; let cur = null, tok = 0, lastEv = null;
    const get = (n) => nb[n] || (nb[n] = decode(`assets/voice/${n}.wav`));
    const fac = () => (S && S.players[0].faction) || 'citadel'; // cada facção tem a sua voz; fala que falte cai na da Citadel (abaixo)
    function say(ev) { if (!LINES[ev] || !Audio.unlock()) return false; const now = performance.now(); if (now - (said[ev] ?? -1e9) < GAP || q.includes(ev)) return false; said[ev] = now;
      if (ev === 'victory' || ev === 'defeat') { q.length = 0; tok++; if (cur) try { cur.stop(); } catch (e) {} cur = null; } // fim de jogo fura a fila
      q.push(ev); next(); return true; }
    async function next() { if (cur || !q.length) return; const ev = q.shift(), my = ++tok; cur = 'carregando'; let b = await get(`narr_${fac()}_${ev}`); if (!b && fac() !== 'citadel') b = await get(`narr_citadel_${ev}`); if (my !== tok) return; if (!b) { cur = null; return next(); }
      const ac = Audio.ctx, src = ac.createBufferSource(); src.buffer = b; src.connect(Audio.bus.alert); if (Voice.playing) try { Voice.playing.stop(); } catch (e) {} Audio.duck(); src.onended = () => { if (cur === src) { cur = null; next(); } }; src.start(); cur = src; lastEv = ev; }
    const reset = () => { for (const k in said) delete said[k]; q.length = 0; tok++; if (cur) try { cur.stop(); } catch (e) {} cur = null; }; // partida nova: cala a fala da anterior e zera o limite de 20 s
    return { say, reset, LINES, debug: () => ({ playing: cur && cur !== 'carregando' ? lastEv : cur, queue: q.slice(), said: Object.keys(said), loaded: Object.keys(nb).length }) }; })();

  // detecção de eventos do narrador comparando o estado entre quadros (nenhum outro módulo precisa chamar Narrator.say)
  let seenS = null, seen = new WeakSet(), labs = [], wonders = new Set(), popFull = false, won = null;
  const ally = (s, o) => o > 0 && typeof E.isEnemy === 'function' && !E.isEnemy(s, 0, o);
  const enemy = (s, o) => o !== 0 && (typeof E.isEnemy === 'function' ? E.isEnemy(s, 0, o) : true);
  const LOG = [[(l) => l.kind === 'era', 'era'], [(l) => l.kind === 'levelup', 'heroLevel'], [(l) => /^Base sob ataque/.test(l.text), 'attack'], [(l) => /herói caiu/i.test(l.text), 'heroDown'], [(l) => /Misaligned/.test(l.text), 'misaligned'], [(l) => /^Pesquisa concluída/.test(l.text), 'research'], [(l) => /recurso esgotado/.test(l.text), 'depleted']];
  function watch(s) {
    const isW = (e) => e.kind === 'building' && E.BUILDINGS[e.type].countdown, full = E.pop(s, 0) >= E.popCap(s, 0) && E.popCap(s, 0) > 0, rl = s.relics || [];
    const labOf = (r) => { const l = r.lab != null && E.byId(s, r.lab); return l && l.owner === 0 ? l.id : null; };
    if (s !== seenS) { seenS = s; seen = new WeakSet(); s.log.forEach((l) => seen.add(l)); (s.hits || []).forEach((h) => seen.add(h)); labs = rl.map(labOf); wonders = new Set(s.ents.filter(isW).map((e) => e.id)); popFull = full; won = s.winner; Narrator.reset(); if (s.t < 1) Narrator.say('start'); return; }
    for (const l of s.log) if (!seen.has(l)) { seen.add(l); const m = LOG.find(([f]) => f(l)); if (m) Narrator.say(m[1]); }
    for (const h of s.hits || []) if (!seen.has(h)) { seen.add(h); const t = E.byId(s, h.tgt); if (t && ally(s, t.owner)) Narrator.say('allyAttack'); }
    rl.forEach((r, i) => { const l = labOf(r); if (l != null && l !== labs[i]) Narrator.say('relic'); labs[i] = l; });
    for (const e of s.ents) if (isW(e) && !wonders.has(e.id)) { wonders.add(e.id); if (e.owner === 0) Narrator.say('wonder'); else if (enemy(s, e.owner)) Narrator.say('wonderRival'); }
    if (full && !popFull) Narrator.say('popCap'); popFull = full;
    if (s.winner !== null && won === null) Narrator.say(s.winner === 0 || ally(s, s.winner) ? 'victory' : 'defeat'); won = s.winner;
  }
  const debug = () => ({ world: voices.length, voiceList: voices.map((v) => [v.k, v.p, v.mat || null]), stolen, dropped, sfx: Object.keys(bufs).length, voices: Voice.loaded(), bus: Audio.busVol, musicGain: Audio.bus.music && Audio.bus.music.gain.value, state, pend, theme: music && music.name, layers: music ? music.layers.map((g) => +g.gain.value.toFixed(2)) : null, amb: amb && Object.fromEntries(Object.keys(amb).map((k) => [k, { vol: +amb[k].vol.toFixed(3), pan: +amb[k].pan.toFixed(2) }])) });
  return { start, stop, tick, setState, pick, play, steal, PRIO, CAP, material, voices, Voice, Narrator, debug, get state() { return state; } };
})();
const Voice = Sound.Voice, Narrator = Sound.Narrator;
if (typeof module !== 'undefined') module.exports = { Sound }; /* test.js: Sound.steal é pura */
