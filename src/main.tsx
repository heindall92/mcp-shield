import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { PrefsProvider } from './i18n/prefs'
createRoot(document.getElementById('root')!).render(<StrictMode><PrefsProvider><App /></PrefsProvider></StrictMode>)
