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
