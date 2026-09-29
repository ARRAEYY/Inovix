import React from 'react';

// Error Boundary — catches React rendering errors + shows a fallback UI
// instead of a white screen. This is the LAST line of defense against
// unhandled JS errors that would otherwise crash the entire app.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleClearData = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '1rem',
          background: '#faf5f6', padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem' }}>🍽️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b10035', margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', maxWidth: '400px' }}>
            The app hit an unexpected error. Try reloading — if it keeps happening,
            clearing your browser data may help.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button onClick={this.handleReload}
              style={{ padding: '0.6rem 1.5rem', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
              Reload page
            </button>
            <button onClick={this.handleClearData}
              style={{ padding: '0.6rem 1.5rem', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
              Clear data & re-login
            </button>
          </div>
          {this.state.error && (
            <details style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#9ca3af', maxWidth: '500px' }}>
              <summary>Error details</summary>
              <pre style={{ textAlign: 'left', overflow: 'auto', background: '#f3f4f6', padding: '0.75rem', borderRadius: '8px' }}>
                {this.state.error?.message || String(this.state.error)}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
