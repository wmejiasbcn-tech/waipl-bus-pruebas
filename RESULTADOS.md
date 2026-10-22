# Resultados de la prueba real — 2026-10-22 (19:51–20:05 CEST)

Ejecutada por Hark en GitHub real (este repo), con nodos inventados (alfa, beta) y sellos inventados. A verificar por SENTINEL y Carla: cada fila enlaza el Issue con su asiento del portero.

| # | Qué se prueba | Issue | Resultado |
|---|---|---|---|
| 1 | Sello bueno (alfa, publicado con la cuenta del soberano) | #1 | ALLOW, identidad «sello (transportado por soberano)». La primera ejecución falló (ver Hallazgo); el barrido lo recuperó |
| 2 | Sello falso | #2 | DENY + `to:soberano` + asignado a William |
| 2b | Mensaje alterado después de sellar | #3 | DENY + aviso |
| 3 | Aviso por riesgo alto | #4 | ALLOW + `risk:high` + `to:soberano` + asignado |
| 4 | Sin duplicados: reejecutar los workflows de #1 y #4 (evento repetido) | #1, #4 | Sigue habiendo 1 asiento en cada uno. Prueba de máquina: [ejecución de #4, intento 2](https://github.com/wmejiasbcn-tech/waipl-bus-pruebas/actions/runs/39826378237/attempts/2) y [ejecución de #1, intento 2](https://github.com/wmejiasbcn-tech/waipl-bus-pruebas/actions/runs/39826374912/attempts/2): el registro dice `{"skipped":true,"reason":"ya asentado: ALLOW"}` |
| 4b | Reenvío con TRACE repetido | #5 | DENY «TRACE ya se usó» |
| 5 | Interruptor de apagado (BUS_KILL=true) y encendido | #7 | KILLED; al encender, el barrido lo procesó una sola vez → ALLOW (2 asientos: KILLED, ALLOW) |
| 7 | Recibido del destinatario (alfa → soberano; la cuenta del soberano comenta) | #36 | `bus:allowed` → `bus:received` |
| 7b | Comentario de quien NO es destinatario | #1 | Sigue en `bus:allowed`, sin recibido |
| 6 | Límite de 30 por nodo y hora | #8–#34, #35 | 30 ALLOW en la hora; #35 → RATE_LIMITED + aviso |

**Regla de reproceso (por escrito, a petición de la verificación):** un Issue con asiento `ALLOW`, `DENY` o `RATE_LIMITED` no se vuelve a decidir nunca. Solo `KILLED` se reprocesa, una vez, cuando el bus se enciende (portero.js, líneas 99–107). Por eso #7 tiene dos asientos y no es una contradicción.

**Hallazgo real (no lo detectaban las pruebas simuladas):** dos ejecuciones a la vez intentaron crear la misma etiqueta y una falló (HTTP 422 `already_exists`). Arreglado aquí y en wmejiasbcn-tech/Will-AI-Project-Lab#217 (commit 1105e13), con la prueba 31.

**Sin probar aquí:** secretos y variables de GitHub (la app Hark no puede crearlos: HTTP 403; en este repo, los sellos y BUS_KILL van en archivos), que a William le llegue la notificación de GitHub (solo se comprobó la asignación), el «recibido» de un nodo con cuenta propia distinta del soberano (no existe ninguna; T7 lo prueba con la única cuenta real), el recibido sellado (no está programado) y el atasco de 24 h.
