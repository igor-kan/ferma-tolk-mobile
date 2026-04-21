/**
 * Auth page — FT-006
 * ------------------
 * All authentication now goes through Supabase Auth (server-side).
 * Modes:
 *   login    — sign in with email + password
 *   register — create account (email + password + optional security hint)
 *   reset    — request a password-reset email (replaces secret-answer flow)
 *   update   — set a new password after following the reset link
 *              (entered via URL hash '#recovery' set by Supabase reset email)
 */

import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Lock, Mail, ShieldCheck, ArrowRight, CheckCircle } from 'lucide-react';
import logo from '../../assets/logo.png';

const Auth = () => {
  const { login, register, sendPasswordReset, updatePassword, loading } = useAuth();

  // 'login' | 'register' | 'reset' | 'update'
  const [mode, setMode] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [securityHint, setSecurityHint] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  // -------------------------------------------------------------------------
  // Detect password-recovery token in URL fragment.
  // Supabase appends #recovery (or ?type=recovery) to the redirect URL
  // contained in the reset email.  onAuthStateChange fires PASSWORD_RECOVERY
  // once the SDK exchanges the token for a session — at that point the user
  // should be shown the "set new password" form.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#recovery' || hash.includes('type=recovery')) {
      setMode('update');
      // Clean fragment so refresh doesn't re-enter update mode after completion
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // -------------------------------------------------------------------------
  // Form submission
  // -------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    setBusy(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (!res.success) setError('Неверный Email или пароль');
        // On success onAuthStateChange fires → App.jsx re-renders with the session
      } else if (mode === 'register') {
        if (password.length < 6) {
          setError('Пароль должен быть не менее 6 символов');
          return;
        }
        const res = await register(email, password, null, securityHint);
        if (!res.success) {
          setError(res.error || 'Email уже зарегистрирован');
        } else if (res.needsConfirmation) {
          setSuccess('Аккаунт создан! Проверьте почту и перейдите по ссылке для подтверждения.');
        }
        // If no confirmation needed, onAuthStateChange fires → logged in immediately
      } else if (mode === 'reset') {
        if (!email) {
          setError('Введите Email');
          return;
        }
        const res = await sendPasswordReset(email);
        if (!res.success) {
          setError(res.error || 'Не удалось отправить письмо');
        } else {
          setSuccess('Письмо для сброса пароля отправлено. Проверьте почту.');
        }
      } else if (mode === 'update') {
        if (password.length < 6) {
          setError('Пароль должен быть не менее 6 символов');
          return;
        }
        const res = await updatePassword(password);
        if (!res.success) {
          setError(res.error || 'Не удалось обновить пароль');
        } else {
          setSuccess('Пароль успешно обновлён! Выполняется вход…');
          setMode('login');
          setPassword('');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  // Don't render anything while the initial session check is running
  if (loading) {
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

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const title = {
    login: 'Вход в аккаунт',
    register: 'Регистрация',
    reset: 'Сброс пароля',
    update: 'Новый пароль',
  }[mode];

  const submitLabel = {
    login: 'ВОЙТИ',
    register: 'СОЗДАТЬ АККАУНТ',
    reset: 'ОТПРАВИТЬ ПИСЬМО',
    update: 'ОБНОВИТЬ ПАРОЛЬ',
  }[mode];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '400px',
          width: '100%',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* ── Logo & title ── */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '110px',
              height: '110px',
              background: 'white',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
            }}
          >
            <img
              src={logo}
              alt="Logo"
              style={{ width: '85%', height: '85%', objectFit: 'contain' }}
            />
          </div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: '900',
              color: 'var(--text)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              marginTop: '4px',
              fontWeight: '600',
            }}
          >
            Ferma.Tolk
          </p>
        </div>

        {/* ── Alerts ── */}
        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: 'var(--danger)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              textAlign: 'center',
              fontWeight: '600',
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              background: '#dcfce7',
              color: 'var(--success)',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              textAlign: 'center',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        {/* ── Form ── */}
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {/* Email — shown on login, register, reset */}
          {mode !== 'update' && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  display: 'block',
                }}
              >
                EMAIL
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="email"
                  required
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 40px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Password — shown on login, register, update */}
          {mode !== 'reset' && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  display: 'block',
                }}
              >
                {mode === 'update' ? 'НОВЫЙ ПАРОЛЬ' : 'ПАРОЛЬ'}
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="password"
                  required
                  value={password}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 40px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Security hint — register only (non-secret, optional) */}
          {mode === 'register' && (
            <div>
              <label
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  display: 'block',
                }}
              >
                ПОДСКАЗКА ДЛЯ АККАУНТА (необязательно)
              </label>
              <div style={{ position: 'relative' }}>
                <ShieldCheck
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  value={securityHint}
                  onChange={(e) => setSecurityHint(e.target.value)}
                  placeholder="Например: личный аккаунт"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 40px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Reset mode explanation */}
          {mode === 'reset' && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Введите Email, привязанный к аккаунту. Мы отправим ссылку для создания нового пароля.
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            style={{
              background: busy ? 'var(--text-muted)' : 'var(--primary)',
              color: 'white',
              padding: '14px',
              borderRadius: '8px',
              fontWeight: '800',
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Подождите…' : submitLabel}
            {!busy && <ArrowRight size={18} />}
          </button>
        </form>

        {/* ── Mode switcher links ── */}
        <div
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            textAlign: 'center',
          }}
        >
          {mode === 'login' && (
            <>
              <button
                onClick={() => {
                  clearMessages();
                  setMode('register');
                }}
                style={{
                  color: 'var(--primary)',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  background: 'none',
                }}
              >
                Нет аккаунта? Зарегистрироваться
              </button>
              <button
                onClick={() => {
                  clearMessages();
                  setMode('reset');
                }}
                style={{ color: 'var(--text-muted)', fontSize: '0.875rem', background: 'none' }}
              >
                Забыли пароль?
              </button>
            </>
          )}

          {(mode === 'register' || mode === 'reset' || mode === 'update') && (
            <button
              onClick={() => {
                clearMessages();
                setMode('login');
                setPassword('');
              }}
              style={{
                color: 'var(--primary)',
                fontSize: '0.875rem',
                fontWeight: '600',
                background: 'none',
              }}
            >
              Вернуться ко входу
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
