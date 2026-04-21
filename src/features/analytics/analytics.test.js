/**
 * src/lib/services/analytics.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert';
import {
  filterTransactionsByPeriod,
  calculateTotals,
  calculateOpexBreakdown,
  calculateForecast,
} from './analytics.js';

test('filterTransactionsByPeriod filters correctly', () => {
  const txs = [
    { date: '2024-01-15', amount: 100 },
    { date: '2024-02-15', amount: 200 },
    { date: '2023-01-15', amount: 300 },
  ];
  const filtered = filterTransactionsByPeriod(txs, 0, 2024);
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].amount, 100);
});

test('calculateTotals computes accurately', () => {
  const txs = [
    { type: 'income', amount: 1000, category: 'operationalRevenue' },
    { type: 'expense', amount: 400, category: 'opex' },
    { type: 'expense', amount: 100, category: 'capex' },
  ];
  const totals = calculateTotals(txs);
  assert.strictEqual(totals.totalIncome, 1000);
  assert.strictEqual(totals.totalExpenses, 500);
  assert.strictEqual(totals.opex, 400);
  assert.strictEqual(totals.capex, 100);
  assert.strictEqual(totals.balance, 500);
});

test('calculateOpexBreakdown uses keywords', () => {
  const txs = [
    { type: 'expense', category: 'opex', amount: 100, description: 'бензин' },
    { type: 'expense', category: 'opex', amount: 200, description: 'unknown' },
  ];
  const opexSubCategories = [{ slug: 'fuel', keywords_ru: ['бензин'], keywords_en: ['petrol'] }];
  const breakdown = calculateOpexBreakdown(txs, { descriptionMappings: {}, opexSubCategories });
  assert.strictEqual(breakdown.length, 1);
  assert.strictEqual(breakdown[0].value, 100);
});

test('calculateForecast applies trend multiplier for current month', () => {
  const opexBreakdown = [
    { id: 'fuel', value: 100, forecasting_type: 'trend' },
    { id: 'salary', value: 500, forecasting_type: 'fixed' },
  ];
  // Mock "now" as middle of January (day 15 of 31)
  const now = new Date(2024, 0, 15);
  const result = calculateForecast({
    opexBreakdown,
    selectedMonth: 0,
    selectedYear: 2024,
    forecastAdjustments: {},
    now,
  });

  const fuel = result.opexBreakdownWithForecast.find((c) => c.id === 'fuel');
  const salary = result.opexBreakdownWithForecast.find((c) => c.id === 'salary');

  assert.ok(fuel.projected > 206 && fuel.projected < 207);
  assert.strictEqual(salary.projected, 500);
  assert.strictEqual(result.isCurrentMonth, true);
});
