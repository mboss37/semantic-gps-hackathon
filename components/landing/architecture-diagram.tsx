const NODES = [
  { x: 76, y: 122, label: 'Claude', tone: 'muted' },
  { x: 84, y: 222, label: 'Cursor', tone: 'muted' },
  { x: 300, y: 170, label: 'MCP TRel', tone: 'hot' },
  { x: 524, y: 94, label: 'Salesforce', tone: 'muted' },
  { x: 546, y: 176, label: 'Slack', tone: 'muted' },
  { x: 524, y: 258, label: 'GitHub', tone: 'muted' },
] as const;

const EDGES = [
  'M126 122 C178 116 226 126 252 154',
  'M132 222 C184 226 226 208 252 184',
  'M348 158 C408 112 454 98 474 94',
  'M354 170 C414 172 460 174 496 176',
  'M348 186 C408 238 454 254 474 258',
] as const;

export const ArchitectureDiagram = () => (
  <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
    <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/24 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_44%,rgba(255,255,255,0.1),transparent_36%)]" />
      <svg viewBox="0 0 620 350" className="relative z-10 h-full min-h-[390px] w-full">
        <defs>
          <linearGradient id="architecture-edge" x1="0" x2="1">
            <stop stopColor="rgb(56 189 248)" stopOpacity="0.05" />
            <stop offset="0.52" stopColor="rgb(96 165 250)" stopOpacity="0.9" />
            <stop offset="1" stopColor="rgb(168 85 247)" stopOpacity="0.18" />
          </linearGradient>
          <filter id="architecture-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {EDGES.map((edge) => (
          <path
            key={edge}
            d={edge}
            fill="none"
            stroke="url(#architecture-edge)"
            strokeWidth="1.6"
          />
        ))}

        {NODES.map((node) => (
          <g key={node.label} filter={node.tone === 'hot' ? 'url(#architecture-glow)' : undefined}>
            <rect
              x={node.x - (node.tone === 'hot' ? 70 : 50)}
              y={node.y - 24}
              width={node.tone === 'hot' ? 140 : 100}
              height="48"
              rx="16"
              fill={node.tone === 'hot' ? 'rgb(255 255 255 / 0.12)' : 'rgb(255 255 255 / 0.07)'}
              stroke={node.tone === 'hot' ? 'rgb(255 255 255 / 0.42)' : 'rgb(255 255 255 / 0.17)'}
            />
            <text
              x={node.x}
              y={node.y + 4}
              textAnchor="middle"
              className="fill-white text-[12px] font-medium"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>

    <div className="grid gap-4">
      {[
        [
          'Extend MCP',
          'MCP tells agents what tools exist. Tool Relationship (TRel) tells them how tools work together.',
        ],
        [
          'Discover',
          'Agents self-discover valid execution flows instead of guessing which tool comes next.',
        ],
        [
          'Recover',
          'Fallback and rollback relationships make failure paths explicit before production traffic runs.',
        ],
      ].map(([title, description], index) => (
        <div
          key={title}
          className="rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.22em] text-white/42 uppercase">
              0{index + 1}
            </span>
            <span className="ml-4 h-px flex-1 bg-linear-to-r from-white/30 to-transparent" />
          </div>
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/52">{description}</p>
        </div>
      ))}
    </div>
  </div>
);
