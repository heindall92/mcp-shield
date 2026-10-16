/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Single source of truth for the version: package.json, injected at build time.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
export default defineConfig({ define: { __APP_VERSION__: JSON.stringify(version) }, plugins: [react()], base: '/mcp-shield/', build: { modulePreload: { polyfill: false }, assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined) }, test: { include: ['tests/**/*.test.ts'] } })
