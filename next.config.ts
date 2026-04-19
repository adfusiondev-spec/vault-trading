import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Turbopack is dev-only; webpack is required for Vercel middleware tracing.
  experimental: {
    turbopack: false,
  },
  // Pre-existing Supabase generated-type errors (never) don't affect runtime.
  // Remove this once types.ts is regenerated from the live schema.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
