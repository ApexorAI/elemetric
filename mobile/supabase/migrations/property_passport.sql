-- Property Compliance Passport — address search optimisation
-- Adds a trigram index on job_addr so ILIKE address searches are fast.
-- Requires the pg_trgm extension (enabled by default on Supabase).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS jobs_job_addr_trgm_idx
  ON jobs USING gin (job_addr gin_trgm_ops);
