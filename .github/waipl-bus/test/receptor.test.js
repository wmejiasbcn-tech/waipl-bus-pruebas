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
