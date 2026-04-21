/**
 * src/hooks/useForecast.js
 * ------------------------
 * FT-016: Shift server state management to TanStack Query.
 *
 * Owns:
 *   - forecastAdjustments{}  loaded via useQuery from Supabase
 *
 * Public API:
 *   forecastAdjustments  Record<"year-month", Record<categoryId, delta>>
 *   adjustForecast       (categoryId, delta) => Promise<void>
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../shared/api/supabase';

/**
 * @param {string} userId
 * @param {number} selectedYear   — passed in from useUiPrefs
 * @param {number} selectedMonth  — passed in from useUiPrefs
 */
export function useForecast(userId, selectedYear, selectedMonth) {
  const queryClient = useQueryClient();

  // ── Forecast Adjustments Query ────────────────────────────────────────────
  const forecastQuery = useQuery({
    queryKey: ['forecastAdjustments', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_adjustments')
        .select('year, month, category_id, delta')
        .eq('user_id', userId);

      if (error) throw error;
      const obj = {};
      if (data) {
        for (const r of data) {
          const key = `${r.year}-${r.month}`;
          if (!obj[key]) obj[key] = {};
          obj[key][r.category_id] = r.delta;
        }
      }
      return obj;
    },
    enabled: !!userId,
  });

  const adjustForecastMutation = useMutation({
    mutationFn: async ({ categoryId, newDelta }) => {
      const { error } = await supabase.from('forecast_adjustments').upsert(
        {
          user_id: userId,
          year: selectedYear,
          month: selectedMonth,
          category_id: categoryId,
          delta: newDelta,
        },
        { onConflict: 'user_id,year,month,category_id' }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecastAdjustments', userId] });
    },
  });

  // ── Public API Wrapper ────────────────────────────────────────────────────

  const adjustForecast = useCallback(
    async (categoryId, delta) => {
      const key = `${selectedYear}-${selectedMonth}`;
      const data = forecastQuery.data || {};
      const prev = data[key] || {};
      const newDelta = (prev[categoryId] || 0) + delta;

      try {
        await adjustForecastMutation.mutateAsync({ categoryId, newDelta });
      } catch (err) {
        console.error('adjustForecast:', err);
      }
    },
    [userId, selectedYear, selectedMonth, forecastQuery.data, adjustForecastMutation]
  );

  return {
    forecastAdjustments: forecastQuery.data || {},
    adjustForecast,
  };
}
