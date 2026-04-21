/**
 * src/components/ErrorBoundary.jsx
 * ---------------------------------
 * FT-012: React error boundary.
 *
 * Catches any render-time or lifecycle exception thrown inside the tree it
 * wraps and replaces the white screen with a recoverable error UI.
 *
 * React ErrorBoundaries must be class components — hooks cannot catch errors
 * from other components' render methods.
 *
 * What it handles:
 *   - Unhandled exceptions in render, constructor, or lifecycle methods
 *   - TypeError / SyntaxError from corrupt localStorage values leaking into
 *     React state (the storage.js wrapper should prevent most of these, but
 *     this is the last line of defence)
 *   - Any edge case not anticipated by the application code
 *
 * What it does NOT handle:
 *   - Errors in async code (useEffect callbacks, event handlers)
 *     → those are caught by the global window.onerror handler in main.jsx
 *   - Errors in server-side code
 *
 * Ticket: FT-012
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Structured error logger (mirrors storage.js pattern)
// ---------------------------------------------------------------------------
function logCrash(error, componentStack) {
  try {
    console.error(
      '[crash]',
      JSON.stringify({
        t: 'RENDER_ERROR',
        message: error?.message || String(error),
        name: error?.name || 'Error',
        stack: componentStack?.slice(0, 600) || '',
      })
    );
  } catch {
    console.error('[crash] Failed to serialize error:', error);
  }
}

// ---------------------------------------------------------------------------
// ErrorBoundary class component
// ---------------------------------------------------------------------------
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isStorageError: false,
      cleared: false,
    };
    this.handleClear = this.handleClear.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    // Detect storage-related errors by name and message patterns
    const msg = (error?.message || '').toLowerCase();
    const name = error?.name || '';

    const isStorageError =
      name === 'QuotaExceededError' ||
      name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      msg.includes('quota') ||
      msg.includes('storage') ||
      msg.includes('json') ||
      msg.includes('syntaxerror') ||
      msg.includes('unexpected token') ||
      msg.includes('localstorage');

    return { hasError: true, error, isStorageError };
  }

  componentDidCatch(error, { componentStack }) {
    logCrash(error, componentStack);
  }

  handleClear() {
    this.setState({ cleared: true });
    // Wipe all storage if it's corrupt.
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    // Short delay so user sees the confirmation before reload
    setTimeout(() => window.location.reload(), 800);
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, isStorageError, cleared } = this.state;
    const isDev = import.meta.env.DEV;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
          padding: '1.5rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
            textAlign: 'center',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: '64px',
              height: '64px',
              background: isStorageError ? '#fef3c7' : '#fee2e2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              fontSize: '1.75rem',
            }}
          >
            {isStorageError ? '💾' : '⚠️'}
          </div>

          {/* Heading */}
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: '800',
              color: '#1e293b',
              marginBottom: '0.75rem',
              lineHeight: 1.3,
            }}
          >
            {isStorageError ? 'Ошибка хранилища браузера' : 'Что-то пошло не так'}
          </h2>

          {/* Explanation */}
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748b',
              lineHeight: 1.6,
              marginBottom: '1.5rem',
            }}
          >
            {isStorageError
              ? 'Браузерное хранилище переполнено или содержит повреждённые данные. ' +
                'Вы можете очистить локальные данные и перезагрузить страницу — ' +
                'ваши данные в базе данных не затронуты.'
              : 'Приложение столкнулось с неожиданной ошибкой. ' +
                'Попробуйте перезагрузить страницу. Если проблема повторяется, ' +
                'обратитесь в поддержку.'}
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
            {cleared ? (
              <div style={{ color: '#16a34a', fontWeight: '700', fontSize: '0.875rem' }}>
                Данные очищены — перезагрузка…
              </div>
            ) : (
              <>
                {isStorageError && (
                  <button
                    onClick={this.handleClear}
                    style={{
                      background: '#dc2626',
                      color: 'white',
                      padding: '12px',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Очистить хранилище и перезагрузить
                  </button>
                )}
                <button
                  onClick={this.handleReload}
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  Перезагрузить страницу
                </button>
              </>
            )}
          </div>

          {/* Dev-only error detail */}
          {isDev && error && (
            <details style={{ marginTop: '1.5rem', textAlign: 'left' }}>
              <summary style={{ fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer' }}>
                Техническая информация (только в режиме разработки)
              </summary>
              <pre
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  color: '#dc2626',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {error.name}: {error.message}
                {error.stack ? '\n\n' + error.stack : ''}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

// ---------------------------------------------------------------------------
// withErrorBoundary HOC — convenience wrapper for individual components
// ---------------------------------------------------------------------------
/**
 * Wraps a component in an ErrorBoundary.
 * Usage:  export default withErrorBoundary(MyComponent);
 *
 * @param {React.ComponentType} Component
 * @param {object} [boundaryProps] — props forwarded to ErrorBoundary
 */
export function withErrorBoundary(Component, boundaryProps = {}) {
  const displayName = Component.displayName || Component.name || 'Component';
  function Wrapped(props) {
    return (
      <ErrorBoundary {...boundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  }
  Wrapped.displayName = `withErrorBoundary(${displayName})`;
  return Wrapped;
}

export default ErrorBoundary;
