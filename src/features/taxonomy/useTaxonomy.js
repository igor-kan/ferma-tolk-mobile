/**
 * src/hooks/useTaxonomy.js
 * ------------------------
 * FT-019: Fetch data-driven category taxonomy from Supabase.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../shared/api/supabase';

/**
 * @param {string} userId
 */
export function useTaxonomy(userId) {
  const taxonomyQuery = useQuery({
    queryKey: ['taxonomy', userId],
    queryFn: async () => {
      // 1. Fetch all levels in parallel
      const [
        { data: categories, error: err1 },
        { data: subCategories, error: err2 },
        { data: opexSub, error: err3 },
      ] = await Promise.all([
        supabase.from('transaction_categories').select('*').order('sort_order'),
        supabase.from('transaction_sub_categories').select('*').order('sort_order'),
        supabase.from('opex_sub_categories').select('*').order('sort_order'),
      ]);

      if (err1) throw err1;
      if (err2) throw err2;
      if (err3) throw err3;

      return {
        categories: categories || [],
        subCategories: subCategories || [],
        opexSubCategories: opexSub || [],
      };
    },
    enabled: !!userId,
  });

  return {
    taxonomy: taxonomyQuery.data || { categories: [], subCategories: [], opexSubCategories: [] },
    dbReady: taxonomyQuery.isSuccess,
    dbError: taxonomyQuery.error,
  };
}
