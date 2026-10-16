import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { PrefsProvider } from './i18n/prefs'
import { Toaster } from "./components/ui/Toaster"
createRoot(document.getElementById('root')!).render(<StrictMode><PrefsProvider><Toaster><App /></Toaster></PrefsProvider></StrictMode>)
