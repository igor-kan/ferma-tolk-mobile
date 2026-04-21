/**
 * src/lib/services/assistant.js
 * -----------------------------
 * FT-019: Dedicated service for assistant logic (intent detection, filtering, response building).
 * Supports data-driven synonyms from taxonomy.
 */

import { FALLBACK_TAXONOMY } from '../transactions/categorization.js';

/**
 * Detects the time period from natural language input.
 */
export function detectPeriod(lowerText, language = 'ru', now = new Date()) {
  let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  let periodLabel = language === 'ru' ? 'текущий месяц' : 'current month';

  if (lowerText.match(/прошл[оы][мй] месяц|last month/)) {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    periodLabel = language === 'ru' ? 'прошлый месяц' : 'last month';
  } else if (lowerText.match(/эт[оо][мй] месяц|this month/)) {
    // defaults already set
  } else if (lowerText.match(/неделе|week/)) {
    const day = now.getDay() || 7;
    startDate = new Date(now);
    startDate.setDate(now.getDate() - day + 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    periodLabel = language === 'ru' ? 'эта неделя' : 'this week';
  } else if (lowerText.match(/квартал|quarter/)) {
    const q = Math.floor(now.getMonth() / 3);
    startDate = new Date(now.getFullYear(), q * 3, 1);
    endDate = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
    periodLabel = language === 'ru' ? 'квартал' : 'quarter';
  } else if (lowerText.match(/год[уа]?|year/)) {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    periodLabel = language === 'ru' ? 'этот год' : 'this year';
  } else if (lowerText.match(/сегодня|today/)) {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    periodLabel = language === 'ru' ? 'сегодня' : 'today';
  } else if (lowerText.match(/все|все время|all time/)) {
    startDate = new Date(0);
    endDate = new Date(now.getFullYear() + 10, 0, 1);
    periodLabel = language === 'ru' ? 'все время' : 'all time';
  }

  return { startDate, endDate, periodLabel };
}

const DIESEL_REGEX = /дизель|солярк|diesel|solyarka/;
const PETROL_REGEX = /бензин|petrol|gasoline/;
const PROPAN_REGEX = /пропан|propan|propane|lpg/;

/**
 * Filters transactions based on natural language query.
 */
export function filterAssistantTransactions({
  transactions,
  lowerText,
  language = 'ru',
  taxonomy,
  now = new Date(),
}) {
  const { startDate, endDate, periodLabel } = detectPeriod(lowerText, language, now);

  // Fall back to FALLBACK_TAXONOMY when no DB taxonomy is available yet
  const resolvedTaxonomy =
    taxonomy && taxonomy.categories && taxonomy.categories.length > 0
      ? taxonomy
      : FALLBACK_TAXONOMY;
  const { categories = [], subCategories = [], opexSubCategories = [] } = resolvedTaxonomy;

  // 1. Detect Intent/Keywords from taxonomy
  const findMatch = (list) =>
    list.find((item) => {
      const keywords = [...(item.keywords_ru || []), ...(item.keywords_en || [])];
      return keywords.some((k) => lowerText.includes(k.toLowerCase()));
    });

  const matchedTopCat = findMatch(categories);
  const matchedSubCat = findMatch(subCategories);
  const matchedOpex = findMatch(opexSubCategories);

  const isDieselQ = DIESEL_REGEX.test(lowerText);
  const isPetrolQ = PETROL_REGEX.test(lowerText);
  const isPropanQ = PROPAN_REGEX.test(lowerText);

  const isFuelQ = isDieselQ || isPetrolQ || isPropanQ || matchedOpex?.slug === 'fuel';
  const isSalaryQ = matchedOpex?.slug === 'salary';
  const isIncomeQ =
    matchedTopCat?.slug === 'income' || matchedSubCat?.slug === 'operationalRevenue';
  const isExpenseQ = matchedTopCat?.slug === 'expense';

  // Specific query logic: if matched an opex leaf or special keyword
  const isSpecificQuery = matchedOpex || isFuelQ || isSalaryQ;

  let effectiveStart = startDate;
  let effectiveEnd = endDate;
  let effectivePeriod = periodLabel;

  if (isSpecificQuery) {
    effectiveStart = new Date(0);
    effectiveEnd = new Date(now.getFullYear() + 10, 0, 1);
    effectivePeriod = language === 'ru' ? 'все время' : 'all time';
  }

  const txMatch = (tx) => {
    const desc = (tx.description || '').toLowerCase();
    const sub = (tx.subCategory || '').toLowerCase();
    const full = (tx.fullTranscript || '').toLowerCase();
    const fuelTyp = (tx.fuelType || '').toLowerCase();

    // If we matched a specific leaf category from taxonomy
    if (matchedOpex) {
      const keywords = [...(matchedOpex.keywords_ru || []), ...(matchedOpex.keywords_en || [])];
      if (
        keywords.some((k) => desc.includes(k) || sub.includes(k) || full.includes(k)) ||
        tx.opex_sub_id === matchedOpex.id ||
        sub === matchedOpex.slug
      )
        return true;
    }

    // Fallback/Legacy/Hardcoded specific fuel type matching
    if (isDieselQ)
      return (
        DIESEL_REGEX.test(desc) ||
        DIESEL_REGEX.test(full) ||
        fuelTyp === 'diesel' ||
        sub === 'diesel'
      );
    if (isPetrolQ)
      return (
        PETROL_REGEX.test(desc) ||
        PETROL_REGEX.test(full) ||
        fuelTyp === 'petrol' ||
        sub === 'petrol'
      );
    if (isPropanQ)
      return (
        PROPAN_REGEX.test(desc) ||
        PROPAN_REGEX.test(full) ||
        fuelTyp === 'propan' ||
        sub === 'propan'
      );

    if (matchedSubCat) {
      return tx.sub_category_id === matchedSubCat.id || tx.category === matchedSubCat.slug;
    }

    if (matchedTopCat) {
      return tx.category_id === matchedTopCat.id || tx.type === matchedTopCat.slug;
    }

    return true;
  };

  const filtered = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    if (txDate < effectiveStart || txDate > effectiveEnd) return false;

    // If user said "income" but is asking about "diesel" (expense), the specific query wins
    if (isIncomeQ && !isSpecificQuery && tx.type !== 'income') return false;
    if (isExpenseQ && !isSpecificQuery && tx.type !== 'expense') return false;

    return txMatch(tx);
  });

  return { filtered, effectivePeriod, matchedCat: matchedOpex || matchedSubCat || matchedTopCat };
}

/**
 * Builds the assistant's response text based on filtered transactions.
 */
export function buildAssistantResponse({
  filtered,
  effectivePeriod,
  matchedCat,
  lowerText,
  language = 'ru',
}) {
  if (filtered.length === 0) {
    const searchedFor = matchedCat
      ? language === 'ru'
        ? matchedCat.label_ru
        : matchedCat.label_en
      : lowerText.substring(0, 30);
    return language === 'ru'
      ? `Нет транзакций по запросу "${searchedFor}".\n\nПроверьте что записи добавлены через голос или форму.`
      : `No transactions found for "${searchedFor}".\n\nMake sure entries have been added via voice or manual form.`;
  }

  let totalExpense = 0;
  let totalIncome = 0;
  let totalLiters = 0;

  let lines =
    language === 'ru'
      ? `Транзакции (${effectivePeriod}):\n\n`
      : `Transactions (${effectivePeriod}):\n\n`;

  filtered.forEach((tx) => {
    const dateStr = new Date(tx.date).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US');
    const amt = tx.amount || 0;

    if (tx.type === 'expense') totalExpense += amt;
    else totalIncome += amt;

    const liters = parseFloat(tx.liters || 0);
    const litersStr =
      liters > 0
        ? `   ${liters}л • ${(amt / liters).toFixed(1)} ${language === 'ru' ? 'руб/л' : 'rub/l'}`
        : '';

    if (liters > 0) totalLiters += liters;

    const sign = tx.type === 'income' ? '+' : '-';
    const name = tx.description || (language === 'ru' ? 'Без названия' : 'Unnamed');
    const unit = language === 'ru' ? 'руб' : 'rub';
    lines += `• ${name}  (${dateStr})\n   ${sign}${amt.toLocaleString()} ${unit}${litersStr}\n\n`;
  });

  lines += '\n';
  if (totalLiters > 0) {
    lines +=
      language === 'ru'
        ? `⛽ Всего литров: ${totalLiters.toFixed(1)} л\n`
        : `⛽ Total liters: ${totalLiters.toFixed(1)} l\n`;
  }
  if (totalIncome > 0) {
    lines +=
      language === 'ru'
        ? `✅ Итого доход: +${totalIncome.toLocaleString()} руб\n`
        : `✅ Total income: +${totalIncome.toLocaleString()} rub\n`;
  }
  if (totalExpense > 0) {
    lines +=
      language === 'ru'
        ? `💸 Итого расход: -${totalExpense.toLocaleString()} руб\n`
        : `💸 Total expense: -${totalExpense.toLocaleString()} rub\n`;
  }

  return lines;
}
