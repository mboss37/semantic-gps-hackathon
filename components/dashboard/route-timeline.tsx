'use client';

import { motion } from 'motion/react';
import { ArrowRightIcon, ChevronDownIcon, GitBranchIcon, Undo2Icon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { monogramFor, serverHex } from '@/lib/relationships/server-tint';
import type { RouteStepDetail } from '@/lib/routes/fetch';

// Sprint 28 redesign: Routes detail no longer renders a React Flow canvas
// (the static `fitView` + minimap was unreadable). Instead each step is a
// card row in a vertical pipeline, same shape Vercel/GitHub Actions use
// to show CI/CD step lists. Saga affordances (rollback, fallback) live
// inline as iconified chips so the eye can scan a 5-step procedure in one
// pass without zooming. Mapping detail is collapsible per step.

type Props = {
  steps: RouteStepDetail[];
};

export const RouteTimeline = ({ steps }: Props) => (
  <ol className="flex flex-col gap-3">
    {steps.map((step, idx) => (
      <RouteStepRow
        key={step.id}
        step={step}
        index={idx}
        isLast={idx === steps.length - 1}
      />
    ))}
  </ol>
);

const RouteStepRow = ({
  step,
  index,
  isLast,
}: {
  step: RouteStepDetail;
  index: number;
  isLast: boolean;
}) => {
  const tint = step.tool_server_id ? serverHex(step.tool_server_id) : null;
  const monogram = step.tool_server_name ? monogramFor(step.tool_server_name) : '??';

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="grid grid-cols-[auto_1fr] gap-4"
    >
      {/* Step rail: circle + vertical connector to the next row */}
      <div className="flex flex-col items-center pt-3">
        <div className="flex size-7 items-center justify-center rounded-full border bg-card font-mono text-[11px] font-medium tabular-nums">
          {step.step_order}
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
      </div>

      <Card className="overflow-hidden py-0">
        <div className="flex flex-col gap-3 px-5 py-4">
          {/* Top row: server chip + tool name + capture key */}
          <div className="flex flex-wrap items-center gap-3">
            {tint && step.tool_server_name ? (
              <span
                className="inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[10px]"
                style={{
                  backgroundColor: `${tint}1a`,
                  borderColor: `${tint}4d`,
                  color: tint,
                }}
                aria-label={step.tool_server_name}
              >
                <span className="text-[11px] font-semibold">{monogram}</span>
                <span className="text-muted-foreground">
                  {step.tool_server_name.toLowerCase()}
                </span>
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <code className="truncate font-mono text-sm font-medium text-foreground">
                {step.tool_name}
              </code>
              {step.tool_display_name && step.tool_display_name !== step.tool_name && (
                <span className="truncate text-xs text-muted-foreground">
                  {step.tool_display_name}
                </span>
              )}
            </div>
            {step.output_capture_key ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                <ArrowRightIcon className="size-3" />
                <span className="text-foreground">$steps.{step.output_capture_key}</span>
              </span>
            ) : null}
          </div>

          {/* Saga affordances row, only render when something to say */}
          {(step.rollback_tool_name || step.fallback_route_name) && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {step.rollback_tool_name ? (
                <SagaChip
                  Icon={Undo2Icon}
                  tone="rollback"
                  label="Rollback"
                  body={step.rollback_tool_name}
                  serverName={step.rollback_tool_server_name}
                />
              ) : null}
              {step.fallback_route_name ? (
                <SagaChip
                  Icon={GitBranchIcon}
                  tone="fallback"
                  label="Fallback"
                  body={`route ${step.fallback_route_name}`}
                />
              ) : null}
            </div>
          )}

          {/* Mapping detail (collapsed by default) */}
          <Disclosure
            label="Input mapping"
            count={Object.keys(step.input_mapping ?? {}).length}
          >
            <MappingTable mapping={step.input_mapping} />
          </Disclosure>

          {step.rollback_input_mapping && step.rollback_tool_name ? (
            <Disclosure
              label="Rollback mapping"
              count={Object.keys(step.rollback_input_mapping ?? {}).length}
              hint="applied when this step is compensated"
            >
              <MappingTable mapping={step.rollback_input_mapping} />
            </Disclosure>
          ) : null}
        </div>
      </Card>
    </motion.li>
  );
};

const SAGA_TONE: Record<'rollback' | 'fallback', { stroke: string }> = {
  rollback: { stroke: '#a3a3a3' },
  fallback: { stroke: '#60a5fa' },
};

const SagaChip = ({
  Icon,
  tone,
  label,
  body,
  serverName,
}: {
  Icon: typeof Undo2Icon;
  tone: 'rollback' | 'fallback';
  label: string;
  body: string;
  serverName?: string | null;
}) => {
  const { stroke } = SAGA_TONE[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono"
      style={{
        borderColor: `${stroke}4d`,
        backgroundColor: `${stroke}14`,
      }}
    >
      <Icon className="size-3" style={{ color: stroke }} />
      <span className="uppercase tracking-wider" style={{ color: stroke }}>
        {label}
      </span>
      <span className="text-foreground">→</span>
      <span className="text-foreground">{body}</span>
      {serverName ? (
        <span className="text-muted-foreground">· {serverName.toLowerCase()}</span>
      ) : null}
    </span>
  );
};

const Disclosure = ({
  label,
  count,
  hint,
  children,
}: {
  label: string;
  count: number;
  hint?: string;
  children: React.ReactNode;
}) => {
  if (count === 0) {
    return (
      <p className="text-[11px] text-muted-foreground/70">
        <span className="font-mono uppercase tracking-wider">{label}</span> · empty
      </p>
    );
  }
  return (
    <details className="group rounded-md border bg-muted/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px]">
        <span className="flex items-center gap-2">
          <span className="font-mono uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="rounded-sm border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {count} {count === 1 ? 'field' : 'fields'}
          </span>
          {hint ? <span className="text-muted-foreground/70">· {hint}</span> : null}
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-3 py-2">{children}</div>
    </details>
  );
};

const MappingTable = ({ mapping }: { mapping: Record<string, unknown> }) => {
  const entries = Object.entries(mapping ?? {});
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No fields.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5 font-mono text-[11px]">
      {entries.map(([key, value]) => (
        <li key={key} className="grid grid-cols-[minmax(0,140px)_auto_1fr] items-baseline gap-2">
          <span className="truncate text-foreground">{key}</span>
          <ArrowRightIcon className="size-3 text-muted-foreground" />
          <span className="truncate text-muted-foreground">
            {typeof value === 'string' ? value : JSON.stringify(value)}
          </span>
        </li>
      ))}
    </ul>
  );
};

