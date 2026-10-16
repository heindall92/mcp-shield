/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], base: '/mcp-shield/', build: { modulePreload: { polyfill: false }, assetsInlineLimit: (file: string) => (/\.woff2?$/.test(file) ? false : undefined) }, test: { include: ['tests/**/*.test.ts'] } })
