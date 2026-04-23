// Shared upstream-error type for proxy modules (Salesforce, Slack, future
// per-integration proxies). Split out of `salesforce-auth.ts` so later proxies
// can depend on it without dragging SF-specific auth surface.

export class UpstreamError extends Error {
  readonly status: number;
  readonly reason: string;
  readonly detail?: string;
  constructor(status: number, reason: string, detail?: string) {
    super(reason);
    this.status = status;
    this.reason = reason;
    this.detail = detail;
  }
}
