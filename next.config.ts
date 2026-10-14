import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // People live in the Explore graph now (people and records are nodes of one orbit): the old
  // People screen opens Explore.
  async redirects() {
    return [{ source: "/people", destination: "/explore", permanent: false }];
  },
  // Test builds (e2e/, npm run e2e:tour) can build into their own folder, so a
  // running server on `.next` is not changed under it.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
