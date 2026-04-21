/**
 * src/lib/services/assistant.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { detectPeriod, filterAssistantTransactions } from './assistantService.js';

test('detectPeriod detects current month', () => {
  const now = new Date(2024, 0, 15);
  const { startDate, endDate: _endDate, periodLabel } = detectPeriod('test', 'ru', now);
  assert.strictEqual(startDate.getMonth(), 0);
  assert.strictEqual(startDate.getFullYear(), 2024);
  assert.strictEqual(startDate.getDate(), 1);
  assert.strictEqual(periodLabel, 'текущий месяц');
});

test('detectPeriod detects last month', () => {
  const now = new Date(2024, 0, 15);
  const { startDate, periodLabel } = detectPeriod('прошлый месяц', 'ru', now);
  assert.strictEqual(startDate.getMonth(), 11);
  assert.strictEqual(startDate.getFullYear(), 2023);
  assert.strictEqual(periodLabel, 'прошлый месяц');
});

test('filterAssistantTransactions filters by income keyword', () => {
  const transactions = [
    { type: 'income', amount: 1000, description: 'sale', date: '2024-01-10' },
    { type: 'expense', amount: 500, description: 'buy', date: '2024-01-11' },
  ];
  const now = new Date(2024, 0, 15);
  const { filtered } = filterAssistantTransactions({
    transactions,
    lowerText: 'доход',
    language: 'ru',
    now,
  });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].type, 'income');
});

test('filterAssistantTransactions filters by fuel synonym', () => {
  const transactions = [
    { type: 'expense', amount: 500, description: 'солярка', date: '2024-01-11' },
    { type: 'expense', amount: 100, description: 'хлеб', date: '2024-01-12' },
  ];
  const now = new Date(2024, 0, 15);
  const { filtered } = filterAssistantTransactions({
    transactions,
    lowerText: 'траты на дизель',
    language: 'ru',
    now,
  });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].description, 'солярка');
});
