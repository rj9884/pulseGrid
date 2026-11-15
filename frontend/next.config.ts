import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const backendHost = isDevelopment ? "localhost:8080" : "backend:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "localhost:3001"],
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
    // Use localhost in development, Docker internal DNS in production
    return [
      {
        source: "/api/v1/:path*",
        destination: `http://${backendHost}/api/v1/:path*`,
      },
      {
        source: "/api/v1/stream/events",
        destination: `http://${backendHost}/api/v1/stream/events`,
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