/**
 * Redis singleton client.
 *
 * SECURITY: Set REDIS_URL with a password in production:
 *   REDIS_URL=redis://:YOUR_PASSWORD@localhost:6379
 *
 * To configure Redis to require a password:
 *   1. Edit /etc/redis/redis.conf → set `requirepass YOUR_PASSWORD`
 *   2. Restart Redis: `systemctl restart redis`
 */

import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    // Log but don't crash — Redis is used for background jobs, not critical path
    console.error("[Redis] Connection error:", err.message);
  });

  client.on("connect", () => {
    console.log("[Redis] Connected");
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
