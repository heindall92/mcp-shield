// Runs before first paint (external file to satisfy CSP script-src 'self').
try {
  var t = localStorage.getItem('mcps-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  if (t === 'light') document.documentElement.classList.add('light')
  var l = localStorage.getItem('mcps-lang') || 'es'
  document.documentElement.lang = l
} catch {
  /* storage unavailable */
}
