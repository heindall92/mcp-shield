// Copies the package.json version into README badges and the mcp-shield.yaml table footer
// (the app and SARIF read it at build time).
import { readFileSync, writeFileSync } from 'node:fs'
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const p = 'README.md'
const s = readFileSync(p, 'utf8')
  .replace(/(alt="Versi(?:ón|on) )[\d.]+(" src="https:\/\/img\.shields\.io\/badge\/versi(?:%C3%B3)?n-)[\d.]+/g, `$1${version}$2${version}`)
  .replace(/(<tfoot>[\s\S]*?version: )[\d.]+/, `$1${version}`)
writeFileSync(p, s)
console.log('README version ->', version)
