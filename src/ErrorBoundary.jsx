import { Component } from 'react'

/** Catches React errors and shows them instead of a blank screen */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          padding: 24,
          background: '#f4f2ed',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: 24, color: '#c00', marginBottom: 12 }}>Something went wrong</h1>
          <pre style={{
            background: '#fff',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
            maxWidth: '100%',
            fontSize: 13,
            textAlign: 'left',
            border: '1px solid #ddd',
          }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <p style={{ marginTop: 16, color: '#666', fontSize: 14 }}>
            Check the browser console (F12) for more details.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
