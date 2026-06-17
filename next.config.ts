import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  serverExternalPackages: [
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "@prisma/client",
    "prisma",
  ],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000", pathname: "/**" },
      { protocol: "https", hostname: "**", pathname: "/**" },
    ],
  },
};

export default nextConfig;
