import { createContext, useContext } from 'react'
export type ToastKind = 'ok' | 'error'
export type ToastFn = (msg: string, kind?: ToastKind) => void
export const ToastCtx = createContext<ToastFn>(() => {})
/** Fire a short, polite status message. Never pass user input or secrets. */
export const useToast = () => useContext(ToastCtx)
