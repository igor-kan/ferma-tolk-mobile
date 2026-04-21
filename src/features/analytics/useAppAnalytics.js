/**
 * src/hooks/useAppAnalytics.js
 * ----------------------------
 * FT-017 / FT-019 / FT-025: Compose domain hooks for computed analytics.
 * Integrates data-driven taxonomy and server-side computations.
 */

import { useAuth } from '../auth/AuthContext';
import { useUiContext } from '../ui/UiContext';
import { useQuery } from '@tanstack/react-query';
import { useTaxonomy } from '../taxonomy/useTaxonomy';
import { supabase } from '../../shared/api/supabase';
import { buildApiUrl } from '../../shared/api/apiUrl';
import {
  filterTransactionsByPeriod,
  calculateTotals,
  calculateOpexBreakdown,
  calculateFuelMetrics,
  calculateForecast,
  calculateCycleAnalytics,
  calculateProjectBreakdown,
} from './analytics';
import { createDefaultAnalytics, normalizeAnalyticsPayload } from './analyticsShape';

const DEFAULT_PROJECTS = [
  { id: 'onion', name: 'onion', label: 'Onion Field' },
  { id: 'watermelon', name: 'watermelon', label: 'Watermelon Field' },
  { id: 'greenhouse', name: 'greenhouse', label: 'Greenhouse' },
  { id: 'all_projects', name: 'all_projects', label: 'All Projects (Shared)' },
];

function dbRowToTx(r) {
  return {
    id: r.id,
    type: r.type,
    category: r.category || (r.type === 'income' ? 'operationalRevenue' : 'opex'),
    subCategory: r.sub_category,
    projectId: r.project_id || null,
    amount: parseFloat(r.amount),
    liters: r.liters != null ? parseFloat(r.liters) : undefined,
    fuelType: r.fuel_type,
    isFuel: r.is_fuel,
    description: r.description,
    date: r.entry_date,
    opex_sub_id: r.opex_sub_id,
  };
}

function dbRowToProject(r) {
  return { id: r.slug, name: r.slug, label: r.label, _uuid: r.id };
}

function dbRowToOpexSubCat(r) {
  return {
    id: r.id,
    slug: r.slug,
    label: r.label,
    icon: r.icon,
    color: r.color,
    is_fuel: r.is_fuel ?? r.isFuel ?? false,
    parent_category: r.parent_category ?? r.parentCategory,
    display_order: r.display_order ?? r.displayOrder ?? 0,
    forecasting_type: r.forecasting_type ?? r.forecastingType ?? 'trend',
    keywords_ru: Array.isArray(r.keywords_ru) ? r.keywords_ru : [],
    keywords_en: Array.isArray(r.keywords_en) ? r.keywords_en : [],
  };
}

async function fetchAnalyticsFromApi({ accessToken, selectedMonth, selectedYear }) {
  const endpoint = buildApiUrl(`/api/analytics?month=${selectedMonth}&year=${selectedYear}`);
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Analytics API failed (${res.status})`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Analytics API returned non-JSON content type: ${contentType || 'unknown'}`);
  }

  return res.json();
}

async function computeAnalyticsClientSide({
  userId,
  selectedMonth,
  selectedYear,
  taxonomyOpexSubCategories,
}) {
  const start1 = new Date(selectedYear, selectedMonth, 1).toISOString();
  const end1 = new Date(selectedYear, selectedMonth + 1, 1).toISOString();
  const start2 = new Date(selectedYear - 1, selectedMonth, 1).toISOString();
  const end2 = new Date(selectedYear - 1, selectedMonth + 1, 1).toISOString();

  const needsOpexFetch =
    !Array.isArray(taxonomyOpexSubCategories) || taxonomyOpexSubCategories.length === 0;

  const [txRes, projectsRes, mappingsRes, forecastRes, opexSubCatRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .or(
        `and(entry_date.gte.${start1},entry_date.lt.${end1}),and(entry_date.gte.${start2},entry_date.lt.${end2})`
      ),

    supabase.from('projects').select('*').eq('user_id', userId),

    supabase
      .from('description_mappings')
      .select('description_key, sub_category_id')
      .eq('user_id', userId),

    supabase
      .from('forecast_adjustments')
      .select('year, month, category_id, delta')
      .eq('user_id', userId)
      .eq('month', selectedMonth)
      .eq('year', selectedYear),

    needsOpexFetch
      ? supabase
          .from('opex_sub_categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
      : Promise.resolve({ data: taxonomyOpexSubCategories, error: null }),
  ]);

  if (txRes.error) throw txRes.error;
  if (projectsRes.error) throw projectsRes.error;
  if (mappingsRes.error) throw mappingsRes.error;
  if (forecastRes.error) throw forecastRes.error;
  if (opexSubCatRes.error) throw opexSubCatRes.error;

  const transactions = (txRes.data || []).map(dbRowToTx);
  const projects = (projectsRes.data || []).length
    ? projectsRes.data.map(dbRowToProject)
    : DEFAULT_PROJECTS;

  const descriptionMappings = {};
  for (const row of mappingsRes.data || []) {
    descriptionMappings[row.description_key] = row.sub_category_id;
  }

  const forecastAdjustments = {};
  const key = `${selectedYear}-${selectedMonth}`;
  forecastAdjustments[key] = {};
  for (const row of forecastRes.data || []) {
    forecastAdjustments[key][row.category_id] = row.delta;
  }

  const opexSubCategories = (opexSubCatRes.data || [])
    .map(dbRowToOpexSubCat)
    .filter((cat) => cat.is_active !== false);

  const filteredTransactions = filterTransactionsByPeriod(
    transactions,
    selectedMonth,
    selectedYear
  );
  const totals = calculateTotals(filteredTransactions);

  const opexBreakdown = calculateOpexBreakdown(filteredTransactions, {
    descriptionMappings,
    opexSubCategories,
  });

  const { fuelLiters, fuelCost, fuelBreakdown } = calculateFuelMetrics(filteredTransactions, {
    descriptionMappings,
    opexSubCategories,
  });

  const { opexBreakdownWithForecast, forecastTotal, isCurrentMonth } = calculateForecast({
    opexBreakdown,
    selectedMonth,
    selectedYear,
    forecastAdjustments,
  });

  const cycleAnalytics = calculateCycleAnalytics({
    transactions,
    opexBreakdown,
    descriptionMappings,
    opexSubCategories,
    selectedMonth,
    selectedYear,
  });

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
}

export function useAppAnalytics() {
  const { currentUser, session } = useAuth();
  const userId = currentUser?.id;
  const { selectedMonth, selectedYear } = useUiContext();

  const taxonomyDomain = useTaxonomy(userId);

  const analyticsQuery = useQuery({
    queryKey: ['analytics', userId, selectedMonth, selectedYear],
    queryFn: async () => {
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('No access token');

      try {
        const apiPayload = await fetchAnalyticsFromApi({
          accessToken,
          selectedMonth,
          selectedYear,
        });
        return normalizeAnalyticsPayload(apiPayload);
      } catch (apiError) {
        // Local Vite dev serves /api/* as JS modules; use client fallback in that case.
        console.warn('[analytics] API fetch failed, using client fallback', apiError);
      }

      const fallbackPayload = await computeAnalyticsClientSide({
        userId,
        selectedMonth,
        selectedYear,
        taxonomyOpexSubCategories: taxonomyDomain.taxonomy.opexSubCategories,
      });
      return normalizeAnalyticsPayload(fallbackPayload);
    },
    enabled:
      !!userId &&
      !!session?.access_token &&
      selectedMonth !== undefined &&
      selectedYear !== undefined,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const analytics = normalizeAnalyticsPayload(analyticsQuery.data || createDefaultAnalytics());
  const hasAnalyticsError = !!analyticsQuery.error && !analyticsQuery.data;

  return {
    ...analytics,
    dbReady: taxonomyDomain.dbReady && !analyticsQuery.isPending && !hasAnalyticsError,
    dbError: taxonomyDomain.dbError || analyticsQuery.error,
    taxonomy: taxonomyDomain.taxonomy,
  };
}
