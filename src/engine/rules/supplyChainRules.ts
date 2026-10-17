import type { Rule, Finding } from '../../types/mcp.types'
import { pick } from '../../i18n/lang'
import { mk, launcher, runnerSubcommand, runnerPackage, containerImage, imagePinned, imageTag, imageName } from './util'

/** Detects remote package execution without a pinned version (rug-pull class, e.g. postmark-mcp). */
const PINNED = /^(@[^/]+\/)?[^@]+@\d+\.\d+\.\d+(-[\w.]+)?$/
const KNOWN_PUBLISHERS = ['@modelcontextprotocol/', '@anthropic-ai/', '@cloudflare/', '@github/']

export const unpinnedNpx: Rule = {
  id: 'MCPS-SC-001', category: 'supply-chain', emits: [{ id: 'MCPS-SC-002', name: { es: 'Publisher npm sin scope verificable', en: 'npm publisher without a verifiable scope' } }], name: { es: 'Paquete remoto sin versión fijada', en: 'Remote package without pinned version' },
  check: ({ serverName, server, lang }) => {
    const L = (es: string, en: string) => pick(lang, es, en)
    const out: Finding[] = []
    const { cmd, args, offset } = launcher(server)
    // Subcommands that download and run a package like npx: pnpm/yarn dlx, npm exec / npm x, bun x
    const sub = runnerSubcommand(cmd, args[0])
    if (!['npx', 'bunx', 'uvx', 'pnpx'].includes(cmd) && !sub) return out
    const dlx = sub ? 1 : 0
    const p0 = runnerPackage(args.slice(dlx))
    const p = p0 && { ...p0, idx: p0.idx + dlx }
    if (!p) return out
    const autoYes = args.includes('-y') || args.includes('--yes')
    const pinned = cmd === 'uvx' ? /(==|@)\d/.test(p.pkg) || args.some(a => /^--from=?/.test(a)) && /(==|@)\d/.test(args.join(' ')) : PINNED.test(p.pkg)
    const label = `${cmd}${sub ? ` ${args[0]}` : ''}${autoYes ? ' -y' : ''}`
    if (!pinned) out.push(mk({
      ruleId: 'MCPS-SC-001', category: 'supply-chain', severity: autoYes ? 'high' : 'medium', server: serverName,
      title: L(`${label} ejecuta "${p.pkg}" sin versión anclada`, `${label} runs "${p.pkg}" without a pinned version`),
      detail: L('Cada arranque descarga la última versión publicada. Un mantenedor comprometido (o malicioso) puede introducir un backdoor en una versión posterior sin que nadie lo revise: el patrón rug-pull documentado en postmark-mcp 1.0.16.',
        'Every start downloads the latest published version. A compromised (or malicious) maintainer can ship a backdoor in a later release without review: the rug-pull pattern documented in postmark-mcp 1.0.16.'),
      evidence: [server.command, ...args].join(' '), location: `mcpServers.${serverName}.args[${p.idx + offset}]`,
      remediation: L(`Fija la versión exacta (p.ej. ${p.pkg.replace(/@latest$/, '')}@1.2.3), quita -y y verifica integridad (lockfile / npm audit signatures).`,
        `Pin the exact version (e.g. ${p.pkg.replace(/@latest$/, '')}@1.2.3), drop -y and verify integrity (lockfile / npm audit signatures).`),
      cwe: 'CWE-494',
    }))
    // PyPI has no scopes: only npm runners get the publisher-scope hint
    if (cmd !== 'uvx' && !KNOWN_PUBLISHERS.some(k => p.pkg.startsWith(k)) && !p.pkg.startsWith('@')) out.push(mk({
      ruleId: 'MCPS-SC-002', category: 'supply-chain', severity: 'low', server: serverName,
      title: L(`Paquete sin scope de publisher verificado: "${p.pkg.split('@')[0]}"`, `Package without a verified publisher scope: "${p.pkg.split('@')[0]}"`),
      detail: L('Los paquetes sin scope son más fáciles de suplantar (typosquatting / suplantación de marca).', 'Unscoped packages are easier to impersonate (typosquatting / brand impersonation).'),
      evidence: p.pkg, location: `mcpServers.${serverName}.args[${p.idx + offset}]`,
      remediation: L('Usa el servidor oficial del proveedor o revisa repositorio, publisher y provenance antes de instalar.', "Use the vendor's official server or review repository, publisher and provenance before installing."),
      cwe: 'CWE-829',
    }))
    return out
  },
}

export const insecureRemote: Rule = {
  id: 'MCPS-SC-003', category: 'supply-chain', name: { es: 'Servidor MCP remoto sin TLS', en: 'Remote MCP server without TLS' },
  check: ({ serverName, server, lang }) => {
    if (!server.url || !/^(http|ws):\/\//i.test(server.url.trim()) || /^(http|ws):\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(server.url.trim())) return []
    const L = (es: string, en: string) => pick(lang, es, en)
    return [mk({
      ruleId: 'MCPS-SC-003', category: 'supply-chain', severity: 'high', server: serverName,
      title: L('Transporte remoto en HTTP plano', 'Remote transport over plain HTTP'), evidence: server.url, location: `mcpServers.${serverName}.url`,
      detail: L('Un atacante en la red puede leer tokens y alterar tools/list (inyectar descripciones envenenadas) en tránsito.', 'An on-path attacker can read tokens and tamper with tools/list (inject poisoned descriptions) in transit.'),
      remediation: L('Usa https:// con OAuth 2.1 y valida el certificado; nunca envíes tokens por HTTP.', 'Use https:// with OAuth 2.1 and validate the certificate; never send tokens over HTTP.'), cwe: 'CWE-319',
    })]
  },
}

/**
 * Container image not pinned by digest. A tag (and above all `latest` or no tag) can be repointed to a different image
 * by whoever controls the registry or the account: the container equivalent of `npx -y` without a version.
 */
export const unpinnedImage: Rule = {
  id: 'MCPS-SC-004', category: 'supply-chain', name: { es: 'Imagen de contenedor sin fijar por digest', en: 'Container image not pinned by digest' },
  check: ({ serverName, server, lang }) => {
    const L = (es: string, en: string) => pick(lang, es, en)
    const { cmd, args, offset } = launcher(server)
    if (cmd !== 'docker' && cmd !== 'podman') return []
    const found = containerImage(args)
    if (!found) return []
    const { image, idx } = found
    // ${VAR}: decided outside the file. mcp-sandbox/*: built locally from the Dockerfile MCP-Shield generates (its base image goes by digest).
    if (imagePinned(image) || /\$\{/.test(image) || image.startsWith('mcp-sandbox/')) return []
    const tag = imageTag(image)
    const floating = !tag || tag === 'latest'
    const pullAlways = args.some((a, i) => a === '--pull=always' || (a === '--pull' && args[i + 1] === 'always'))
    // Docker keeps the image cached until it pulls again; --pull always turns a movable reference into a new image on every start
    const severity = pullAlways ? (floating ? 'high' : 'medium') : 'low'
    const base = imageName(image)
    return [mk({
      ruleId: 'MCPS-SC-004', category: 'supply-chain', severity, server: serverName,
      title: floating ? L(`Imagen "${image}" sin versión: se descarga la que esté publicada${pullAlways ? ' en cada arranque (--pull always)' : ''}`, `Image "${image}" without a version: whatever is published gets pulled${pullAlways ? ' on every start (--pull always)' : ''}`)
        : L(`Imagen "${image}" fijada por etiqueta, no por digest`, `Image "${image}" pinned by tag, not by digest`),
      detail: L('Una etiqueta es un puntero que se puede mover: quien controle el registro o la cuenta puede publicar otra imagen con el mismo nombre y tu cliente MCP la ejecutará sin aviso. Solo el digest (sha256) identifica el contenido.',
        'A tag is a movable pointer: whoever controls the registry or the account can publish a different image under the same name and your MCP client will run it without warning. Only the digest (sha256) identifies the content.'),
      evidence: [server.command, ...(server.args ?? [])].join(' '), location: `mcpServers.${serverName}.args[${idx + offset}]`,
      remediation: L(`Fija la imagen por digest tras revisarla: obtén el digest con "docker buildx imagetools inspect ${base}${tag ? ':' + tag : ''}" (o "docker inspect --format '{{index .RepoDigests 0}}'") y usa "${base}${tag && tag !== 'latest' ? ':' + tag : ''}@sha256:…". No uses --pull always.`,
        `Pin the image by digest after reviewing it: get the digest with "docker buildx imagetools inspect ${base}${tag ? ':' + tag : ''}" (or "docker inspect --format '{{index .RepoDigests 0}}'") and use "${base}${tag && tag !== 'latest' ? ':' + tag : ''}@sha256:…". Do not use --pull always.`),
      cwe: 'CWE-494',
    })]
  },
}

export const supplyChainRules: Rule[] = [unpinnedNpx, insecureRemote, unpinnedImage]
