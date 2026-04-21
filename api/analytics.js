/**
 * api/analytics.js — Server-side analytics computation (Vercel Edge)
 * ------------------------------------------------------------------
 * FT-025: Move expensive calculations off the client to an Edge function.
 */

import { requireAuth } from './_auth-session.js';
import { supabaseAdmin } from './_supabase-admin.js';
import {
  filterTransactionsByPeriod,
  calculateTotals,
  calculateOpexBreakdown,
  calculateFuelMetrics,
  calculateForecast,
  calculateCycleAnalytics,
  calculateProjectBreakdown,
} from '../src/features/analytics/analytics.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // 1. Authenticate request
  const { user, error, response } = await requireAuth(req);
  if (error) return response;

  // 2. Parse query parameters
  const url = new URL(req.url);
  const monthParam = url.searchParams.get('month');
  const yearParam = url.searchParams.get('year');
  const _farmId = url.searchParams.get('farmId'); // Optional — reserved for multi-farm filtering

  if (!monthParam || !yearParam) {
    return json({ error: 'Missing month or year parameter' }, 400);
  }

  const selectedMonth = parseInt(monthParam, 10);
  const selectedYear = parseInt(yearParam, 10);

  try {
    // 3. Fetch necessary data (Transactions, Projects, Mappings, Forecast, Taxonomy)

    // 3a. Transactions (current month and same month last year)
    const start1 = new Date(selectedYear, selectedMonth, 1).toISOString();
    const end1 = new Date(selectedYear, selectedMonth + 1, 1).toISOString();
    const start2 = new Date(selectedYear - 1, selectedMonth, 1).toISOString();
    const end2 = new Date(selectedYear - 1, selectedMonth + 1, 1).toISOString();

    const [txRes, projectsRes, mappingsRes, forecastRes, opexSubCatRes] = await Promise.all([
      supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(
          `and(entry_date.gte.${start1},entry_date.lt.${end1}),and(entry_date.gte.${start2},entry_date.lt.${end2})`
        ),

      supabaseAdmin.from('projects').select('*').eq('user_id', user.id),

      supabaseAdmin
        .from('description_mappings')
        .select('description_key, sub_category_id')
        .eq('user_id', user.id),

      supabaseAdmin
        .from('forecast_adjustments')
        .select('year, month, category_id, delta')
        .eq('user_id', user.id)
        .eq('month', selectedMonth)
        .eq('year', selectedYear),

      supabaseAdmin
        .from('opex_sub_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
    ]);

    if (txRes.error) throw txRes.error;
    if (projectsRes.error) throw projectsRes.error;
    if (mappingsRes.error) throw mappingsRes.error;
    if (forecastRes.error) throw forecastRes.error;
    if (opexSubCatRes.error) throw opexSubCatRes.error;

    // Transform DB rows to App shapes
    const transactions = txRes.data.map(dbRowToTx);

    const projects =
      projectsRes.data.length > 0
        ? projectsRes.data.map((r) => ({ id: r.slug, name: r.slug, label: r.label, _uuid: r.id }))
        : DEFAULT_PROJECTS;

    const descriptionMappings = {};
    for (const r of mappingsRes.data) {
      descriptionMappings[r.description_key] = r.sub_category_id;
    }

    const forecastAdjustments = {};
    const key = `${selectedYear}-${selectedMonth}`;
    forecastAdjustments[key] = {};
    if (forecastRes.data) {
      for (const r of forecastRes.data) {
        forecastAdjustments[key][r.category_id] = r.delta;
      }
    }

    const opexSubCategories = opexSubCatRes.data.map(dbRowToOpexSubCat);

    // 4. Run Analytics Calculations
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

    const result = {
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

    return json(result, 200);
  } catch (err) {
    console.error('Analytics API Error:', err);
    return json({ error: 'Failed to compute analytics' }, 500);
  }
}

// ---------------------------------------------------------------------------
// DB → app shape helpers
// ---------------------------------------------------------------------------

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
  };
}

const DEFAULT_PROJECTS = [
  { id: 'onion', name: 'onion', label: 'Onion Field' },
  { id: 'watermelon', name: 'watermelon', label: 'Watermelon Field' },
  { id: 'greenhouse', name: 'greenhouse', label: 'Greenhouse' },
  { id: 'all_projects', name: 'all_projects', label: 'All Projects (Shared)' },
];

function dbRowToOpexSubCat(r) {
  return {
    id: r.id,
    slug: r.slug,
    label: r.label,
    icon: r.icon,
    color: r.color,
    isFuel: r.is_fuel,
    parentCategory: r.parent_category,
    displayOrder: r.display_order,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
