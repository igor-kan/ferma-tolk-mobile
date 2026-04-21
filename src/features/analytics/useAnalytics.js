/**
 * src/hooks/useAnalytics.js
 * -------------------------
 * FT-018 / FT-019: Domain hook — analytics computation (thin wrapper).
 * Consumes pure services from src/lib/services/.
 */

import { useMemo } from 'react';
import {
  filterTransactionsByPeriod,
  calculateTotals,
  calculateOpexBreakdown,
  calculateFuelMetrics,
  calculateForecast,
  calculateCycleAnalytics,
  calculateProjectBreakdown,
} from './analytics';

/**
 * @param {{
 *   transactions:        object[],
 *   projects:            object[],
 *   descriptionMappings: Record<string, string>,
 *   forecastAdjustments: Record<string, Record<string, number>>,
 *   opexSubCategories:   object[],
 *   selectedMonth:       number,
 *   selectedYear:        number,
 * }} inputs
 */
export function useAnalytics({
  transactions,
  projects,
  descriptionMappings,
  forecastAdjustments,
  opexSubCategories,
  selectedMonth,
  selectedYear,
}) {
  return useMemo(() => {
    // 1. Filter by period
    const filteredTransactions = filterTransactionsByPeriod(
      transactions,
      selectedMonth,
      selectedYear
    );

    // 2. Core totals
    const totals = calculateTotals(filteredTransactions);

    // 3. OPEX breakdown
    const opexBreakdown = calculateOpexBreakdown(filteredTransactions, {
      descriptionMappings,
      opexSubCategories,
    });

    // 4. Fuel metrics
    const { fuelLiters, fuelCost, fuelBreakdown } = calculateFuelMetrics(filteredTransactions, {
      descriptionMappings,
      opexSubCategories,
    });

    // 5. Forecasting
    const { opexBreakdownWithForecast, forecastTotal, isCurrentMonth } = calculateForecast({
      opexBreakdown,
      selectedMonth,
      selectedYear,
      forecastAdjustments,
    });

    // 6. Year-over-year
    const cycleAnalytics = calculateCycleAnalytics({
      transactions,
      opexBreakdown,
      descriptionMappings,
      opexSubCategories,
      selectedMonth,
      selectedYear,
    });

    // 7. Projects
    const projectBreakdown = calculateProjectBreakdown({
      filteredTransactions,
      projects,
      totals,
    });

    return {
      ...totals,
      fuelLiters,
      fuelCost,
      fuelBreakdown,
      opexFuel: opexBreakdown.find((b) => b.slug === 'fuel')?.value || 0,
      opexSalary: opexBreakdown.find((b) => b.slug === 'salary')?.value || 0,
      opexFood: opexBreakdown.find((b) => b.slug === 'food')?.value || 0,
      opexBreakdown: opexBreakdownWithForecast,
      forecastTotal,
      isCurrentMonth,
      cycleAnalytics,
      projectBreakdown,
    };
  }, [
    transactions,
    projects,
    descriptionMappings,
    forecastAdjustments,
    opexSubCategories,
    selectedMonth,
    selectedYear,
  ]);
}
