import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { proxyClientMaxBodySize: "50mb", proxyTimeout: 120_000 },
  rewrites: () => Promise.resolve([{ source: "/v1/:path*", destination: `${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/v1/:path*` }]),
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
