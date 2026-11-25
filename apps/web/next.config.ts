import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@argos/rdo-schema"],
};

export default nextConfig;
