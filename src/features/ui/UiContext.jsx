/**
 * src/context/UiContext.jsx
 * -------------------------
 * FT-017: Isolate local UI state.
 *
 * Owns:
 *   - language
 *   - selectedMonth / selectedYear
 *
 * This context is strictly for non-persistent (or local-persistent) UI state
 * that multiple components need access to.
 */

import { createContext, useContext } from 'react';
import { useUiPrefs } from './useUiPrefs';

const UiContext = createContext();

export const UiProvider = ({ children, userId }) => {
  const uiPrefs = useUiPrefs(userId);

  return <UiContext.Provider value={uiPrefs}>{children}</UiContext.Provider>;
};

export const useUiContext = () => {
  const context = useContext(UiContext);
  if (!context) throw new Error('useUiContext must be used within a UiProvider');
  return context;
};
