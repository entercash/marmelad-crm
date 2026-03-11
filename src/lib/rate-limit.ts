/**
 * Simple in-memory rate limiter.
 *
 * Suitable for single-instance deployments (like this CRM).
 * Tracks request counts per key within a fixed time window.
 * Periodically cleans up expired entries to prevent memory leaks.
 */

type Entry = {
  count: number;
  windowStart: number;
};

export class RateLimiter {
  private store = new Map<string, Entry>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    /** Maximum requests allowed within the window. */
    private maxAttempts: number,
    /** Time window in milliseconds. */
    private windowMs: number,
  ) {
    // Clean up expired entries every 60 seconds
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    // Don't keep the process alive just for cleanup
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /**
   * Check if a request is allowed for the given key.
   * Each call increments the counter.
   */
  check(key: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // No previous entry or window expired → start a new window
    if (!entry || now - entry.windowStart > this.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }

    // Within window → increment count
    entry.count++;

    if (entry.count > this.maxAttempts) {
      const retryAfterMs = this.windowMs - (now - entry.windowStart);
      return { allowed: false, retryAfterMs };
    }

    return { allowed: true };
  }

  /** Reset the counter for a key (e.g. after a successful login). */
  reset(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    this.store.forEach((entry, key) => {
      if (now - entry.windowStart > this.windowMs) {
        this.store.delete(key);
      }
    });
  }
}

// ─── Singleton instances ─────────────────────────────────────────────────────
// Preserved across hot-reloads in development via globalThis.

const g = globalThis as unknown as {
  __loginIpLimiter?: RateLimiter;
  __loginEmailLimiter?: RateLimiter;
};

/** IP-based: max 10 login attempts per 15 minutes. */
export const loginIpLimiter =
  g.__loginIpLimiter ?? new RateLimiter(10, 15 * 60 * 1000);

/** Email-based: max 5 login attempts per 15 minutes (anti-brute-force). */
export const loginEmailLimiter =
  g.__loginEmailLimiter ?? new RateLimiter(5, 15 * 60 * 1000);

if (process.env.NODE_ENV !== "production") {
  g.__loginIpLimiter = loginIpLimiter;
  g.__loginEmailLimiter = loginEmailLimiter;
}
