import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    // Keep `pnpm lint` as the lint gate; avoid Next build coupling to ESLint patch quirks.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
