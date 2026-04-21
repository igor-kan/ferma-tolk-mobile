-- =============================================================================
-- Migration: 007_background_jobs
-- Project:   Ferma.Tolk
-- Ticket:    FT-027
-- Created:   2026-04-06
-- Depends on: 001_initial_schema
-- =============================================================================
-- Introduces a jobs table for asynchronous background processing.
-- =============================================================================

CREATE TYPE public.job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE public.jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,           -- e.g. 'speech_to_text', 'analytics_refresh'
    status          public.job_status NOT NULL DEFAULT 'pending',
    payload         JSONB NOT NULL DEFAULT '{}',
    result          JSONB,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.jobs IS
    'Tracks background tasks and asynchronous operations.';

CREATE INDEX idx_jobs_user_status ON public.jobs (user_id, status);

CREATE TRIGGER jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs: users can manage own jobs"
    ON public.jobs FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Grants
GRANT ALL ON public.jobs TO authenticated;
GRANT USAGE ON TYPE public.job_status TO authenticated;
