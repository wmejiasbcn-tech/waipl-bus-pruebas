# waipl-bus-pruebas

Repositorio de PRUEBAS del portero WAIPL-BUS (copia del borrador wmejiasbcn-tech/Will-AI-Project-Lab#217).

**Desde el 2026-10-23 aloja también el PILOTO WAIPL-BUS** (orden de William). Se trasladó desde el Lab, de donde Sentinel lo retiró en la PR #230.
- Repositorio **público**: por aquí **solo pasan datos inventados o no sensibles**. Nada real del ecosistema.
- Nodos: los de prueba (alfa, beta, con sellos inventados en `seals-prueba.json`) y los del **piloto**: soberano, carla, hark y ada, con permisos P-101…P-112 hasta el 2026-11-05 21:41 CET.
- Llaves: **BUS_SEAL_HARK es una llave real**. Está guardada como secreto de GitHub (cifrada) y no aparece en ningún archivo. Mientras exista algún secreto, `seals-prueba.json` no se usa.
- Carla: no tiene llave. Su «recibido» se reconoce por su conexión de ChatGPT (`apps.json`).

**Apagado de emergencia (BUS_KILL)**: lo más rápido es crear la variable `BUS_KILL` = `true` en Settings → Secrets and variables → Actions → Variables. Es un solo paso, sin PR, y la puede crear William o Sentinel. La app de Hark no puede (403). Si la variable existe, manda sobre el archivo `.github/waipl-bus/BUS_KILL`, que sigue funcionando como respaldo (cambiarlo exige un commit).

Lo de abajo describe las pruebas originales del 2026-10-22, con nodos inventados:
No es producción ni el transporte elegido. Plan acordado por SENTINEL y autorizado por William (2026-10-22). Verifican Carla y SENTINEL.
