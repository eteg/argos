import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@argos/rdo-schema"],
  // Libera o dev server para quem acessa pelo túnel do Cloudflare.
  allowedDevOrigins: ["vitor.eteg.me"],
  // O navegador fala só com a web; a web repassa /v1 para a API. Assim um único host público basta.
  async rewrites() {
    return [{ source: "/v1/:path*", destination: `${process.env.API_INTERNAL_URL ?? "http://localhost:3001"}/v1/:path*` }];
  },
};

export default nextConfig;
