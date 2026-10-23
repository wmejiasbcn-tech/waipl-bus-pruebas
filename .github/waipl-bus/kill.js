// WAIPL-BUS · Interruptor de apagado. La parada manda siempre: basta con que la variable
// de GitHub O el archivo BUS_KILL digan "true" para que el bus esté apagado
// (defecto hallado por Carla en la revisión de la PR #47, 2026-10-23).
'use strict';
function isKilled(varValue, fileValue) {
  const on = (v) => String(v == null ? '' : v).trim().toLowerCase() === 'true';
  return on(varValue) || on(fileValue);
}
module.exports = { isKilled };
