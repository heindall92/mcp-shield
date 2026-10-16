import type { Lang } from '../i18n/lang'
/** Real incidents for context. Only facts verified against primary sources (docs/SOURCES.md). */
const DATA = [
  { id: 'postmark', name: 'postmark-mcp (npm)', date: { es: 'sep 2025', en: 'Sep 2025' },
    fact: { es: 'Paquete no oficial que imitaba a Postmark: 15 versiones limpias y, en la 1.0.16, un BCC oculto que copiaba los emails enviados.', en: 'Unofficial package impersonating Postmark: 15 clean versions, then in 1.0.16 a hidden BCC that copied every email sent.' },
    lesson: { es: 'Fija versiones; npx -y ejecuta lo último publicado.', en: 'Pin versions; npx -y runs whatever was published last.' }, url: 'https://postmarkapp.com/blog/information-regarding-malicious-postmark-mcp-package' },
  { id: 'cve', name: 'CVE-2025-68144 · mcp-server-git', date: { es: 'dic 2025', en: 'Dec 2025' },
    fact: { es: 'Argument injection en git_diff/git_checkout (CWE-88): "--output=<ruta>" sobrescribía ficheros. Parcheado en 2025.12.18. NVD: CVSS 3.1 7.1.', en: 'Argument injection in git_diff/git_checkout (CWE-88): "--output=<path>" overwrote files. Patched in 2025.12.18. NVD: CVSS 3.1 7.1.' },
    lesson: { es: 'Actualiza y no encadenes Git MCP con Filesystem MCP con escritura.', en: 'Upgrade, and do not chain Git MCP with a write-enabled Filesystem MCP.' }, url: 'https://github.com/modelcontextprotocol/servers/security/advisories/GHSA-9xwc-hfwc-8w59' },
  { id: 'ghost', name: 'GhostAction (GitHub Actions)', date: { es: 'sep 2025', en: 'Sep 2025' },
    fact: { es: 'GitGuardian: cuentas de mantenedores comprometidas inyectaron workflows que exfiltraron 3.325 secretos de 817 repositorios.', en: 'GitGuardian: compromised maintainer accounts injected workflows that exfiltrated 3,325 secrets from 817 repositories.' },
    lesson: { es: 'Los secretos en CI/config son el objetivo: referencias + rotación.', en: 'Secrets in CI/config are the target: references + rotation.' }, url: 'https://blog.gitguardian.com/ghostaction-campaign-3-325-secrets-stolen/' },
  { id: 'drift', name: 'Salesloft Drift (UNC6395)', date: { es: 'ago 2025', en: 'Aug 2025' },
    fact: { es: 'Google GTIG: tokens OAuth robados de la integración del agente Drift se usaron para extraer datos de instancias de Salesforce y buscar credenciales.', en: "Google GTIG: OAuth tokens stolen from the Drift agent integration were used to extract data from Salesforce instances and hunt for credentials." },
    lesson: { es: 'Una integración de IA de confianza hereda todos sus tokens.', en: 'A trusted AI integration inherits all of its tokens.' }, url: 'https://cloud.google.com/blog/topics/threat-intelligence/data-theft-salesforce-instances-via-salesloft-drift' },
] as const
export const getIncidents = (lang: Lang) => DATA.map(d => ({ id: d.id, name: d.name, url: d.url, date: d.date[lang], fact: d.fact[lang], lesson: d.lesson[lang] }))
