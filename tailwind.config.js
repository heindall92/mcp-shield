/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  future: { hoverOnlyWhenSupported: true },
  theme: { extend: {
    transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.23, 1, 0.32, 1)', out: 'cubic-bezier(0.23, 1, 0.32, 1)', 'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)' },
    transitionDuration: { DEFAULT: '160ms' },
    fontFamily: { mono: ['ui-monospace','SFMono-Regular','Menlo','Consolas','monospace'], sans: ['-apple-system','BlinkMacSystemFont','"Segoe UI"','Roboto','system-ui','sans-serif'] },
    keyframes: { pulseGlow: { '0%,100%': { boxShadow: '0 0 0 1px #f8717180, 0 8px 30px -6px #ef4444' }, '50%': { boxShadow: '0 0 0 1px #fca5a5, 0 8px 44px -2px #ef4444' } }, fadein: { '0%': { opacity: '0', transform: 'translateY(6px) scale(0.98)' }, '100%': { opacity: '1', transform: 'none' } } },
    animation: { fadein: 'fadein 240ms cubic-bezier(.23,1,.32,1) both', pulseGlow: 'pulseGlow 2.2s ease-in-out infinite' },
  } },
  plugins: [],
}
