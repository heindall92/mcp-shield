/** v1.5.0: MCPS-SC-004 · container image not pinned by digest. */
import { describe, it, expect } from 'vitest'
import { scanConfig, ALL_RULES } from '../src/engine/scanner'
import { remediate, hardeningVerdict } from '../src/engine/remediator'
import { containerImage, imageName, imageTag } from '../src/engine/rules/util'
import { RULES } from '../src/components/iso/zeroTelemetry'

const D = 'sha256:' + 'a'.repeat(64)
const sc4 = (args: string[], command = 'docker') => scanConfig({ mcpServers: { s: { command, args } } }).findings.filter(f => f.ruleId === 'MCPS-SC-004')

describe('containerImage: finds the image like docker does', () => {
  it.each([
    [['run', '-i', '--rm', 'mcp/github'], 'mcp/github'],
    [['run', '-i', '-e', 'TOKEN', '-v', '/tmp:/tmp', 'ghcr.io/acme/mcp:1.2.0', '--flag'], 'ghcr.io/acme/mcp:1.2.0'],
    [['run', '--network=none', '--name', 'x', 'img@' + D, 'serve'], 'img@' + D],
    [['-H', 'tcp://h', 'run', '-i', 'img'], 'img'],
    [['container', 'run', '-i', 'img:2'], 'img:2'],
  ])('%j → %s', (args, image) => { expect(containerImage(args)?.image).toBe(image) })
  it('no image for other subcommands', () => { expect(containerImage(['ps', '-a'])).toBeNull(); expect(containerImage(['run', '-i'])).toBeNull() })
})

describe('MCPS-SC-004', () => {
  it('no tag → low (cached after the first pull)', () => { const f = sc4(['run', '-i', '--rm', 'mcp/github']); expect(f).toHaveLength(1); expect(f[0].severity).toBe('low'); expect(f[0].location).toBe('mcpServers.s.args[3]') })
  it(':latest → low', () => { expect(sc4(['run', '-i', 'mcp/github:latest'])[0].severity).toBe('low') })
  it('fixed tag with --pull always → medium (the tag can be moved and is pulled again)', () => { expect(sc4(['run', '--pull', 'always', '-i', 'img:1.2.0'])[0].severity).toBe('medium') })
  it('no tag or latest with --pull always → high (a new image on every start, like npx -y)', () => {
    expect(sc4(['run', '--pull', 'always', '-i', 'mcp/github'])[0].severity).toBe('high')
    expect(sc4(['run', '--pull=always', '-i', 'mcp/github:latest'])[0].severity).toBe('high')
  })
  it('fixed tag without digest → low (tags can be moved)', () => { expect(sc4(['run', '-i', 'ghcr.io/acme/mcp:1.2.0'])[0].severity).toBe('low') })
  it('registry with port is not a tag', () => { expect(sc4(['run', '-i', 'localhost:5000/mcp'])[0].title).toMatch(/sin versión/); expect(sc4(['run', '-i', 'localhost:5000/mcp:2.0'])[0].title).toMatch(/etiqueta/) })
  it('digest → no finding, with or without tag', () => { expect(sc4(['run', '-i', 'mcp/github@' + D])).toHaveLength(0); expect(sc4(['run', '-i', 'mcp/github:1.0@' + D])).toHaveLength(0) })
  it('podman, cmd /c docker and wsl docker too', () => {
    expect(sc4(['run', '-i', 'img'], 'podman')).toHaveLength(1)
    expect(sc4(['/c', 'docker', 'run', '-i', 'img'], 'cmd')).toHaveLength(1)
  })
  it('images built from MCP-Shield\'s own Dockerfile (mcp-sandbox/*) and ${VAR} images are not flagged', () => {
    expect(sc4(['run', '-i', 'mcp-sandbox/git:pinned'])).toHaveLength(0)
    expect(sc4(['run', '-i', '${MCP_IMAGE}'])).toHaveLength(0)
  })
  it('non-container servers are not evaluated by it', () => { expect(scanConfig({ mcpServers: { s: { command: 'npx', args: ['-y', 'x'] } } }).findings.some(f => f.ruleId === 'MCPS-SC-004')).toBe(false) })
  it('the remediation shows how to get the digest', () => { expect(sc4(['run', '-i', 'mcp/github'])[0].remediation).toMatch(/docker (buildx imagetools inspect|inspect)/) })
})

describe('hardening with an unpinned image', () => {
  const cfg = { mcpServers: { gh: { command: 'docker', args: ['run', '--pull', 'always', '-i', 'mcp/github'] } } }
  it('--pull always is dropped, so the re-scan drops to low and the config counts as hardened', () => {
    expect(scanConfig(cfg).findings.find(f => f.ruleId === 'MCPS-SC-004')?.severity).toBe('high')
    const out = remediate(cfg); expect(out.mcpServers.gh.args).not.toContain('always')
    expect(scanConfig(out).findings.find(f => f.ruleId === 'MCPS-SC-004')?.severity).toBe('low')
    expect(hardeningVerdict(cfg).status).toBe('hardened')
  })
  it('the verdict carries an image note so the UI can ask for the digest', () => {
    expect(hardeningVerdict(cfg).notes.some(n => n.kind === 'image' && n.flag === 'mcp/github')).toBe(true)
  })
})

describe('the zero-telemetry figure draws one cartridge per configuration rule', () => {
  it('RULES equals the number of rule ids', () => { expect(RULES).toBe(new Set(ALL_RULES.flatMap(r => [r.id, ...(r.emits ?? []).map(e => e.id)])).size) })
})

describe('Bugbot review: the remediation names the image once', () => {
  const rem = (image: string, lang: 'es' | 'en' = 'en') => scanConfig({ mcpServers: { s: { command: 'docker', args: ['run', '-i', '--rm', image] } } }, lang).findings.find(f => f.ruleId === 'MCPS-SC-004')!.remediation
  it('imageName drops the tag and the digest, keeps a registry port', () => {
    expect(imageName('ghcr.io/acme/srv:1.2.0')).toBe('ghcr.io/acme/srv')
    expect(imageName('localhost:5000/srv:1.0@sha256:abc')).toBe('localhost:5000/srv')
    expect(imageName('localhost:5000/srv')).toBe('localhost:5000/srv')
    expect(imageName('srv')).toBe('srv')
    expect(imageTag('localhost:5000/srv')).toBe('')
  })
  for (const lang of ['es', 'en'] as const) {
    it(`a tagged image is not tagged twice (${lang})`, () => {
      const r = rem('ghcr.io/acme/srv:1.2.0', lang)
      expect(r).not.toContain('1.2.0:1.2.0')
      expect(r).toContain('imagetools inspect ghcr.io/acme/srv:1.2.0"')
      expect(r).toContain('"ghcr.io/acme/srv:1.2.0@sha256:…"')
    })
    it(`latest is inspected but not kept in the pinned reference (${lang})`, () => {
      const r = rem('acme/srv:latest', lang)
      expect(r).toContain('imagetools inspect acme/srv:latest"')
      expect(r).toContain('"acme/srv@sha256:…"')
    })
    it(`a registry port is not taken for a tag (${lang})`, () => {
      const r = rem('localhost:5000/srv', lang)
      expect(r).toContain('imagetools inspect localhost:5000/srv"')
      expect(r).toContain('"localhost:5000/srv@sha256:…"')
    })
  }
})
