import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(): State { return { hasError: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[HkTube] Component error', error, info) }
  render() {
    if (!this.state.hasError) return this.props.children
    return <div className="app-loading"><div className="auth-card"><h2>Something went wrong</h2><p className="form-error">This section could not be loaded. Please try again.</p><button className="btn-primary" onClick={() => this.setState({ hasError: false })}>Try again</button></div></div>
  }
}
