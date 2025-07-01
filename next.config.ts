import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['placehold.co']
  },

  webpack: (config) => {
    config.module.exprContextCritical = false;
    return config;
  },
};

export default nextConfig;
