-- Migration: add topic_key to the content-brief dedup tables.
-- Prerequisite for the daily-content-email v2 workflow (scripts/_update_daily_email_v2.py),
-- whose "Save topics" node now inserts a topic_key alongside title/kind.
-- PostgREST rejects inserts referencing a column that does not exist, so this MUST
-- run before the v2 workflow is deployed/executed.
--
-- Run via the Supabase MCP (apply_migration) or the SQL editor. Safe to re-run.

ALTER TABLE content_history  ADD COLUMN IF NOT EXISTS topic_key text;
ALTER TABLE published_posts  ADD COLUMN IF NOT EXISTS topic_key text;

-- Optional: backfill topic_key on the live blog posts so the email's dedup flagger
-- matches future briefs against published work by key (not just fuzzy title). The
-- slug already encodes the subject; copy it as a reasonable starting key.
UPDATE published_posts SET topic_key = slug WHERE topic_key IS NULL AND slug IS NOT NULL;
