import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — produces an `out/` directory for deployment / CI zip
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
