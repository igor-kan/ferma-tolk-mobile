/**
 * src/main.jsx — Application entry point
 * ----------------------------------------
 * FT-012: Global error handlers + ErrorBoundary wrapping App root.
 *
 * Three layers of crash protection:
 *
 *   1. window.onerror          — catches synchronous uncaught JS errors
 *                                (e.g. event handlers, script load failures)
 *
 *   2. unhandledrejection      — catches unhandled Promise rejections
 *                                (e.g. failed Supabase calls, async event
 *                                handlers, useEffect bodies that throw)
 *
 *   3. <ErrorBoundary>         — catches React render-time and lifecycle
 *                                errors and shows a recoverable UI instead
 *                                of a blank white screen
 *
 * All three handlers emit structured [crash] log lines to console.error,
 * visible in browser DevTools and Vercel's Function Logs.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { ErrorBoundary } from './shared/ui/ErrorBoundary.jsx';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './shared/api/queryClient.js';
import { initMobileRuntime } from './mobile/runtime.js';

// ---------------------------------------------------------------------------
// 1. Global synchronous error handler
// ---------------------------------------------------------------------------
window.onerror = function globalErrorHandler(message, source, lineno, colno, error) {
  try {
    console.error(
      '[crash]',
      JSON.stringify({
        t: 'UNCAUGHT_ERROR',
        message: message || String(error),
        name: error?.name || 'Error',
        source: source?.slice(-80) || '',
        line: lineno,
        col: colno,
      })
    );
  } catch {
    /* serialization failure is not actionable */
  }
  return false; // let browser also log normally
};

// ---------------------------------------------------------------------------
// 2. Global unhandled Promise rejection handler
// ---------------------------------------------------------------------------
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  try {
    console.error(
      '[crash]',
      JSON.stringify({
        t: 'UNHANDLED_REJECTION',
        message: reason?.message || String(reason),
        name: reason?.name || 'Error',
        code: reason?.code || undefined,
      })
    );
  } catch {
    /* ignore */
  }
});

// ---------------------------------------------------------------------------
// 3. React root with ErrorBoundary (last-resort render-crash protection)
// ---------------------------------------------------------------------------
void initMobileRuntime();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
