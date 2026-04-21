/**
 * src/lib/services/analytics.js
 * -----------------------------
 * FT-019: Dedicated service for analytics and forecasting calculations.
 * Supports data-driven taxonomy.
 */

/**
 * Filters transactions by month and year.
 */
export function filterTransactionsByPeriod(transactions, month, year) {
  return transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

/**
 * Calculates core totals (income, expenses, opex, capex, balance).
 */
export function calculateTotals(filteredTransactions) {
  const totalIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((a, t) => a + t.amount, 0);
  const totalExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((a, t) => a + t.amount, 0);
  const opex = filteredTransactions
    .filter((t) => t.type === 'expense' && t.category === 'opex')
    .reduce((a, t) => a + t.amount, 0);
  const capex = filteredTransactions
    .filter((t) => t.type === 'expense' && t.category === 'capex')
    .reduce((a, t) => a + t.amount, 0);
  const balance = totalIncome - totalExpenses;

  return { totalIncome, totalExpenses, opex, capex, balance };
}

/**
 * Calculates OPEX breakdown based on database-driven categories.
 */
export function calculateOpexBreakdown(
  filteredTransactions,
  { descriptionMappings, opexSubCategories = [] }
) {
  return opexSubCategories.map((cat) => ({
    ...cat,
    value: filteredTransactions
      .filter((t) => {
        if (t.type !== 'expense' || t.category !== 'opex') return false;

        // Priority 1: Direct ID match if available
        if (t.opex_sub_id && t.opex_sub_id === cat.id) return true;

        // Priority 2: Description Mapping
        const desc = (t.description || '').toLowerCase();
        const mappedId = descriptionMappings[desc];
        if (mappedId) return mappedId === (cat.slug || cat.id);

        // Priority 3: Keyword Match
        const keywords = [...(cat.keywords_ru || []), ...(cat.keywords_en || [])];
        return keywords.some((k) => desc.includes(k.toLowerCase()));
      })
      .reduce((a, t) => a + t.amount, 0),
  }));
}

/**
 * Calculates fuel-specific metrics and breakdown.
 */
export function calculateFuelMetrics(
  filteredTransactions,
  { descriptionMappings, opexSubCategories = [] }
) {
  const fuelCat = opexSubCategories.find((c) => c.slug === 'fuel');
  const fuelKeywords = fuelCat
    ? [...(fuelCat.keywords_ru || []), ...(fuelCat.keywords_en || [])]
    : ['топлив', 'бензин', 'дизель', 'fuel', 'petrol'];

  const fuelTransactions = filteredTransactions.filter((t) => {
    if (t.opex_sub_id && fuelCat && t.opex_sub_id === fuelCat.id) return true;

    const desc = (t.description || '').toLowerCase();
    const mappedId = descriptionMappings[desc];
    if (mappedId === 'fuel') return true;
    if (mappedId) return false;

    return t.isFuel || fuelKeywords.some((k) => desc.includes(k.toLowerCase()));
  });

  const fuelLiters = fuelTransactions.reduce((a, t) => a + (parseFloat(t.liters) || 0), 0);
  const fuelCost = fuelTransactions.reduce((a, t) => a + (t.amount || 0), 0);

  const fuelBreakdown = {
    petrol: { liters: 0, cost: 0 },
    diesel: { liters: 0, cost: 0 },
    propan: { liters: 0, cost: 0 },
    other: { liters: 0, cost: 0 },
  };

  fuelTransactions.forEach((t) => {
    const desc = (t.description || '').toLowerCase();
    const type =
      t.fuelType ||
      (desc.match(/бензин|petrol/)
        ? 'petrol'
        : desc.match(/дизель|солярк|diesel|solarka|solyarka/)
          ? 'diesel'
          : desc.match(/пропан|propan/)
            ? 'propan'
            : 'other');
    const b = fuelBreakdown[type] || fuelBreakdown.other;
    b.liters += parseFloat(t.liters) || 0;
    b.cost += t.amount;
  });

  return { fuelLiters, fuelCost, fuelBreakdown };
}

/**
 * Calculates forecasting for the current period.
 */
export function calculateForecast({
  opexBreakdown,
  selectedMonth,
  selectedYear,
  forecastAdjustments,
  now = new Date(),
}) {
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const daysElapsed = isCurrentMonth ? now.getDate() : 30;
  const daysTotal = isCurrentMonth
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    : 30;
  const forecastMult = isCurrentMonth ? daysTotal / Math.max(daysElapsed, 1) : 1;
  const currentAdj = forecastAdjustments[`${selectedYear}-${selectedMonth}`] || {};

  const opexBreakdownWithForecast = opexBreakdown.map((cat) => {
    const base =
      cat.forecasting_type === 'trend' ? (cat.value || 0) * forecastMult : cat.value || 0;
    const adjustment = currentAdj[cat.slug || cat.id] || 0;
    return { ...cat, projected: Math.max(0, base + adjustment), adjustment };
  });

  const forecastTotal = opexBreakdownWithForecast.reduce((a, c) => a + (c.projected || 0), 0);

  return { opexBreakdownWithForecast, forecastTotal, isCurrentMonth };
}

/**
 * Calculates year-over-year crop cycle analytics.
 */
export function calculateCycleAnalytics({
  transactions,
  opexBreakdown,
  descriptionMappings,
  opexSubCategories = [],
  selectedMonth,
  selectedYear,
}) {
  const cycleSlugs = ['seeds', 'fertilizers', 'pesticides', 'irrigation', 'contractLabor'];

  const prevYearTx = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear - 1;
  });

  return cycleSlugs.map((slug) => {
    const cat = opexSubCategories.find((c) => c.slug === slug);
    const currentVal = opexBreakdown.find((b) => b.slug === slug)?.value || 0;

    const prevVal = prevYearTx
      .filter((t) => {
        if (t.opex_sub_id && cat && t.opex_sub_id === cat.id) return true;

        const desc = (t.description || '').toLowerCase();
        const mid = descriptionMappings[desc];
        if (mid) return mid === slug;

        if (!cat) return false;
        const keywords = [...(cat.keywords_ru || []), ...(cat.keywords_en || [])];
        return keywords.some((k) => desc.includes(k.toLowerCase()));
      })
      .reduce((a, t) => a + (t.amount || 0), 0);

    return { id: slug, currentVal, prevVal };
  });
}

/**
 * Calculates Project P&L breakdown.
 */
export function calculateProjectBreakdown({ filteredTransactions, projects, totals: _totals }) {
  const { totalIncome: sharedIncomeTotal, totalExpenses: sharedExpenseTotal } = calculateTotals(
    filteredTransactions.filter((t) => t.projectId === 'all_projects' || !t.projectId)
  );

  const indivProjects = projects.filter((p) => p.id !== 'all_projects');
  const numIndiv = Math.max(indivProjects.length, 1);

  return projects.map((p) => {
    const pTx = filteredTransactions.filter((t) => t.projectId === p.id);
    let pIncome = pTx.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
    let pExpense = pTx.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

    if (p.id !== 'all_projects') {
      pIncome += sharedIncomeTotal / numIndiv;
      pExpense += sharedExpenseTotal / numIndiv;
    }

    const pBalance = pIncome - pExpense;
    const effectiveness = pExpense > 0 ? (pBalance / pExpense) * 100 : pIncome > 0 ? 100 : 0;
    return { ...p, pIncome, pExpense, pBalance, effectiveness };
  });
}
