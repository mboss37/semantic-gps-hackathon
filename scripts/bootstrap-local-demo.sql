-- Sprint 10 follow-up: idempotent local demo bootstrap.
--
-- Seeds the full demo stack (3 MCPs + 12 tools + 10 relationships +
-- 2 routes + 3 policies + assignments) into local Supabase so every
-- Playground story can be validated E2E against real upstreams without
-- reaching for hosted.
--
-- Apply:
--   docker cp scripts/bootstrap-local-demo.sql \
--     supabase_db_semantic-gps-hackathon:/tmp/bootstrap.sql
--   docker exec supabase_db_semantic-gps-hackathon \
--     psql -U postgres -d postgres -f /tmp/bootstrap.sql
--
-- Preconditions:
--   - `pnpm supabase start` (local stack up)
--   - `seed.sql` has run (demo user + org + gateway token present)
--   - `.env.local` has `SF_LOGIN_URL` / `SF_CLIENT_ID` / `SF_CLIENT_SECRET` /
--     `SLACK_BOT_TOKEN` / `GITHUB_PAT` — the vendor MCP routes at
--     `app/api/mcps/<vendor>/route.ts` read credentials from env at request
--     time. Sprint 15 WP-C.6 removed the encrypted `auth_config` path; the
--     gateway registration now stores `auth_config=null` and the vendor
--     route holds the creds for the whole deployment.
--   - `.env.local` has `SSRF_ALLOW_LOCALHOST=1` for dev. The gateway's
--     `proxyHttp` roundtrips `origin_url` through `safeFetch`; localhost
--     hosts are blocked by default. This flag is a dev-only escape hatch;
--     on Vercel the seed gets rewritten with the live HTTPS domain and the
--     flag stays unset. See `lib/security/ssrf-guard.ts`.
--
-- Hosted deploy: before applying this seed to hosted Supabase, sed-replace
--   every `http://localhost:3000/` with the Vercel domain
--   (e.g. `https://semantic-gps-hackathon.vercel.app/`). SSRF guard accepts
--   public HTTPS; no flag flip needed in prod.

BEGIN;

-- ---------------------------------------------------------------------------
-- Cleanup (safe order — reverse of FK dependency)
-- ---------------------------------------------------------------------------

DELETE FROM public.policies
 WHERE name IN (
   'business_hours_window',
   'write_freeze_killswitch',
   'redact_contact_pii',
   'injection_guard_default',
   'allowlist_task_subjects'
 );
-- cascades to policy_assignments + policy_versions

DELETE FROM public.routes
 WHERE name IN ('sales_escalation', 'cross_domain_escalation');
-- cascades to route_steps

DELETE FROM public.servers
 WHERE name IN ('Demo Salesforce', 'Demo Slack', 'Demo GitHub');
-- cascades to tools → relationships, policy_assignments

-- ---------------------------------------------------------------------------
-- Servers — pointed at the co-deployed vendor MCP routes. `auth_config` is
-- NULL because the vendor routes read credentials from env vars on the same
-- Next.js deployment (Sprint 15 WP-C.6). For a future standalone extraction,
-- re-introduce encrypted `auth_config` via the standard bearer path.
-- ---------------------------------------------------------------------------

INSERT INTO public.servers (organization_id, name, transport, origin_url, auth_config)
SELECT m.organization_id,
       'Demo Salesforce',
       'http-streamable',
       'http://localhost:3000/api/mcps/salesforce',
       NULL
  FROM public.memberships m
  JOIN auth.users u ON u.id = m.user_id
 WHERE u.email = 'demo@semantic-gps.dev'
 LIMIT 1;

INSERT INTO public.servers (organization_id, name, transport, origin_url, auth_config)
SELECT m.organization_id,
       'Demo Slack',
       'http-streamable',
       'http://localhost:3000/api/mcps/slack',
       NULL
  FROM public.memberships m
  JOIN auth.users u ON u.id = m.user_id
 WHERE u.email = 'demo@semantic-gps.dev'
 LIMIT 1;

INSERT INTO public.servers (organization_id, name, transport, origin_url, auth_config)
SELECT m.organization_id,
       'Demo GitHub',
       'http-streamable',
       'http://localhost:3000/api/mcps/github',
       NULL
  FROM public.memberships m
  JOIN auth.users u ON u.id = m.user_id
 WHERE u.email = 'demo@semantic-gps.dev'
 LIMIT 1;

-- ---------------------------------------------------------------------------
-- Tools (12 total: 5 SF + 3 Slack + 4 GitHub)
-- ---------------------------------------------------------------------------

-- Salesforce
INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'find_account',
       'Find up to 5 Salesforce Accounts by partial Name match',
       '{"type":"object","required":["query"],"properties":{"query":{"type":"string","minLength":1}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo Salesforce';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'find_contact',
       'Find a Salesforce Contact by exact Email match',
       '{"type":"object","required":["email"],"properties":{"email":{"type":"string","format":"email"}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo Salesforce';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'get_opportunity',
       'Fetch a Salesforce Opportunity by 15-18 char Id',
       '{"type":"object","required":["id"],"properties":{"id":{"type":"string","pattern":"^[a-zA-Z0-9]{15,18}$"}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo Salesforce';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'update_opportunity_stage',
       'Set the StageName of a Salesforce Opportunity',
       '{"type":"object","required":["id","stage"],"properties":{"id":{"type":"string"},"stage":{"type":"string"}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo Salesforce';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'create_task',
       'Create a Salesforce Task linked to a WhatId (Account/Opportunity)',
       '{"type":"object","required":["subject","whatId"],"properties":{"whatId":{"type":"string"},"subject":{"type":"string"}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo Salesforce';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'delete_task',
       'Delete a Salesforce Task by Id. Compensator for create_task on saga rollback.',
       '{"type":"object","required":["id"],"properties":{"id":{"type":"string","pattern":"^[a-zA-Z0-9]{15,18}$"}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo Salesforce';

-- Slack
INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'users_lookup_by_email',
       'Find a Slack user by email address',
       '{"type":"object","required":["email"],"properties":{"email":{"type":"string","format":"email"}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo Slack';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'chat_post_message',
       'Post a message to a Slack channel or DM',
       '{"type":"object","required":["channel","text"],"properties":{"text":{"type":"string","minLength":1},"channel":{"type":"string","minLength":1}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo Slack';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'conversations_list',
       'List Slack channels the bot has access to',
       '{"type":"object","required":[],"properties":{"limit":{"type":"integer","maximum":1000,"minimum":1},"types":{"type":"string"}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo Slack';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'delete_message',
       'Delete a previously-posted Slack message. Compensator for chat_post_message on saga rollback.',
       '{"type":"object","required":["channel","ts"],"properties":{"channel":{"type":"string","minLength":1},"ts":{"type":"string","minLength":1}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo Slack';

-- GitHub
INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'search_issues',
       'Search GitHub issues and PRs by query string',
       '{"type":"object","required":["query"],"properties":{"limit":{"type":"integer","maximum":100,"minimum":1},"query":{"type":"string","maxLength":500,"minLength":1}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo GitHub';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'create_issue',
       'Create a new GitHub issue on a repo',
       '{"type":"object","required":["owner","repo","title"],"properties":{"body":{"type":"string","maxLength":65536},"repo":{"type":"string"},"owner":{"type":"string"},"title":{"type":"string","maxLength":256,"minLength":1},"labels":{"type":"array","items":{"type":"string"}}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo GitHub';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'add_comment',
       'Add a comment to an existing GitHub issue',
       '{"type":"object","required":["owner","repo","issue_number","body"],"properties":{"body":{"type":"string","maxLength":65536,"minLength":1},"repo":{"type":"string"},"owner":{"type":"string"},"issue_number":{"type":"integer","minimum":1}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo GitHub';

INSERT INTO public.tools (server_id, name, description, input_schema)
SELECT s.id,
       'close_issue',
       'Close an existing GitHub issue',
       '{"type":"object","required":["owner","repo","issue_number"],"properties":{"repo":{"type":"string"},"owner":{"type":"string"},"issue_number":{"type":"integer","minimum":1}}}'::jsonb
  FROM public.servers s WHERE s.name = 'Demo GitHub';

-- ---------------------------------------------------------------------------
-- Relationships (10 total — TRel graph edges)
-- ---------------------------------------------------------------------------

-- Salesforce: find_account → find_contact (produces_input_for)
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'produces_input_for', 'find_account surfaces Account.Id that find_contact can correlate via AccountId.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'find_contact'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'find_account' AND fs.name = 'Demo Salesforce'
   AND ts.name = 'Demo Salesforce';

-- Salesforce: find_contact → create_task (produces_input_for)
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'produces_input_for', 'find_contact Contact.Id can be used as create_task WhatId.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'create_task'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'find_contact' AND fs.name = 'Demo Salesforce'
   AND ts.name = 'Demo Salesforce';

-- Salesforce: create_task → update_opportunity_stage (requires_before)
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'requires_before', 'Log the outreach task before advancing the opportunity stage.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'update_opportunity_stage'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'create_task' AND fs.name = 'Demo Salesforce'
   AND ts.name = 'Demo Salesforce';

-- SF → Slack: find_contact → users_lookup_by_email (produces_input_for)
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'produces_input_for', 'Contact.Email found in Salesforce can be used to look up the owner rep on Slack.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'users_lookup_by_email'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'find_contact' AND fs.name = 'Demo Salesforce'
   AND ts.name = 'Demo Slack';

-- Slack: users_lookup_by_email → chat_post_message (produces_input_for)
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'produces_input_for', 'Resolved Slack user id can be the DM channel target (or used to @-mention in a channel post).'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'chat_post_message'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'users_lookup_by_email' AND fs.name = 'Demo Slack'
   AND ts.name = 'Demo Slack';

-- Slack: conversations_list → chat_post_message (suggests_after)
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'suggests_after', 'After inspecting available channels, post the escalation message to the right one.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'chat_post_message'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'conversations_list' AND fs.name = 'Demo Slack'
   AND ts.name = 'Demo Slack';

-- GitHub: search_issues → create_issue (alternative_to)
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'alternative_to', 'Search first to avoid filing a duplicate before creating a new issue.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'create_issue'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'search_issues' AND fs.name = 'Demo GitHub'
   AND ts.name = 'Demo GitHub';

-- GitHub: create_issue → close_issue (compensated_by) — rollback edge
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'compensated_by', 'Rollback: close the GitHub issue that was just created.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'close_issue'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'create_issue' AND fs.name = 'Demo GitHub'
   AND ts.name = 'Demo GitHub';

-- Slack: chat_post_message → delete_message (compensated_by) — rollback edge
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'compensated_by', 'Saga compensator: deletes the posted Slack message on rollback.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'delete_message'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'chat_post_message' AND fs.name = 'Demo Slack'
   AND ts.name = 'Demo Slack';

-- Salesforce: create_task → delete_task (compensated_by) — rollback edge
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'compensated_by', 'Saga compensator: deletes the SF Task on rollback.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'delete_task'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'create_task' AND fs.name = 'Demo Salesforce'
   AND ts.name = 'Demo Salesforce';

-- GH → Slack: create_issue → chat_post_message (suggests_after)
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'suggests_after', 'After filing an engineering ticket, post the issue URL into the #cs-escalations channel.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'chat_post_message'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'create_issue' AND fs.name = 'Demo GitHub'
   AND ts.name = 'Demo Slack';

-- GH → SF: create_issue → create_task (produces_input_for)
INSERT INTO public.relationships (from_tool_id, to_tool_id, relationship_type, description)
SELECT ft.id, tt.id, 'produces_input_for', 'GitHub issue number + html_url feed into the Salesforce follow-up task body.'
  FROM public.tools ft JOIN public.servers fs ON fs.id = ft.server_id
       JOIN public.tools tt ON tt.name = 'create_task'
       JOIN public.servers ts ON ts.id = tt.server_id
 WHERE ft.name = 'create_issue' AND fs.name = 'Demo GitHub'
   AND ts.name = 'Demo Salesforce';

-- ---------------------------------------------------------------------------
-- Routes
-- ---------------------------------------------------------------------------

INSERT INTO public.routes (organization_id, name, description)
SELECT m.organization_id,
       'sales_escalation',
       'Find an account, look up the primary contact, and log a follow-up task.'
  FROM public.memberships m JOIN auth.users u ON u.id = m.user_id
 WHERE u.email = 'demo@semantic-gps.dev' LIMIT 1;

INSERT INTO public.routes (organization_id, name, description)
SELECT m.organization_id,
       'cross_domain_escalation',
       'High-value customer bug: find account, file engineering ticket, notify CS channel, log on the opportunity.'
  FROM public.memberships m JOIN auth.users u ON u.id = m.user_id
 WHERE u.email = 'demo@semantic-gps.dev' LIMIT 1;

-- ---------------------------------------------------------------------------
-- Route steps
-- sales_escalation: find_account → find_contact → create_task
-- ---------------------------------------------------------------------------

INSERT INTO public.route_steps (route_id, step_order, tool_id, input_mapping, output_capture_key)
SELECT r.id, 1, t.id, '{"query":"$inputs.account_name"}'::jsonb, 'account'
  FROM public.routes r, public.tools t JOIN public.servers s ON s.id = t.server_id
 WHERE r.name = 'sales_escalation' AND t.name = 'find_account' AND s.name = 'Demo Salesforce';

INSERT INTO public.route_steps (route_id, step_order, tool_id, input_mapping, output_capture_key)
SELECT r.id, 2, t.id, '{"email":"$inputs.contact_email"}'::jsonb, 'contact'
  FROM public.routes r, public.tools t JOIN public.servers s ON s.id = t.server_id
 WHERE r.name = 'sales_escalation' AND t.name = 'find_contact' AND s.name = 'Demo Salesforce';

INSERT INTO public.route_steps (route_id, step_order, tool_id, input_mapping, output_capture_key)
SELECT r.id, 3, t.id, '{"whatId":"$steps.account.records.0.Id","subject":"$inputs.task_subject"}'::jsonb, 'task'
  FROM public.routes r, public.tools t JOIN public.servers s ON s.id = t.server_id
 WHERE r.name = 'sales_escalation' AND t.name = 'create_task' AND s.name = 'Demo Salesforce';

-- cross_domain_escalation: find_account → find_contact → create_issue → chat_post_message → create_task
INSERT INTO public.route_steps (route_id, step_order, tool_id, input_mapping, output_capture_key)
SELECT r.id, 1, t.id, '{"query":"$inputs.account_name"}'::jsonb, 'account'
  FROM public.routes r, public.tools t JOIN public.servers s ON s.id = t.server_id
 WHERE r.name = 'cross_domain_escalation' AND t.name = 'find_account' AND s.name = 'Demo Salesforce';

INSERT INTO public.route_steps (route_id, step_order, tool_id, input_mapping, output_capture_key)
SELECT r.id, 2, t.id, '{"email":"$inputs.contact_email"}'::jsonb, 'contact'
  FROM public.routes r, public.tools t JOIN public.servers s ON s.id = t.server_id
 WHERE r.name = 'cross_domain_escalation' AND t.name = 'find_contact' AND s.name = 'Demo Salesforce';

-- Step 3 creates a GitHub issue. rollback_input_mapping explicitly derives
-- close_issue's {owner, repo, issue_number} from the original args + result
-- so saga rollback actually undoes the issue on halt. Without this mapping
-- the gateway would pass create_issue's raw result verbatim to close_issue
-- and Zod would reject it with invalid_input.
INSERT INTO public.route_steps (route_id, step_order, tool_id, input_mapping, output_capture_key, rollback_input_mapping)
SELECT r.id, 3, t.id,
       '{"body":"$inputs.issue_body","repo":"semantic-gps-sandbox","owner":"mboss37","title":"$inputs.issue_title"}'::jsonb,
       'issue',
       jsonb_build_object('owner', 'mboss37', 'repo', 'semantic-gps-sandbox', 'issue_number', '$steps.issue.result.number')
  FROM public.routes r, public.tools t JOIN public.servers s ON s.id = t.server_id
 WHERE r.name = 'cross_domain_escalation' AND t.name = 'create_issue' AND s.name = 'Demo GitHub';

-- Step 4 posts to Slack. rollback_input_mapping derives delete_message's
-- {channel, ts} from the captured result so a saga halt (step 5 failing)
-- unwinds the Slack message instead of leaving it orphaned on the channel.
INSERT INTO public.route_steps (route_id, step_order, tool_id, input_mapping, output_capture_key, rollback_input_mapping)
SELECT r.id, 4, t.id,
       '{"text":"$inputs.slack_message","channel":"#general"}'::jsonb,
       'notification',
       jsonb_build_object('channel', '$steps.notification.result.channel', 'ts', '$steps.notification.result.ts')
  FROM public.routes r, public.tools t JOIN public.servers s ON s.id = t.server_id
 WHERE r.name = 'cross_domain_escalation' AND t.name = 'chat_post_message' AND s.name = 'Demo Slack';

-- Step 5 creates an SF Task. rollback_input_mapping pulls the Task Id out of
-- the create_task result so delete_task compensates correctly on later halts
-- (not strictly needed today since step 5 is terminal, but required for
-- correctness if we extend the saga with more downstream steps).
INSERT INTO public.route_steps (route_id, step_order, tool_id, input_mapping, output_capture_key, rollback_input_mapping)
SELECT r.id, 5, t.id,
       '{"whatId":"$steps.account.records.0.Id","subject":"$inputs.task_subject"}'::jsonb,
       'task',
       jsonb_build_object('id', '$steps.task.result.id')
  FROM public.routes r, public.tools t JOIN public.servers s ON s.id = t.server_id
 WHERE r.name = 'cross_domain_escalation' AND t.name = 'create_task' AND s.name = 'Demo Salesforce';

-- ---------------------------------------------------------------------------
-- Policies (Sprint 9 J.5 canonical set)
-- ---------------------------------------------------------------------------

INSERT INTO public.policies (name, builtin_key, config, enforcement_mode) VALUES
  (
    'business_hours_window',
    'business_hours',
    jsonb_build_object(
      'timezone', 'Europe/Vienna',
      'days', jsonb_build_array('mon','tue','wed','thu','fri'),
      'start_hour', 9,
      'end_hour', 17
    ),
    'enforce'
  ),
  (
    'write_freeze_killswitch',
    'write_freeze',
    jsonb_build_object('enabled', false),
    'enforce'
  ),
  (
    'redact_contact_pii',
    'pii_redaction',
    '{}'::jsonb,
    'shadow'
  ),
  (
    -- Story #7 demo policy. Empty config uses DEFAULT_INJECTION_PATTERNS
    -- (ignore_prior / role_override / im_start / sql_drop / sql_comment_inject).
    'injection_guard_default',
    'injection_guard',
    '{}'::jsonb,
    'enforce'
  );

-- Global assignments
INSERT INTO public.policy_assignments (policy_id, server_id, tool_id)
SELECT id, NULL::uuid, NULL::uuid FROM public.policies WHERE name = 'business_hours_window'
UNION ALL
SELECT id, NULL::uuid, NULL::uuid FROM public.policies WHERE name = 'write_freeze_killswitch'
UNION ALL
SELECT id, NULL::uuid, NULL::uuid FROM public.policies WHERE name = 'injection_guard_default';

-- PII tool-scoped on find_account + find_contact
INSERT INTO public.policy_assignments (policy_id, server_id, tool_id)
SELECT p.id, NULL::uuid, t.id
  FROM public.policies p, public.tools t JOIN public.servers s ON s.id = t.server_id
 WHERE p.name = 'redact_contact_pii'
   AND s.name = 'Demo Salesforce'
   AND t.name IN ('find_account', 'find_contact');

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

SELECT 'servers' AS entity, count(*) AS n FROM public.servers
UNION ALL SELECT 'tools', count(*) FROM public.tools
UNION ALL SELECT 'relationships', count(*) FROM public.relationships
UNION ALL SELECT 'routes', count(*) FROM public.routes
UNION ALL SELECT 'route_steps', count(*) FROM public.route_steps
UNION ALL SELECT 'policies', count(*) FROM public.policies
UNION ALL SELECT 'policy_assignments', count(*) FROM public.policy_assignments;
