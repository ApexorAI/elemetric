import { StrictMode, Component, type ReactNode, type ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Elemetric] Uncaught error:', error, info)
  }

  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <div style={{ backgroundColor: '#07152B', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '32px', maxWidth: '480px', width: '100%' }}>
            <div style={{ color: '#FF6B00', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>ELEMETRIC</div>
            <div style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Something went wrong</div>
            <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px', wordBreak: 'break-word' }}>
              {err.message || 'An unexpected error occurred.'}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#FF6B00', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
