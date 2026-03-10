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
};

export default nextConfig;
