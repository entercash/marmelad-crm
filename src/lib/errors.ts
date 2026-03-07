/**
 * Application error hierarchy.
 * Consistent error typing across the entire ingestion pipeline.
 */

// ─── Base ────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    // Preserve prototype chain in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Integration errors ──────────────────────────────────────────────────────

/** Base class for all errors from external data sources */
export class IntegrationError extends AppError {
  constructor(
    public readonly source: string,
    message: string,
    public readonly statusCode?: number,
    cause?: unknown,
  ) {
    super(message, cause);
  }
}

export class TaboolaError extends IntegrationError {
  constructor(message: string, statusCode?: number, cause?: unknown) {
    super("taboola", message, statusCode, cause);
  }
}

export class KeitaroError extends IntegrationError {
  constructor(message: string, statusCode?: number, cause?: unknown) {
    super("keitaro", message, statusCode, cause);
  }
}

// ─── Infrastructure errors ───────────────────────────────────────────────────

/** A required environment variable is missing or empty */
export class ConfigurationError extends AppError {}

/** A BullMQ job payload failed validation */
export class ValidationError extends AppError {}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Extract a printable message from any thrown value */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

/** Extract a stack trace from any thrown value */
export function toErrorStack(err: unknown): string | undefined {
  if (err instanceof Error) return err.stack;
  return undefined;
}
