/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
  // Proxy API calls to backend during development
  async rewrites() {
    return [
      {
        source: '/api/faucet',
        destination: 'http://localhost:3002/api/faucet',
      },
      {
        source: '/api/twitter/:path*',
        destination: 'http://localhost:3002/api/twitter/:path*',
      },
      {
        source: '/api/whitelist/:path*',
        destination: 'http://localhost:3002/api/whitelist/:path*',
      },
    ];
  },
};

export default nextConfig;
