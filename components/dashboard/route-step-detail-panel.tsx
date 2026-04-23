'use client';

import type { RouteStepDetail } from '@/lib/routes/fetch';

type Props = {
  step: RouteStepDetail | null;
};

export const RouteStepDetailPanel = ({ step }: Props) => {
  if (!step) {
    return (
      <aside className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-500">
        Select a step to inspect.
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs">
      <header>
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Step {step.step_order}</p>
        <h3 className="mt-0.5 text-sm font-medium text-zinc-100">
          {step.tool_display_name ?? step.tool_name}
        </h3>
        {step.tool_display_name && step.tool_display_name !== step.tool_name && (
          <p className="mt-0.5 text-zinc-500">tool: {step.tool_name}</p>
        )}
      </header>

      <DetailBlock
        label="Input mapping"
        hint="$inputs.* + $steps.<key>.(args|result).*"
        value={step.input_mapping}
      />

      {step.rollback_input_mapping ? (
        <DetailBlock
          label="Rollback input mapping"
          hint="applied when this step is compensated"
          value={step.rollback_input_mapping}
        />
      ) : null}

      <section>
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Compensation</p>
        {step.rollback_tool_name ? (
          <p className="mt-1 text-zinc-300">
            → <span className="font-mono">{step.rollback_tool_name}</span>
          </p>
        ) : (
          <p className="mt-1 text-zinc-500">none</p>
        )}
      </section>

      <section>
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Fallback</p>
        {step.fallback_route_name ? (
          <p className="mt-1 text-zinc-300">
            → route <span className="font-mono">{step.fallback_route_name}</span>
          </p>
        ) : (
          <p className="mt-1 text-zinc-500">none</p>
        )}
      </section>

      <section>
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">Output capture key</p>
        <p className="mt-1 text-zinc-300">
          {step.output_capture_key ? (
            <span className="font-mono">$steps.{step.output_capture_key}</span>
          ) : (
            <span className="text-zinc-500">not captured</span>
          )}
        </p>
      </section>
    </aside>
  );
};

const DetailBlock = ({
  label,
  hint,
  value,
}: {
  label: string;
  hint?: string;
  value: Record<string, unknown>;
}) => (
  <section>
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      {hint ? <p className="text-[10px] text-zinc-600">{hint}</p> : null}
    </div>
    <pre className="mt-1 overflow-x-auto rounded border border-zinc-800 bg-zinc-900 p-2 text-[11px] leading-relaxed text-zinc-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  </section>
);
