/**
 * src/hooks/useUiPrefs.js
 * -----------------------
 * FT-015: Domain hook — UI preferences.
 *
 * Owns:
 *   - language  (ru | en)  — in-memory only; no persistence needed
 *   - selectedMonth        — persisted to localStorage (non-sensitive)
 *   - selectedYear         — persisted to localStorage (non-sensitive)
 *   - viewMode             — 'month' | 'quarter', persisted to localStorage
 *   - selectedQuarter      — e.g. 'q1' | 'h1' | 'year', persisted to localStorage
 *
 * Public API:
 *   language        string        current language tag
 *   toggleLanguage  () => void    switch ru ↔ en
 *   selectedMonth   number        0-indexed month (JS convention)
 *   setSelectedMonth (n) => void
 *   selectedYear    number        4-digit year
 *   setSelectedYear  (n) => void
 *   viewMode        string        'month' | 'quarter'
 *   setViewMode     (s) => void
 *   selectedQuarter string        period code
 *   setSelectedQuarter (s) => void
 */

import { useState, useEffect } from 'react';
import { safeGet, safeSetJSON } from '../../lib/storage';

/**
 * @param {string} userId — used to namespace localStorage keys
 */
export function useUiPrefs(userId) {
  const [language, setLanguage] = useState('ru');

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const v = safeGet(`agri_selected_month_${userId}`, null);
    return v !== null ? parseInt(v, 10) : new Date().getMonth();
  });

  const [selectedYear, setSelectedYear] = useState(() => {
    const v = safeGet(`agri_selected_year_${userId}`, null);
    return v !== null ? parseInt(v, 10) : new Date().getFullYear();
  });

  const [viewMode, setViewMode] = useState(() => {
    return safeGet(`agri_view_mode_${userId}`, null) || 'month';
  });

  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const saved = safeGet(`agri_selected_quarter_${userId}`, null);
    if (saved) return saved;
    return `q${Math.floor(new Date().getMonth() / 3) + 1}`;
  });

  // Persist UI prefs to localStorage whenever they change
  useEffect(() => {
    safeSetJSON(`agri_selected_month_${userId}`, selectedMonth);
    safeSetJSON(`agri_selected_year_${userId}`, selectedYear);
    safeSetJSON(`agri_view_mode_${userId}`, viewMode);
    safeSetJSON(`agri_selected_quarter_${userId}`, selectedQuarter);
  }, [selectedMonth, selectedYear, viewMode, selectedQuarter, userId]);

  const toggleLanguage = () => setLanguage((p) => (p === 'en' ? 'ru' : 'en'));

  return {
    language,
    toggleLanguage,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    viewMode,
    setViewMode,
    selectedQuarter,
    setSelectedQuarter,
  };
}
