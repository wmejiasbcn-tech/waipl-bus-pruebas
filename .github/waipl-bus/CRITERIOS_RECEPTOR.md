# Criterios de aceptación del receptor automático (NVIDIA)
Matriz pedida por Carla (#46, 23-10-2026) a partir de la revisión de Sider Fusión. Hark la implementa; Sentinel contrasta; Carla revisa; Ada audita; William decide.
Estados: **escrito** (está en el código) · **probado** (lo demuestran pruebas simuladas, `node --test .github/waipl-bus/test/`) · **funcionando** (comprobado en una ejecución real en GitHub).

| # | Criterio | Cómo se cumple | Cómo se comprueba | Estado |
|---|---|---|---|---|
| C1 | Orquestación en GitHub, inferencia en NVIDIA | El portero decide (ALLOW/DENY); NVIDIA solo redacta el texto y no puede tocar etiquetas ni repos | Pruebas «responde como portavoz», «trampa: texto del Issue» | probado |
| C2 | Identidad: solo cuenta lo que escribió el bus | El registro del portero y la marca del receptor solo valen si su autor es `github-actions[bot]`. Si no coincide, se ignoran | 3 pruebas «trampa: …» + ataque reproducido en real (#48, S6) | **funcionando en ensayo real** |
| C3 | Idempotencia | Clave = número de Issue. Como máximo una respuesta automática por Issue (marca del bus + etiqueta `bus:acuse-auto`). Ejecuciones en serie (`concurrency`) | Prueba «volver a procesar no duplica» | probado |
| C4 | Fallo cerrado | No publica sin llave, con apagado, con error HTTP (incluido el 429), si se agota el tiempo (60 s), si hay un error de red o si la respuesta está vacía o mal formada | 8 pruebas de fallo | probado |
| C5 | Límite | Como máximo 5 publicaciones por pasada (cuenta lo publicado) y 10 min por ejecución | Prueba «nunca más de 5» | probado |
| C6 | Apagado: dónde, quién, cómo, latencia | 1) Interruptor rápido: un Issue abierto con la etiqueta `bus:kill`; pueden ponerla William, Sentinel o la app de Hark, sin PR. 2) Archivo `BUS_KILL`, leído en cada comprobación. 3) Variable `BUS_KILL`, que se lee al arrancar. Se comprueba al arrancar, antes de cada llamada a NVIDIA y antes de cada publicación. Si no se puede comprobar, se para. **Latencia esperada:** la etiqueta y el archivo actúan antes de la siguiente llamada o publicación (segundos); una respuesta que NVIDIA esté generando no se publica. La variable actúa en la siguiente ejecución | Pruebas «apagado en marcha» (antes de NVIDIA y durante) e «interruptor rápido» | **funcionando en ensayo real**: latencia de 5 a 7,5 s (S2, S4a, S5) |
| C7 | Conciliar los permisos mínimos con el apagado | El workflow solo tiene `issues: write` y `contents: read`. Leer etiquetas y el archivo no necesita más permisos. La variable la cambia una persona administradora, no el workflow | Inspección del YAML | escrito |
| C8 | Permisos y contexto | El workflow solo corre en `wmejiasbcn-tech/waipl-bus-pruebas` y solo si el portero terminó bien. El checkout no guarda credenciales. El secreto solo llega al paso del receptor. Los errores nunca muestran la llave | Prueba «la llave nunca aparece»; S4b real: sin llave, 0 llamadas y 0 publicaciones; S7: solo wmejiasbcn-tech (admin) puede etiquetar | **funcionando en ensayo real** |
| C9 | Trazabilidad fuera del Issue | Cada respuesta lleva `clave`, `trace`, `run_id` y `run_url`. Cada ejecución deja un resumen (tabla) en GitHub Actions | Prueba «trazabilidad» | probado · falta verlo en real |
| C10 | Acuse automático ≠ validación humana | Nunca pone `bus:received`. El texto dice «no es X en persona; no cuenta como recibido» | Pruebas «nunca pone bus:received» y «trampa: texto del Issue» | probado |
| C11 | Coste y continuidad | GitHub Actions es gratis en repos públicos con runners estándar (docs.github.com, Actions billing). En NVIDIA, el plan gratuito sirve para prototipar, con «hasta 40 peticiones/min en la mayoría de modelos», sin cobro por token (FAQ de build.nvidia.com); en la práctica puede dar 429 por debajo de 40 (foros de NVIDIA). **Uso en producción = licencia de pago** (FAQ de NIM): el piloto es una prueba y está dentro | Documentación oficial consultada el 23-10-2026 | comprobado en las fuentes |

## Qué solo se puede comprobar en real
- C6 y C9 en una ejecución de verdad. El workflow tiene que estar en la rama principal, y eso exige fusionar, que solo autoriza William.
- Sin la llave, el receptor se queda quieto (SIN_LLAVE). Aun así se pueden medir en real el apagado al arrancar y su latencia, y ver el resumen de Actions. El apagado durante una ejecución, con NVIDIA de verdad, necesita la llave.

## Ensayo real, 24-10-2026 00:07 (sin fusionar y sin NVIDIA)
Ejecución https://github.com/wmejiasbcn-tech/waipl-bus-pruebas/actions/runs/40031534466: las 57 pruebas pasan en Actions, y el simulacro S1–S7 sale CUMPLE en los 9 puntos. Issues de ensayo #48 a #51, ya cerrados.
Queda para la fase con llave: una respuesta real de NVIDIA, el receptor arrancado por el portero desde main y su resumen de Actions.
