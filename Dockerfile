# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy lockfile first so layer is cached unless deps actually change.
# npm ci requires package-lock.json — generate it locally with `npm install`
# and commit it before building the Docker image.
COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Build the Next.js app ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure the public/ directory exists even if it is empty in the repo.
# The standalone runner copies it, so it must be present.
RUN mkdir -p /app/public

# Generate the Prisma client before building Next.js.
# The client is embedded in the standalone output so it ships without the
# full prisma devDependency at runtime.
RUN npx prisma generate

# Disable telemetry during build (also set at runtime via ENV below).
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: Minimal production image ────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

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
