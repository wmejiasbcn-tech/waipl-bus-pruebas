// Pruebas del receptor (BORRADOR de Hark). Ejecutar: node --test .github/waipl-bus/test/
// GitHub falso en memoria y NVIDIA falsa: no se llama a nada real.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const receptor = require('../receptor');

const DIR = path.join(__dirname, '..');
const LEDGER = (para, verdict) => '<!-- waipl-bus:portero v1 -->\nx\n```json\n' + JSON.stringify({ v: 1, verdict, para, trace: 't-1', at: '2026-10-23T19:00:00Z' }) + '\n```';

function fakeGithub(issues, commentsByIssue) {
  const writes = { comments: [], labels: [] };
  const rest = { issues: {
    listForRepo: 'listForRepo', listComments: 'listComments',
    createComment: async (a) => { writes.comments.push(a); },
    addLabels: async (a) => { writes.labels.push(a); },
    getLabel: async () => ({}), createLabel: async () => ({}),
  } };
  return { writes, rest, paginate: async (fn, a) => (fn === 'listForRepo' ? issues : commentsByIssue[a.issue_number] || []) };
}
const okFetch = (calls) => async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => ({ id: 'r1', choices: [{ message: { content: 'Recibido. Se pide revisar X.' } }] }) }; };
const issue = (n, extra = []) => ({ number: n, title: '[BUS] hark → carla · prueba', body: 'datos inventados', labels: ['bus', 'bus:allowed', ...extra] });
const repo = { owner: 'o', repo: 'r' };

test('sin llave no publica nada', async () => {
  const gh = fakeGithub([issue(1)], { 1: [{ body: LEDGER('carla', 'ALLOW') }] });
  const r = await receptor.run({ github: gh, repo, dir: DIR, env: {}, killed: false });
  assert.strictEqual(r.estado, 'SIN_LLAVE');
  assert.strictEqual(gh.writes.comments.length, 0);
});

test('con BUS_KILL no publica nada', async () => {
  const gh = fakeGithub([issue(1)], { 1: [{ body: LEDGER('carla', 'ALLOW') }] });
  const r = await receptor.run({ github: gh, repo, dir: DIR, env: { NVIDIA_API_KEY: 'k' }, killed: true });
  assert.strictEqual(r.estado, 'APAGADO');
  assert.strictEqual(gh.writes.comments.length, 0);
});

test('responde como portavoz y nunca pone bus:received', async () => {
  const calls = [];
  const gh = fakeGithub([issue(1)], { 1: [{ body: LEDGER('carla', 'ALLOW') }] });
  const r = await receptor.run({ github: gh, repo, dir: DIR, env: { NVIDIA_API_KEY: 'k' }, killed: false, fetchImpl: okFetch(calls) });
  assert.deepStrictEqual(r.hechos.map((h) => h.estado), ['RESPONDIDO']);
  assert.match(gh.writes.comments[0].body, /Portavoz automático de carla/);
  assert.match(gh.writes.comments[0].body, /no cuenta como recibido/);
  assert.deepStrictEqual(gh.writes.labels.flatMap((l) => l.labels), ['bus:acuse-auto']);
  assert.match(calls[0].body.messages[0].content, /Carla/);
  assert.strictEqual(calls[0].url, 'https://integrate.api.nvidia.com/v1/chat/completions');
});

test('ignora lo que el portero no autorizó, los nodos sin carta y lo ya respondido', async () => {
  const calls = [];
  const gh = fakeGithub([issue(1), issue(2), issue(3, ['bus:acuse-auto']), issue(4)], {
    1: [{ body: LEDGER('carla', 'DENY') }],
    2: [{ body: LEDGER('alfa', 'ALLOW') }],
    3: [{ body: LEDGER('carla', 'ALLOW') }],
    4: [{ body: LEDGER('ada', 'ALLOW') }, { body: receptor.MARKER + ' ya' }],
  });
  const r = await receptor.run({ github: gh, repo, dir: DIR, env: { NVIDIA_API_KEY: 'k' }, killed: false, fetchImpl: okFetch(calls) });
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(gh.writes.comments.length, 0);
  assert.deepStrictEqual(r.hechos, []);
});

test('si NVIDIA falla (p. ej. 429) no publica nada', async () => {
  const gh = fakeGithub([issue(1)], { 1: [{ body: LEDGER('ada', 'ALLOW') }] });
  const r = await receptor.run({ github: gh, repo, dir: DIR, env: { NVIDIA_API_KEY: 'k' }, killed: false, fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.deepStrictEqual(r.hechos, [{ issue: 1, nodo: 'ada', estado: 'NVIDIA_FALLO', status: 429 }]);
  assert.strictEqual(gh.writes.comments.length, 0);
});

// ---- Ampliación tras la revisión de Carla y Ada (2026-10-23) ----
const { isKilled } = require('../kill');

test('interruptor: la parada manda en todas las combinaciones de variable y archivo', () => {
  assert.strictEqual(isKilled('false', 'true'), true);   // el defecto que halló Carla
  assert.strictEqual(isKilled('true', 'false'), true);
  assert.strictEqual(isKilled('', 'true\n'), true);
  assert.strictEqual(isKilled(undefined, ' TRUE '), true);
  assert.strictEqual(isKilled('false', 'false'), false);
  assert.strictEqual(isKilled(undefined, ''), false);
});

for (const [nombre, fetchImpl, status] of [
  ['error de red', async () => { throw Object.assign(new Error('x'), { name: 'TypeError' }); }, 'red:TypeError'],
  ['tiempo agotado', async () => { throw Object.assign(new Error('x'), { name: 'TimeoutError' }); }, 'red:TimeoutError'],
  ['respuesta vacía', async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '   ' } }] }) }), 'vacía'],
  ['respuesta sin choices', async () => ({ ok: true, json: async () => ({}) }), 'vacía'],
  ['respuesta mal formada', async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } }), 'mal-formada'],
]) {
  test('si NVIDIA da ' + nombre + ' no publica nada', async () => {
    const gh = fakeGithub([issue(1)], { 1: [{ body: LEDGER('carla', 'ALLOW') }] });
    const r = await receptor.run({ github: gh, repo, dir: DIR, env: { NVIDIA_API_KEY: 'k' }, killed: false, fetchImpl });
    assert.deepStrictEqual(r.hechos, [{ issue: 1, nodo: 'carla', estado: 'NVIDIA_FALLO', status }]);
    assert.strictEqual(gh.writes.comments.length, 0);
    assert.strictEqual(gh.writes.labels.length, 0);
  });
}

test('nunca publica más de 5 por pasada aunque haya más mensajes', async () => {
  const calls = [];
  const issues = [1, 2, 3, 4, 5, 6, 7].map((n) => issue(n));
  const comments = Object.fromEntries(issues.map((i) => [i.number, [{ body: LEDGER('carla', 'ALLOW') }]]));
  const gh = fakeGithub(issues, comments);
  await receptor.run({ github: gh, repo, dir: DIR, env: { NVIDIA_API_KEY: 'k' }, killed: false, fetchImpl: okFetch(calls) });
  assert.strictEqual(receptor.MAX_POR_PASADA, 5);
  assert.strictEqual(gh.writes.comments.length, 5);
  assert.strictEqual(calls.length, 5);
});

test('volver a procesar el mismo mensaje no duplica la respuesta', async () => {
  const calls = [];
  const comments = { 1: [{ body: LEDGER('carla', 'ALLOW') }] };
  const iss = issue(1);
  const gh = fakeGithub([iss], comments);
  gh.rest.issues.createComment = async (a) => { gh.writes.comments.push(a); comments[1].push({ body: a.body }); };
  gh.rest.issues.addLabels = async (a) => { gh.writes.labels.push(a); iss.labels.push(...a.labels); };
  await receptor.run({ github: gh, repo, dir: DIR, env: { NVIDIA_API_KEY: 'k' }, killed: false, fetchImpl: okFetch(calls) });
  await receptor.run({ github: gh, repo, dir: DIR, env: { NVIDIA_API_KEY: 'k' }, killed: false, fetchImpl: okFetch(calls) });
  assert.strictEqual(gh.writes.comments.length, 1);
  assert.strictEqual(calls.length, 1);
});

test('la llave nunca aparece en lo que se publica ni en el resultado', async () => {
  const KEY = 'nvapi-SECRETO-DE-PRUEBA-123';
  const gh = fakeGithub([issue(1), issue(2)], { 1: [{ body: LEDGER('carla', 'ALLOW') }], 2: [{ body: LEDGER('ada', 'ALLOW') }] });
  let n = 0;
  const fetchImpl = async () => (n++ === 0 ? { ok: true, json: async () => ({ id: 'r', choices: [{ message: { content: 'ok' } }] }) } : (() => { throw new Error('fallo ' + KEY); })());
  const r = await receptor.run({ github: gh, repo, dir: DIR, env: { NVIDIA_API_KEY: KEY }, killed: false, fetchImpl });
  assert.ok(!JSON.stringify(gh.writes).includes(KEY));
  assert.ok(!JSON.stringify(r).includes(KEY));
});
