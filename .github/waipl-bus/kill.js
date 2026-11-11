// WAIPL-BUS · Interruptor de apagado. La parada manda siempre: basta con que la variable
// de GitHub O el archivo BUS_KILL digan "true" para que el bus esté apagado
// (defecto hallado por Carla en la revisión de la PR #47, 2026-10-23).
'use strict';
function isKilled(varValue, fileValue) {
  const on = (v) => String(v == null ? '' : v).trim().toLowerCase() === 'true';
  return on(varValue) || on(fileValue);
}
// Interruptor rápido, sin PR ni permisos de administración: cualquier Issue ABIERTO con la etiqueta bus:kill
// para el bus. Solo pueden poner etiquetas quienes tienen permiso en el repositorio (William, Sentinel, la app de Hark).
// Se vuelve a mirar antes de cada llamada a NVIDIA y antes de cada publicación.
const KILL_LABEL = 'bus:kill';
async function killAhora({ github, repo, varValue }) {
  if (isKilled(varValue, '')) return true;
  try {
    const f = await github.rest.repos.getContent({ ...repo, path: '.github/waipl-bus/BUS_KILL' });
    if (isKilled('', Buffer.from(f.data.content || '', 'base64').toString('utf8'))) return true;
  } catch (e) { if (e.status !== 404) return true; } // si no se puede comprobar, se para (falla cerrado)
  try {
    const r = await github.rest.issues.listForRepo({ ...repo, state: 'open', labels: KILL_LABEL, per_page: 1 });
    return r.data.length > 0;
  } catch (_) { return true; }
}
module.exports = { isKilled, killAhora, KILL_LABEL };
