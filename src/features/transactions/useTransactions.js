/**
 * src/hooks/useTransactions.js
 * ----------------------------
 * FT-016: Shift server state management to TanStack Query.
 *
 * Owns:
 *   - transactions[]         loaded via useQuery from Supabase
 *   - projects[]             loaded via useQuery from Supabase
 *   - descriptionMappings{}  loaded via useQuery from Supabase
 *
 * Public API remains the same for backward compatibility:
 *   transactions         Transaction[]
 *   projects             Project[]
 *   descriptionMappings  Record<string, string>
 *   dbReady              boolean (now derived from query status)
 *   addTransaction       (tx) => Promise<{ ok, errors? }>
 *   deleteTransaction    (id) => Promise<void>
 *   updateTransaction    (id, patch) => Promise<{ ok, errors? }>
 *   addProject           (name) => Promise<{ ok, errors? }>
 *   setMapping           (description, subCategoryId) => Promise<void>
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../../shared/api/supabase';
import {
  validateTransaction,
  validateTransactionUpdate,
  validateProject,
} from '../../lib/validators';

// ---------------------------------------------------------------------------
// DB → app shape
// ---------------------------------------------------------------------------
/** Map a Supabase transactions row to the legacy app shape used by all consumers. */
export function dbRowToTx(r) {
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
    version: r.version || 1,
  };
}

export function usePaginatedTransactions(userId, filters) {
  return useInfiniteQuery({
    queryKey: [
      'transactionsPaginated',
      userId,
      filters?.month,
      filters?.year,
      filters?.searchQuery,
      filters?.type,
      filters?.category,
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const limit = 50;
      let q = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false })
        .range(pageParam, pageParam + limit - 1);

      if (filters?.month !== undefined && filters?.year !== undefined) {
        const start = new Date(filters.year, filters.month, 1).toISOString();
        const end = new Date(filters.year, filters.month + 1, 1).toISOString();
        q = q.gte('entry_date', start).lt('entry_date', end);
      } else if (filters?.year !== undefined) {
        const start = new Date(filters.year, 0, 1).toISOString();
        const end = new Date(filters.year + 1, 0, 1).toISOString();
        q = q.gte('entry_date', start).lt('entry_date', end);
      }

      if (filters?.searchQuery) {
        q = q.ilike('description', `%${filters.searchQuery}%`);
      }
      if (filters?.type && filters.type !== 'all') {
        q = q.eq('type', filters.type);
      }
      if (filters?.category && filters.category !== 'all') {
        q = q.eq('category', filters.category);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ? data.map(dbRowToTx) : [];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 50 ? allPages.length * 50 : undefined;
    },
    enabled: !!userId,
  });
}

const DEFAULT_PROJECTS = [
  { id: 'onion', name: 'onion', label: 'Onion Field' },
  { id: 'watermelon', name: 'watermelon', label: 'Watermelon Field' },
  { id: 'greenhouse', name: 'greenhouse', label: 'Greenhouse' },
  { id: 'all_projects', name: 'all_projects', label: 'All Projects (Shared)' },
];

/**
 * @param {string} userId
 */
export function useTransactions(
  userId,
  { selectedMonth: _selectedMonth, selectedYear: _selectedYear } = {}
) {
  const queryClient = useQueryClient();

  // ── Transactions Query ────────────────────────────────────────────────────
  // Removed FT-025: Transactions are now fetched via usePaginatedTransactions
  // and analytics are computed server-side, so we no longer load all txs into memory.

  // ── Projects Query ────────────────────────────────────────────────────────
  const projectsQuery = useQuery({
    queryKey: ['projects', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        return data.map((r) => ({
          id: r.slug,
          name: r.slug,
          label: r.label,
          _uuid: r.id,
        }));
      }

      return DEFAULT_PROJECTS;
    },
    enabled: !!userId,
  });

  // ── Description Mappings Query ────────────────────────────────────────────
  const mappingsQuery = useQuery({
    queryKey: ['descriptionMappings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('description_mappings')
        .select('description_key, sub_category_id')
        .eq('user_id', userId);

      if (error) throw error;
      const obj = {};
      if (data) {
        for (const r of data) obj[r.description_key] = r.sub_category_id;
      }
      return obj;
    },
    enabled: !!userId,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addTransactionMutation = useMutation({
    mutationFn: async (v) => {
      // Use client-side ID to make this insert idempotent on retries/double-clicks
      const txId =
        v.id ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now());

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          id: txId,
          user_id: userId,
          type: v.type,
          category: v.category,
          sub_category: v.subCategory,
          project_id: v.projectId,
          amount: v.amount,
          liters: v.liters,
          fuel_type: v.fuelType,
          is_fuel: v.isFuel,
          description: v.description,
          entry_date: v.date,
          last_modified_by: userId,
        })
        .select()
        .single();

      if (error) {
        // Handle duplicate ID if client-side UUID generation was used and it somehow collided or retried
        if (error.code === '23505') {
          console.warn('Transaction already exists (idempotent insert prevented duplicate).');
          return null; // or fetch existing
        }
        throw error;
      }
      return dbRowToTx(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('transactions')
        .update({
          deleted_at: new Date().toISOString(),
          last_modified_by: userId,
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, patch, currentVersion }) => {
      let query = supabase
        .from('transactions')
        .update({
          ...patch,
          last_modified_by: userId,
        })
        .eq('id', id)
        .eq('user_id', userId);

      // Apply Optimistic Concurrency Control if a version is provided
      if (currentVersion) {
        query = query.eq('version', currentVersion);
      }

      const { data, error } = await query.select().single();

      if (error) {
        if (error.code === 'PGRST116' && currentVersion) {
          throw new Error('CONFLICT: Record was modified by another device. Please refresh.');
        }
        throw error;
      }
      return dbRowToTx(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
    },
  });

  const addProjectMutation = useMutation({
    mutationFn: async ({ slug, label }) => {
      const projectId =
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
      const { data, error } = await supabase
        .from('projects')
        .insert({
          id: projectId,
          user_id: userId,
          slug,
          label,
          last_modified_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.slug,
        name: data.slug,
        label: data.label,
        _uuid: data.id,
        version: data.version,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', userId] });
    },
  });

  const setMappingMutation = useMutation({
    mutationFn: async ({ key, subCategoryId }) => {
      const { error } = await supabase
        .from('description_mappings')
        .upsert(
          { user_id: userId, description_key: key, sub_category_id: subCategoryId },
          { onConflict: 'user_id,description_key' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['descriptionMappings', userId] });
    },
  });

  // ── Public API Wrapper ────────────────────────────────────────────────────

  const addTransaction = useCallback(
    async (transaction) => {
      const validation = validateTransaction(transaction);
      if (!validation.ok) {
        console.error('addTransaction validation failed:', validation.errors);
        return { ok: false, errors: validation.errors };
      }
      try {
        await addTransactionMutation.mutateAsync(validation.value);
        return { ok: true };
      } catch (err) {
        console.error('addTransaction:', err);
        return { ok: false, errors: [err.message] };
      }
    },
    [addTransactionMutation]
  );

  const deleteTransaction = useCallback(
    async (id) => {
      try {
        await deleteTransactionMutation.mutateAsync(id);
      } catch (err) {
        console.error('deleteTransaction:', err);
      }
    },
    [deleteTransactionMutation]
  );

  const updateTransaction = useCallback(
    async (id, updatedFields) => {
      const validation = validateTransactionUpdate(updatedFields);
      if (!validation.ok) {
        console.error('updateTransaction validation failed:', validation.errors);
        return { ok: false, errors: validation.errors };
      }

      // Try to find the current version from the cache if not provided in updatedFields
      const currentTx = queryClient
        .getQueryData(['transactions', userId])
        ?.find((t) => t.id === id);
      const currentVersion = updatedFields.version || currentTx?.version;

      const v = validation.value;
      const patch = {};
      if (v.type !== undefined) patch.type = v.type;
      if (v.category !== undefined) patch.category = v.category;
      if (v.subCategory !== undefined) patch.sub_category = v.subCategory;
      if (v.amount !== undefined) patch.amount = v.amount;
      if (v.description !== undefined) patch.description = v.description;
      if (v.date !== undefined) patch.entry_date = v.date;
      if (v.projectId !== undefined) patch.project_id = v.projectId;
      if (v.liters !== undefined) patch.liters = v.liters;
      if (v.fuelType !== undefined) patch.fuel_type = v.fuelType;
      if (v.isFuel !== undefined) patch.is_fuel = v.isFuel;

      try {
        await updateTransactionMutation.mutateAsync({ id, patch, currentVersion });
        return { ok: true };
      } catch (err) {
        console.error('updateTransaction:', err);
        return { ok: false, errors: [err.message] };
      }
    },
    [updateTransactionMutation, userId, queryClient]
  );

  const addProject = useCallback(
    async (name) => {
      const validation = validateProject({ name });
      if (!validation.ok) {
        console.error('addProject validation failed:', validation.errors);
        return { ok: false, errors: validation.errors };
      }
      try {
        await addProjectMutation.mutateAsync(validation.value);
        return { ok: true };
      } catch (err) {
        console.error('addProject:', err);
        return { ok: false, errors: [err.message] };
      }
    },
    [addProjectMutation]
  );

  const setMapping = useCallback(
    async (description, subCategoryId) => {
      if (!description) return;
      const key = description.toLowerCase().trim();
      try {
        await setMappingMutation.mutateAsync({ key, subCategoryId });
      } catch (err) {
        console.error('setMapping:', err);
      }
    },
    [setMappingMutation]
  );

  return {
    transactions: [],
    projects: projectsQuery.data || [],
    descriptionMappings: mappingsQuery.data || {},
    dbReady: projectsQuery.isSuccess && mappingsQuery.isSuccess,
    dbError: projectsQuery.error || mappingsQuery.error,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    addProject,
    setMapping,
  };
}
