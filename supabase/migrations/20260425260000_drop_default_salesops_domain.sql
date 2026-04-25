-- Sprint 24: drop the hardcoded SalesOps domain seed from the signup trigger.
-- Original Sprint 4 trigger inserted a default `salesops` domain on every
-- new signup so the hero demo had a preconfigured scope. That's demo content
-- baked into platform behavior — real users signing up tomorrow shouldn't get
-- a 'Sales operations — Salesforce, Slack, GitHub' domain they never asked
-- for. New signups now get a clean org + membership only; domain CRUD ships
-- when the UI is built (currently greyed out as "Soon" on the Connect page).
--
-- Existing demo orgs keep their salesops rows — this migration only changes
-- the trigger going forward, no DELETE on existing data.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  handle text;
begin
  handle := coalesce(split_part(NEW.email, '@', 1), 'user');
  insert into public.organizations (name)
    values (handle || '''s Workspace')
    returning id into new_org_id;
  insert into public.memberships (organization_id, user_id, role)
    values (new_org_id, NEW.id, 'admin');
  return NEW;
end;
$$;
