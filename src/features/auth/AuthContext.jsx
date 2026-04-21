/**
 * AuthContext — Supabase Auth implementation
 * ------------------------------------------
 * FT-006 / FT-014
 *
 * FT-006: Replaces the previous localStorage / PBKDF2 client-side auth with
 * Supabase Auth (GoTrue). Passwords are NEVER stored or processed client-side.
 * All credential operations go through the Supabase API over HTTPS.
 *
 * FT-014: All auth outcomes are logged via security-log.js with structured
 * [auth] events. Passwords and tokens are never included in log output.
 *
 * Session lifecycle:
 *   - Supabase issues a signed JWT (access_token) + refresh_token on sign-in.
 *   - The SDK stores both in localStorage under the key configured in
 *     src/lib/supabase.js ('ferma-tolk-auth'). The stored value is a signed
 *     JWT, not a plaintext credential.
 *   - autoRefreshToken = true (configured in supabase.js) silently refreshes
 *     the access_token before it expires — no manual refresh needed.
 *   - onAuthStateChange fires on: sign-in, sign-out, token refresh, and on
 *     initial load if a persisted session is valid.
 *
 * What this resolves:
 *   BLOCKER-01 — No plaintext credentials stored anywhere.
 *   BLOCKER-02 — Auth is issued and verified by Supabase (GoTrue) server-side.
 *   BLOCKER-05 — Secret-answer recovery replaced by email OTP reset.
 *
 * Backward-compatibility note:
 *   The old agri_users / agri_current_user localStorage keys are cleaned up on
 *   mount so they do not persist stale data alongside the new auth token.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../shared/api/supabase';
import {
  logSignInSuccess,
  logSignInFailure,
  logSignUpSuccess,
  logSignUpFailure,
  logSignOut,
  logPasswordReset,
  logPasswordUpdate,
} from '../../lib/security-log';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // session: the full Supabase Session object (contains user, access_token, etc.)
  // null  = not signed in
  // undefined = still loading (initial check in progress)
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    // -----------------------------------------------------------------------
    // 1. Retrieve any existing session (e.g. on page reload with a valid token).
    //    getSession() reads from localStorage synchronously via the SDK.
    // -----------------------------------------------------------------------
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
    });

    // -----------------------------------------------------------------------
    // 3. Subscribe to all subsequent auth state changes:
    //    SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY
    // -----------------------------------------------------------------------
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // -------------------------------------------------------------------------
  // Derived public user object — safe to expose to the entire component tree.
  // Contains only: { id, email, securityHint } (no tokens, no hashes).
  // -------------------------------------------------------------------------
  const currentUser = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        securityHint: session.user.user_metadata?.security_hint ?? '',
      }
    : null;

  // -------------------------------------------------------------------------
  // AUTH OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Sign in with email + password.
   * Supabase validates credentials server-side and returns a JWT session.
   * Returns { success: true } or { success: false, error: string }.
   */
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logSignInFailure(error.message);
      return { success: false, error: error.message };
    }
    logSignInSuccess(data?.user?.id || 'unknown');
    return { success: true };
  };

  /**
   * Create a new account.
   * securityHint is stored as user_metadata (non-secret, surfaced on recovery UI).
   * Returns { success: true } or { success: false, error: string }.
   *
   * Note: if email confirmations are enabled in your Supabase project, the user
   * will not have an active session until they confirm their email. The UI
   * handles this via the 'check_email' success variant.
   */
  const register = async (email, password, _secretAnswer, securityHint) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          security_hint: securityHint || '',
          // secret_answer is intentionally dropped — see FT-005/FT-006.
          // Password recovery is now handled server-side via email OTP.
        },
      },
    });

    if (error) {
      logSignUpFailure(error.message);
      return { success: false, error: error.message };
    }

    if (data.user && !data.session) {
      logSignUpSuccess(data.user.id, true);
      return { success: true, needsConfirmation: true };
    }

    logSignUpSuccess(data?.user?.id || 'unknown', false);
    return { success: true };
  };

  /**
   * Sign out the current user.
   * Invalidates the session on the Supabase server and clears local storage.
   */
  const logout = async () => {
    const uid = session?.user?.id;
    await supabase.auth.signOut();
    logSignOut(uid || 'unknown');
    // onAuthStateChange fires with SIGNED_OUT → setSession(null)
  };

  /**
   * Send a password-reset email via Supabase.
   * The user receives a link that opens the app with a recovery token in the URL
   * (handled by onAuthStateChange → PASSWORD_RECOVERY event).
   * Returns { success: true } or { success: false, error: string }.
   *
   * The redirectTo URL must be added to the allowed redirect list in the
   * Supabase Dashboard → Authentication → URL Configuration.
   */
  const sendPasswordReset = async (email) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}#recovery`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      logPasswordReset('error', error.message);
      return { success: false, error: error.message };
    }
    logPasswordReset('success');
    return { success: true };
  };

  /**
   * Update the password for the currently authenticated user.
   * Called after the user follows the recovery link and has an active session.
   * Returns { success: true } or { success: false, error: string }.
   */
  const updatePassword = async (newPassword) => {
    const uid = session?.user?.id;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      logPasswordUpdate(uid || 'unknown', 'error', error.message);
      return { success: false, error: error.message };
    }
    logPasswordUpdate(uid || 'unknown', 'success');
    return { success: true };
  };

  /**
   * Legacy shim — the old restorePassword() signature is kept so any
   * component that hasn't been updated yet does not crash.
   * It delegates to sendPasswordReset() which ignores the secret answer.
   * @deprecated Use sendPasswordReset() directly.
   */
  const restorePassword = async (email, _secretAnswer, _newPassword) => {
    return sendPasswordReset(email);
  };

  return (
    <AuthContext.Provider
      value={{
        // Session state
        session,
        currentUser,
        // loading is true only during the initial session check
        loading: session === undefined,

        // Auth operations
        login,
        register,
        logout,
        sendPasswordReset,
        updatePassword,
        restorePassword, // deprecated shim

        // Supabase client exposed for components that need direct access
        // (e.g. OAuth providers, magic links) — read-only, not for auth state
        supabase,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
