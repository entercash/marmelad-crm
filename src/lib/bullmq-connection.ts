/**
 * BullMQ Connection Options
 *
 * BullMQ manages its own internal Redis connections and expects a
 * `ConnectionOptions` object (host, port, password) — NOT a shared ioredis
 * instance. Passing an ioredis `Redis` instance directly to BullMQ causes
 * TypeScript type mismatches and can produce subtle runtime issues because
 * BullMQ needs to control the connection lifecycle independently.
 *
 * This module parses REDIS_URL into the shape BullMQ expects.
 * The shared ioredis singleton (lib/redis.ts) remains separate and is used
 * only for direct Redis commands outside of BullMQ.
 */

import type { ConnectionOptions } from "bullmq";

/**
 * Return BullMQ-compatible connection options parsed from REDIS_URL.
 *
 * Called once per Queue / Worker instantiation — the result is a plain options
 * object, not a live connection, so calling it multiple times is cheap.
 *
 * Supported REDIS_URL formats:
 *   redis://localhost:6379
 *   redis://:password@localhost:6379
 *   redis://username:password@host:6379
 *   rediss://... (TLS — ioredis handles the scheme automatically)
 */
export function getBullMQConnection(): ConnectionOptions {
  const raw = process.env.REDIS_URL ?? "redis://localhost:6379";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Malformed URL — fall back to localhost defaults and let BullMQ surface
    // the error on first connection attempt rather than crashing at import time.
    console.warn(
      `[BullMQ] REDIS_URL is not a valid URL ("${raw}"). Falling back to localhost:6379.`,
    );
    return { host: "localhost", port: 6379 };
  }

  const options: ConnectionOptions = {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    // Prevent BullMQ jobs from stalling when Redis is momentarily unavailable.
    enableOfflineQueue: false,
  };

  if (url.password) {
    options.password = decodeURIComponent(url.password);
  }

  // Only set username if it is present and not the ioredis "default" sentinel.
  if (url.username && url.username !== "default") {
    options.username = decodeURIComponent(url.username);
  }

  // TLS: ioredis enables TLS automatically when the scheme is "rediss".
  // BullMQ passes ConnectionOptions through to ioredis, so this works.
  if (url.protocol === "rediss:") {
    options.tls = {};
  }

  return options;
}
