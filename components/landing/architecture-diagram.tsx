// Hand-authored inline SVG for the architecture section. Three zones: Agent,
// Gateway (4 internal pills), Upstreams (SF/Slack/GitHub). `currentColor` +
// `var(--brand)` so dark/light stays correct. One animated pulse along the
// agent→gateway arrow = "this is live" signal without Lottie weight.

export const ArchitectureDiagram = () => (
  <svg
    viewBox="0 0 900 360"
    role="img"
    aria-label="Agent on the left, gateway in the middle with manifest, policy engine, route orchestrator, and audit logger, three MCPs on the right labelled Salesforce, Slack, and GitHub."
    className="w-full h-auto text-foreground"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" opacity="0.6" />
      </marker>
      <linearGradient id="pulse" x1="0%" x2="100%">
        <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
        <stop offset="50%" stopColor="var(--brand)" stopOpacity="1" />
        <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
      </linearGradient>
    </defs>

    <g fontFamily="var(--font-sans)" fontSize="13">
      {/* Agent (zone 1) */}
      <g transform="translate(30 140)">
        <rect
          width="140"
          height="80"
          rx="12"
          fill="currentColor"
          fillOpacity="0.04"
          stroke="currentColor"
          strokeOpacity="0.25"
        />
        <text x="70" y="32" textAnchor="middle" fill="currentColor" fontWeight="600">
          Agent
        </text>
        <g transform="translate(26 48)">
          <rect width="88" height="22" rx="11" fill="var(--brand)" fillOpacity="0.15" stroke="var(--brand)" strokeOpacity="0.5" />
          <text x="44" y="15" textAnchor="middle" fill="var(--brand)" fontSize="11" fontWeight="500">
            Opus 4.7
          </text>
        </g>
      </g>

      {/* Gateway (zone 2) */}
      <g transform="translate(260 60)">
        <rect
          width="340"
          height="240"
          rx="16"
          fill="currentColor"
          fillOpacity="0.03"
          stroke="var(--brand)"
          strokeOpacity="0.4"
          strokeDasharray="0"
        />
        <text x="170" y="26" textAnchor="middle" fill="currentColor" fontWeight="600" fontSize="12" letterSpacing="2" opacity="0.65">
          GATEWAY
        </text>

        {[
          { label: 'Manifest cache', y: 48 },
          { label: 'Policy engine', y: 98 },
          { label: 'Route orchestrator', y: 148 },
          { label: 'Audit logger', y: 198 },
        ].map((pill) => (
          <g key={pill.label} transform={`translate(30 ${pill.y})`}>
            <rect
              width="280"
              height="36"
              rx="10"
              fill="currentColor"
              fillOpacity="0.06"
              stroke="currentColor"
              strokeOpacity="0.2"
            />
            <circle cx="18" cy="18" r="4" fill="var(--brand)" />
            <text x="34" y="22" fill="currentColor" fontSize="13" fontWeight="500">
              {pill.label}
            </text>
          </g>
        ))}
      </g>

      {/* Upstreams (zone 3) */}
      {[
        { label: 'Salesforce', y: 60, accent: '#22c55e' },
        { label: 'Slack', y: 150, accent: '#a855f7' },
        { label: 'GitHub', y: 240, accent: '#f59e0b' },
      ].map((up) => (
        <g key={up.label} transform={`translate(700 ${up.y})`}>
          <rect
            width="160"
            height="60"
            rx="10"
            fill="currentColor"
            fillOpacity="0.04"
            stroke="currentColor"
            strokeOpacity="0.25"
          />
          <circle cx="24" cy="30" r="6" fill={up.accent} />
          <text x="44" y="35" fill="currentColor" fontWeight="500">
            {up.label}
          </text>
        </g>
      ))}

      {/* Flow arrows */}
      <g stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)">
        <line x1="170" y1="180" x2="260" y2="180" />
        <line x1="600" y1="96" x2="700" y2="90" />
        <line x1="600" y1="180" x2="700" y2="180" />
        <line x1="600" y1="264" x2="700" y2="270" />
      </g>

      {/* Animated pulse along agent→gateway */}
      <line x1="170" y1="180" x2="260" y2="180" stroke="url(#pulse)" strokeWidth="3" strokeLinecap="round">
        <animate attributeName="x1" values="170;260" dur="3s" repeatCount="indefinite" />
        <animate attributeName="x2" values="180;270" dur="3s" repeatCount="indefinite" />
      </line>

      {/* Labels on arrows */}
      <text x="215" y="172" textAnchor="middle" fill="currentColor" opacity="0.55" fontSize="11">
        MCP JSON-RPC
      </text>
      <text x="650" y="170" textAnchor="middle" fill="currentColor" opacity="0.55" fontSize="11">
        tools/call
      </text>
    </g>
  </svg>
);
