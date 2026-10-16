# Changelog

## 1.3.1 — 2026-10-16 · Diseño móvil
- Cabecera en pantallas de menos de 640 px: logo (el nombre ya no se parte), botón de búsqueda compacto y un único menú (Lucide) con idioma, tema, ayuda y garantía cero egress. Corregido el atajo «Ctrl K», que se mostraba en móvil porque `.kbd` anulaba `hidden`.
- Pestañas en móvil: barra con desplazamiento horizontal, *snap*, bordes difuminados, sin saltos de línea y la pestaña activa siempre visible.
- Pie: el aviso ocupa todo el ancho y los enlaces se colocan debajo, sin solaparse.
- Sin desbordamiento horizontal en Auditor (rejillas y diff con `minmax(0,1fr)`), Integridad (rutas largas) y Gobernanza (la tabla desplazable ya se puede enfocar con el teclado).
- Nueva prueba e2e `scripts/e2e-mobile.mjs` en CI: todas las vistas, menú, paleta y modal a 320, 360, 390 y 430 px, claro/oscuro, ES/EN. Falla si hay desbordamiento horizontal o texto de varias palabras en una columna de menos de 80 px; axe a 390 px.

## 1.3.0 — 2026-10-16 · Tool Integrity Monitor
Implementa la parte web offline del RFC-001 en `src/integrity/`.
- **Nueva vista Integridad** (atajo `2`; los demás pasan a `3–5`): baseline aprobada frente a candidato, chips de huella, métricas de riesgo de integridad y de configuración por separado, eventos filtrables con evidencia antes/después por campo y nivel de confianza, cobertura MCPS-INT, revisión humana y registro de decisiones. ES/EN, claro/oscuro AA, Lucide, sin fondos de cuadrícula.
- **Importador**: `tools/list` JSON-RPC (única o paginada) y `MCPShieldSnapshot 1.0`; límites de 8 MiB, 1000 herramientas, 128 páginas y profundidad 64; duplicados y cursores circulares son error; huecos de cursor, `resultType` no completo o `nextCursor` final ⇒ captura parcial; `ttlMs`/`cacheScope` de MCP 2026-07-28; `$ref` externos e iconos nunca se cargan; `verifiedCollector` nunca se acepta del archivo. Se ejecuta en un Web Worker con límite de 15 s (con respaldo en el hilo principal).
- **Huellas**: JCS (RFC 8785) verificado con los vectores del RFC; SHA-256 público de la proyección redactada; HMAC-SHA-256 por herramienta y raíz ligada a perfil, identidad, transporte, protocolo y completitud; clave solo en memoria.
- **Comparador**: comprobación de comparabilidad (perfil, identidad, transporte, completitud; cambio de protocolo reduce la confianza), `CONTEXT_MISMATCH` bloquea el diff, nombres sensibles a mayúsculas, sin `TOOL_REMOVED` en capturas parciales.
- **Reglas MCPS-INT-001..008** e Integrity Risk separado del Configuration Risk (TP-001/002/003 sobre el contenido importado).
- **Aprobación explícita**: nada se aprueba solo; lista TOFU para la primera baseline; aceptar riesgo exige fecha de revisión; no se puede aprobar con contexto distinto.
- **Paquete de baseline cifrado**: AES-256-GCM, PBKDF2-SHA256 (600 000 iteraciones), sal y nonce aleatorios, cabecera versionada como AAD; la contraseña no se guarda.
- **Exportes** SARIF, Markdown y JSON redactados, sin clave HMAC, tras el control de salida.
- CSP: añadido `worker-src 'self'` (sigue `connect-src 'none'`).
- Demo `acme-mail`: `send_email` con directiva oculta, caracteres Unicode Tag, nuevo `bcc` en `x-mcp-header` y una herramienta con nombre confundible; y una demo de contexto distinto.
- Captura directa por CLI (RFC §10): documentada como planificada/experimental; no incluida.

## 1.2.2 — 2026-10-16 · Security Hardening
Corrige los hallazgos de una auditoría técnica externa de la v1.2.1. Cada uno tiene una prueba de regresión que lo reproducía antes del arreglo (`tests/audit-v122.test.ts`).
- **P0-1 · Contenedores por lista blanca.** `docker/podman run` se reconstruye desde una base segura (`--rm -i --network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 1000:1000 --pids-limit --memory`); solo sobreviven opciones inocuas (`-e KEY`, montajes no sensibles forzados a solo lectura, `--tmpfs`, `-w`, `--name`…). Se eliminan `--user root`, `--network bridge/host`, `--read-only=false`, `--privileged`, `--cap-add`, `--security-opt *=unconfined`, `--pid/--ipc/--uts/--userns host`, `--device`, el socket de Docker, montajes sensibles (también rutas Windows y UNC) y opciones globales como `--remote`. La config generada se **vuelve a analizar**: solo se etiqueta «Endurecida» si no queda ningún problema crítico o alto; si no, «Parcialmente endurecida» con la lista de lo que falta. Si el original pedía red, se avisa. MCPS-FS-003 detecta ahora `--cap-add`, seccomp/AppArmor `unconfined`, `--ipc/--uts/--userns host`, `--device` y `--user root`.
- **P0-2 · Ocultación contextual y control de salida.** Cualquier valor en `env`, `-e KEY=VAL`, `--env`, cabeceras, parámetros de URL y tras `--token/--key/--password/--secret/--pat…` se trata como sensible salvo literales seguros (booleanos, números, versiones, rutas, URL sin credenciales, `${…}`, marcadores). Cada exportación (SARIF, Markdown, config corregida, Dockerfile/compose, portapapeles) pasa un control final (patrones conocidos, credenciales en URL, `Bearer`, cadenas de alta entropía) que bloquea la descarga con un mensaje ES/EN. Los textos ya no prometen una ocultación absoluta.
- **P0-3 · Sin errores silenciosos.** Cada regla informa `PASS / FAIL / NOT_EVALUATED / ERROR` con diagnóstico no sensible (clase de error y recuento). Un `ERROR`, un fallo de lectura o una config vacía dan nota `N/A`, nunca A ni «limpio». Panel de cobertura en la interfaz; SARIF incluye `invocations[].executionSuccessful`, `toolExecutionNotifications` y `ruleCoverage`; Markdown, una tabla de cobertura.
- **P1-4 · Superficie de Tool Poisoning.** Se indica qué se analizó (config o también inventario de herramientas). TP-001/TP-002 devuelven `NOT_EVALUATED` sin inventario. Nuevo importador de respuestas `tools/list` (JSON-RPC, `{tools}` o array; pegar o archivo), fusionado por servidor en memoria.
- **P1-5 · CI.** El despliegue solo ocurre si pasan lint, tipos, pruebas, build, comprobación de cero egress, `npm audit --omit=dev`, e2e con Playwright + axe (incluida la prueba negativa de red) y CodeQL; dependency review en pull requests.
- **P2-6 · Una sola versión.** `package.json` se inyecta en la build (pie de la interfaz, SARIF `tool.driver.version`); `scripts/sync-version.mjs` actualiza el README y una prueba exige que todo coincida (antes SARIF decía 1.0.0).
- Pruebas adversariales: JSONC roto, anidamiento extremo, Unicode enorme, caracteres invisibles en nombres de servidor (ahora se muestran como ⟨U+XXXX⟩ en los informes, también bidi y controles), rutas Windows/UNC, argumentos Docker contradictorios y secretos de formato desconocido.
- Nuevo ejemplo «Contenedor con escape + git antiguo» que demuestra el estado «Parcialmente endurecida».

## 1.2.1 — 2026-10-16
- Eliminados todos los fondos decorativos de cuadrícula, puntos o líneas (fondo de la app y regla/rejilla de la figura) en ambos temas; superficies lisas. Nueva prueba que falla si reaparecen.
- Figura «Cero telemetría»: la tarjeta de hallazgos ya no tapa el puerto de red precintado.

## 1.2.0 — 2026-10-16
- Nueva regla **MCPS-TP-003 · ASCII smuggling** (inspirada en NVIDIA garak, Apache-2.0): caracteres Unicode Tag con el texto oculto decodificado en el hallazgo, selectores de variación en serie, Sneaky Bits y secuencias ANSI en nombres, descripciones, esquemas y args. Incluida en SARIF/Markdown, la ayuda, la remediación y un nuevo ejemplo de demo. Sin falsos positivos con emoji normales (VS16, banderas de subdivisión, ZWJ, CJK).
- El editor del auditor muestra los caracteres invisibles como ⟨U+XXXX⟩.
- Figura isométrica «Cero telemetría» en la ayuda (kit anatomy, MIT): instrumento sellado con bandeja mcp.json, 11 cartuchos de reglas, tarjeta de hallazgos, puerto de red tapado y contador real de peticiones externas. Tema claro/oscuro, ES/EN, una sola imagen fija con movimiento reducido y pausa fuera de pantalla.
- Tipografía Inter y JetBrains Mono variables, autoalojadas con Fontsource (OFL 1.1), con respaldo del sistema.
- Créditos y NOTICE: garak, anatomy, Inter, JetBrains Mono y Fontsource.

## 1.1.0 — 2026-10-16
- Paleta de comandos (⌘K / Ctrl+K, `/`), atajos `?`, `1–4`, `T`, `L`; botón de búsqueda en la barra superior.
- Centro de ayuda con buscador: uso, FAQ, reglas, atajos, privacidad, aviso legal, créditos y licencias, acerca de y otras herramientas del autor.
- Primeros pasos descartables, avisos (toasts) accesibles, impresión / PDF del informe (oculta el editor con el texto original).
- Pie con versión, repositorio, aviso legal, créditos y atajos; enlace «Saltar al contenido».
- Regiones desplazables accesibles por teclado (axe-core: 0 violaciones WCAG 2 A/AA en las vistas probadas).
- Textos sobre interpolación de variables corregidos según la documentación de Cursor, VS Code y Claude Desktop.
- SECURITY.md, CHANGELOG.md y README reestructurado.

## 1.0.0 — 2026-10-16
- Primera versión pública: auditor, simulador (demo) y matriz de gobernanza; parser JSONC/VS Code, ocultación de secretos, SARIF validado con el esquema oficial.
