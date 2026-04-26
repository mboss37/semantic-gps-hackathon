'use client';

import { CopyButton } from '@/components/dashboard/copy-button';
import type { RouteDetail } from '@/lib/routes/fetch';

// Sprint 28 WP-28.4 (refactored post design review): "Copy as JSON" button on
// route detail. Builds the import-shape payload from a RouteDetail (the same
// shape RouteImportSchema accepts), delegates clipboard + state + toast to
// the project's canonical CopyButton primitive. Closes the loop:
// import + export = full clone-and-edit workflow.
//
// domain_id intentionally omitted from export, domain UUIDs are
// org-internal and not portable. If the user wants to keep the route in
// the same domain on re-import, they edit the JSON and add it back.

type Props = { route: RouteDetail };

const buildExportJson = (route: RouteDetail): string => {
  const exported = {
    name: route.name,
    description: route.description,
    steps: route.steps.map((s) => {
      // Build each step with only the keys that are populated, so the
      // exported JSON is clean (no `null` clutter for steps without
      // rollback or fallback mappings).
      const out: Record<string, unknown> = {
        step_order: s.step_order,
        server_name: s.tool_server_name,
        tool_name: s.tool_name,
        input_mapping: s.input_mapping,
      };
      if (s.output_capture_key) out.output_capture_key = s.output_capture_key;
      if (s.rollback_tool_name && s.rollback_tool_server_name) {
        out.rollback_server_name = s.rollback_tool_server_name;
        out.rollback_tool_name = s.rollback_tool_name;
      }
      if (s.rollback_input_mapping) out.rollback_input_mapping = s.rollback_input_mapping;
      if (s.fallback_input_mapping) out.fallback_input_mapping = s.fallback_input_mapping;
      if (s.fallback_rollback_input_mapping) {
        out.fallback_rollback_input_mapping = s.fallback_rollback_input_mapping;
      }
      return out;
    }),
  };
  return JSON.stringify(exported, null, 2);
};

export const RouteExportButton = ({ route }: Props) => (
  <CopyButton value={buildExportJson(route)} label="Copy as JSON" variant="outline" />
);
