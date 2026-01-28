import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@solana/spl-token": path.resolve(
        __dirname,
        "lib/shims/solanaSplToken.ts"
      ),
    };
    return config;
  },
};

export default nextConfig;
