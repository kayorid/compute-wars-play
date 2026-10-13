// 4.2.2 (frente mec-teams): HUD com 3-4 jogadores (rival = primeiro inimigo com HQ) e tributo ao aliado no Menu
const rivalId = () => { const en = S.players.filter((p) => E.isEnemy(S, 0, p.id)); return (en.find((p) => S.ents.some((e) => e.type === 'hq' && e.owner === p.id)) || en[0] || S.players[1]).id; };
const allyOf0 = () => S.players.find((p) => p.id !== 0 && !E.isEnemy(S, 0, p.id));
function tribute(res) {
  const a = allyOf0();
  if (a && E.cmd(S, 0, { type: 'tribute', to: a.id, res, amount: 100 })) { SFX.confirm(); toast(`Tributo enviado: 100 de ${RNAME[res]} para ${a.name}`, 'info'); }
  else { SFX.deny(); toast(a ? MSG.lack(`${Math.ceil(100 - S.players[0].res[res])} ${RNAME[res]}`) : 'Sem aliado nesta partida', 'alert'); }
}
// chamado no fim de hud(): cria o bloco uma vez no Menu e só o mostra quando há aliado
function teamsHud() {
  const m = $('menu'); if (!m) return; let el = $('tribute');
  if (!el) { m.insertAdjacentHTML('afterbegin', `<div id="tribute" style="display:contents"><div class="row">Tributo a <span id="tribname"></span></div>${Object.keys(E.RES).map((k) => `<button class="tb" onclick="tribute('${k}')">100 ${RNAME[k]} <kbd>enviar</kbd></button>`).join('')}<hr></div>`); el = $('tribute'); }
  const a = allyOf0(); el.style.display = a ? 'contents' : 'none';
  if (a) { const n = $('tribname'); if (n.textContent !== a.name) n.textContent = a.name; n.style.color = ownerCol(a.id); }
}
