import { ZapIcon, ShieldCheckIcon } from 'lucide-react';

export type ToolCallEvent = {
  type: 'tool_call';
  id: string;
  name: string;
  args_preview: string;
};

export type ToolResultEvent = {
  type: 'tool_result';
  id: string;
  summary: string;
  is_error?: boolean;
};

export type TextEvent = { type: 'text'; content: string };

export type ThinkingEvent = { type: 'thinking'; content: string };

export type PolicyEvent = { type: 'policy_event'; detail: string };

export type ErrorEvent = { type: 'error'; message: string };

export type DoneEvent = {
  type: 'done';
  stats: {
    tool_calls: number;
    ms: number;
    policy_events?: number;
    thinking_chars?: number;
  };
};

export type StreamEvent =
  | ToolCallEvent
  | ToolResultEvent
  | TextEvent
  | ThinkingEvent
  | PolicyEvent
  | ErrorEvent
  | DoneEvent;

export type PaneState = {
  running: boolean;
  toolCalls: ToolCallEvent[];
  toolResults: Map<string, ToolResultEvent>;
  policyEvents: PolicyEvent[];
  text: string;
  thinking: string;
  error: string | null;
  stats: DoneEvent['stats'] | null;
};

export const emptyPane = (): PaneState => ({
  running: false,
  toolCalls: [],
  toolResults: new Map(),
  policyEvents: [],
  text: '',
  thinking: '',
  error: null,
  stats: null,
});

export type Pane = {
  key: 'raw' | 'gateway';
  title: string;
  badge: string;
  badgeTone: 'muted' | 'governed';
  icon: typeof ZapIcon;
};

export const PANES: Pane[] = [
  {
    key: 'raw',
    title: 'Raw MCP',
    badge: 'Direct / no governance',
    badgeTone: 'muted',
    icon: ZapIcon,
  },
  {
    key: 'gateway',
    title: 'Semantic GPS',
    badge: 'Policy-enforced',
    badgeTone: 'governed',
    icon: ShieldCheckIcon,
  },
];

export const toStreamEvents = async (
  res: Response,
  onEvent: (event: StreamEvent) => void,
): Promise<void> => {
  if (!res.body) throw new Error('no response body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as StreamEvent;
        onEvent(parsed);
      } catch {
        // Skip malformed line -- keep the stream alive on downstream bugs.
      }
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail) as StreamEvent);
    } catch {
      // swallow
    }
  }
};

export const applyEvent = (prev: PaneState, event: StreamEvent): PaneState => {
  if (event.type === 'tool_call') {
    return { ...prev, toolCalls: [...prev.toolCalls, event] };
  }
  if (event.type === 'tool_result') {
    const next = new Map(prev.toolResults);
    next.set(event.id, event);
    return { ...prev, toolResults: next };
  }
  if (event.type === 'policy_event') {
    return { ...prev, policyEvents: [...prev.policyEvents, event] };
  }
  if (event.type === 'text') {
    return { ...prev, text: prev.text + event.content };
  }
  if (event.type === 'thinking') {
    // Non-streaming beta.messages.create returns thinking as one or more
    // complete blocks. Concatenate with a blank line between blocks for
    // readability in the collapsible reasoning panel.
    const sep = prev.thinking ? '\n\n' : '';
    return { ...prev, thinking: prev.thinking + sep + event.content };
  }
  if (event.type === 'error') {
    return { ...prev, error: event.message };
  }
  if (event.type === 'done') {
    return { ...prev, running: false, stats: event.stats };
  }
  return prev;
};
