/**
 * Normalizes analytics payload shapes consumed by Dashboard/Reports.
 * Keeps UI resilient if API responses are missing fields or use stale schema.
 */

const FUEL_TYPES = ['petrol', 'diesel', 'propan', 'other'];

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function createEmptyFuelBreakdown() {
  return {
    petrol: { liters: 0, cost: 0 },
    diesel: { liters: 0, cost: 0 },
    propan: { liters: 0, cost: 0 },
    other: { liters: 0, cost: 0 },
  };
}

export function createDefaultAnalytics() {
  return {
    totalIncome: 0,
    totalExpenses: 0,
    opex: 0,
    capex: 0,
    balance: 0,
    fuelLiters: 0,
    fuelCost: 0,
    fuelBreakdown: createEmptyFuelBreakdown(),
    opexFuel: 0,
    opexSalary: 0,
    opexFood: 0,
    opexBreakdown: [],
    forecastTotal: 0,
    isCurrentMonth: false,
    cycleAnalytics: [],
    projectBreakdown: [],
  };
}

export function normalizeAnalyticsPayload(payload) {
  const base = createDefaultAnalytics();
  const src = asObject(payload);
  const fuelSrc = asObject(src.fuelBreakdown);
  const fuelBreakdown = createEmptyFuelBreakdown();

  for (const type of FUEL_TYPES) {
    const bucket = asObject(fuelSrc[type]);
    fuelBreakdown[type] = {
      liters: asNumber(bucket.liters),
      cost: asNumber(bucket.cost),
    };
  }

  return {
    ...base,
    ...src,
    totalIncome: asNumber(src.totalIncome, base.totalIncome),
    totalExpenses: asNumber(src.totalExpenses, base.totalExpenses),
    opex: asNumber(src.opex, base.opex),
    capex: asNumber(src.capex, base.capex),
    balance: asNumber(src.balance, base.balance),
    fuelLiters: asNumber(src.fuelLiters, base.fuelLiters),
    fuelCost: asNumber(src.fuelCost, base.fuelCost),
    opexFuel: asNumber(src.opexFuel, base.opexFuel),
    opexSalary: asNumber(src.opexSalary, base.opexSalary),
    opexFood: asNumber(src.opexFood, base.opexFood),
    forecastTotal: asNumber(src.forecastTotal, base.forecastTotal),
    isCurrentMonth: Boolean(src.isCurrentMonth),
    fuelBreakdown,
    opexBreakdown: asArray(src.opexBreakdown),
    cycleAnalytics: asArray(src.cycleAnalytics),
    projectBreakdown: asArray(src.projectBreakdown),
  };
}
