import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    // Use Docker internal DNS for backend service - evaluated at runtime
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://backend:8080/api/v1/:path*",
      },
      {
        source: "/api/v1/stream/events",
        destination: "http://backend:8080/api/v1/stream/events",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;