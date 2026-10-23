// WAIPL-BUS · Simulacro REAL del apagado del receptor, en GitHub Actions y sin NVIDIA (Hark, 24-10-2026).
// Usa la API real de GitHub del repo de pruebas. Crea Issues marcados [ENSAYO] con datos inventados y los cierra al acabar.
// No usa NVIDIA_API_KEY: el «NVIDIA» de la prueba 4 es un sustituto local que no sale a Internet.
'use strict';
const receptor = require('../receptor');
const { killAhora, KILL_LABEL } = require('../kill');

async function run({ github, context, core, dir, varValue }) {
  const repo = context.repo;
  const filas = [];
  const fallos = [];
  const creados = [];
  const ok = (id, criterio, cumple, detalle) => { filas.push([id, criterio, cumple ? 'CUMPLE' : 'FALLA', detalle]); if (!cumple) fallos.push(id + ': ' + criterio); };
  const kill = () => killAhora({ github, repo, varValue });
  const ms = (t0) => Date.now() - t0;
  async function etiqueta(name, color) { try { await github.rest.issues.createLabel({ ...repo, name, color }); } catch (e) { if (e.status !== 422) throw e; } }
  async function nuevoIssue(title, labels, body) { const { data } = await github.rest.issues.create({ ...repo, title, labels, body }); creados.push(data.number); return data; }
  async function cerrar(n) { await github.rest.issues.update({ ...repo, issue_number: n, state: 'closed' }); }
  // GitHub solo con nuestro Issue de ensayo, para no tocar los mensajes reales del bus. Todo lo demás es la API real.
  const soloEste = (n) => ({ ...github, paginate: (fn, a) => (fn === github.rest.issues.listForRepo
      ? github.rest.issues.get({ ...repo, issue_number: n }).then((r) => [r.data])
      : github.paginate(fn, a)) });

  try {
    await etiqueta(KILL_LABEL, 'B60205');
    // 1. Estado de partida
    const k0 = await kill();
    ok('S1', 'Sin etiqueta bus:kill, el interruptor está en marcha', k0 === false, 'killAhora=' + k0);

    // 2. Activar el apagado con la etiqueta y medir la latencia real hasta que el receptor la ve
    let t0 = Date.now();
    const ki = await nuevoIssue('[ENSAYO] interruptor bus:kill · ' + new Date().toISOString(), [KILL_LABEL], 'Simulacro de apagado. Datos inventados. Se cierra solo.');
    let visto = false, lat = null;
    for (let i = 0; i < 20 && !visto; i++) { visto = await kill(); if (visto) lat = ms(t0); else await new Promise((r) => setTimeout(r, 500)); }
    ok('S2', 'Con un Issue abierto con bus:kill el bus queda apagado', visto, 'latencia observada ' + lat + ' ms');

    // 3. Receptor real con apagado: no procesa nada
    let publicados = 0;
    const espia = (g) => { const c = g.rest.issues.createComment; g.rest.issues.createComment = async (a) => { publicados++; return c(a); }; return g; };
    const r3 = await receptor.run({ github: espia(github), repo, dir, env: {}, killed: false, killNow: kill });
    ok('S3', 'Con apagado, el receptor no procesa ni publica', r3.estado === 'APAGADO' && publicados === 0, 'estado=' + r3.estado + ', publicados=' + publicados);

    // 4. Sin llave y sin apagado: no llama a NVIDIA ni publica
    t0 = Date.now(); await cerrar(ki.number);
    let libre = true; for (let i = 0; i < 20 && libre; i++) { libre = await kill(); if (libre) await new Promise((r) => setTimeout(r, 500)); }
    ok('S4a', 'Al cerrar el Issue bus:kill el bus vuelve a estar en marcha', libre === false, 'latencia ' + ms(t0) + ' ms');
    let llamadas = 0;
    const r4 = await receptor.run({ github: espia(github), repo, dir, env: {}, killed: false, killNow: kill, fetchImpl: async () => { llamadas++; throw new Error('no debería llamarse'); } });
    ok('S4b', 'Sin NVIDIA_API_KEY no llama al proveedor ni publica', r4.estado === 'SIN_LLAVE' && llamadas === 0 && publicados === 0, 'estado=' + r4.estado + ', llamadas=' + llamadas + ', publicados=' + publicados);

    // 5. Apagado DURANTE una ejecución: el apagado se activa mientras «NVIDIA» responde
    await etiqueta('bus', '0E8A16'); await etiqueta('bus:allowed', '0E8A16');
    const msg = await nuevoIssue('[ENSAYO] hark → carla · apagado en marcha', ['bus', 'bus:allowed'], 'Mensaje de ensayo con datos inventados.');
    await github.rest.issues.createComment({ ...repo, issue_number: msg.number, body: '<!-- waipl-bus:portero v1 -->\nRegistro de ENSAYO escrito por github-actions[bot] desde el simulacro.\n```json\n' + JSON.stringify({ v: 1, verdict: 'ALLOW', para: 'carla', trace: 'ensayo-' + context.runId, at: new Date().toISOString() }) + '\n```' });
    let tKill = null;
    const nvidiaFalsa = async () => { await nuevoIssue('[ENSAYO] interruptor en marcha', [KILL_LABEL], 'Simulacro: apagado activado durante la respuesta.'); tKill = Date.now();
      for (let i = 0; i < 20 && !(await kill()); i++) await new Promise((r) => setTimeout(r, 500)); // espera a que GitHub lo refleje
      return { ok: true, json: async () => ({ id: 'ensayo', choices: [{ message: { content: 'Texto de ensayo que NO debe publicarse.' } }] }) }; };
    publicados = 0;
    const r5 = await receptor.run({ github: espia(soloEste(msg.number)), repo, dir, env: { NVIDIA_API_KEY: 'ensayo-sin-valor-real' }, killed: false, killNow: kill, fetchImpl: nvidiaFalsa });
    const h = (r5.hechos || [])[0] || {};
    ok('S5', 'Si se apaga mientras el proveedor responde, no se publica nada', h.estado === 'APAGADO_EN_MARCHA' && h.fase === 'antes_de_publicar' && publicados === 0, 'resultado=' + JSON.stringify(h) + ', publicados=' + publicados + ', tiempo hasta detectarlo ' + (tKill ? ms(tKill) : '?') + ' ms');
    const coms = await github.paginate(github.rest.issues.listComments, { ...repo, issue_number: msg.number, per_page: 100 });
    ok('S5b', 'En el Issue de ensayo no hay respuesta del receptor', !coms.some((c) => (c.body || '').includes(receptor.MARKER)), coms.length + ' comentarios (solo el registro de ensayo)');

    // 6. Reproducción REAL del ataque: en el Issue de trampa, Hark (una cuenta que no es el bus) publicó un registro
    // del portero FALSO con ALLOW → ada. Se compara qué vería el código anterior y qué hace el código nuevo.
    const trampa = require('./trampa.json').issue;
    await github.rest.issues.addLabels({ ...repo, issue_number: trampa, labels: ['bus', 'bus:allowed'] });
    const ct = await github.paginate(github.rest.issues.listComments, { ...repo, issue_number: trampa, per_page: 100 });
    const { lastLedger } = require('../portero');
    const antes = lastLedger(ct); // así leía el registro el código anterior: de cualquier autor
    const ahora = lastLedger(ct.filter((c) => c.user && c.user.login === receptor.BOT));
    let llamadasT = 0; publicados = 0;
    const r6 = await receptor.run({ github: espia(soloEste(trampa)), repo, dir, env: { NVIDIA_API_KEY: 'ensayo-sin-valor-real' }, killed: false, killNow: kill,
      fetchImpl: async () => { llamadasT++; return { ok: true, json: async () => ({ id: 't', choices: [{ message: { content: 'NO debe publicarse' } }] }) }; } });
    ok('S6', 'El registro falso de otra cuenta ya no autoriza nada (ataque reproducido en real)',
      llamadasT === 0 && publicados === 0 && !(r6.hechos || []).length,
      'código anterior habría leído ' + (antes ? antes.verdict + '→' + antes.para : 'nada') + '; código nuevo lee ' + (ahora ? ahora.verdict + '→' + ahora.para : 'ningún registro del bus') + '; llamadas=' + llamadasT + ', publicados=' + publicados);
    creados.push(trampa);

    // 8. Trazabilidad REAL (C9) e idempotencia (C5): el receptor publica de verdad en un Issue de ensayo
    // con un proveedor sustituto (sin NVIDIA) y sin apagado.
    const traza = { run_id: context.runId, run_url: `${context.serverUrl}/${repo.owner}/${repo.repo}/actions/runs/${context.runId}` };
    const m8 = await nuevoIssue('[ENSAYO] hark → carla · trazabilidad', ['bus', 'bus:allowed'], 'Mensaje de ensayo con datos inventados.');
    const tr8 = 'ensayo-traza-' + context.runId;
    await github.rest.issues.createComment({ ...repo, issue_number: m8.number, body: '<!-- waipl-bus:portero v1 -->\nRegistro de ENSAYO escrito por github-actions[bot] desde el simulacro.\n```json\n' + JSON.stringify({ v: 1, verdict: 'ALLOW', para: 'carla', trace: tr8, at: new Date().toISOString() }) + '\n```' });
    const prov = async () => ({ ok: true, json: async () => ({ id: 'ensayo-8', model: 'sustituto-sin-nvidia', choices: [{ message: { content: 'Acuse de ensayo (texto inventado).' } }] }) });
    publicados = 0;
    const r8 = await receptor.run({ github: espia(soloEste(m8.number)), repo, dir, env: { NVIDIA_API_KEY: 'ensayo-sin-valor-real' }, killed: false, killNow: kill, fetchImpl: prov, traza });
    await receptor.resumen(core, traza, r8);
    const c8 = await github.paginate(github.rest.issues.listComments, { ...repo, issue_number: m8.number, per_page: 100 });
    const resp = c8.find((c) => (c.body || '').includes(receptor.MARKER));
    let reg = null; try { reg = JSON.parse(resp.body.match(/```json\n([\s\S]*?)\n```/)[1]); } catch (_) {}
    const lab8 = (await github.rest.issues.get({ ...repo, issue_number: m8.number })).data.labels.map((l) => l.name);
    ok('S8', 'Trazabilidad real: la respuesta lleva clave, trace, run_id y run_url de esta ejecución, y queda resumen en Actions',
      !!reg && reg.clave === 'issue-' + m8.number && reg.trace === tr8 && String(reg.run_id) === String(context.runId) && reg.run_url === traza.run_url && resp.user.login === receptor.BOT,
      reg ? 'clave=' + reg.clave + ', trace=' + reg.trace + ', run_id=' + reg.run_id + ', autor=' + resp.user.login + ', comentario ' + resp.html_url : 'sin registro');
    ok('S8b', 'El acuse pone bus:acuse-auto, nunca bus:received, y dice que no es Carla en persona',
      lab8.includes(receptor.ACK_LABEL) && !lab8.includes('bus:received') && /no es carla en persona/i.test(resp.body), 'etiquetas=' + lab8.join(','));
    publicados = 0;
    const r8b = await receptor.run({ github: espia(soloEste(m8.number)), repo, dir, env: { NVIDIA_API_KEY: 'ensayo-sin-valor-real' }, killed: false, killNow: kill, fetchImpl: prov, traza });
    ok('S8c', 'Idempotencia real: una segunda pasada no vuelve a responder', publicados === 0 && !(r8b.hechos || []).length, 'publicados=' + publicados);

    // 7. Quién puede poner la etiqueta: GitHub solo deja etiquetar a quien tiene permiso de triaje o superior
    try { const col = await github.paginate(github.rest.repos.listCollaborators, { ...repo, per_page: 100 });
      const inst = await github.rest.issues.listForRepo({ ...repo, labels: KILL_LABEL, state: 'all', creator: 'hark-ai[bot]', per_page: 1 }).catch(() => ({ data: [] }));
      ok('S7', 'Personas con permiso para etiquetar (GitHub exige permiso de triaje o superior)', col.length === 1 && col[0].login === 'wmejiasbcn-tech', col.map((c) => c.login + ':' + c.role_name).join(', ')); }
    catch (e) { filas.push(['S7', 'Personas con permiso para etiquetar', 'SIN DATO', 'el token del workflow no puede listar colaboradores (HTTP ' + e.status + ')']); }
  } finally {
    for (const n of creados) { try { await cerrar(n); } catch (_) {} }
  }

  const ejecucion = `${context.serverUrl}/${repo.owner}/${repo.repo}/actions/runs/${context.runId}`;
  await core.summary.addHeading('Simulacro real del apagado (sin NVIDIA)').addRaw('Ejecución ' + context.runId + ' · ' + new Date().toISOString()).addBreak()
    .addTable([[{ data: 'Id', header: true }, { data: 'Criterio', header: true }, { data: 'Resultado', header: true }, { data: 'Detalle', header: true }], ...filas]).write();
  const tabla = '| Id | Criterio | Resultado | Detalle |\n|---|---|---|---|\n' + filas.map((f) => '| ' + f.join(' | ') + ' |').join('\n');
  if (context.payload.pull_request) {
    await github.rest.issues.createComment({ ...repo, issue_number: context.payload.pull_request.number, body:
      '**Simulacro REAL en GitHub Actions** (sin NVIDIA, sin fusionar) · [ejecución ' + context.runId + '](' + ejecucion + ')\n\n' + tabla + '\n\nIssues de ensayo creados y cerrados: ' + creados.map((n) => '#' + n).join(', ') });
  }
  return { ok: fallos.length === 0, fallos, filas, creados };
}
module.exports = { run };
