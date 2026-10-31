# Changelog

## Unreleased
- **Ecosistema GRC.** La ayuda suma **Atlas GRC**, que enseña la ISO/IEC 27001 desde cero con lecciones, prácticas, simulacros CertiProf y la ciudad de Albatrel que crece contigo, con «Abrir» y «Código». También aparece en la tabla del README. La e2e comprueba las nueve herramientas y los dos enlaces de Atlas.

## 1.7.0 — 2026-10-31 · Harness-Shield
- **Nueva pestaña Harness-Shield.** Auditor estático de los ficheros que configuran a un agente: `SKILL.md` (con su cabecera YAML), `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.mcp.json` y hooks en Bash, Python o PowerShell. Se sueltan, se abren o se pegan; se leen en memoria y nunca se ejecutan, no se resuelve ninguna URL ni se instala ningún paquete.
- **Ocho reglas AHS** (OWASP Top 10 for LLM Applications 2025 y control del Anexo A de ISO/IEC 42001, marcados como orientativos):
  - **AHS-01** Unicode invisible o bidireccional (*Trojan Source*, Unicode Tags), con el texto oculto decodificado. Respeta las secuencias ZWJ de emoji.
  - **AHS-02** Secuestro de instrucciones en español e inglés y comentarios ocultos (`<!-- -->`, `[//]: #`) sobre el texto completo, con la línea exacta aunque el comentario ocupe varias. Un comentario con una orden es crítico.
  - **AHS-03** Exfiltración por red, graduada por contexto (hook o script, bloque de código, instrucción o prosa) y con nivel de confianza. Un `fetch` en documentación no es crítico.
  - **AHS-04** Dependencias MCP sin fijar: el `.mcp.json` se analiza como JSON (un error de sintaxis es un hallazgo con su línea) y se marcan `npx`/`uvx`/`pipx` y equivalentes sin versión exacta, con `@latest`, con `-y`, y las URL git sin commit. `paquete@1.2.0` no se marca.
  - **AHS-05** Lectura de ficheros sensibles (`~/.ssh`, `.env`, credenciales cloud) y volcados del entorno. Una mención suelta a `process.env` solo da confianza baja.
  - **AHS-06** Descarga y ejecución remota (`curl | bash`, `iex (irm …)`).
  - **AHS-07** Payload en base64 que se decodifica y se ejecuta, con el contenido decodificado a la vista.
  - **AHS-08** Aprobación automática o permisos desactivados (`autoApprove`, `--dangerously-skip-permissions`, `Bash(*)`).
- **Riesgo de 0 a 100 y nota**, con la misma fórmula que el Auditor (peso por severidad y confianza). Exportes **SARIF 2.1.0** (región con línea, OWASP e ISO como etiquetas) y **Markdown**, ocultando secretos y pasando por el control final de salida.
- **Entrada endurecida:** el tamaño se comprueba antes de leer (máximo 5 MB por fichero y 50 ficheros); los binarios se rechazan con un mensaje claro tras leer solo los primeros 8 KiB; las líneas se recortan a 4096 caracteres y las expresiones regulares son lineales. El contenido se pinta solo como texto (nunca `innerHTML`) y los fragmentos se limitan a 140 caracteres.
- **«Cargar ejemplos»**: siete ficheros maliciosos de demostración (dominios `.example.invalid`, sin secretos reales) que disparan las ocho reglas.
- La CSP no cambia (`connect-src 'none'`); no hay peticiones nuevas. La vista se carga bajo demanda y el bundle principal sigue por debajo de 500 kB.
- Atajos `1`–`6`, comando de paleta «Cargar ejemplos · Harness-Shield», sección en la Ayuda y barra inferior móvil con seis vistas. En la cabecera de escritorio, «Buscar» se muestra solo desde 1536 px para que quepan las seis pestañas a 1280 px; en la barra inferior cada pestaña parte del ancho de su texto para que «Gobernanza» no se corte a 320 px.
- El sobre de ejemplo `docs/ecosistema/mcp-shield-hallazgos-ejemplo.json` pasa a `"version": "1.7.0"` (solo cambia esa línea).
- Pruebas: 40 nuevas de vitest en `tests/harness-v170.test.ts` (esteganografía Unicode, exfiltración desde hooks, fijación de versiones, rechazo de más de 5 MB, XSS pintado como texto, SARIF contra el esquema, ReDoS y ningún nombre de API de red en el código). El e2e carga los ejemplos, comprueba que el XSS no crea elementos, descarga el SARIF y rechaza un fichero de 5 MB + 1 byte y un PNG.
- **Pie de la tabla `mcp-shield.yaml` en el README.** `scripts/sync-version.mjs` también actualiza `version:` del `<tfoot>` a la de `package.json` (seguía en 1.5.2 con la 1.6.0). La prueba de fuente única falla si difieren.
- **Aviso de laboratorio en el README.** Alerta GitHub `[!WARNING]` justo después de los distintivos (español + una línea en inglés) y la misma advertencia breve al inicio de la sección English: no conectar el repositorio como servidor MCP. Las definiciones de herramientas (p. ej. `add`, con instrucción oculta para leer `~/.ssh/id_rsa` y pasarlo en `notes`) son fixtures de demostración para detectar *tool poisoning*, no herramientas reales.

## 1.6.0 — 2026-10-18 · MCP-Shield entra en el ecosistema GRC
- **Exportación «Ecosistema» en el Auditor.** Descarga un sobre `yrd-ecosistema` (versión 1) de tipo `hallazgos`, el formato común de las herramientas GRC del autor.
  - Cada hallazgo lleva la regla, la categoría, la severidad, el servidor, la ubicación con su línea y la CWE.
  - El resumen lleva el riesgo de 0 a 100, la nota, si el análisis está completo, los servidores y el recuento por severidad.
  - Los textos pasan por la misma ocultación que el SARIF y el fichero por el control final de secretos. El nombre del fichero pierde la ruta y los caracteres de control.
- **CTEM-Nexus 1.2.1 lo importa** en su vista Ecosistema: asigna a cada hallazgo su guía de corrección, sus técnicas ATT&CK y sus controles unificados, y de ahí pasa a Rosetta como evidencia. El SARIF sigue entrando por «Importar escáner».
- **El contrato es el de CTEM-Nexus:** su esquema JSON añade `mcp-shield` y la forma de sus hallazgos, y aquí se prueba contra una copia de ese esquema (`tests/fixtures/yrd-ecosistema.schema.json`).
- **Ejemplo publicado:** `docs/ecosistema/mcp-shield-hallazgos-ejemplo.json`. Es el mismo fichero que prueba CTEM-Nexus, y una prueba exige que coincida byte a byte con lo que genera el exportador.
- **GitHub Actions fijadas por SHA** (con la versión en un comentario) y Dependabot semanal para mantenerlas al día.
- La ayuda «Ecosistema GRC» explica el recorrido con el sobre y qué controles recibe cada categoría.
- Pruebas: 9 nuevas de vitest en `tests/ecosystem-v160.test.ts`. El e2e descarga el sobre y comprueba que no lleva el token.

## 1.5.2 — 2026-10-17 · Cabecera del README con identidad propia
- **Cabecera y pie nuevos en azul eléctrico**, sustituyen a los degradados de capsule-render, que compartía con otras herramientas. Es un escudo vivo, con la forma de `shield-check` de Lucide:
  - El contorno se dibuja solo, se rellena y aparece el check.
  - Respira con ecos con forma de escudo; no son anillos, que son la firma de Rosetta.
  - Un haz lo escanea por dentro.
  - Los paquetes rojos y ámbar que llegan por la derecha se vuelven azules y se apagan con un destello al tocarlo.
- Movimiento con las curvas de Emil Kowalski: `ease-out` para entrar, `ease-in-out` para lo que se mueve en pantalla y nada desde `scale(0)`. Los textos suben 6 px escalonados cada 40 ms. Con `prefers-reduced-motion` todo queda quieto en su estado final.
- Son SVG del propio repositorio, sin servicios externos. Los textos van convertidos a trazos con Inter y JetBrains Mono (las fuentes de la app), porque un SVG dentro de `<img>` no puede cargar fuentes y cada sistema usaría la suya. Pesan 55 KiB la cabecera y 7 KiB el pie, con descripción accesible (`<title>` y `<desc>`).
- `npm run readme-banner` (`scripts/readme-banner.py`) los regenera.

## 1.5.1 — 2026-10-17 · Diagramas del README
- **El mapa mental y la arquitectura no se dibujaban en GitHub.** Mermaid lee las llaves de `${VAR}` como sintaxis de forma (hexágono en el mapa mental, rombo en el diagrama de flujo) y mostraba un error en lugar del diagrama. El mapa mental dice ahora «variables de entorno» y la etiqueta de `remediator.ts` va entre comillas, que conservan `${VAR}` como texto.
- **Nueva comprobación `npm run readme-check`** (`scripts/readme-mermaid.mjs`): renderiza en Chromium cada bloque Mermaid del README con Mermaid 11 y falla si alguno no se puede dibujar, indicando archivo, línea y error. Corre en la CI antes de publicar; con el README de la 1.5.0 da «0/2 diagramas Mermaid renderizan».

## 1.5.0 — 2026-10-17 · Imágenes de contenedor sin fijar por digest
- **Nueva regla MCPS-SC-004.** Detecta servidores `docker run` / `podman run` (también con `cmd /c`, `wsl` y `docker container run`) cuya imagen no va fijada por digest (`@sha256:…`). Una etiqueta es un puntero movible: quien controle el registro o la cuenta puede publicar otra imagen con el mismo nombre. Es el equivalente en contenedores de `npx -y` sin versión.
  - Severidad: **alta** sin versión o con `latest` y `--pull always` (se descarga una imagen nueva en cada arranque); **media** con etiqueta y `--pull always`; **baja** en el resto, porque Docker guarda la imagen en caché hasta la siguiente descarga. Así la configuración oficial de GitHub queda en baja, sin ruido.
  - No marca imágenes `${VAR}` ni las `mcp-sandbox/*` que se construyen con el Dockerfile generado, cuya imagen base ya va por digest.
  - La corrección explica cómo obtener el digest (`docker buildx imagetools inspect`) y cómo escribir la referencia.
- **Endurecimiento:** `--pull always` ya se eliminaba (lista blanca); ahora el veredicto avisa además de las imágenes que quedan sin digest, porque MCP-Shield no puede conocer el digest y no lo inventa.
- La lectura de la imagen (`containerImage`) se comparte entre la regla y el endurecimiento: opciones globales (`-H tcp://…`), `container run`, opciones con valor, `--opt=valor` y `--`. Un registro con puerto (`localhost:5000/img`) no se confunde con una etiqueta.
- La figura «Cero telemetría» calcula el ancho de los cartuchos según el número de reglas; una prueba exige un cartucho por regla.
- **README con el formato del ecosistema** (el de Rosetta): cabecera, distintivos, tabla `mcp-shield.yaml` con fichas, índice, secciones con iconos Lucide, mapa mental, vistas, capturas, arquitectura en Mermaid, novedades, tabla de calidad con el recuento real por suite, estructura y tarjeta de autor. Iconos y fichas generados desde Lucide con `npm run readme-assets`; capturas regeneradas con `npm run capturas` (escritorio y móvil).
- Móvil: el aviso de ecosistema bajo los exportes ya no deja el icono solo en una línea.
- La corrección escribe bien la referencia de una imagen con etiqueta (`ghcr.io/acme/srv:1.2.0@sha256:…`, sin repetir la etiqueta) y quita `latest` de la referencia fijada.
- Pruebas: 412 de vitest (27 nuevas en `tests/images-v150.test.ts`).

## 1.4.0 — 2026-10-17 · Identidad del ecosistema y SARIF útil fuera de la app
Se mantiene la estructura (cinco vistas, ES/EN, móvil, 0 infracciones de axe) y se alinea con el resto de herramientas del autor.
- **Siete colores de acento** del ecosistema (azul eléctrico por defecto, rosa, solar, glaciar, orquídea, verde bosque y rojo), con selector en la cabecera (icono Lucide `Palette`) y en el menú móvil. Se guarda en `mcps-accent` y se aplica antes del primer pintado, sin parpadeo. El acento solo marca la marca: botón principal, pestaña activa, foco, antetítulos, enlaces y logotipo. Peligro, seguro y aviso siguen con sus colores. Una prueba comprueba los 7 acentos en los dos temas: texto ≥ 4,5:1 sobre el fondo y sobre su propio tinte, botón ≥ 4,5:1 también al pasar el ratón y anillo de foco ≥ 3:1.
- **Medidor lineal de riesgo** en lugar del anillo, porque los anillos son la firma visual de Rosetta: cifra grande, nota y una barra 0–100 dividida en las bandas A–F con su letra y una aguja en la puntuación. Las bandas salen de `src/engine/grades.ts`, la misma constante con la que el escáner pone la nota, y una prueba lo comprueba.
- **Severidades traducidas** («Crítica, Alta, Media, Baja» / «Critical…»); antes salían en inglés también en la interfaz en español. Etiquetas de al menos 11 px.
- **Ecosistema GRC** en la ayuda y en la paleta de comandos: la ruta mcp.json → SARIF → CTEM-Nexus → Rosetta, comprobada con el importador real de CTEM-Nexus (reconoce el SARIF, importa los 10 hallazgos de la demo con su severidad y los asocia a controles unificados), y las siete herramientas con «Abrir» y «Código», más Auditor LLM. Aviso bajo los exportes del Auditor.
- **SARIF:** los metadatos de cada regla describían su *primer hallazgo* (paquete y servidor concretos) y MCPS-SC-002 aparecía con el nombre de SC-001. Ahora cada regla lleva su propio nombre, una ayuda genérica con enlace a las reglas y la peor severidad vista; el detalle de cada caso va en el mensaje del resultado. Lo leen así GitHub code scanning y CTEM-Nexus.
- **Revisión de Cursor Bugbot sobre la 1.3.4:** el Dockerfile generado seguía instalando `exec` o `dlx` con `npm exec`, `bun x` o `pnpm dlx`, y `--package pkg` / `-p pkg` (con espacio) se ignoraban. Ahora una sola función (`runnerPackage`) lee el paquete para la regla, la config endurecida y el Dockerfile.
- **Cabecera:** entre 768 y 1279 px no cabía y la página se desplazaba en horizontal; las pestañas pasan a la segunda fila hasta 1280 px y el sello «cero egress» usa su forma corta. El e2e lo comprueba a 768, 1024, 1280 y 1440 px en los dos idiomas.
- **Accesibilidad:** el selector de acento es un grupo de botones con `aria-pressed` y dentro del menú móvil usa `menuitemradio`. Escape cierra y devuelve el foco.
- Pruebas: 385 de vitest (18 nuevas de acentos, SARIF y bandas) y nuevos pasos e2e (acento aplicado, guardado y conservado al recargar, ecosistema con axe, cabecera sin desbordamiento).

## 1.3.4 — 2026-10-17 · Nombres que chocan con `Object.prototype`
Cada corrección tiene una prueba que reproducía el fallo antes del arreglo (`tests/keys-v134.test.ts` y un paso nuevo en `scripts/e2e.mjs`).
- **Evasión del auditor con un servidor llamado `__proto__`.** `JSON.parse` conserva la clave como propia, así que Claude Desktop, Cursor o VS Code lanzan ese servidor. En el parser, `mcpServers[name] = s` cambiaba el prototipo en lugar de crear la entrada: el servidor desaparecía del análisis sin aviso. Una configuración con `npx -y evil-pkg /` y un token de GitHub sacaba **A, 0 hallazgos**. Lo mismo ocurría con claves `__proto__` en `env` y `headers` (el secreto no se analizaba), en la vista ocultada y en la config endurecida.
- **Caída del Auditor con un servidor llamado `constructor`, `hasOwnProperty`, `isPrototypeOf`…** `mergeTools` leía `imported[n]` sin comprobar que fuera propia, recibía la función heredada y fallaba con `extra is not iterable`: la vista se caía y no se veía ningún hallazgo.
- Arreglo: `src/engine/ownKeys.ts` (`setOwn`, `getOwn`, `hasOwn`) en el parser, la importación de `tools/list`, la ocultación, el remediador y el Auditor. Solo escribe y lee propiedades propias; no hay contaminación global del prototipo. El monitor de integridad ya era inmune (indexa con `Map`) y tiene prueba.
- **MCPS-SC-001 cubre `npm exec`, `npm x` y `bun x`**, que descargan y ejecutan un paquete igual que `npx` y antes no se analizaban, y lee el paquete de `--package=`. La config endurecida nombra la imagen por el paquete (antes, con `pnpm dlx`, usaba `dlx`) y su re-escaneo ya no marca SC-001.
- README: el bloque de resumen decía `version: 1.1.0`, `vitest 160` y 11 reglas; ahora refleja la 1.3.4, 359 pruebas y las 8 reglas de integridad. La estructura incluye `src/integrity/` y los scripts e2e.

## 1.3.3 — 2026-10-16 · Guía de diseño móvil
- **Paleta de 4 tonos**: pizarra (neutro), rojo (único acento saturado: inyección y peligro), esmeralda (seguro) y ámbar (aviso), más cian atenuado solo para foco e información. Naranja, amarillo y violeta se integran en ámbar o pizarra; esmeralda, ámbar y cian se desaturan mezclándolos con pizarra.
- **Contraste**: el texto de cuerpo y el atenuado alcanzan al menos 7:1 en ambos temas (pizarra-400 ajustada); todo el texto, al menos 4.5:1. La prueba de contraste exige 7:1 en los pares de cuerpo y comprueba que no haya más de 5 tonos.
- **Jerarquía de botones**: primario sólido, secundario gris neutro y terciario con contorno (44 px de alto en táctil). Imprimir y Reiniciar son terciarios legibles; deshabilitados se muestran con borde discontinuo y texto ≥ 7:1. Reiniciar mantiene la confirmación.
- **Acciones del Auditor en móvil**: apiladas a todo el ancho, alineadas a la izquierda, mismo ancho y espaciado.
- **«Ver un ataque en 5 s»**: botón terciario bajo el título del Auditor vacío que abre el Simulador e inicia la cadena de ataque. El Auditor sigue siendo la vista inicial.
- **Primeros pasos en móvil**: una sola línea descartable que se despliega al tocarla.
- **Sello de la cabecera móvil**: «0 egress» con escudo, título y `aria-label`; abre el modal y cabe a 320 px.
- Iconos solo de contorno (se quita el relleno del icono Play).
- **Integridad (revisión R1–R4, con prueba de regresión antes de cada corrección)**:
  - R1: el estado de Integridad (clave HMAC, baseline, candidato, registro) vive en un proveedor por encima de las pestañas; ya no se pierde al cambiar de vista. Solo en memoria y se borra al Reiniciar.
  - R2: `schemaDiff` clasifica de forma conservadora cada cambio de esquema como AMPLIADO, RESTRINGIDO o DESCONOCIDO; un cambio desconocido nunca se trata como compatible (nota `unknown`, confianza baja, hallazgo MCPS-INT-003 medio).
  - R3: TOFU solo crea una baseline completa con una captura completa; con una parcial solo se puede crear una «Baseline provisional», marcada en la interfaz y en los exportes (`baselineStatus: provisional-no-coverage-guarantee`).
  - R4: `openBaseline` valida de forma estricta la carga descifrada (mismo validador y límites, a prueba de `__proto__`) y la rechaza con un error ES/EN.
- **Sin CLI de captura**: la interfaz y el README explican que la captura local aún no está implementada; Integridad funciona con snapshots importados y demos. El siguiente paso previsto es un recolector local opcional para servidores autorizados.
- **Simulador, terminal «Impacto en el host» en móvil**: el panel se ajusta a su contenido (sin desplazamiento interno, sin máscara ni hueco en blanco) y las líneas largas se parten; el desplazamiento automático solo actúa cuando el panel realmente desplaza (escritorio). Se corrige la última línea recortada a 390 px.
- e2e móvil: CTA visible arriba y ataque iniciado en menos de 5 s, acciones apiladas e iguales, primeros pasos plegados, sello con texto y última línea del terminal visible a 390 px sin hueco.

## 1.3.2 — 2026-10-16 · Barra inferior en móvil
- En pantallas de menos de 640 px las pestañas pasan a una **barra inferior fija** (estilo iOS): icono Lucide + etiqueta corta (Auditor, Integridad, Simulador, Gobernanza, Ayuda / Auditor, Integrity, Simulator, Governance, Help), translúcida con `backdrop-filter` y fondo opaco con `prefers-reduced-transparency` o sin soporte de desenfoque. Estado activo con `aria-current`, accesible por teclado, objetivos de 44 px o más y respuesta al pulsar.
- Área segura de iOS: `viewport-fit=cover` y `env(safe-area-inset-bottom)`; el contenido, el pie y los avisos se desplazan para que la barra nunca los tape.
- Sello «cero egress» compacto en la cabecera móvil que abre el modal existente.
- e2e móvil ampliado (320/360/390/430 × 844 px, claro/oscuro, ES/EN): barra fija abajo, 5 pestañas sin etiquetas recortadas, objetivos ≥ 44 px, `aria-current` correcto, navegación con teclado, pie no tapado por la barra y sello visible.

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
