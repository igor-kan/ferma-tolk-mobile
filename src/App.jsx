/**
 * App.jsx — FT-006 / FT-008
 * --------------------------
 * FT-006: Session guard uses Supabase Auth state.
 * FT-008: Migration banner wired — detects legacy localStorage data and
 *         offers the user a one-click import to the database.
 */

import { useState, useEffect } from 'react';
import { UiProvider, useUiContext } from './features/ui/UiContext';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { useAppAnalytics } from './features/analytics/useAppAnalytics';
import BottomNav from './shared/ui/BottomNav';
import Dashboard from './features/analytics/Dashboard';
import Transactions from './features/transactions/Transactions';
import AddEntry from './features/transactions/AddEntry';
import Reports from './features/analytics/Reports';
import Assistant from './features/assistant/Assistant';
import Auth from './features/auth/Auth';
import { LogOut } from 'lucide-react';
import logo from './assets/logo.png';
import { supabase } from './shared/api/supabase';

// ---------------------------------------------------------------------------
// AppContent — rendered when session is active
// ---------------------------------------------------------------------------
function AppContent({ userId: _userId, farmId: _farmId }) {
  const { logout, currentUser } = useAuth();
  const { language: _language } = useUiContext();
  const { dbReady, dbError } = useAppAnalytics();
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderPage = () => {
    if (!dbReady) {
      if (dbError) {
        return (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--danger)', fontWeight: '700' }}>Ошибка загрузки данных</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{dbError.message}</p>
          </div>
        );
      }
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontWeight: '700' }}>Загрузка данных…</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'transactions':
        return <Transactions />;
      case 'add':
        return <AddEntry />;
      case 'reports':
        return <Reports />;
      case 'assistant':
        return <Assistant />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <header
        style={{
          padding: '1rem',
          paddingTop: 'calc(1rem + env(safe-area-inset-top))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          zIndex: 50,
          maxWidth: '480px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <img
            src={logo}
            alt="Ferma.Tolk Logo"
            style={{ height: '48px', width: '48px', objectFit: 'contain' }}
          />
        </div>
        <h1
          className="text-gradient"
          style={{
            fontSize: '1.75rem',
            fontWeight: '900',
            textAlign: 'center',
            flex: 2,
            letterSpacing: '-0.04em',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
          }}
        >
          Ferma.Tolk
        </h1>
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
            {currentUser?.email?.split('@')[0]}
          </span>
          <button
            onClick={logout}
            style={{ background: 'none', color: 'var(--danger)', display: 'flex' }}
            title="Выйти"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {renderPage()}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </>
  );
}

// ---------------------------------------------------------------------------
// MainApp — resolves farm_id then mounts AppContent
// ---------------------------------------------------------------------------
function MainApp() {
  const { currentUser, loading } = useAuth();
  const [farmId, setFarmId] = useState(null);
  const [farmLoading, setFarmLoading] = useState(false);

  // Fetch the user's default farm_id once they are authenticated.
  // This is needed by the migration hook to scope records correctly.
  useEffect(() => {
    if (!currentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFarmId(null);
      return;
    }
    setFarmLoading(true);
    supabase
      .from('user_preferences')
      .select('default_farm_id')
      .eq('user_id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        setFarmId(data?.default_farm_id ?? null);
        setFarmLoading(false);
      })
      .catch(() => setFarmLoading(false));
  }, [currentUser?.id]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || (currentUser && farmLoading)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
        }}
      >
        <p style={{ color: 'var(--text-muted)', fontWeight: '700' }}>Загрузка…</p>
      </div>
    );
  }

  // ── No session ────────────────────────────────────────────────────────────
  if (!currentUser) return <Auth />;

  // ── Authenticated ─────────────────────────────────────────────────────────
  return (
    <UiProvider userId={currentUser.id}>
      <AppContent userId={currentUser.id} farmId={farmId} />
    </UiProvider>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
