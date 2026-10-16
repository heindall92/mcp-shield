# Política de seguridad / Security policy

MCP-Shield analiza configuraciones MCP que pueden contener credenciales reales. Una vulnerabilidad aquí podría exponerlas, así que se toma en serio.

## Cómo informar / How to report

**No abras una issue pública. / Do not open a public issue.**

1. [Aviso de seguridad privado de GitHub](https://github.com/heindall92/mcp-shield/security/advisories/new) (preferida / preferred).
2. Correo / email: **yoandyramirezdelgado@gmail.com**, asunto `[SEGURIDAD] MCP-Shield`.

Incluye versión o commit, navegador, pasos para reproducirlo e impacto. **Nunca envíes credenciales reales**: usa tokens ficticios (`ghp_FAKE…`, `sk-FAKE-…`).

## Plazos orientativos / Target timelines

| Plazo | Compromiso |
|---|---|
| 72 h | Acuse de recibo / acknowledgement |
| 7 días | Evaluación inicial y severidad / triage |
| 30 días | Corrección de severidad alta o crítica / fix for high or critical |

## Alcance / Scope

- Fuga de secretos sin ocultar (UI, SARIF, Markdown, config corregida, portapapeles, almacenamiento).
- Cualquier petición de red con datos del usuario (la CSP debe impedirlo: `connect-src 'none'`).
- XSS o inyección HTML/Markdown desde un `mcp.json` malicioso.
- Fallos que dejen la app inutilizable con una entrada manipulada.

Fuera de alcance: cabeceras HTTP que GitHub Pages no permite configurar (ver README › Seguridad), falsos positivos/negativos de las reglas heurísticas (abre una issue normal).
