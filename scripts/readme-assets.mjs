// Generates the README icons (Lucide, ISC) in the brand's electric blue, and the tiles of the `mcp-shield.yaml` table.
// Brand logos (React, TypeScript, Tailwind, Vitest, Node.js, Git, GitHub…) are copied as-is from the ecosystem repos.
import { mkdirSync, writeFileSync } from 'node:fs'
const BLUE = '#3D6BFF', BG = '#242938'
// Lucide 1.x keeps old names as alias modules that re-export the renamed icon: follow the alias
import { readFileSync } from 'node:fs'
const DIR = 'node_modules/lucide-react/dist/esm/icons/'
const FILE = { fingerprint: 'fingerprint-pattern' }
const load = async n => {
  let f = FILE[n] ?? n
  for (let i = 0; i < 3; i++) { const alias = /from '\.\/([^']+)\.mjs'/.exec(readFileSync(DIR + f + '.mjs', 'utf8'))?.[1]; if (alias && alias !== '../createLucideIcon') { const m = await import(`lucide-react/dist/esm/icons/${f}.mjs`); if (m.__iconData) break; f = alias } else break }
  return (await import(`lucide-react/dist/esm/icons/${f}.mjs`)).__iconData.node
}
const attrs = o => Object.entries(o).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')
const body = node => node.map(([t, a]) => `  <${t} ${attrs(a)} />`).join('\n')
mkdirSync('docs/assets/icons', { recursive: true }); mkdirSync('docs/assets/stack', { recursive: true })

const ICONS = ['route', 'brain-circuit', 'list-checks', 'image', 'rocket', 'network', 'fingerprint', 'workflow', 'shield-alert', 'sparkles', 'flask-conical',
  'shield-check', 'triangle-alert', 'folder-tree', 'scale', 'user-round', 'scan-search', 'swords', 'landmark', 'circle-help', 'container', 'list-tree']
for (const n of ICONS) writeFileSync(`docs/assets/icons/${n}.svg`, `<!-- @license lucide v1.58.0 - ISC -->\n<svg class="lucide lucide-${n}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${BLUE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${body(await load(n))}\n</svg>\n`)

// Tiles drawn with a Lucide icon (topic tiles)
const TILES = { 'supply-chain': 'package-search', filesystem: 'folder-lock', secretos: 'key-round', 'tool-poisoning': 'syringe', smuggling: 'eye-off', integridad: 'fingerprint', simulador: 'swords', gobernanza: 'landmark', 'cero-egress': 'shield-check' }
for (const [file, icon] of Object.entries(TILES)) writeFileSync(`docs/assets/stack/${file}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${file}"><title>${file}</title><rect width="256" height="256" rx="60" fill="${BG}"/><g transform="translate(58 58) scale(5.8333)" fill="none" stroke="${BLUE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${body(await load(icon))}\n</g></svg>\n`)

// Text tiles (frameworks and formats without a logo we may reuse)
const TEXT = { vite: ['Vite', 'build', '#BD34FE'], sarif: ['SARIF', '2.1.0', '#3D6BFF'], owasp: ['OWASP', 'Agentic', '#E0457B'], nsa: ['NSA', 'MCP CSI', '#8f9aa6'], csa: ['CSA', 'MCP Top 10', '#3DBE95'], mcp: ['MCP', 'mcp.json', '#3D6BFF'], docker: ['Docker', 'sandbox', '#2496ED'] }
for (const [file, [big, small, c]] of Object.entries(TEXT)) writeFileSync(`docs/assets/stack/${file}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${big}"><title>${big}</title><rect width="256" height="256" rx="60" fill="${BG}"/><rect x="28" y="28" width="200" height="200" rx="40" fill="${c}" fill-opacity=".16" stroke="${c}" stroke-width="6"/><text x="128" y="${big.length > 4 ? 132 : 136}" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-weight="800" font-size="${big.length > 5 ? 48 : big.length > 4 ? 54 : 62}" fill="#fff">${big}</text><text x="128" y="182" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-weight="700" font-size="${small.length > 7 ? 26 : 32}" fill="${c}">${small}</text></svg>\n`)
console.log('icons', ICONS.length, 'tiles', Object.keys(TILES).length + Object.keys(TEXT).length)
