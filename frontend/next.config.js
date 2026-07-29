/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    const stub = require("path").resolve(__dirname, "src/lib/stub.js");
    config.resolve.alias = {
      ...config.resolve.alias,
      "@base-org/account": stub,
      "@react-native-async-storage/async-storage": stub,
      "pino-pretty": stub,
    };
    return config;
  },
  turbopack: {},
  async rewrites() {
    return [
      { source: "/", destination: "/index.html" },
      // Proxy whitelist API calls to backend
      { source: "/api/whitelist/:path*", destination: "http://localhost:3002/api/whitelist/:path*" },
    ];
  },
};

module.exports = nextConfig;
