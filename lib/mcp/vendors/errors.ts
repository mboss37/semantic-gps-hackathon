// Shared error class for the vendor MCPs. Lives in its own module so every
// vendor adapter + the JSON-RPC surface check `instanceof VendorError`
// against the SAME constructor. Defining it per-vendor produces separate
// classes (same name, different module identity) → `instanceof` fails for
// cross-module throws and errors silently collapse to `internal_error`.

export class VendorError extends Error {
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
