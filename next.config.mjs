/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build a self-contained server bundle that can run with `node server.js`
  // Required for Docker deployments.
  output: "standalone",

  // Opt out of Next.js telemetry at build time.
  // Also set the env var in Dockerfile / docker-compose for runtime.
  env: {
    NEXT_TELEMETRY_DISABLED: "1",
  },

  // Extend remote image hostnames here as the product grows.
  images: {
    remotePatterns: [],
  },

  // Allow large CSV file uploads via server actions (default is 1 MB).
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },

  // Packages that should NOT be bundled by webpack — loaded from node_modules at runtime.
  // ioredis has native/dynamic requires that break standalone bundling.
  serverExternalPackages: ["ioredis"],

  // ─── Security headers ───────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking — block all framing
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control referrer information sent to other origins
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable DNS prefetching for external domains
          { key: "X-DNS-Prefetch-Control", value: "off" },
          // Force HTTPS for 1 year (including subdomains)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Restrict access to sensitive browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Content Security Policy — restrict resource origins
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
