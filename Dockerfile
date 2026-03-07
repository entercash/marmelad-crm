# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-bookworm-slim AS deps

# Prisma query engine requires OpenSSL at both build and runtime.
# bookworm-slim ships OpenSSL 3 (Debian 12), which matches the generated engine.
RUN apt-get update \
 && apt-get install -y openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy lockfile first so layer is cached unless deps actually change.
# npm ci requires package-lock.json — generate it locally with `npm install`
# and commit it before building the Docker image.
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Build the Next.js app ──────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

RUN apt-get update \
 && apt-get install -y openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure the public/ directory exists even if it is empty in the repo.
# The standalone runner copies it, so it must be present.
RUN mkdir -p /app/public

# Purge any stale Prisma artifacts copied from the deps stage.
# npm ci in deps triggers Prisma postinstall which may write a platform-specific
# engine binary (possibly linux-musl if that layer is stale in Docker cache).
# Wiping .prisma here guarantees prisma generate always runs clean on Debian.
RUN rm -rf node_modules/.prisma

# Generate Prisma Client for the current platform (debian-openssl-3.0.x).
# The client is embedded in the standalone output so it ships without the
# full prisma devDependency at runtime.
RUN npx prisma generate

# Disable telemetry during build (also set at runtime via ENV below).
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: Minimal production image ────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

RUN apt-get update \
 && apt-get install -y openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security.
# bookworm uses groupadd/useradd (not Alpine's addgroup/adduser).
RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 --gid nodejs nextjs

# Static public assets (gitkeep ensures the directory always exists in source).
RUN mkdir -p ./public
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The standalone output contains server.js + all required node_modules bundled.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Static Next.js assets (JS chunks, CSS, etc.) served by the built-in server.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# `server.js` is the Next.js standalone entry point.
CMD ["node", "server.js"]
