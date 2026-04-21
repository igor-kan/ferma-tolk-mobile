-- =============================================================================
-- Migration: 005_taxonomy_keywords
-- Project:   Ferma.Tolk
-- Ticket:    FT-019
-- Created:   2026-04-06
-- Depends on: 003_normalise_categories
-- =============================================================================
-- Adds keyword support to all taxonomy levels to enable fully data-driven
-- transaction categorization and AI assistant matching.
-- =============================================================================

-- 1. Add columns to transaction_categories
ALTER TABLE public.transaction_categories
    ADD COLUMN keywords_ru TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN keywords_en TEXT[] NOT NULL DEFAULT '{}';

-- 2. Add columns to transaction_sub_categories
ALTER TABLE public.transaction_sub_categories
    ADD COLUMN keywords_ru TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN keywords_en TEXT[] NOT NULL DEFAULT '{}';

-- 3. Seed keywords for top-level categories
UPDATE public.transaction_categories 
SET keywords_ru = ARRAY['доход', 'приход', 'выручк', 'прода', 'продал'],
    keywords_en = ARRAY['income', 'revenue', 'sale', 'sold']
WHERE slug = 'income';

UPDATE public.transaction_categories 
SET keywords_ru = ARRAY['расход', 'трат', 'ушло', 'купил', 'заплатил', 'оплатил'],
    keywords_en = ARRAY['expense', 'spending', 'bought', 'paid', 'purchased']
WHERE slug = 'expense';

-- 4. Seed keywords for second-level categories
UPDATE public.transaction_sub_categories
SET keywords_ru = ARRAY['опер', 'текущ', 'хоз'],
    keywords_en = ARRAY['opex', 'operating', 'running']
WHERE slug = 'opex';

UPDATE public.transaction_sub_categories
SET keywords_ru = ARRAY['кап', 'инвест', 'оборуд', 'техник', 'трактор', 'машин'],
    keywords_en = ARRAY['capex', 'capital', 'investment', 'equipment', 'machinery', 'tractor']
WHERE slug = 'capex';

UPDATE public.transaction_sub_categories
SET keywords_ru = ARRAY['выручк', 'реализац', 'продаж'],
    keywords_en = ARRAY['revenue', 'sales', 'realization']
WHERE slug = 'operationalRevenue';

-- 5. Backfill/Refine OPEX leaf categories (ensuring coverage for regional expansion)
UPDATE public.opex_sub_categories
SET keywords_ru = keywords_ru || ARRAY['бензин','дизель','солярк','пропан','топливо','гсм'],
    keywords_en = keywords_en || ARRAY['fuel','petrol','diesel','solarka','propan','lpg']
WHERE slug = 'fuel';

UPDATE public.opex_sub_categories
SET keywords_ru = keywords_ru || ARRAY['еда','продукты','хлеб','молоко','мясо','яйца'],
    keywords_en = keywords_en || ARRAY['food','bread','milk','meat','eggs']
WHERE slug = 'food';

UPDATE public.opex_sub_categories
SET keywords_ru = keywords_ru || ARRAY['инсектицид','фунгицид','гербицид','пестицид','яд','химия'],
    keywords_en = keywords_en || ARRAY['pesticide','herbicide','insecticide','fungicide','poison','chemicals']
WHERE slug = 'pesticides';
