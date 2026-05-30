import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  experimental: {
    externalDir: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@sabjiwala/shared"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@sabjiwala/shared": path.resolve(__dirname, "node_modules/@sabjiwala/shared"),
    };
    return config;
  },
};

export default nextConfig;
