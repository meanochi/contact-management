import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // apps/web is presentation-only (ARCHITECTURE-SPINE.md AD-1) — no
  // rewrites/proxying to apps/api here; all calls go through
  // lib/api-client.ts at the application layer (AD-12), not framework config.
  reactStrictMode: true,
};

export default nextConfig;
