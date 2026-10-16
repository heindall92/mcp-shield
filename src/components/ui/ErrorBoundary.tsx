import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { UI } from '../../i18n/ui'

type Props = { children: ReactNode; lang: 'es' | 'en'; onReset?: () => void; resetKey?: unknown }
type State = { failed: boolean; key?: unknown }

/** Catches render errors so a malformed config can never blank the app. Logs nothing (input may contain secrets). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, key: this.props.resetKey }
  static getDerivedStateFromError(): Partial<State> { return { failed: true } }
  static getDerivedStateFromProps(p: Props, s: State): Partial<State> | null { return p.resetKey !== s.key ? { failed: false, key: p.resetKey } : null }
  componentDidCatch() { /* intentionally silent: never log user input */ }
  render() {
    if (!this.state.failed) return this.props.children
    const t = UI[this.props.lang]
    return (
      <div role="alert" className="card mx-auto max-w-lg p-6 text-center">
        <AlertTriangle className="mx-auto text-amber-300" size={22} aria-hidden />
        <h2 className="mt-3 text-[1.0625rem] font-semibold text-white">{t.errTitle}</h2>
        <p className="mt-1.5 text-sm text-slate-300">{t.errBody}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-ghost focus-ring text-[0.8125rem]" onClick={() => this.setState({ failed: false })}><RotateCcw size={14} aria-hidden />{t.errRetry}</button>
          {this.props.onReset && <button className="btn-primary focus-ring text-[0.8125rem]" onClick={() => { this.props.onReset?.(); this.setState({ failed: false }) }}>{t.resetBtn}</button>}
        </div>
      </div>
    )
  }
}
