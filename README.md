# MCP-Shield 🛡️

Simulador de Kill-Chain y auditor SAST **100% client-side** para configuraciones Model Context Protocol (`mcp.json`, `claude_desktop_config.json`, `.cursor/mcp.json`).

> Proyecto educativo y defensivo. Todos los payloads, claves (`sk-FAKE-…`, `ghp_FAKE…`) y hosts son simulados.

## Qué hace
- **Simulador (pestaña inicial):** 4 kill-chains en 3 paneles sincronizados — lo que ve el usuario, el tráfico JSON-RPC 2.0 (`tools/list`, `tools/call`) con la inyección resaltada en rojo y el impacto en el host. Modo **Vulnerable vs Hardened**. Impacto visible en < 5 s.
  1. Tool Poisoning → robo de `~/.ssh/id_rsa` *(ilustrativo)*
  2. Rug-pull `postmark-mcp` 1.0.16 → BCC oculto *(caso real)*
  3. CVE-2025-68144 · Git MCP + Filesystem MCP *(CVE real, cadena simplificada)*
  4. Cross-Server Tool Shadowing *(ilustrativo)*
- **Auditor:** pega o abre tu `mcp.json`; 10 reglas en 4 categorías (supply chain, filesystem, secretos, tool poisoning), risk score, diff *Vulnerable vs Hardened*, `mcp.json` corregido y sandbox Docker (`--network none`, `--read-only`, `--cap-drop ALL`).
- **Exportes:** SARIF 2.1.0 (pestaña Security de GitHub) y Markdown, descargados con Blob local.
- **Gobernanza:** mapeo orientativo a NSA MCP CSI (may 2026), OWASP Agentic Top 10 2026, ISO/IEC 42001 y CSA.

## Idioma y tema
Conmutador ES/EN y claro/oscuro en la cabecera (se guardan en localStorage; el tema sigue `prefers-color-scheme` por defecto). Contraste WCAG AA verificado por test en ambos temas (`tests/contrast.test.ts`).

## Cero telemetría
Sin backend, sin analytics, sin fuentes externas. CSP con `connect-src 'none'`. Compruébalo en DevTools → Network.

## Desarrollo
```bash
npm install
npm run dev      # http://localhost:5173/mcp-shield/
npm test         # vitest: reglas y exportadores
npm run build    # dist/ para GitHub Pages (base /mcp-shield/)
```

## Fuentes
Todas las cifras, CVEs e incidentes están en [docs/SOURCES.md](docs/SOURCES.md).

## Licencia
MIT © Yoandy Ramírez Delgado (heindall92)

---

## English

MCP-Shield is a **100% client-side** Kill-Chain simulator and SAST auditor for Model Context Protocol configs. Use the ES/EN switch in the header to read the whole UI, findings and exports in English. Run `npm run dev`, `npm test`, `npm run build`. Sources: [docs/SOURCES.md](docs/SOURCES.md).

Design references (patterns re-implemented, no code copied): 21st.dev Segmented Tabs (micka_design), Segmented Control Tabs (Cnippet), 8-bit Demo Shell (OrcDev) — see docs/DESIGN-REFERENCES.md.
