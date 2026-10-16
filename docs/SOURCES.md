# Fuentes verificadas (16 oct 2026)

Cada afirmación que aparece en la UI se comprobó contra estas fuentes. Lo que no se pudo verificar se marca en la app como **escenario ilustrativo**.

## CVE-2025-68144 · mcp-server-git
- Aviso oficial GHSA-9xwc-hfwc-8w59: https://github.com/modelcontextprotocol/servers/security/advisories/GHSA-9xwc-hfwc-8w59 — argument injection en `git_diff`/`git_checkout`, CWE-88, afectadas `< 2025.12.18`, parche `2025.12.18`, CVSS 4.0 6.3 (Moderate).
- NVD: https://nvd.nist.gov/vuln/detail/CVE-2025-68144 — CVSS 3.1 7.1 HIGH (NVD primaria).
- Registro CVE (MITRE): https://cveawg.mitre.org/api/cve/CVE-2025-68144 (la descripción del CNA dice "prior to 2025.12.17"; el aviso dice parche en 2025.12.18 — usamos ≥ 2025.12.18).
- Encadenamiento con Filesystem MCP → ejecución de código (investigación de Cyata): https://www.theregister.com/security/2026/01/20/anthropic-quietly-fixed-flaws-in-its-git-mcp-server/4676059 y https://www.csoonline.com/article/4119571/three-vulnerabilities-found-in-anthropic-git-mcp-server-could-let-attackers-tamper-with-llms.html — en la app el encadenamiento se muestra como reconstrucción simplificada y no funcional.

## postmark-mcp (npm)
- Aviso de Postmark: https://postmarkapp.com/blog/information-regarding-malicious-postmark-mcp-package — paquete falso, 15 versiones de confianza, backdoor BCC en 1.0.16; Postmark no tuvo relación.
- OSV MAL-2025-47604: https://osv.dev/vulnerability/MAL-2025-47604 — "turned malicious in v1.0.16 and exfiltrates email data via BCC".
- Koi Security (descubrimiento): https://www.koi.security/blog/postmark-mcp-npm-malicious-backdoor-email-theft
- Snyk: https://snyk.io/blog/malicious-mcp-server-on-npm-postmark-mcp-harvests-emails/

## GhostAction
- GitGuardian: https://blog.gitguardian.com/ghostaction-campaign-3-325-secrets-stolen/ — descubierto el 5 sep 2025; 327 usuarios, 817 repos, 3.325 secretos.
- Nueva ola 2026 (no citada en la UI): https://blog.gitguardian.com/ghostaction-github-actions-supply-chain-attack-returns/

## Salesloft Drift
- Google GTIG: https://cloud.google.com/blog/topics/threat-intelligence/data-theft-salesforce-instances-via-salesloft-drift — UNC6395, tokens OAuth de Drift, 8–18 ago 2025, búsqueda de credenciales (AKIA, Snowflake).
- Salesforce: https://help.salesforce.com/s/articleView?id=005134951&language=en_US&type=1

## Informes y marcos
- NSA AISC, CSI "Model Context Protocol (MCP): Security Design Considerations for AI-Driven Automation", 20 may 2026: https://www.nsa.gov/Press-Room/Press-Releases-Statements/Press-Release-View/Article/4496698/nsa-releases-security-design-considerations-for-ai-driven-automation-leveraging/ · PDF: https://www.nsa.gov/Portals/75/documents/Cybersecurity/CSI_MCP_SECURITY.pdf
- OWASP Top 10 for Agentic Applications 2026 (9 dic 2025, ASI01–ASI10): https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- ISO/IEC 42001:2023 (Anexo A: A.6 ciclo de vida, A.7 datos, A.9 uso, A.10 terceros): https://www.iso.org/standard/42001
- CSA MCP Security Resource Center (ago 2025): https://labs.cloudsecurityalliance.org/mcp/ · https://cloudsecurityalliance.org/blog/2025/08/20/securing-the-agentic-ai-control-plane-announcing-the-mcp-security-resource-center
- Invariant Labs, Tool Poisoning / Tool Shadowing (abr 2025): https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks

## Retirado o suavizado
- "CVSS 7.1" sin contexto → se indica NVD 3.1 7.1 **y** GitHub 4.0 6.3.
- Variante anterior del escenario CVE-2025-68144 que sobrescribía `.zshrc` → sustituida por la cadena publicada (config de git), en versión no funcional.
- Estadísticas de Enkrypt AI y CVE-2025-6514: no se usan en la UI (no se verificaron para este build).
- El mapeo de gobernanza es orientativo (elaborado por MCP-Shield), no un crosswalk oficial.
- Escenarios "Tool Poisoning calculadora" y "Tool Shadowing": técnicas reales (Invariant Labs), servidores ficticios → marcados como **ilustrativos**.

## Formatos de configuración MCP (verificado 16 oct 2026)
- Claude Desktop, `claude_desktop_config.json` con `mcpServers` (ejemplo oficial con `npx -y @modelcontextprotocol/server-filesystem`): https://modelcontextprotocol.io/docs/develop/connect-local-servers — la guía no documenta interpolación de variables.
- Cursor, `.cursor/mcp.json` / `~/.cursor/mcp.json` con `mcpServers`, `url` + `headers`, interpolación `${env:NAME}` en `command`, `args`, `env`, `url` y `headers`: https://cursor.com/docs/context/mcp
- VS Code, `.vscode/mcp.json` con `servers`, `type` stdio/http/sse, `headers`, `inputs` y `${input:id}`, `envFile`; `.mcp.json` portable con `mcpServers`: https://code.visualstudio.com/docs/copilot/reference/mcp-configuration
- `mcp.servers` en `settings.json`: formato anterior de VS Code; se acepta por compatibilidad y la UI lo llama «heredado».

## Licencias de terceros
- Lucide: ISC (iconos derivados de Feather bajo MIT): https://lucide.dev/license
- React, Tailwind CSS, Vite: MIT (ficheros LICENSE de cada repositorio).
- Inter (rsms): SIL OFL 1.1 https://github.com/rsms/inter/blob/master/LICENSE.txt · JetBrains Mono: SIL OFL 1.1 https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt · empaquetadas con Fontsource (@fontsource-variable/inter y /jetbrains-mono 5.3.0, MIT): https://github.com/fontsource/fontsource — los woff2 se sirven desde el propio sitio (`font-src 'self'`).
- anatomy (kit isométrico, MIT, commit e948829 del 15 oct 2026): https://github.com/wheresryan22/anatomy — copiado en src/components/iso/ con su aviso de licencia.
- NVIDIA garak (Apache-2.0): https://github.com/NVIDIA/garak — inspiración de MCPS-TP-003; sin código copiado.

## ASCII smuggling (MCPS-TP-003)
- Sondas de garak `encoding.InjectUnicodeTagChars`, `InjectUnicodeVariantSelectors` e `InjectSneakyBits` (garak/probes/encoding.py, garak/resources/smuggling; revisado en el commit 346497a): https://github.com/NVIDIA/garak/blob/main/garak/probes/encoding.py
- Caracteres Unicode Tag (U+E0000–E007F) como texto oculto: https://embracethered.com/blog/posts/2024/hiding-and-finding-text-with-unicode-tags/
- Sneaky Bits (U+2062 / U+2064): https://embracethered.com/blog/posts/2025/sneaky-bits-and-ascii-smuggler/
- Datos en selectores de variación (U+FE00–FE0F, U+E0100–E01EF): https://paulbutler.org/2025/smuggling-arbitrary-data-through-an-emoji/
- Bloque Tags y secuencias de bandera de subdivisión (emoji tag sequences): https://www.unicode.org/charts/PDF/UE0000.pdf · https://www.unicode.org/reports/tr51/#valid-emoji-tag-sequences
- Esquema SARIF 2.1.0 (OASIS), solo en pruebas: https://docs.oasis-open.org/sarif/sarif/v2.1.0/

## GitHub Pages y cabeceras HTTP
- GitHub Pages no permite cabeceras de respuesta propias (respuesta de GitHub en github/pages-gem#415): https://github.com/github/pages-gem/issues/415 · petición abierta: https://github.com/orgs/community/discussions/54257
- Comprobado con `curl -I` el 16 oct 2026: Pages ya envía `strict-transport-security: max-age=31556952`; no envía `X-Frame-Options` ni CSP como cabecera.
- `frame-ancestors` se ignora dentro de `<meta http-equiv="Content-Security-Policy">` (CSP Level 3, §6.1/§3.3): https://www.w3.org/TR/CSP3/#meta-element

## Monitor de integridad (v1.3.0)
- Esquema oficial MCP 2026-07-28 (`Tool`, `ToolAnnotations`, `ListToolsResult` con `nextCursor`, `ttlMs`, `cacheScope`, `resultType`; `x-mcp-header` en propiedades de `inputSchema`; iconos): https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts · versiones: https://modelcontextprotocol.io/specification/versioning
- Las anotaciones son pistas no fiables: el propio esquema indica que los clientes no deben decidir el uso de herramientas basándose en ellas.
- `extensions` **no** es un campo de `Tool` en el esquema; MCP-Shield lo usa solo como contenedor propio para claves desconocidas.
- JSON Canonicalization Scheme, RFC 8785 (vectores del apéndice B usados en las pruebas): https://www.rfc-editor.org/rfc/rfc8785
- OWASP Password Storage Cheat Sheet: «PBKDF2-HMAC-SHA256: 600,000 iterations» (comprobado el 16 oct 2026): https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Web Crypto API (SHA-256, HMAC, PBKDF2, AES-GCM; sin Argon2): https://www.w3.org/TR/WebCryptoAPI/
