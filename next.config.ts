import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for Docker
  output: "standalone",

  // Disable Next.js telemetry
  env: {
    NEXT_TELEMETRY_DISABLED: "1",
  },

  // Image domains (extend as needed)
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
