import { test } from 'node:test';
import assert from 'node:assert';
import {
  createDefaultAnalytics,
  createEmptyFuelBreakdown,
  normalizeAnalyticsPayload,
} from './analyticsShape.js';

test('createDefaultAnalytics returns safe UI shapes', () => {
  const defaults = createDefaultAnalytics();
  assert.deepStrictEqual(defaults.cycleAnalytics, []);
  assert.deepStrictEqual(defaults.projectBreakdown, []);
  assert.deepStrictEqual(defaults.opexBreakdown, []);
  assert.deepStrictEqual(defaults.fuelBreakdown, createEmptyFuelBreakdown());
});

test('normalizeAnalyticsPayload converts legacy cycleAnalytics object to array', () => {
  const normalized = normalizeAnalyticsPayload({
    totalIncome: 100,
    cycleAnalytics: { hasPreviousYearData: false },
  });

  assert.strictEqual(normalized.totalIncome, 100);
  assert.deepStrictEqual(normalized.cycleAnalytics, []);
});

test('normalizeAnalyticsPayload repairs invalid or partial fuelBreakdown payload', () => {
  const normalized = normalizeAnalyticsPayload({
    fuelBreakdown: {
      diesel: { liters: '10.5', cost: '99.9' },
      petrol: { liters: 'bad', cost: null },
    },
  });

  assert.deepStrictEqual(normalized.fuelBreakdown.diesel, { liters: 10.5, cost: 99.9 });
  assert.deepStrictEqual(normalized.fuelBreakdown.petrol, { liters: 0, cost: 0 });
  assert.deepStrictEqual(normalized.fuelBreakdown.propan, { liters: 0, cost: 0 });
  assert.deepStrictEqual(normalized.fuelBreakdown.other, { liters: 0, cost: 0 });
});
