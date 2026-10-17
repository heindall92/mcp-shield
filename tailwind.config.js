import { tailwindColors, cssVars, accentRules } from './palette.js'
import plugin from 'tailwindcss/plugin.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  future: { hoverOnlyWhenSupported: true },
  theme: {
    colors: tailwindColors(),
    extend: {
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.23, 1, 0.32, 1)', out: 'cubic-bezier(0.23, 1, 0.32, 1)', 'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)' },
      transitionDuration: { DEFAULT: '160ms' },
      fontFamily: { mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'], sans: ['"Inter Variable"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'] },
      keyframes: { fadein: { '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' }, '100%': { opacity: '1', transform: 'none' } } },
      animation: { fadein: 'fadein 240ms cubic-bezier(.23,1,.32,1) both' },
    },
  },
  plugins: [plugin(({ addBase }) => { addBase({ ':root': { ...cssVars('dark'), colorScheme: 'dark' }, ':root.light': { ...cssVars('light'), colorScheme: 'light' } }); addBase(accentRules()) })],
}
