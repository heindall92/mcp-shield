<h1 align="center">MCP-Shield</h1>

<p align="center"><b>Auditor de seguridad para configuraciones Model Context Protocol · simulador de kill-chain · matriz de gobernanza</b><br/>100% en el navegador, sin servidor y sin peticiones de red.</p>

<p align="center">
  <a href="https://heindall92.github.io/mcp-shield/"><img alt="Abrir MCP-Shield" src="https://img.shields.io/badge/ABRIR-heindall92.github.io%2Fmcp--shield-10B981?style=for-the-badge"/></a>
</p>
<p align="center">
  <img alt="Versión 1.3.1" src="https://img.shields.io/badge/versi%C3%B3n-1.3.1-555?style=flat"/>
  <a href="LICENSE"><img alt="Licencia MIT" src="https://img.shields.io/badge/LICENCIA-MIT-4169A1?style=flat"/></a>
  <a href="https://github.com/heindall92/mcp-shield/actions/workflows/pages.yml"><img alt="Deploy" src="https://github.com/heindall92/mcp-shield/actions/workflows/pages.yml/badge.svg"/></a>
  <img alt="SARIF 2.1.0" src="https://img.shields.io/badge/SARIF-2.1.0%20validado-3B6FD4?style=flat"/>
  <img alt="CSP connect-src none" src="https://img.shields.io/badge/CSP-connect--src%20'none'-2E8B57?style=flat"/>
  <img alt="axe-core 0 violaciones" src="https://img.shields.io/badge/axe--core-0%20violaciones-2E8B57?style=flat"/>
  <img alt="Interfaz ES/EN" src="https://img.shields.io/badge/UI-ES%20%2F%20EN-2E8B57?style=flat"/>
  <img alt="Iconos Lucide" src="https://img.shields.io/badge/iconos-Lucide-F56565?style=flat"/>
</p>

<p align="center"><img src="docs/img/auditor-dark.png" alt="Auditor de MCP-Shield con una configuración real: risk score, hallazgos con secretos ocultos y diff vulnerable frente a endurecida" width="880"/></p>

MCP-Shield revisa el `mcp.json` de Claude Desktop, Cursor o VS Code y te dice qué servidores MCP te ponen en riesgo: paquetes sin versión fijada, acceso a `~/.ssh` o a todo el disco, contenedores sin aislamiento, secretos en texto plano y descripciones de herramientas envenenadas. Para cada hallazgo propone la corrección y genera una configuración endurecida, un sandbox Docker y exportes SARIF y Markdown. **Tu configuración no sale del navegador** y los secretos detectados se ocultan en pantalla y en cada exporte, con un control final que bloquea la descarga si queda algo con forma de secreto (protección de mejor esfuerzo, no una garantía).

> Proyecto educativo y defensivo. Los ataques del simulador y todas las claves de ejemplo (`sk-FAKE-…`, `ghp_FAKE…`) son ficticios.

```text
mcp-shield:~$ cat mcp-shield.yaml
├─ entrada:     mcpServers · servers (.vscode) · mcp.servers · JSONC · BOM · límite 1 MiB / 500 servidores
├─ reglas:      11 (supply chain 3 · filesystem 3 · secretos 2 · tool poisoning 3)
├─ salidas:     SARIF 2.1.0 · Markdown · mcp.json endurecido (${VAR}) · Dockerfile + compose · impresión/PDF
├─ gobernanza:  OWASP Agentic Top 10 2026 · NSA MCP CSI · ISO/IEC 42001 · CSA (mapeo orientativo)
├─ aplicación:  React 19 · TypeScript · Vite · Tailwind CSS 3 · Lucide
├─ pruebas:     vitest 160 · Playwright + axe-core (4 vistas × 2 temas × 2 idiomas) · esquema SARIF oficial
╰─ seguridad:   CSP connect-src 'none' · referrer no-referrer · cero terceros · lo pegado no se persiste
version: 1.1.0 · licencia: MIT
```

---

## Índice

- [Cómo se usa](#cómo-se-usa)
- [Vistas](#vistas)
- [Capturas](#capturas)
- [Arranque rápido](#arranque-rápido)
- [Arquitectura](#arquitectura)
- [Monitor de integridad](#monitor-de-integridad)
- [Reglas](#reglas)
- [Calidad](#calidad)
- [Seguridad y privacidad](#seguridad-y-privacidad)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Estructura](#estructura)
- [Licencia y créditos](#licencia-y-créditos)
- [Autor](#autor)
- [English](#english)

## Cómo se usa

1. Abre **https://heindall92.github.io/mcp-shield/**.
2. Pega tu configuración, suéltala sobre el editor o pulsa **Abrir archivo local** (`claude_desktop_config.json`, `.cursor/mcp.json`, `.vscode/mcp.json`). ¿Sin archivo a mano? **Cargar ejemplo de demo**.
3. Revisa los hallazgos: riesgo, evidencia (con los secretos detectados ocultos), ubicación y corrección.
4. Exporta **SARIF** (pestaña *Security* de GitHub) o **Markdown**, copia el `mcp.json` endurecido o imprime el informe.
5. **Reiniciar / dejar limpio** borra el texto, los resultados y los datos locales de la app (se conservan idioma y tema).

Atajos: <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> paleta de comandos · <kbd>/</kbd> buscar · <kbd>?</kbd> atajos · <kbd>1</kbd>–<kbd>5</kbd> vistas · <kbd>T</kbd> tema · <kbd>L</kbd> idioma · <kbd>Esc</kbd> cerrar.

## Vistas

| Vista | Para qué |
|---|---|
| **Auditor** (inicio) | Análisis de tu configuración real: risk score, hallazgos, panel de **cobertura** (estado PASS/FAIL/NOT_EVALUATED/ERROR de cada regla y superficies analizadas), importador de respuestas **`tools/list`** por servidor, diff *Vulnerable vs Hardened* con veredicto **Endurecida / Parcialmente endurecida** tras re-escanear la config generada, sandbox Docker y exportes con control final de secretos. |
| **Integridad** | Monitor de integridad de herramientas: baseline aprobada frente a captura nueva, huellas SHA-256/HMAC, eventos por campo, revisión humana con TOFU, paquete cifrado y exportes. |
| **Simulador (demo)** | Cuatro kill-chains con datos ficticios en tres paneles sincronizados (lo que ve el usuario, el JSON-RPC que recibe el modelo, el impacto en el host). Modo *Vulnerable* / *Hardened*. |
| **Gobernanza** | Cada regla mapeada a OWASP Agentic Top 10 2026, NSA MCP CSI, ISO/IEC 42001 y CSA, más incidentes reales verificados. |
| **Ayuda** | Buscador, uso, FAQ, reglas, atajos, privacidad, aviso legal, créditos y licencias, acerca de. |

## Capturas

| | |
|---|---|
| <img src="docs/img/inicio-dark.png" alt="Inicio limpio con la tarjeta de primeros pasos" width="420"/> | <img src="docs/img/paleta-dark.png" alt="Paleta de comandos filtrando ejemplos de demo" width="420"/> |
| Inicio limpio y primeros pasos | Paleta de comandos (⌘K / Ctrl+K) |
| <img src="docs/img/auditor-light.png" alt="Auditor en tema claro e inglés" width="420"/> | <img src="docs/img/ayuda-light.png" alt="Centro de ayuda en tema claro" width="420"/> |
| Auditor · tema claro · EN | Centro de ayuda |
| <img src="docs/img/simulador-dark.png" alt="Simulador de kill-chain marcado como demo educativa" width="420"/> | <img src="docs/img/informe-print.png" alt="Vista de impresión del informe sin el editor" width="420"/> |
| Simulador (demo educativa) | Informe para imprimir / PDF |

## Arranque rápido

```bash
git clone https://github.com/heindall92/mcp-shield.git && cd mcp-shield
npm ci
npm run dev      # http://localhost:5173/mcp-shield/
npm test         # vitest
npm run lint     # oxlint
npm run build    # dist/ (base /mcp-shield/)
```

El despliegue lo hace `.github/workflows/pages.yml` (tests → build → comprobación de egress → GitHub Pages) en cada push a `main`.

## Arquitectura

```text
mcp.json ──► parse.ts (JSONC, formatos, límites) ──► scanner.ts ──► 11 reglas ──► redact.ts
                                                         │                         │
                                                         ▼                         ▼
                                       remediator.ts (config ${VAR}, Docker)   UI · SARIF · Markdown · impresión
```

Todo es TypeScript puro en `src/engine/`, sin dependencias de ejecución salvo React y Lucide. La UI nunca guarda el texto pegado: vive en memoria.

## Monitor de integridad

Nuevo en v1.3.0 (RFC-001 «Tool Integrity Monitor», parte web offline). Compara el inventario de herramientas **aprobado** de un servidor MCP con una captura nueva y detecta *rug pulls* (cambios silenciosos de descripciones, esquemas o anotaciones) antes de usarlo.

- **Entrada**: respuesta JSON-RPC `tools/list` (única o paginada, con o sin pares `request`/`response`) o un archivo `MCPShieldSnapshot 1.0`. Las capturas JSON-RPC exigen su contexto: perfil, identidad (`authContextId`), servidor, versión MCP y transporte (`stdio` / `streamable-http`).
- **Validación**: 8 MiB, 1000 herramientas, 128 páginas y profundidad 64; nombres duplicados y cursores circulares son error; un hueco de cursor o un `resultType` distinto de `complete` dejan la captura como **parcial**, y una captura parcial nunca concluye `TOOL_REMOVED`. Los `$ref` externos y las URL de iconos **no se cargan nunca**; el Unicode se conserva tal cual. El análisis pesado corre en un Web Worker con tiempo límite.
- **Huellas**: canonicalización JCS (**RFC 8785**, verificada con los vectores del RFC), SHA-256 público de una proyección redactada y **HMAC-SHA-256** por herramienta más una raíz que liga perfil, identidad, transporte, protocolo y completitud. La clave HMAC vive solo en memoria (WebCrypto, no extraíble).
- **Comparación**: solo dentro del mismo perfil, identidad y transporte; si no, `CONTEXT_MISMATCH` bloquea el diff. Eventos `TOOL_ADDED`, `TOOL_REMOVED`, `DESCRIPTION_CHANGED`, `SCHEMA_CHANGED` (con notas de compatibilidad), `INPUT_EXPANDED`, `ANNOTATION_CHANGED`, `INVISIBLE_PAYLOAD`, `INTEGRITY_MISMATCH`, cada uno con evidencia por campo y nivel de confianza.
- **Riesgos separados**: *Integrity Risk* (reglas MCPS-INT-001..008) y *Configuration Risk* (TP-001/002/003 reutilizadas sobre el contenido importado).
- **Revisión humana**: aprobar, rechazar, aceptar riesgo (con fecha de revisión) o pedir revalidación. Nada se aprueba solo; la primera baseline exige una lista TOFU. Registro local de decisiones.
- **Paquete cifrado opcional**: AES-256-GCM con clave derivada de la contraseña (PBKDF2-SHA256, 600 000 iteraciones, parámetros versionados, cabecera autenticada como AAD). La contraseña no se guarda.
- **Exportes**: SARIF, Markdown y JSON redactados, sin la clave HMAC, todos por el control de salida.
- **Demo**: baseline limpia de `acme-mail` frente a un candidato con `send_email` modificado (directiva oculta, caracteres Unicode Tag, nuevo parámetro `bcc` reflejado en `x-mcp-header`) y una herramienta de nombre confundible.
- **Captura directa (CLI, RFC §10)**: planificada / experimental. **No** está incluida en esta versión.

Desviaciones respecto al RFC: PBKDF2 en lugar de Argon2id (WebCrypto no ofrece Argon2 y no se añaden dependencias criptográficas); `extensions` no es un campo de Tool en MCP 2026-07-28 y se usa solo como contenedor propio de claves desconocidas; los iconos se tratan como metadatos de anotación; MCPS-INT-006 compara nombres nuevos con la baseline (no con todos los perfiles guardados, porque no se guardan).

## Reglas

| ID | Qué detecta |
|---|---|
| MCPS-SC-001 | `npx -y` / `uvx` / `bunx` / `pnpm dlx` sin versión exacta (incluye `cmd /c npx` y `npx.cmd`) |
| MCPS-SC-002 | Paquete npm sin scope de publisher verificable |
| MCPS-SC-003 | Servidor remoto por `http://` o `ws://` (excepto localhost) |
| MCPS-FS-001 | Acceso a `/`, `C:\`, home completo, `~/.ssh`, `~/.aws`, directorios de sistema (args, `-v`, `--mount`) |
| MCPS-FS-002 | `mcp-server-git` anterior a 2025.12.18 (CVE-2025-68144) |
| MCPS-FS-003 | Contenedor con `--privileged`, `--network host`, `--pid host`, socket de Docker; red abierta (bajo) |
| MCPS-SEC-001 | Secretos en `env`, `headers` (`Authorization: Bearer …`) o en la URL |
| MCPS-SEC-002 | Secretos en argumentos de línea de comandos |
| MCPS-TP-001 | Tool Poisoning: directivas ocultas, ocultación al usuario, ficheros sensibles, exfiltración, zero-width |
| MCPS-TP-002 | Cross-server tool shadowing |
| MCPS-TP-003 | ASCII smuggling: caracteres Unicode Tag (U+E0000–E007F, con el texto oculto decodificado), selectores de variación en serie (U+FE00–FE0F, U+E0100–E01EF), Sneaky Bits y secuencias ANSI en nombres, descripciones y args. Inspirada en las sondas de [NVIDIA garak](https://github.com/NVIDIA/garak). Sin falsos positivos con emoji normales (VS16, banderas de subdivisión, ZWJ) |
| MCPS-INT-001 | Nueva herramienta no aprobada (medio) |
| MCPS-INT-002 | Descripción modificada con indicios de inyección (alto/crítico) |
| MCPS-INT-003 | Superficie de entrada ampliada: parámetros nuevos, `additionalProperties`, enum o límites relajados (alto) |
| MCPS-INT-004 | Cambio de anotaciones sensibles (`readOnlyHint`, `destructiveHint`…) (medio) |
| MCPS-INT-005 | Payload invisible nuevo (crítico) |
| MCPS-INT-006 | Nombre confundible con otra herramienta (medio) |
| MCPS-INT-007 | Cambio en `_meta` o campos desconocidos, o huella distinta sin clasificar (medio) |
| MCPS-INT-008 | Cambio en `x-mcp-header` (alto) |

Las cifras, CVE e incidentes están contrastados con fuentes primarias en [docs/SOURCES.md](docs/SOURCES.md).

## Calidad

- **Más de 300 pruebas vitest**: vectores de RFC 8785, importador y límites, huellas, cifrado (ida y vuelta, contraseña errónea, cabecera alterada), comparador (RFC-001 §13.1), aprobación TOFU, exportes sin secretos; reglas, falsos positivos con configuraciones de la documentación oficial, parser (BOM, JSONC, formatos, tamaño, entradas no objeto), ocultación contextual de secretos y control de salida en cada exporte, endurecimiento de contenedores por lista blanca con re-escaneo, cobertura de reglas, importación `tools/list`, SARIF validado con el esquema OASIS, inyección Markdown, pruebas adversariales (JSONC roto, Unicode enorme, caracteres invisibles, rutas Windows, argumentos Docker contradictorios), versión única, paridad ES/EN y contraste WCAG AA en ambos temas. Las pruebas de regresión de la auditoría externa están en `tests/audit-v122.test.ts`.
- **CI**: el despliegue en Pages solo ocurre si pasan lint, tipos, pruebas, build, comprobación de cero egress, `npm audit --omit=dev`, e2e (Playwright + axe + prueba negativa de red) y CodeQL; dependency review en pull requests.
- **Playwright + axe-core**: 0 violaciones WCAG 2 A/AA en Auditor, Integridad, paleta, Ayuda, Gobernanza y Simulador, en claro/oscuro y ES/EN; cero peticiones externas; ningún secreto en `localStorage`.
- `oxlint` sin avisos. `npm audit --omit=dev`: 0 vulnerabilidades (los avisos restantes son de herramientas de desarrollo ligadas a Tailwind 3).

## Seguridad y privacidad

- **Sin servidor, analítica, cookies ni terceros.** Fuentes Inter y JetBrains Mono (variables, OFL 1.1) autoalojadas con Fontsource bajo `font-src 'self'`, con fuentes del sistema como respaldo; ninguna petición a otro origen. La figura «Cero telemetría» de la ayuda muestra el recuento real de peticiones externas (Resource Timing API).
- **CSP** en `<meta>`: `default-src 'self'; script-src 'self'; connect-src 'none'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`, más `<meta name="referrer" content="no-referrer">`.
- **Secretos (mejor esfuerzo)**: los detectados —formatos conocidos y cualquier valor en posiciones sensibles (`env`, `-e KEY=VAL`, `--env`, cabeceras, parámetros de URL, valor tras `--token`/`--key`/`--password`…) salvo literales seguros— se ocultan en pantalla, SARIF, Markdown, impresión y portapapeles; la config corregida usa referencias `${VAR}`. Un control final escanea cada exportación (patrones y cadenas de alta entropía) y la bloquea si queda algo sospechoso. Ninguna detección es perfecta: revisa lo que compartes. El texto pegado nunca se guarda ni se registra. `localStorage` solo contiene `mcps-lang`, `mcps-theme` y `mcps-onboarded`.
- **XSS**: React escapa toda salida; los exportes Markdown escapan HTML, `|` y backticks.
- **Cabeceras HTTP en GitHub Pages**: Pages no permite configurar cabeceras de respuesta ([github/pages-gem#415](https://github.com/github/pages-gem/issues/415)). GitHub ya envía `Strict-Transport-Security` (comprobado con `curl -I`), pero no es posible añadir `X-Frame-Options` ni `Content-Security-Policy` como cabecera, y `frame-ancestors` se ignora dentro de `<meta>` ([CSP3](https://www.w3.org/TR/CSP3/#meta-element)). La app no tiene acciones con estado que un *clickjacking* pueda aprovechar; si lo necesitas, sírvela tras un proxy (p. ej. Cloudflare) que añada esas cabeceras.
- Para informar de una vulnerabilidad: [SECURITY.md](SECURITY.md).

## Limitaciones conocidas

- Las reglas son **heurísticas**: puede haber falsos positivos y negativos. No sustituye a una auditoría profesional.
- La config corregida es un **punto de partida**: sustituye las versiones `@1.0.0`, construye las imágenes `mcp-sandbox/*` con el Dockerfile generado y adapta `${VAR}` a tu cliente (`${env:VAR}` en Cursor, `${input:id}` o `envFile` en VS Code; la documentación de Claude Desktop no describe interpolación).
- El mapeo de gobernanza es **orientativo**, no una certificación.
- El análisis no se conecta a los servidores: solo ve las descripciones de herramientas que incluyas en el JSON.
- Todas las apps de `heindall92.github.io` comparten origen; por eso MCP-Shield no guarda nada sensible.

## Estructura

```text
src/
  engine/        parse · scanner · rules/ · redact · remediator · sarifExporter · governance · simulation
  components/    auditor/ · simulator/ · governance/ · help/ · ui/ (paleta, toasts, diálogos, segmented)
  i18n/          ui.ts (ES/EN) · prefs · storage
  data/          escenarios, ejemplos de demo, incidentes
tests/           vitest + esquema SARIF oficial
docs/            SOURCES.md · DESIGN-REFERENCES.md · img/
```

## Licencia y créditos

MIT © Yoandy Ramírez Delgado. Iconos [Lucide](https://lucide.dev/license) (ISC; los derivados de Feather, MIT). React, Tailwind CSS y Vite (MIT). Fuentes Inter y JetBrains Mono (SIL OFL 1.1) vía Fontsource (MIT). Figura isométrica con el kit [anatomy](https://github.com/wheresryan22/anatomy) (MIT, copiado en `src/components/iso/`). Regla MCPS-TP-003 inspirada en [NVIDIA garak](https://github.com/NVIDIA/garak) (Apache-2.0, sin copiar código). Ver [NOTICE](NOTICE). Patrones de diseño de 21st.dev reimplementados desde cero: [docs/DESIGN-REFERENCES.md](docs/DESIGN-REFERENCES.md). Cambios: [CHANGELOG.md](CHANGELOG.md).

El software se ofrece «tal cual», sin garantía. Úsalo solo con configuraciones propias o autorizadas.

## Autor

**Yoandy Ramírez Delgado** · ciberseguridad

<a href="https://github.com/heindall92"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white"/></a>
<a href="https://www.linkedin.com/in/yoandyrd92/"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white"/></a>
<a href="https://yoandyramirez.com"><img alt="Portafolio" src="https://img.shields.io/badge/Portafolio-10B981?style=flat"/></a>

Otras herramientas: [Rosetta](https://heindall92.github.io/rosetta_multinorma/) · [GRC ENS Compliance Studio](https://heindall92.github.io/grc_ens_compliance_studio/) · [CTEM-Nexus](https://heindall92.github.io/ctem-nexus/) · [Auditor LLM](https://heindall92.github.io/auditor_llm/) · [Kairos](https://heindall92.github.io/kairos/) · [Argos GRC](https://heindall92.github.io/argos-grc/)

---

## English

**MCP-Shield** audits Model Context Protocol configurations (Claude Desktop, Cursor, VS Code) entirely in your browser: 11 rules for supply chain, filesystem, secrets and tool poisoning (including ASCII smuggling with Unicode tag characters, inspired by NVIDIA garak); a hardened `mcp.json` with `${VAR}` references; a Docker sandbox; SARIF 2.1.0 and Markdown exports; and a printable report. New in v1.3.0: an offline **integrity monitor** that pins an approved `tools/list` inventory (RFC 8785 canonicalisation, SHA-256 + in-memory HMAC-SHA-256), diffs new captures field by field (rules MCPS-INT-001..008, CONTEXT_MISMATCH blocks cross-identity diffs), requires explicit human approval with a TOFU checklist and can save an AES-256-GCM encrypted baseline package (PBKDF2-SHA256, 600,000 iterations). The capture CLI is planned/experimental and not included. Detected secrets are masked on screen and in every export, and a final output check blocks a download if anything secret-shaped remains (best effort, not a guarantee). Pasted text is never stored. It also ships an educational kill-chain simulator with fictitious data, a governance matrix (OWASP Agentic Top 10 2026, NSA MCP CSI, ISO/IEC 42001, CSA) and a help centre with a command palette (Ctrl/⌘+K) and keyboard shortcuts.

- Live: **https://heindall92.github.io/mcp-shield/**
- Security headers: GitHub Pages cannot set response headers. HSTS is sent by GitHub; `X-Frame-Options` and header-based CSP/`frame-ancestors` are not available, so the CSP is delivered via `<meta>` (with `connect-src 'none'`) plus a `no-referrer` policy.
- Not a substitute for a professional audit. Provided “as is” under the MIT licence. Report vulnerabilities via [SECURITY.md](SECURITY.md).
