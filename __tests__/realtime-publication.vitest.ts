import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Sprint 22 WP-22.1: regression guard for the realtime publication
// migration. We can't easily integration-test against a live realtime
// channel inside vitest (no JWT, no socket), so we contract-test the
// migration SQL itself. If anyone deletes either invariant the test
// fails before the diff lands.
//
// Two invariants:
//   1. mcp_events is added to the supabase_realtime publication
//   2. mcp_events has REPLICA IDENTITY FULL (so RLS columns reach the
//      replication stream, without this Realtime can't filter rows
//      against jwt_org_id() and the channel either silently drops or
//      leaks across orgs)
const MIGRATION_PATH = join(
  process.cwd(),
  'supabase/migrations/20260425230000_realtime_publication.sql',
);

describe('realtime publication migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('adds public.mcp_events to supabase_realtime', () => {
    expect(sql).toMatch(
      /alter\s+publication\s+supabase_realtime\s+add\s+table\s+public\.mcp_events/i,
    );
  });

  it('sets REPLICA IDENTITY FULL on mcp_events for RLS-aware fanout', () => {
    expect(sql).toMatch(
      /alter\s+table\s+public\.mcp_events\s+replica\s+identity\s+full/i,
    );
  });

  it('guards the publication ADD against duplicate_object on re-run', () => {
    expect(sql).toMatch(/exception\s+when\s+duplicate_object/i);
  });
});
