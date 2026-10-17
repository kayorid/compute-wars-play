// Onda 5 / ui: 5.3.2 comparativo de unidade (derivado de E.damageMult) e 5.1.3 tela de carregamento com dicas. Browser: window.Tips; Node: require('./tips.js').
(function (root) {
  const NODE = typeof module !== 'undefined';
  const TIPS = [
    'Infantaria vence Pesados, Pesados vencem À distância, À distância vence Infantaria. Passe o mouse num cartão de treino para ver o comparativo.',
    'Cerco demole prédios com o triplo do dano, mas sofre contra qualquer Modelo: escolte seus Rigs.',
    'Pressione ponto (.) para achar um Engineer ocioso; End seleciona todos eles de uma vez.',
    'Segure Espaço para ir ao último alerta; Backspace devolve a câmera de onde você saiu.',
    'Ctrl+1 a 9 grava um grupo; o número seleciona, e dois toques centralizam a câmera nele.',
    'Cada Server Rack dá +5 de população. Construa antes de travar a produção.',
    'Um Data Center perto dos recursos encurta as viagens dos Engineers.',
    'Engineers guarnecidos no Lab HQ fazem-no atirar: 3 de ataque por Engineer lá dentro.',
    'Todo Modelo que mata perde alinhamento. O Alignment Lab cura e realinha quem está por perto.',
    'Guarde os 5 Datasets nos seus Labs por 5 minutos para vencer por Monopólio.',
    'No Compute Exchange você troca recursos e compra Técnicas, as cartas do MLG de uso único.',
    'Pressione Y para abrir o histórico de notificações e clique num evento para ir até ele.',
    'T abre a árvore de tecnologias; segure Tab para ver o placar.',
    'N mostra o mapa inteiro; M troca o modo do minimapa entre terreno, unidades e economia.',
    'F1 seleciona o herói; Q usa a habilidade dele. Herói morto volta pela metade do preço.',
    'A Caravana leva GPU do Exchange a um Data Center seu e rende Pesquisa pela distância.',
  ];
  const CLS = ['infantry', 'heavy', 'ranged', 'siege', 'hero'];
  // causa = dano que a classe dá em B; sofre = dano que B dá nela; ganha se causa/sofre > 1. Prédio (torre) só em "ganha de": todo Modelo perde para torre.
  function matchup(E, cls) {
    if (!CLS.includes(cls)) return null;
    const rep = (c) => ({ kind: 'unit', type: Object.keys(E.UNITS).find((u) => E.UNITS[u].cls === c) }), me = rep(cls), win = [], lose = [];
    for (const c of [...CLS, 'building']) {
      const other = c === 'building' ? { kind: 'building' } : rep(c), out = E.damageMult(me, other), inc = E.damageMult(other, me);
      if (out / inc > 1) win.push({ cls: c, out, inc }); else if (out / inc < 1 && c !== 'building') lose.push({ cls: c, out, inc });
    }
    return { win, lose };
  }
  const Tips = { TIPS, matchup };
  if (NODE) { module.exports = Tips; return; }
  root.Tips = Tips;

  const name = (c) => c === 'building' ? 'Prédios' : CLSNAME[c], glyph = (c) => c === 'building' ? '▣' : GLYPH[c];
  const num = (v) => String(v).replace('.', ',');
  const why = (x) => [x.out !== 1 ? `causa ×${num(x.out)}` : '', x.inc !== 1 ? `sofre ×${num(x.inc)}` : ''].filter(Boolean).join(', ');
  Tips.matchupHtml = (cls) => { const m = matchup(Engine, cls); if (!m) return ''; const li = (l) => l.map((x) => `<span class="mu">${glyph(x.cls)} ${name(x.cls)} <i>${why(x)}</i></span>`).join('') || '<span class="mu">nenhuma classe</span>';
    return `<span class="vs win">Ganha de</span>${li(m.win)}<span class="vs lose">Perde para</span>${li(m.lose)}`; };
  Tips.hoverLine = (cls) => { const m = matchup(Engine, cls); return m ? `<br><span class="vs win">ganha</span> ${m.win.map((x) => glyph(x.cls)).join(' ') || '–'} <span class="vs lose">perde</span> ${m.lose.map((x) => glyph(x.cls)).join(' ') || '–'}` : ''; };

  document.head.insertAdjacentHTML('beforeend', `<style>
  #tip .vs, #hover .vs { font:700 10px var(--label); letter-spacing:1px; text-transform:uppercase; } #tip .vs { display:block; margin-top:5px; } .vs.win { color:var(--data); } .vs.lose { color:var(--danger); }
  #tip .mu { display:block; font:500 12px var(--mono); color:var(--ivory); } #tip .mu i { font-style:normal; color:#9aa6ba; }
  #loading { position:fixed; inset:0; z-index:30; display:flex; align-items:center; justify-content:center; background:radial-gradient(ellipse at 50% 40%, #142033, #05080c 70%); transition:opacity .4s; }
  #loading.done { opacity:0; pointer-events:none; }
  #loading .box { zoom:var(--ui); width:720px; max-width:96vw; text-align:center; }
  #loading h1 { white-space:nowrap; font:700 60px var(--display); letter-spacing:.2em; margin-bottom:4px; }
  #loading h2 { font:600 14px var(--display); letter-spacing:.4em; color:var(--own); text-shadow:0 0 12px var(--glow); margin-bottom:34px; }
  #loading .bar { height:16px; border:1px solid #000; box-shadow:0 0 0 2px var(--m2), 0 0 0 3px var(--m4), inset 0 1px 4px #000; background:linear-gradient(180deg,#000,#121a26); }
  #loading .bar i { background:linear-gradient(180deg,var(--m1),var(--m2) 55%,var(--m3)); box-shadow:0 0 10px var(--glow); transition:width .15s; }
  #loading .cnt { margin-top:10px; font:600 12px var(--label); letter-spacing:2px; text-transform:uppercase; color:#9aa6ba; }
  #loading .tipbox { margin-top:40px; min-height:92px; padding:12px 18px; background:linear-gradient(180deg,var(--enamel2),var(--enamel)); border:3px solid; border-image:var(--metal) 1; box-shadow:inset 0 0 0 1px #000, 0 10px 30px rgba(0,0,0,.8); }
  #loading .tipbox b { display:block; font:700 12px var(--display); letter-spacing:.3em; color:var(--m1); margin-bottom:6px; }
  #loading .tipbox p { font:500 17px/1.4 var(--body); color:var(--ivory); }
  </style>`);
  const el = document.createElement('div'); el.id = 'loading'; el.setAttribute('role', 'progressbar'); el.setAttribute('aria-label', 'Carregando'); el.setAttribute('aria-valuemin', 0); el.setAttribute('aria-valuemax', 100);
  el.innerHTML = '<div class="box"><h1 class="metal-text">COMPUTE WARS</h1><h2>PREPARANDO O LABORATÓRIO</h2><div class="bar"><i style="width:0%"></i></div><div class="cnt"></div><div class="tipbox"><b>DICA</b><p aria-live="polite"></p></div></div>';
  document.body.appendChild(el); const ov = document.getElementById('overlay'); if (ov) ov.inert = true; /* teclado não age no lobby escondido */
  let tipI = Math.floor(Math.random() * TIPS.length);
  const nextTip = () => { el.querySelector('p').textContent = TIPS[tipI++ % TIPS.length]; }; nextTip();
  const tipT = setInterval(nextTip, 4000);
  const poll = setInterval(() => {
    const all = Object.values(IMG), done = all.filter((i) => i.complete).length, pct = all.length ? done / all.length * 100 : 100; /* imagem com falha também fica complete */
    el.querySelector('.bar i').style.width = pct + '%'; el.querySelector('.cnt').textContent = `Arte ${done} de ${all.length}`; el.setAttribute('aria-valuenow', Math.round(pct));
    if (done < all.length) return;
    clearInterval(poll); clearInterval(tipT); el.classList.add('done'); Tips.loaded = true;
    if (ov) ov.inert = false; setTimeout(() => el.remove(), 450); /* o foco começa no documento, como antes: o 1º Tab cai na 1ª placa de facção */
  }, 100);
})(typeof window !== 'undefined' ? window : globalThis);
