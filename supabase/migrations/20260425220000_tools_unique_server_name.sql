-- Add a named UNIQUE constraint on tools(server_id, name) to support
-- Supabase upsert with onConflict. The core schema already has an unnamed
-- UNIQUE(server_id, name), so this is idempotent — if a constraint already
-- exists with these columns (named or unnamed), we skip.

DO $$ BEGIN
  ALTER TABLE public.tools
    ADD CONSTRAINT tools_server_id_name_unique UNIQUE (server_id, name);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
